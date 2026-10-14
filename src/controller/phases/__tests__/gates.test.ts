import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { runDocumentPhase, type DocumentPhaseContext, type DocumentPhase, type GateDecision } from '../document.js';
import { createDocumentGates, rankDecisions, parseVetoTags } from '../gates.js';
import { openRunLedger } from '../../ledger.js';
import { listWaits, type RunRecord } from '../../state.js';
import { answerWait, type ControllerWaitRecord } from '../../waits.js';
import { approvalsHandler } from '../../../tools/approvals.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, '..', '..', '..', '..', 'scripts', 'stub-claude.mjs');
const SPEC = 'ctrl-doc';
const savedEnv = { ...process.env };

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

const USAGE = {
  input_tokens: 5, output_tokens: 50, cache_read_input_tokens: 10,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 20 },
};

interface StubRun { edits?: { path: string; content: string }[]; result: Record<string, unknown>; }

/** A lint-clean requirements document with a v1..version Revision History. */
function reqDoc(version: number): string {
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

/** A lint-clean, approval-valid tasks document with a v1..version Revision History. */
function tasksDoc(version: number): string {
  const history = ['- **v1** (2026-10-11) — Initial draft.'];
  for (let v = 2; v <= version; v++) history.push(`- **v${v}** (2026-10-11) — Gate-B annotation.`);
  return [
    '# Tasks Document', '',
    'Document version: v' + version, '',
    '- [ ] 1. Add the data migration runner',
    '  - File: src/db/migrate.ts',
    '  - _Requirements: 1.1_',
    '  - _Prompt: Task: add the runner | Restrictions: none | Success: migrations run_', '',
    '- [ ] 2. Wire the settings page',
    '  - File: src/ui/settings.ts',
    '  - _Requirements: 1.2_',
    '  - _Prompt: Task: wire it | Restrictions: none | Success: page renders_', '',
    '- [ ] 3. Add tests for the runner',
    '  - File: src/db/__tests__/runner.test.ts',
    '  - _Requirements: 1.1_',
    '  - _Prompt: Task: cover it | Restrictions: none | Success: tests pass_', '',
    '## Revision History', ...history,
    '- **D4 — Rejected (SHOULD_FIX).** [gate-b:T2] a new external dependency, intentionally kept.', '',
  ].join('\n');
}

function decisions(n: number): GateDecision[] {
  return Array.from({ length: n }, (_v, i) => ({
    id: `D${i + 1}`, text: `Decision ${i + 1}: a scope call`, options: ['A', 'B'], recommended: 'A',
  }));
}

function docRel(phase: DocumentPhase): string {
  return `.spec-workflow/specs/${SPEC}/${phase}.md`;
}

function drafterRun(phase: DocumentPhase, content: string, decisionList: GateDecision[] = []): StubRun {
  return {
    edits: [
      { path: docRel(phase), content },
      { path: `.spec-workflow/specs/${SPEC}/codebase-context.md`, content: `# Codebase context — ${SPEC}\n` },
    ],
    result: {
      subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: 'drafted',
      structured_output: { wordCount: 40, decisions: decisionList, contextFileWritten: true }, usage: USAGE,
    },
  };
}

function reviewerRun(phase: DocumentPhase, verdict: 'converged' | 'iterate', suffix: string): StubRun {
  return {
    edits: [{ path: `.spec-workflow/specs/${SPEC}/reviews/adversarial-analysis-${phase}${suffix}.md`, content: `VERDICT: ${verdict}\n` }],
    result: {
      subtype: 'success', is_error: false, num_turns: 2, session_id: 's', result: 'reviewed',
      structured_output: { verdict, mustFix: [], shouldFix: [], recurring: [], escalate: 'none', analysisPath: '' },
      usage: USAGE,
    },
  };
}

function reviserRun(phase: DocumentPhase, content: string): StubRun {
  return {
    edits: [{ path: docRel(phase), content }],
    result: { subtype: 'success', is_error: false, num_turns: 2, session_id: 's', result: 'revised', usage: USAGE },
  };
}

interface Fixture { base: string; repo: string; specDir: string; home: string; logs: string; }

function setup(): Fixture {
  const base = mkdtempSync(join(tmpdir(), 'ctrl-gates-'));
  const repo = join(base, 'repo');
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

let runCounter = 0;
function makeContext(fx: Fixture, phase: DocumentPhase, runs: StubRun[]): DocumentPhaseContext {
  const scriptPath = join(fx.base, `script-${phase}-${runCounter++}.json`);
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
    run, phase, specStoreRoot: fx.repo, specDir: fx.specDir, codeRoot: fx.repo,
    ledger, stepLogDir: fx.logs, mcpConfig: { mcpServers: {} }, gates: createDocumentGates(),
  };
}

function ledgerRows(fx: Fixture): Record<string, string>[] {
  const text = readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8');
  return text.split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}
function reviserStarts(fx: Fixture): number {
  return ledgerRows(fx).filter((r) => r.type === 'spawn.start' && r.agent === 'sdd-reviser').length;
}
function commitSubjects(fx: Fixture): string[] {
  return git(fx.repo, ['log', '--format=%s']).split('\n').filter(Boolean);
}
function handoff(fx: Fixture): string {
  const inside = join(fx.repo, '.spec-workflow', 'HANDOFF.md');
  const outside = join(fx.repo, 'HANDOFF.md');
  return existsSync(inside) ? readFileSync(inside, 'utf8')
    : existsSync(outside) ? readFileSync(outside, 'utf8') : '';
}
async function approvedCount(fx: Fixture): Promise<number> {
  const res = await approvalsHandler(
    { action: 'list', categoryName: SPEC, status: 'approved', projectPath: fx.repo },
    { projectPath: fx.repo, workspacePath: fx.repo },
  );
  return (res.data as { approvals: unknown[] }).approvals.length;
}
async function waitById(id: string): Promise<ControllerWaitRecord | undefined> {
  return (await listWaits()).find((w) => w.id === id) as ControllerWaitRecord | undefined;
}

let fx: Fixture;
beforeEach(() => { chmodSync(STUB, 0o755); fx = setup(); });
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value;
  try { rmSync(fx.base, { recursive: true, force: true }); } catch { /* ignore */ }
});

