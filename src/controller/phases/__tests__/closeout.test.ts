import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { runCloseoutPhase, itemPaths, parseItemLines, type CloseoutPhaseContext } from '../closeout.js';
import { openRunLedger } from '../../ledger.js';
import type { RunRecord } from '../../state.js';

// Contract for step (c3), second half (docs/controller-tasks.md T14): close-out
// runs in code against the stub `claude` and the stub `gh`: items classed by
// their Target line, `none` items closed without a step, one implementer batch
// per class landed in its place (the store's branch, a retro worktree), the gate
// per done item, the verifier at high risk, fix rounds, the close-out lines, the
// PR per repository, the CLOSED plan.

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..', '..');
const STUB = join(ROOT, 'scripts', 'stub-claude.mjs');
const STUB_GH = join(ROOT, 'scripts', 'stub-gh.mjs');
const RUN_ID = 'run-20261011-000000';
const NOW = () => new Date('2026-10-11T00:00:00.000Z');
const savedEnv = { ...process.env };

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

interface StubRun { edits?: { path: string; content: string }[]; commands?: string[]; result: Record<string, unknown> }
interface Fixture { base: string; repo: string; specDir: string; home: string; logs: string; scratch: string; spec: string; claudeHome: string }

let counter = 0;

function plan(spec: string, items: string[]): string {
  return [`# Retrospective plan — ${spec}`, '', 'Status: APPROVED', 'Date: 2026-10-11', '', '## Approved proposals', '', ...items, '', '## Decisions', 'None.', '', '## Rejected proposals', 'None.', ''].join('\n');
}

const P_NONE = ['- **P1 (F1) — Keep the ledger as it is.** Nothing to change.', '  Target: none.', '  Decision: ratified as it stands.'].join('\n');
const P_STORE = ['- **P2 (F2) — Name the typecheck rule.** Add `typecheck: none` to `.spec-workflow/agent-rules.md`.', '  Target: agent-rules.md.', '  Decision: add the line.'].join('\n');
const P_CODE = ['- **P3 (F3) — Add a README line.** Append one line to `README.md`.', '  Target: product code.', '  Decision: do it.'].join('\n');
const P_HARNESS = ['- **P4 (F4) — Tidy the skill.** Add a note to `harness/notes.md`.', '  Target: harness skills or agents.', '  Decision: do it.'].join('\n');

function setup(items: string[], opts: { sensitive?: string } = {}): Fixture {
  const spec = `ctrl-close-${process.pid}-${counter++}`;
  const base = mkdtempSync(join(tmpdir(), 'ctrl-close-'));
  const repo = join(base, 'repo');
  const wf = join(repo, '.spec-workflow');
  const specDir = join(wf, 'specs', spec);
  mkdirSync(specDir, { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 't@test']);
  git(repo, ['config', 'user.name', 'Tester']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(repo, 'README.md'), 'init\n');
  writeFileSync(join(wf, 'agent-rules.md'), `# Agent rules\n\nmerge: auto\n\n## Sensitive paths\n\n- ${opts.sensitive ?? 'package.json'}\n`);
  writeFileSync(join(wf, 'HANDOFF.md'), `# H\n\n## Phase log\n\n| Date | Spec | Stage | State | Result | Note |\n| --- | --- | --- | --- | --- | --- |\n`);
  writeFileSync(join(specDir, 'tasks.md'), '# Tasks\n\n- [x] 1. Done\n');
  writeFileSync(join(specDir, 'retrospective-log.md'), `# Retrospective log — ${spec}\n`);
  writeFileSync(join(specDir, 'retrospective-plan.md'), plan(spec, items));
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'init']);
  const home = join(base, 'home');
  const logs = join(base, 'logs');
  const scratch = join(base, 'scratch');
  const claudeHome = join(base, 'claude-home');
  for (const d of [home, logs, scratch, claudeHome]) mkdirSync(d, { recursive: true });
  process.env.SDD_HOME = home;
  process.env.CONTROLLER_GH_BIN = STUB_GH;
  delete process.env.STUB_GH_SCRIPT;
  return { base, repo, specDir, home, logs, scratch, spec, claudeHome };
}

