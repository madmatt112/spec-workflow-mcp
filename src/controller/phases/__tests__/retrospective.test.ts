import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { runRetrospectivePhase, type RetrospectivePhaseContext } from '../retrospective.js';
import { openRunLedger } from '../../ledger.js';
import type { RunRecord } from '../../state.js';

// Contract for step (c3), first half (docs/controller-tasks.md T13): the
// retrospective runs in code against the stub `claude`: the preconditions, the
// compile step, the analyst step, the checks on both files, the commit and the
// phase rows; after it, routing reaches the retro-plan wait.

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const STUB = join(ROOT, 'scripts', 'stub-claude.mjs');
const RUN_ID = 'run-20261011-000000';
const NOW = () => new Date('2026-10-11T00:00:00.000Z');
const savedEnv = { ...process.env };

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

interface StubRun { edits?: { path: string; content: string }[]; result: Record<string, unknown> }
interface Fixture { base: string; repo: string; specDir: string; home: string; logs: string; scratch: string; spec: string }

let counter = 0;

function setup(opts: { retroLog?: boolean; openTask?: boolean } = {}): Fixture {
  const spec = `ctrl-retro-${process.pid}-${counter++}`;
  const base = mkdtempSync(join(tmpdir(), 'ctrl-retro-'));
  const repo = join(base, 'repo');
  const wf = join(repo, '.spec-workflow');
  const specDir = join(wf, 'specs', spec);
  mkdirSync(specDir, { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 't@test']);
  git(repo, ['config', 'user.name', 'Tester']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(repo, 'README.md'), 'init\n');
  writeFileSync(join(wf, 'HANDOFF.md'), `# H\n\n## Phase log\n\n| Date | Spec | Stage | State | Result | Note |\n| --- | --- | --- | --- | --- | --- |\n\n## ${spec} — implementation\n\n| Field | Value |\n| --- | --- |\n| State | tasks 1/1 |\n`);
  writeFileSync(join(specDir, 'tasks.md'), `# Tasks\n\n- [${opts.openTask ? ' ' : 'x'}] 1. Do it\n  - File: src/a.js\n`);
  if (opts.retroLog !== false) {
    writeFileSync(join(specDir, 'retrospective-log.md'), `# Retrospective log — ${spec}\n\n## 2026-10-11T00:00:00Z · implementation · task 1 · gotcha\nsomething\nEvidence: task 1\nCost: 1\n`);
  }
  // The implementation phase ended on complete and the PR merged (the routing rule).
  const ledger = openRunLedger({ specDir, runId: RUN_ID, spec, now: NOW });
  ledger.runStart({ model: 'controller' });
  ledger.phaseStart('implementation', { mode: 'normal' });
  ledger.phaseEnd('implementation', { result: 'complete', state: 'tasks 1/1' });
  ledger.prMerged({ number: 1, sha: 'abc', method: 'merge' });
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'init']);
  const home = join(base, 'home');
  const logs = join(base, 'logs');
  const scratch = join(base, 'scratch');
  for (const d of [home, logs, scratch]) mkdirSync(d, { recursive: true });
  process.env.SDD_HOME = home;
  return { base, repo, specDir, home, logs, scratch, spec };
}

function writeScript(fx: Fixture, runs: StubRun[]): void {
  const scriptPath = join(fx.base, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.CONTROLLER_CLAUDE_BIN = STUB;
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;
}

const USAGE = { input_tokens: 5, output_tokens: 50, cache_read_input_tokens: 10, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 20 } };
function result(structured: Record<string, unknown>): Record<string, unknown> {
  return { subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: 'ok', structured_output: structured, usage: USAGE };
}

const FINDINGS = (spec: string): string => [
  `# Retrospective — ${spec}`, '', 'Compiled 2026-10-11 by the retro compiler.', '',
  '## Gotchas', '- **F1 — The thing.** It happened. Evidence: task 1. Frequency: once. Cost: 1 spawn.', '',
  '## Product bugs found', 'None found.', '',
  '## Summary numbers', '| phases | 4 |', '',
  '## Proposal format (for the analyst)', '', 'One proposal per finding.', '',
].join('\n');

const PROPOSALS = (spec: string): string => [
  `# Retrospective proposals — ${spec}`, '', 'Written 2026-10-11 by the retro analyst.', '',
  '## Proposals',
  '- **P1 (F1) — Fix the thing.** Do it.',
  '  Target: harness skills or agents.',
  '  Effort: S. Risk: low: none.',
  '  Prerequisites: none.',
  '  DECISION NEEDED: yes. Ship it?',
  '  - Option A (recommended): ship.',
  '  - Option B: hold.',
  '', '## Graduation candidates', 'None found.', '',
].join('\n');

function compileRun(fx: Fixture): StubRun {
  return { edits: [{ path: `.spec-workflow/specs/${fx.spec}/retrospective.md`, content: FINDINGS(fx.spec) }], result: result({ findings: 1, categories: 'gotchas 1', words: 40, path: 'retrospective.md' }) };
}
function analystRun(fx: Fixture, content?: string): StubRun {
  return { edits: [{ path: `.spec-workflow/specs/${fx.spec}/retrospective-proposals.md`, content: content ?? PROPOSALS(fx.spec) }], result: result({ proposals: 1, decisions: 1, graduation: 0 }) };
}