describe('rankDecisions / parseVetoTags (pure)', () => {
  it('ranks decisions with a genuine choice ahead of the rest, order stable', () => {
    const ranked = rankDecisions([
      { id: 'D1', text: 'mechanic', options: ['only'] },
      { id: 'D2', text: 'scope', options: ['A', 'B'] },
      { id: 'D3', text: 'outcome', options: ['X', 'Y'] },
    ]);
    expect(ranked.map((d) => d.id)).toEqual(['D2', 'D3', 'D1']);
  });

  it('keeps only Rejected gate-b/gate-c tags, dropping Accepted ones', () => {
    const md = [
      '- **D2 — Rejected (SHOULD_FIX).** [gate-b:T1] kept a new dependency on purpose.',
      '- **D3 — Accepted (MUST_FIX).** [gate-c:T2] removed the extra work.',
    ].join('\n');
    const tags = parseVetoTags(md);
    expect(tags).toHaveLength(1);
    expect(tags[0]).toMatchObject({ taskId: '1', class: 'b' });
  });
});

describe('gate A (requirements)', () => {
  it('asks five of seven decisions; two changed answers run one reviser step', async () => {
    const ctx = makeContext(fx, 'requirements', [
      drafterRun('requirements', reqDoc(1), decisions(7)),
      reviserRun('requirements', reqDoc(2)),
      reviewerRun('requirements', 'converged', ''),
    ]);

    const parked = await runDocumentPhase(ctx);
    expect(parked.result).toBe('waiting');
    expect(parked.waitId).toBeTruthy();

    const wait = await waitById(parked.waitId!);
    expect(wait?.kind).toBe('gate-a');
    expect(wait?.questions).toHaveLength(5);
    expect(wait?.proposals).toHaveLength(2); // the two decisions recorded without asking
    expect(reviserStarts(fx)).toBe(0);

    await answerWait(parked.waitId!, { D1: 'B', D2: 'B', D3: 'A', D4: 'A', D5: 'A' }, 'tester');

    const done = await runDocumentPhase(ctx);
    expect(done).toMatchObject({ result: 'approved', version: 2 });
    expect(reviserStarts(fx)).toBe(1); // the changed answers produced one reviser
    expect(commitSubjects(fx)).toContain(`docs(sdd): ${SPEC} requirements v2 gate-A revision`);
    expect(await approvedCount(fx)).toBe(1);
  });

  it('runs no reviser when every answer is unchanged', async () => {
    const ctx = makeContext(fx, 'requirements', [
      drafterRun('requirements', reqDoc(1), decisions(7)),
      reviewerRun('requirements', 'converged', ''),
    ]);

    const parked = await runDocumentPhase(ctx);
    expect(parked.result).toBe('waiting');
    await answerWait(parked.waitId!, { D1: 'A', D2: 'A', D3: 'A', D4: 'A', D5: 'A' }, 'tester');

    const done = await runDocumentPhase(ctx);
    expect(done).toMatchObject({ result: 'approved', version: 1 });
    expect(reviserStarts(fx)).toBe(0);
    expect(await approvedCount(fx)).toBe(1);
  });

  it('resumes at the open gate on re-entry instead of restarting the phase', async () => {
    const ctx = makeContext(fx, 'requirements', [
      drafterRun('requirements', reqDoc(1), decisions(7)),
      reviewerRun('requirements', 'converged', ''),
    ]);

    const parked = await runDocumentPhase(ctx);
    expect(parked.result).toBe('waiting');

    // Re-enter before answering: still waiting on the same wait, no re-draft.
    const again = await runDocumentPhase(ctx);
    expect(again.result).toBe('waiting');
    expect(again.waitId).toBe(parked.waitId);
    expect(ledgerRows(fx).filter((r) => r.type === 'spawn.start' && r.agent === 'sdd-drafter')).toHaveLength(1);
    expect(ledgerRows(fx).filter((r) => r.type === 'phase.start')).toHaveLength(1);

    await answerWait(parked.waitId!, { D1: 'A', D2: 'A', D3: 'A', D4: 'A', D5: 'A' }, 'tester');
    const done = await runDocumentPhase(ctx);
    expect(done).toMatchObject({ result: 'approved', version: 1 });
  });
});