function writeScript(fx: Fixture, runs: StubRun[]): void {
  const scriptPath = join(fx.base, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.CONTROLLER_CLAUDE_BIN = STUB;
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;
}

const USAGE = { input_tokens: 5, output_tokens: 50, cache_read_input_tokens: 10, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 20 } };
function result(structured: Record<string, unknown>, text = ''): Record<string, unknown> {
  return { subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: text, structured_output: structured, usage: USAGE };
}

/** A stubbed close-out implementer: for each item, edit and commit `file` with the retro message, then report done. */
function batchRun(fx: Fixture, items: { id: string; file: string; status?: 'done' | 'to-do' | 'skipped'; reason?: string }[]): StubRun {
  return {
    commands: items.filter((i) => (i.status ?? 'done') === 'done').map((i) =>
      `mkdir -p "$(dirname ${i.file})" && echo "${i.id}" >> ${i.file} && git add ${i.file} && git commit -qm "chore(retro): ${fx.spec} ${i.id} landed"`),
    result: result({ items: items.map((i) => ({ id: i.id, status: i.status ?? 'done', commit: 'none', reason: i.reason ?? '' })), retro: 'none' }),
  };
}

function ctxFor(fx: Fixture, over: Partial<CloseoutPhaseContext> = {}): CloseoutPhaseContext {
  const iso = NOW().toISOString();
  const run: RunRecord = {
    v: 1, id: RUN_ID, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: fx.spec,
    worktree: fx.repo, branch: 'main', status: 'running', created: iso, updated: iso,
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  };
  return {
    run, specStoreRoot: fx.repo, specDir: fx.specDir, codeRoot: fx.repo, mainCheckout: fx.repo,
    harnessRepo: fx.repo, homeDir: fx.claudeHome,
    ledger: openRunLedger({ specDir: fx.specDir, runId: RUN_ID, spec: fx.spec, now: NOW }),
    stepLogDir: fx.logs, mcpConfig: { mcpServers: {} }, scratchDir: fx.scratch, now: NOW, serialize: (fn) => fn(),
    ...over,
  };
}

function rows(fx: Fixture): Record<string, string>[] {
  return readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, string>);
}
function planText(fx: Fixture): string {
  return readFileSync(join(fx.specDir, 'retrospective-plan.md'), 'utf8');
}

let fx: Fixture | undefined;
beforeEach(() => { chmodSync(STUB, 0o755); chmodSync(STUB_GH, 0o755); });
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value;
  if (fx) { try { rmSync(fx.base, { recursive: true, force: true }); } catch { /* ignore */ } }
  fx = undefined;
});

describe('itemPaths and parseItemLines', () => {
  it('reads the paths an item names and the report lines', () => {
    expect(itemPaths('Add `typecheck: none` to `.spec-workflow/agent-rules.md` and `src/a.ts:12`; see `https://x.y/z`.')).toEqual(['.spec-workflow/agent-rules.md', 'src/a.ts']);
    expect(parseItemLines('P1: done abc1234\n- P2: to-do — needs a human\nP3: skipped — no file\nG1: done deadbeef00')).toEqual([
      { id: 'P1', status: 'done', commit: 'abc1234' }, { id: 'P2', status: 'to-do', reason: 'needs a human' },
      { id: 'P3', status: 'skipped', reason: 'no file' }, { id: 'G1', status: 'done', commit: 'deadbeef00' },
    ]);
  });
});

