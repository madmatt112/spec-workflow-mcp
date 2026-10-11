import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync, chmodSync, rmSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { runDocumentPhase, NO_OP_GATES, type DocumentPhaseContext, type DocumentGates } from '../document.js';
import { openRunLedger } from '../../ledger.js';
import type { RunRecord } from '../../state.js';
import { approvalsHandler } from '../../../tools/approvals.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, '..', '..', '..', '..', 'scripts', 'stub-claude.mjs');
const SPEC = 'ctrl-doc';
const DOC_REL = `.spec-workflow/specs/${SPEC}/requirements.md`;
const CTX_REL = `.spec-workflow/specs/${SPEC}/codebase-context.md`;
const ANALYSIS = (suffix: string) =>
  `.spec-workflow/specs/${SPEC}/reviews/adversarial-analysis-requirements${suffix}.md`;

const savedEnv = { ...process.env };

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

/** A lint-clean requirements document carrying a v1..version Revision History. */
function cleanDoc(version: number): string {
  const history = ['- **v1** (2026-10-11) — Initial draft.'];
  for (let v = 2; v <= version; v++) history.push(`- **v${v}** (2026-10-11) — Round response.`);
  return [
    '# Requirements Document', '',
    '## Introduction',
    'The controller drafts documents. It serves the operator. It changes nothing else.', '',
    '## Requirements',
    'The controller SHALL draft, review and approve each document in order.', '',
    '## Revision History', ...history, '',
  ].join('\n');
}

/** v1 with a bare angle bracket outside code: one MDX `error` finding. */
function dirtyDoc(): string {
  return cleanDoc(1).replace('It changes nothing else.', 'It changes the <WidgetState> shape outside code.');
}

const USAGE = {
  input_tokens: 5, output_tokens: 50, cache_read_input_tokens: 10,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 20 },
};

interface StubRun {
  edits?: { path: string; content: string }[];
  result: Record<string, unknown>;
}

function drafterRun(content: string): StubRun {
  return {
    edits: [
      { path: DOC_REL, content },
      { path: CTX_REL, content: `# Codebase context — ${SPEC}\n` },
    ],
    result: {
      subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: 'drafted',
      structured_output: { wordCount: 40, decisions: [], contextFileWritten: true }, usage: USAGE,
    },
  };
}

function reviewerRun(opts: {
  verdict: 'converged' | 'iterate'; mustFix?: string[]; shouldFix?: string[];
  escalate?: string; suffix: string;
}): StubRun {
  return {
    edits: [{ path: ANALYSIS(opts.suffix), content: `analysis\nVERDICT: ${opts.verdict}\n` }],
    result: {
      subtype: 'success', is_error: false, num_turns: 2, session_id: 's', result: 'reviewed',
      structured_output: {
        verdict: opts.verdict, mustFix: opts.mustFix ?? [], shouldFix: opts.shouldFix ?? [],
        recurring: [], escalate: opts.escalate ?? 'none', analysisPath: '',
      },
      usage: USAGE,
    },
  };
}

function reviserRun(content: string): StubRun {
  return {
    edits: [{ path: DOC_REL, content }],
    result: { subtype: 'success', is_error: false, num_turns: 2, session_id: 's', result: 'revised', usage: USAGE },
  };
}

function checkerRun(suffix: string): StubRun {
  return {
    edits: [{ path: ANALYSIS(suffix), content: 'narrow check\nVERIFIED: 1/1\n' }],
    result: {
      subtype: 'success', is_error: false, num_turns: 1, session_id: 's', result: 'checked',
      structured_output: { verified: true, items: [{ item: 'S-1', status: 'addressed' }] }, usage: USAGE,
    },
  };
}

interface Fixture { base: string; repo: string; specDir: string; home: string; logs: string; }

function setup(): Fixture {
  const base = mkdtempSync(join(tmpdir(), 'ctrl-doc-'));
  const repo = join(base, 'repo'); // spec store root == code root == worktree
  const specDir = join(repo, '.spec-workflow', 'specs', SPEC);
  mkdirSync(specDir, { recursive: true });
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 't@test']);
  git(repo, ['config', 'user.name', 'Tester']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(repo, 'README.md'), 'init\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'init']);
  const home = join(base, 'home');
  const logs = join(base, 'logs');
  mkdirSync(home, { recursive: true });
  mkdirSync(logs, { recursive: true });
  return { base, repo, specDir, home, logs };
}