describe('gate B (tasks)', () => {
  /** Seed an approved tasks document at v1 (committed, with an approval record). */
  async function seedApprovedTasks(): Promise<void> {
    writeFileSync(join(fx.specDir, 'tasks.md'), tasksDoc(1));
    git(fx.repo, ['add', '-A']);
    git(fx.repo, ['commit', '-q', '-m', `docs(sdd): ${SPEC} tasks v1`]);
    const req = await approvalsHandler({
      action: 'request', title: `${SPEC} tasks v1`, filePath: docRel('tasks'),
      type: 'document', category: 'spec', categoryName: SPEC, projectPath: fx.repo,
    }, { projectPath: fx.repo, workspacePath: fx.repo });
    const approvalId = (req.data as { approvalId: string }).approvalId;
    await approvalsHandler({ action: 'approve', approvalId, projectPath: fx.repo, response: 'ok' }, { projectPath: fx.repo, workspacePath: fx.repo });
  }

  it('builds the veto list and parks, then an annotation runs one reviser and re-approves', async () => {
    process.env.SDD_HOME = fx.home;
    await seedApprovedTasks();

    const gates = createDocumentGates();
    const dir = await gates.gateB({
      run: { v: 1, id: 'run-20261011-010101', project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
        worktree: fx.repo, branch: 'main', status: 'running', created: 'x', updated: 'x',
        tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 } },
      specDir: fx.specDir, specStoreRoot: fx.repo, codeRoot: fx.repo, version: 1,
    });
    expect(dir.kind).toBe('waiting');
    const waitId = (dir as { waitId: string }).waitId;
    const wait = await waitById(waitId);
    expect(wait?.kind).toBe('gate-b');
    // The plan and the ranked veto list (task 1 by its migration keyword and its
    // kept gate-b tag) ride the wait's proposals.
    expect((wait?.proposals ?? []).some((p) => /Plan approved at v1/.test(p))).toBe(true);
    expect((wait?.proposals ?? []).some((p) => /veto .*task 1/.test(p))).toBe(true);

    await answerWait(waitId, { 'gate-b': 'Split task 1 into two tasks.' }, 'tester');

    const ctx = makeContext(fx, 'tasks', [reviserRun('tasks', tasksDoc(2))]);
    const done = await runDocumentPhase(ctx);
    expect(done).toMatchObject({ result: 'approved', version: 2 });
    expect(reviserStarts(fx)).toBe(1);
    expect(commitSubjects(fx)).toContain(`docs(sdd): ${SPEC} tasks v2 gate-B annotation`);
    expect(await approvedCount(fx)).toBe(1); // re-approved at v2, old pruned
  });

  it('an approve reply finalizes the approved version with no reviser', async () => {
    process.env.SDD_HOME = fx.home;
    await seedApprovedTasks();

    const gates = createDocumentGates();
    const run: RunRecord = {
      v: 1, id: 'run-20261011-010101', project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: SPEC,
      worktree: fx.repo, branch: 'main', status: 'running', created: 'x', updated: 'x',
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    };
    const dir = await gates.gateB({ run, specDir: fx.specDir, specStoreRoot: fx.repo, codeRoot: fx.repo, version: 1 });
    const waitId = (dir as { waitId: string }).waitId;
    await answerWait(waitId, { 'gate-b': 'Approve' }, 'tester');

    const ctx = makeContext(fx, 'tasks', []);
    const done = await runDocumentPhase(ctx);
    expect(done).toMatchObject({ result: 'approved', version: 1 });
    expect(reviserStarts(fx)).toBe(0);
    expect(handoff(fx)).toContain(`## ${SPEC} — tasks`);
    expect(await approvedCount(fx)).toBe(1);
  });

  it('records phase.end approved before parking at gate B (retro P4)', async () => {
    process.env.SDD_HOME = fx.home;
    const ctx = makeContext(fx, 'tasks', [
      drafterRun('tasks', tasksDoc(1)),
      reviewerRun('tasks', 'converged', ''),
    ]);

    const parked = await runDocumentPhase(ctx);
    expect(parked.result).toBe('waiting');

    // The tasks document is approved the moment it converges; the phase.end row is
    // written before gate B parks the run, so the phase-log reconstructs
    // v1/approved rather than a false interrupted row for an approved phase.
    const ends = ledgerRows(fx).filter((r) => r.type === 'phase.end' && r.phase === 'tasks');
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ result: 'approved', state: 'v1' });
  });
});