describe('runCloseoutPhase', () => {
  it('closes a none item without a step, lands a store batch and a code batch, and marks the plan CLOSED', async () => {
    fx = setup([P_NONE, P_STORE, P_CODE]);
    writeScript(fx, [
      batchRun(fx, [{ id: 'P2', file: '.spec-workflow/agent-rules.md' }]), // store batch, on main of the spec store
      batchRun(fx, [{ id: 'P3', file: 'README.md' }]),                      // code batch, in the retro worktree
    ]);

    const outcome = await runCloseoutPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'closed', reason: undefined });
    expect(outcome.items).toEqual({ total: 3, done: 2, todo: 0, skipped: 1 });
    const text = planText(fx);
    expect(text).toMatch(/^Status: CLOSED$/m);
    expect(text).toMatch(/^- P1: skipped — ratified as it stands$/m);
    expect(text).toMatch(/^- P2: done — [0-9a-f]{40}$/m);
    expect(text).toMatch(/^- P3: done — [0-9a-f]{40}$/m);
    expect(text).toMatch(/^- repo: branch chore\/.*-retro \(no remote\)$/m);
    expect(outcome.prs).toEqual([{ repoDir: fx.repo, branch: `chore/${fx.spec}-retro` }]);
    // The code batch landed in the retro worktree on its branch, not on main.
    const wt = join(fx.repo, '.claude', 'worktrees', `${fx.spec}-retro`);
    expect(existsSync(wt)).toBe(true);
    expect(git(wt, ['log', '-1', '--format=%s'])).toBe(`chore(retro): ${fx.spec} P3 landed`);
    expect(git(fx.repo, ['log', '--format=%s', 'main'])).not.toContain('P3 landed');
    // The store batch landed on the spec store's branch and the phase committed its bookkeeping.
    const mainLog = git(fx.repo, ['log', '--format=%s', 'main']);
    expect(mainLog).toContain(`chore(retro): ${fx.spec} P2 landed`);
    expect(mainLog).toContain(`docs(sdd): ${fx.spec} closed`);
    expect(mainLog).toContain(`docs(sdd): ${fx.spec} closeout store batch 1`);
    const r = rows(fx);
    expect(r.filter((e) => e.type === 'task.pick').map((e) => e.task)).toEqual(['P1', 'P2', 'P3']);
    expect(r.filter((e) => e.type === 'task.done').map((e) => `${e.task}:${e.outcome}`)).toEqual(['P1:skipped', 'P2:done', 'P3:done']);
    expect(r.filter((e) => e.type === 'spawn.usage').map((e) => e.role)).toEqual(['implement store batch 1', 'implement code batch 2']);
    expect(r.some((e) => e.type === 'note' && /^gate: item P2 pass/.test(e.text))).toBe(true);
    expect(r.find((e) => e.type === 'phase.end' && e.phase === 'closeout')).toMatchObject({ result: 'closed', state: 'items 3/3' });
    expect(readFileSync(join(fx.repo, '.spec-workflow', 'HANDOFF.md'), 'utf8')).toMatch(/\| State \| items 3\/3: 2 done, 0 to-do, 1 skipped \|/);
    expect(readFileSync(join(fx.specDir, 'retrospective-log.md'), 'utf8')).toContain('close-out: 2 done, 0 to-do, 1 skipped of 3');
    expect(readFileSync(join(fx.scratch, 'closeout-brief-store-1.md'), 'utf8')).toContain('### P2 — P2 (F2) — Name the typecheck rule.');
  }, 60000);

  it('verifies a high-risk code item, runs a fix round on not done, then closes it done', async () => {
    fx = setup([['- **P3 (F3) — Pin the package.** Edit `package.json`.', '  Target: product code.', '  Decision: do it.'].join('\n')]);
    writeScript(fx, [
      batchRun(fx, [{ id: 'P3', file: 'package.json' }]),
      { result: result({ items: [{ id: 'P3', status: 'not done', reason: 'the field is wrong' }], verdict: 'fix-required' }) },
      batchRun(fx, [{ id: 'P3', file: 'package.json' }]),
      { result: result({ items: [{ id: 'P3', status: 'ok' }], verdict: 'pass' }) },
    ]);

    const outcome = await runCloseoutPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'closed', reason: undefined });
    expect(planText(fx)).toMatch(/^- P3: done — [0-9a-f]{40}$/m);
    const roles = rows(fx).filter((e) => e.type === 'spawn.usage').map((e) => e.role);
    expect(roles).toEqual(['implement code batch 1', 'verify code batch 1', 'fix code batch 1 round 1', 'verify code batch 1 round 1']);
    expect(readFileSync(join(fx.scratch, 'closeout-fix-code-1-r1.md'), 'utf8')).toContain('the field is wrong');
  }, 60000);

  it('records a to-do item, skips an already-closed item on re-entry, and errors on a non-approved plan', async () => {
    fx = setup([P_NONE, P_STORE]);
    // P1 already closed by an earlier pass.
    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), planText(fx) + '\n## Close-out\n\nOne line per proposal, written by the close-out phase.\n- P1: skipped — earlier\n');
    git(fx.repo, ['add', '-A']);
    git(fx.repo, ['commit', '-q', '-m', 'partial']);
    writeScript(fx, [batchRun(fx, [{ id: 'P2', file: '.spec-workflow/agent-rules.md', status: 'to-do', reason: 'needs the operator' }])]);

    const outcome = await runCloseoutPhase(ctxFor(fx));

    expect(outcome.result).toBe('closed');
    expect(outcome.items).toEqual({ total: 2, done: 0, todo: 1, skipped: 1 });
    expect(planText(fx).match(/^- P1:/gm)).toHaveLength(1);
    expect(planText(fx)).toMatch(/^- P2: to-do \(human\) — needs the operator$/m);
    expect(readFileSync(join(fx.repo, '.spec-workflow', 'HANDOFF.md'), 'utf8')).toMatch(/\| To-dos \| P2: needs the operator \|/);

    const closed = await runCloseoutPhase(ctxFor(fx));
    expect(closed.result).toBe('closed');
    expect(rows(fx).filter((e) => e.type === 'phase.start' && e.phase === 'closeout')).toHaveLength(1);

    writeFileSync(join(fx.specDir, 'retrospective-plan.md'), planText(fx).replace('Status: CLOSED', 'Status: DRAFT'));
    const draft = await runCloseoutPhase(ctxFor(fx));
    expect(draft).toMatchObject({ result: 'error', reason: 'plan status is DRAFT, not APPROVED' });
  }, 60000);

  it('opens the retro PR for a harness repository with a remote', async () => {
    fx = setup([P_HARNESS]);
    const origin = join(fx.base, 'origin.git');
    git(fx.repo, ['init', '-q', '--bare', origin]);
    git(fx.repo, ['remote', 'add', 'origin', origin]);
    git(fx.repo, ['push', '-q', 'origin', 'main']);
    const ghScript = join(fx.base, 'gh-script.json');
    writeFileSync(ghScript, JSON.stringify([
      { argvIncludes: ['pr', 'list'], stdout: [] },
      { argvIncludes: ['pr', 'create'], stdout: 'https://github.com/x/y/pull/9\n' },
    ]));
    process.env.STUB_GH_SCRIPT = ghScript;
    writeScript(fx, [batchRun(fx, [{ id: 'P4', file: 'harness/notes.md' }])]);

    const outcome = await runCloseoutPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'closed', reason: undefined });
    expect(outcome.prs).toEqual([{ repoDir: fx.repo, branch: `chore/${fx.spec}-retro`, number: 9, url: 'https://github.com/x/y/pull/9' }]);
    expect(planText(fx)).toMatch(/^- repo: PR https:\/\/github.com\/x\/y\/pull\/9$/m);
    expect(git(origin, ['log', '--format=%s', `chore/${fx.spec}-retro`])).toContain('P4 landed');
    const argv = readFileSync(`${ghScript}.argv`, 'utf8');
    expect(argv).toContain(`"--title","chore(retro): ${fx.spec} retrospective follow-ups"`);
    expect(readFileSync(join(fx.scratch, 'pr-body-repo.md'), 'utf8')).toContain('- P4 P4 (F4) — Tidy the skill.');
  }, 60000);
});