function ctxFor(fx: Fixture, over: Partial<RetrospectivePhaseContext> = {}): RetrospectivePhaseContext {
  const iso = NOW().toISOString();
  const run: RunRecord = {
    v: 1, id: RUN_ID, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: fx.spec,
    worktree: fx.repo, branch: 'main', status: 'running', created: iso, updated: iso,
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  };
  return {
    run, specStoreRoot: fx.repo, specDir: fx.specDir, codeRoot: fx.repo, mainCheckout: fx.repo,
    ledger: openRunLedger({ specDir: fx.specDir, runId: RUN_ID, spec: fx.spec, now: NOW }),
    stepLogDir: fx.logs, mcpConfig: { mcpServers: {} }, scratchDir: fx.scratch, now: NOW, serialize: (fn) => fn(),
    ...over,
  };
}

function rows(fx: Fixture): Record<string, string>[] {
  return readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, string>);
}

let fx: Fixture | undefined;
beforeEach(() => { chmodSync(STUB, 0o755); });
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value;
  if (fx) { try { rmSync(fx.base, { recursive: true, force: true }); } catch { /* ignore */ } }
  fx = undefined;
});

describe('runRetrospectivePhase', () => {
  it('compiles the findings, runs the analyst, commits, and reports retro-ready', async () => {
    fx = setup();
    writeScript(fx, [compileRun(fx), analystRun(fx)]);

    const outcome = await runRetrospectivePhase(ctxFor(fx));

    expect(outcome).toEqual({ result: 'retro-ready', findings: 1, proposals: 1, decisionsNeeded: 1 });
    expect(existsSync(join(fx.specDir, 'retrospective.md'))).toBe(true);
    expect(existsSync(join(fx.specDir, 'retrospective-proposals.md'))).toBe(true);
    const r = rows(fx);
    expect(r.filter((e) => e.type === 'spawn.usage').map((e) => `${e.agent}:${e.role}`)).toEqual(['sdd-retro-compiler:compile findings', 'sdd-retro-analyst:proposals']);
    expect(r.find((e) => e.type === 'phase.end' && e.phase === 'retrospective')).toMatchObject({ result: 'retro-ready' });
    expect(readFileSync(join(fx.specDir, 'retrospective-log.md'), 'utf8')).toContain('retrospective compiled: 1 findings, 1 proposals, 1 decisions needed');
    expect(git(fx.repo, ['log', '-1', '--format=%s'])).toBe(`docs(sdd): ${fx.spec} retrospective findings and proposals`);
    expect(readFileSync(join(fx.repo, '.spec-workflow', 'HANDOFF.md'), 'utf8')).toMatch(/\| retrospective \| +\| retro-ready \|/);
    // The briefs carry the roots and the format.
    expect(readFileSync(join(fx.scratch, 'retro-compile-brief.md'), 'utf8')).toContain('## Proposal format (for the analyst)');
    expect(readFileSync(join(fx.scratch, 'retro-analyst-brief.md'), 'utf8')).toContain(`retrospective.md`);
  }, 30000);

  it('re-enters after the compile step without compiling again, and returns at once once retro-ready', async () => {
    fx = setup();
    writeFileSync(join(fx.specDir, 'retrospective.md'), FINDINGS(fx.spec));
    writeScript(fx, [analystRun(fx)]); // no compile step scripted

    const first = await runRetrospectivePhase(ctxFor(fx));
    expect(first.result).toBe('retro-ready');
    expect(rows(fx).filter((e) => e.type === 'spawn.usage').map((e) => e.agent)).toEqual(['sdd-retro-analyst']);

    const second = await runRetrospectivePhase(ctxFor(fx));
    expect(second).toEqual({ result: 'retro-ready', findings: 1, proposals: 1, decisionsNeeded: 1 });
    expect(rows(fx).filter((e) => e.type === 'phase.start' && e.phase === 'retrospective')).toHaveLength(1);
  }, 30000);

  it('refuses a spec with an open task', async () => {
    fx = setup({ openTask: true });
    writeScript(fx, []);
    const outcome = await runRetrospectivePhase(ctxFor(fx));
    expect(outcome.result).toBe('error');
    expect(outcome.reason).toMatch(/spec not complete \(1 open/);
  });

  it('writes the no-harness-log findings file and errors when the retro log is missing', async () => {
    fx = setup({ retroLog: false });
    writeScript(fx, []);
    const outcome = await runRetrospectivePhase(ctxFor(fx));
    expect(outcome).toMatchObject({ result: 'error', reason: 'no retrospective log' });
    expect(readFileSync(join(fx.specDir, 'retrospective.md'), 'utf8')).toContain('## No harness log');
  });

  it('errors when the analyst leaves out the graduation section', async () => {
    fx = setup();
    writeScript(fx, [compileRun(fx), analystRun(fx, '# proposals\n\n## Proposals\n- **P1 (F1) — x.** y.\n')]);
    const outcome = await runRetrospectivePhase(ctxFor(fx));
    expect(outcome.result).toBe('error');
    expect(outcome.reason).toMatch(/Graduation candidates/);
    expect(rows(fx).find((e) => e.type === 'phase.end' && e.phase === 'retrospective')).toMatchObject({ result: 'error' });
  }, 30000);
});