function makeContext(fx: Fixture, runs: StubRun[], gates?: DocumentGates): DocumentPhaseContext {
  const scriptPath = join(fx.base, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.CONTROLLER_CLAUDE_BIN = STUB;
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;
  process.env.SDD_HOME = fx.home;
  const runId = 'run-20261011-010101';
  const ledger = openRunLedger({ specDir: fx.specDir, runId, spec: SPEC });
  const run: RunRecord = {
    v: 1, id: runId, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
    worktree: fx.repo, branch: 'main', status: 'running',
    created: '2026-10-11T00:00:00Z', updated: '2026-10-11T00:00:00Z',
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  };
  return {
    run, phase: 'requirements', specStoreRoot: fx.repo, specDir: fx.specDir, codeRoot: fx.repo,
    ledger, stepLogDir: fx.logs, mcpConfig: { mcpServers: {} }, gates: gates ?? NO_OP_GATES,
  };
}

function ledgerRows(fx: Fixture): Record<string, string>[] {
  const text = readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8');
  return text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

function commitSubjects(fx: Fixture): string[] {
  return git(fx.repo, ['log', '--format=%s']).split('\n').filter(Boolean);
}

function reviews(fx: Fixture): string[] {
  try { return readdirSync(join(fx.specDir, 'reviews')); } catch { return []; }
}

function handoff(fx: Fixture): string {
  const inside = join(fx.repo, '.spec-workflow', 'HANDOFF.md');
  const outside = join(fx.repo, 'HANDOFF.md');
  return existsSync(inside) ? readFileSync(inside, 'utf8')
    : existsSync(outside) ? readFileSync(outside, 'utf8') : '';
}

async function approvedRecords(fx: Fixture) {
  const res = await approvalsHandler(
    { action: 'list', categoryName: SPEC, status: 'approved', projectPath: fx.repo },
    { projectPath: fx.repo, workspacePath: fx.repo },
  );
  return (res.data as { approvals: { filePath: string }[] }).approvals;
}

let fx: Fixture;

beforeEach(() => {
  chmodSync(STUB, 0o755);
  fx = setup();
});

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value;
  try { rmSync(fx.base, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('runDocumentPhase', () => {
  it('converges at round 1 and approves', async () => {
    const ctx = makeContext(fx, [
      drafterRun(cleanDoc(1)),
      reviewerRun({ verdict: 'converged', suffix: '' }),
    ]);
    const outcome = await runDocumentPhase(ctx);

    expect(outcome).toMatchObject({ result: 'approved', version: 1, rounds: 1 });
    expect(commitSubjects(fx)).toEqual([
      `docs(sdd): ${SPEC} requirements approved at v1`,
      `docs(sdd): ${SPEC} requirements v1`,
      'init',
    ]);

    const rows = ledgerRows(fx);
    expect(rows.filter((r) => r.type === 'phase.start')).toHaveLength(1);
    expect(rows.filter((r) => r.type === 'spawn.start').map((r) => r.agent))
      .toEqual(['sdd-drafter', 'sdd-reviewer']);
    expect(rows.filter((r) => r.type === 'spawn.end')).toHaveLength(2);
    expect(rows.filter((r) => r.type === 'spawn.usage')).toHaveLength(2);
    const roundRows = rows.filter((r) => r.type === 'round');
    expect(roundRows).toHaveLength(1);
    expect(roundRows[0]).toMatchObject({ round: '1', version: 'v1', verdict: 'converged 0/0/0' });
    const end = rows.filter((r) => r.type === 'phase.end');
    expect(end).toHaveLength(1);
    expect(end[0]).toMatchObject({ phase: 'requirements', result: 'approved', state: 'v1' });

    const approvals = await approvedRecords(fx);
    expect(approvals).toHaveLength(1);
    expect(approvals[0].filePath).toContain(`${SPEC}/requirements.md`);

    expect(handoff(fx)).toContain(`## ${SPEC} — requirements`);
    expect(handoff(fx)).toContain('| Approval |');

    const files = reviews(fx);
    expect(files.some((f) => f.startsWith('adversarial-prompt-'))).toBe(false);
    expect(files.some((f) => f.includes('-brief-'))).toBe(false);
    expect(files.some((f) => f.startsWith('adversarial-analysis-'))).toBe(true);
    expect(existsSync(join(fx.specDir, 'codebase-context.md'))).toBe(true);
  });

  it('iterates twice then converges', async () => {
    const ctx = makeContext(fx, [
      drafterRun(cleanDoc(1)),
      reviewerRun({ verdict: 'iterate', mustFix: ['M1'], suffix: '' }),
      reviserRun(cleanDoc(2)),
      reviewerRun({ verdict: 'iterate', mustFix: ['M2'], suffix: '-r2' }),
      reviserRun(cleanDoc(3)),
      reviewerRun({ verdict: 'converged', suffix: '-r3' }),
    ]);
    const outcome = await runDocumentPhase(ctx);

    expect(outcome).toMatchObject({ result: 'approved', version: 3, rounds: 3 });
    expect(commitSubjects(fx)).toEqual([
      `docs(sdd): ${SPEC} requirements approved at v3`,
      `docs(sdd): ${SPEC} requirements v3 after round 2`,
      `docs(sdd): ${SPEC} requirements v2 after round 1`,
      `docs(sdd): ${SPEC} requirements v1`,
      'init',
    ]);

    const rows = ledgerRows(fx);
    const roundRows = rows.filter((r) => r.type === 'round');
    expect(roundRows.map((r) => `${r.version}:${r.verdict}`)).toEqual([
      'v1:iterate 1/0/0', 'v2:iterate 1/0/0', 'v3:converged 0/0/0',
    ]);
    expect(rows.filter((r) => r.type === 'spawn.start')).toHaveLength(6);
    expect(rows.filter((r) => r.type === 'phase.end')[0]).toMatchObject({ result: 'approved', state: 'v3' });
    expect(await approvedRecords(fx)).toHaveLength(1);
  });

  it('runs the SHOULD_FIX-only pass with a narrow check', async () => {
    const ctx = makeContext(fx, [
      drafterRun(cleanDoc(1)),
      reviewerRun({ verdict: 'iterate', mustFix: ['M1'], suffix: '' }),
      reviserRun(cleanDoc(2)),
      reviewerRun({ verdict: 'iterate', shouldFix: ['S1'], suffix: '-r2' }),
      reviserRun(cleanDoc(3)),
      checkerRun('-r3'),
    ]);
    const outcome = await runDocumentPhase(ctx);

    expect(outcome).toMatchObject({ result: 'approved', version: 3, rounds: 3 });
    expect(commitSubjects(fx)).toEqual([
      `docs(sdd): ${SPEC} requirements approved at v3`,
      `docs(sdd): ${SPEC} requirements v3 SHOULD_FIX-only corrective pass`,
      `docs(sdd): ${SPEC} requirements v2 after round 1`,
      `docs(sdd): ${SPEC} requirements v1`,
      'init',
    ]);

    const rows = ledgerRows(fx);
    expect(rows.filter((r) => r.type === 'spawn.start').map((r) => r.agent)).toEqual([
      'sdd-drafter', 'sdd-reviewer', 'sdd-reviser', 'sdd-reviewer', 'sdd-reviser', 'sdd-checker',
    ]);
    // Two review rounds in the ledger; the narrow check is not a `round` row.
    expect(rows.filter((r) => r.type === 'round')).toHaveLength(2);
    expect(await approvedRecords(fx)).toHaveLength(1);
  });

  it('fixes a lint finding before round 1', async () => {
    const ctx = makeContext(fx, [
      drafterRun(dirtyDoc()),
      reviserRun(cleanDoc(1)), // the lint-fix reviser
      reviewerRun({ verdict: 'converged', suffix: '' }),
    ]);
    const outcome = await runDocumentPhase(ctx);

    expect(outcome).toMatchObject({ result: 'approved', version: 1, rounds: 1 });
    expect(commitSubjects(fx)).toEqual([
      `docs(sdd): ${SPEC} requirements approved at v1`,
      `docs(sdd): ${SPEC} requirements v1 lint`,
      `docs(sdd): ${SPEC} requirements v1`,
      'init',
    ]);
    // The lint-fix reviser ran between the drafter and the reviewer.
    const rows = ledgerRows(fx);
    expect(rows.filter((r) => r.type === 'spawn.start').map((r) => r.agent)).toEqual([
      'sdd-drafter', 'sdd-reviser', 'sdd-reviewer',
    ]);
    expect(readFileSync(join(fx.specDir, 'requirements.md'), 'utf8')).not.toContain('<WidgetState>');
    expect(await approvedRecords(fx)).toHaveLength(1);
  });

  it('escalates on an ESCALATE verdict', async () => {
    const ctx = makeContext(fx, [
      drafterRun(cleanDoc(1)),
      reviewerRun({ verdict: 'iterate', mustFix: ['M1'], escalate: 'security: a secret is logged', suffix: '' }),
    ]);
    const outcome = await runDocumentPhase(ctx);

    expect(outcome).toMatchObject({ result: 'escalate', version: 1, rounds: 1, reason: 'security: a secret is logged' });
    const rows = ledgerRows(fx);
    const notes = rows.filter((r) => r.type === 'note');
    expect(notes).toHaveLength(1);
    expect(notes[0].text).toContain('security: a secret is logged');
    // No approval, no phase.end on an escalate.
    expect(rows.filter((r) => r.type === 'phase.end')).toHaveLength(0);
    expect(await approvedRecords(fx)).toHaveLength(0);
    // Only the v1 checkpoint was committed.
    expect(commitSubjects(fx)).toEqual([`docs(sdd): ${SPEC} requirements v1`, 'init']);
  });

  it('returns a cap error when a v4 review still iterates (T5b owns adjudication)', async () => {
    const ctx = makeContext(fx, [
      drafterRun(cleanDoc(1)),
      reviewerRun({ verdict: 'iterate', mustFix: ['M1'], suffix: '' }),
      reviserRun(cleanDoc(2)),
      reviewerRun({ verdict: 'iterate', mustFix: ['M2'], suffix: '-r2' }),
      reviserRun(cleanDoc(3)),
      reviewerRun({ verdict: 'iterate', mustFix: ['M3'], suffix: '-r3' }),
      reviserRun(cleanDoc(4)),
      reviewerRun({ verdict: 'iterate', mustFix: ['M4'], suffix: '-r4' }),
    ]);
    const outcome = await runDocumentPhase(ctx);
    expect(outcome).toMatchObject({ result: 'error', version: 4, reason: 'cap' });
    expect(await approvedRecords(fx)).toHaveLength(0);
  });

  it('returns an error when a step hits the usage limit', async () => {
    const ctx = makeContext(fx, [
      {
        edits: [{ path: DOC_REL, content: cleanDoc(1) }, { path: CTX_REL, content: `# Codebase context — ${SPEC}\n` }],
        result: {
          subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: 'drafted',
          structured_output: { wordCount: 40, decisions: [], contextFileWritten: true }, usage: USAGE,
        },
      },
      {
        edits: [{ path: ANALYSIS(''), content: 'x' }],
        // A rejecting rate_limit_event makes runStep classify this `usage-limit`.
        result: {
          subtype: 'error_during_execution', is_error: true, num_turns: 1, session_id: 's', result: '', usage: {},
        },
      } as StubRun,
    ]);
    // Inject the rate-limit stream event for the reviewer run.
    const script = JSON.parse(readFileSync(join(fx.base, 'script.json'), 'utf8')) as StubRun[];
    (script[1] as unknown as { stream: unknown[] }).stream = [{
      type: 'rate_limit_event',
      rate_limit_info: { status: 'rejected', unifiedWindows: { five_hour: { utilization: 0.99, resetsAt: 1 }, seven_day: { utilization: 0.5, resetsAt: 2 } } },
    }];
    writeFileSync(join(fx.base, 'script.json'), JSON.stringify(script));

    const outcome = await runDocumentPhase(ctx);
    expect(outcome.result).toBe('error');
    expect(outcome.reason).toBe('usage-limit');
    expect(await approvedRecords(fx)).toHaveLength(0);
  });
});
