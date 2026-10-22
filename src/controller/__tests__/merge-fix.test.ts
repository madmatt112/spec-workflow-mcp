import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, chmodSync, rmSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import {
  MERGE_FIX_CAP, mergeFixHistory, mergeFixEligible, runMergeFixRound,
  type MergeFixContext,
} from '../merge-fix.js';
import type { BlockingReason, MergeStageResult } from '../merge.js';
import { openRunLedger } from '../ledger.js';
import { loadRole } from '../step.js';
import { IMPLEMENTER_SCHEMA } from '../phases/implementation.js';
import type { RunRecord } from '../state.js';

// Contract (design C3 "Merge fix round", R1 AC 1-6, AC 10):
//
// S1 mergeFixEligible — true only for `check`/`conflict` kinds under the cap.
//    Pre: a MergeStageResult with a blocking-kind mix and a `used` count.
//    Call: mergeFixEligible(result, used).
//    Observable: boolean, per design C3's pure rule.
//    Source: design C3 Interfaces, `mergeFixEligible`.
//
// S2 mergeFixHistory — skips another run's rows; `used` excludes a
//    `step usage-limit` ending; `endings` lists every end note's ending.
//    Pre: ledger rows mixing two run ids and a usage-limit ending.
//    Call: mergeFixHistory(rows, runId).
//    Observable: { used, endings }.
//    Source: design C3 Interfaces, `mergeFixHistory`.
//
// S3 runMergeFixRound — the pushed/no-commit/rewritten/INFRA endings and
//    kinds design C3 step 7 names.
//    Pre: a git worktree on the run's branch, pushed to a bare `origin`.
//    Call: runMergeFixRound(ctx, { round, pr, blocking, base }).
//    Observable: the returned MergeFixOutcome.
//    Source: design C3 post-conditions, step 7.
//
// S4 a rewritten HEAD is never pushed.
//    Pre: the stubbed implementer amends the commit instead of adding one.
//    Call: same seam as S3.
//    Observable: `origin`'s branch tip is unchanged after the round.
//    Source: design C3 step 7 ("history rewritten; not pushed"), R1 AC 3.
//
// S5 the INFRA round records one `gh run rerun <id> --failed` per run id.
//    Pre: a blocking check with a `runId`; the implementer reports `INFRA:`.
//    Call: same seam as S3.
//    Observable: the stub-gh `.argv` sidecar.
//    Source: design C3 step 7 (the `INFRA:` branch), R1 AC 5.
//
// S6 the start and end notes match Data Models.
//    Observable: the ledger's `note` rows, asserted in S3-S5's scenarios.
//    Source: design Data Models (`merge fix round <k> start/end:` lines).
//
// S7 the brief names the failing check's log path and, for a conflict, the
//    merge of the default branch.
//    Observable: the rendered brief file(s) under the scratch dir.
//    Source: design C3 step 5, C4 `renderMergeFix` (already pinned by
//    harness.test.ts; here only the wiring of real values is asserted).
//
// Restriction check: `IMPLEMENTER_SCHEMA` stays exported, unchanged, from
// implementation.ts (the only change that file takes for this task).

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');
const STUB_CLAUDE = join(ROOT, 'scripts', 'stub-claude.mjs');
const STUB_GH = join(ROOT, 'scripts', 'stub-gh.mjs');
const RUN_ID = 'run-20261021-000000';
const NOW = (): Date => new Date('2026-10-21T00:00:00.000Z');

const USAGE = {
  input_tokens: 5, output_tokens: 20, cache_read_input_tokens: 0,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 0 },
};

const savedEnv = { ...process.env };
let counter = 0;

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

interface Fixture {
  base: string;
  repo: string;
  specDir: string;
  origin: string;
  stepLogDir: string;
  scratch: string;
  spec: string;
}

function setupFx(): Fixture {
  const spec = `mf-${process.pid}-${counter++}`;
  const base = mkdtempSync(join(tmpdir(), 'ctrl-mergefix-'));
  const repo = join(base, 'repo');
  const wf = join(repo, '.spec-workflow');
  const specDir = join(wf, 'specs', spec);
  mkdirSync(specDir, { recursive: true });
  git(repo, ['init', '-q', '-b', 'feat/x']);
  git(repo, ['config', 'user.email', 't@test']);
  git(repo, ['config', 'user.name', 'Tester']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(repo, 'README.md'), 'init\n');
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'init']);
  const origin = join(base, 'origin.git');
  git(repo, ['init', '-q', '--bare', origin]);
  git(repo, ['remote', 'add', 'origin', origin]);
  git(repo, ['push', '-q', 'origin', 'feat/x']);
  writeFileSync(join(wf, 'agent-rules.md'), '# Agent rules\n\nmerge: auto\n');
  const stepLogDir = join(base, 'logs');
  const scratch = join(base, 'scratch');
  mkdirSync(stepLogDir, { recursive: true });
  mkdirSync(scratch, { recursive: true });
  return { base, repo, specDir, origin, stepLogDir, scratch, spec };
}

function makeRun(fx: Fixture): RunRecord {
  const iso = NOW().toISOString();
  return {
    v: 1, id: RUN_ID, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: fx.spec,
    worktree: fx.repo, branch: 'feat/x', pr: 42, status: 'running', created: iso, updated: iso,
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  };
}

function ctxFor(fx: Fixture): MergeFixContext {
  return {
    run: makeRun(fx),
    worktree: fx.repo,
    specStoreRoot: fx.repo,
    specDir: fx.specDir,
    ledger: openRunLedger({ specDir: fx.specDir, runId: RUN_ID, spec: fx.spec, now: NOW }),
    stepLogDir: fx.stepLogDir,
    mcpConfig: { mcpServers: {} },
    scratchDir: fx.scratch,
  } as MergeFixContext;
}

function writeClaudeScript(fx: Fixture, runs: unknown[]): void {
  const scriptPath = join(fx.base, 'claude-script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.CONTROLLER_CLAUDE_BIN = STUB_CLAUDE;
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;
}

function writeGhScript(fx: Fixture, runs: unknown[]): string {
  const scriptPath = join(fx.base, 'gh-script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.CONTROLLER_GH_BIN = STUB_GH;
  process.env.STUB_GH_SCRIPT = scriptPath;
  return scriptPath;
}

function implResult(fields: Record<string, unknown>): Record<string, unknown> {
  return { subtype: 'success', is_error: false, num_turns: 2, session_id: 's', result: '', structured_output: fields, usage: USAGE };
}

function baseImplFields(flag = 'none'): Record<string, unknown> {
  return { logged: 'n/a', commit: 'none', checks: '', checksFile: '', green: '', flag, retro: 'none' };
}

function commitRun(message: string): unknown {
  return {
    commands: [`echo change >> change.txt && git add change.txt && git commit -qm "${message}"`],
    result: implResult(baseImplFields()),
  };
}

function noCommitRun(): unknown {
  return { result: implResult(baseImplFields()) };
}

function amendRun(): unknown {
  return {
    commands: ['git commit --amend -q -m "amended: not built on the old head"'],
    result: implResult(baseImplFields()),
  };
}

function infraRun(line: string): unknown {
  return { result: implResult(baseImplFields(`INFRA: ${line}`)) };
}

function rows(fx: Fixture): Record<string, string>[] {
  const text = readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8').trim();
  if (!text) return [];
  return text.split('\n').map((l) => JSON.parse(l) as Record<string, string>);
}

function notes(fx: Fixture): string[] {
  return rows(fx).filter((r) => r.type === 'note').map((r) => r.text);
}

function scratchText(fx: Fixture): string {
  return readdirSync(fx.scratch)
    .map((f) => readFileSync(join(fx.scratch, f), 'utf8'))
    .join('\n---\n');
}

beforeEach(() => {
  chmodSync(STUB_CLAUDE, 0o755);
  chmodSync(STUB_GH, 0o755);
});

afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value;
});

// --- S1 ----------------------------------------------------------------

describe('mergeFixEligible', () => {
  const blocked = (blocking: BlockingReason[]): MergeStageResult => ({ status: 'blocked', reasons: ['r'], blocking });

  it.each<[string, MergeStageResult, number, boolean]>([
    ['a check alone, under the cap', blocked([{ kind: 'check', text: 'c' }]), 0, true],
    ['a conflict alone, under the cap', blocked([{ kind: 'conflict', text: 'c' }]), 1, true],
    ['a check and a conflict together, under the cap', blocked([{ kind: 'check', text: 'c' }, { kind: 'conflict', text: 'd' }]), 0, true],
    ['a check mixed with a trailer', blocked([{ kind: 'check', text: 'c' }, { kind: 'trailer', text: 't' }]), 0, false],
    ['a head mismatch alone', blocked([{ kind: 'head', text: 'h' }]), 0, false],
    ['an other reason alone', blocked([{ kind: 'other', text: 'o' }]), 0, false],
    ['a check alone, at the cap', blocked([{ kind: 'check', text: 'c' }]), MERGE_FIX_CAP, false],
    ['no blocking reasons', blocked([]), 0, false],
    ['not a blocked result', { status: 'not-ready', reasons: [], blocking: [{ kind: 'check', text: 'c' }] }, 0, false],
  ])('%s', (_label, result, used, expected) => {
    expect(mergeFixEligible(result, used)).toBe(expected);
  });
});

// --- S2 ----------------------------------------------------------------

describe('mergeFixHistory', () => {
  it('counts this run\'s end notes except a usage-limit ending, and lists every ending', () => {
    const rowsIn: Record<string, string>[] = [
      { run: 'run-A', spec: 's', type: 'note', text: 'merge fix round 1 start: x' },
      { run: 'run-A', spec: 's', type: 'note', text: 'merge fix round 1 end: pushed ab12345' },
      { run: 'run-B', spec: 's', type: 'note', text: 'merge fix round 1 end: pushed deadbee' },
      { run: 'run-A', spec: 's', type: 'note', text: 'merge fix round 2 end: step usage-limit' },
      { run: 'run-A', spec: 's', type: 'note', text: 'unrelated note' },
    ];
    expect(mergeFixHistory(rowsIn, 'run-A')).toEqual({ used: 1, endings: ['pushed ab12345', 'step usage-limit'] });
  });
});

// --- Restriction: IMPLEMENTER_SCHEMA export unchanged -------------------

describe('IMPLEMENTER_SCHEMA', () => {
  it('stays exported from implementation.ts, unchanged, for the merge fix round\'s step', () => {
    expect(IMPLEMENTER_SCHEMA.required).toEqual(['logged', 'commit', 'checksFile', 'flag']);
    expect(Object.keys(IMPLEMENTER_SCHEMA.properties)).toEqual(
      ['logged', 'commit', 'checks', 'checksFile', 'green', 'flag', 'retro', 'reproduce'],
    );
  });
});

// --- S3-S7 ---------------------------------------------------------------

describe('runMergeFixRound', () => {
  let fx: Fixture | undefined;

  afterEach(() => {
    if (fx) { try { rmSync(fx.base, { recursive: true, force: true }); } catch { /* ignore */ } }
    fx = undefined;
  });

  it('runs the implementer, saves the failing check\'s log tail, and pushes a fast-forward commit (S3 pushed, S6, S7 log path)', async () => {
    fx = setupFx();
    writeGhScript(fx, [
      { argvIncludes: ['run', 'view', '11', '--log-failed'], stdout: 'line one\nAssertionError: build broke\n' },
    ]);
    writeClaudeScript(fx, [commitRun('fix: build')]);
    const blocking: BlockingReason[] = [{ kind: 'check', text: 'build (20) failed', check: { name: 'build', runId: 11 } }];
    const before = git(fx.repo, ['rev-parse', 'HEAD']);

    const outcome = await runMergeFixRound(ctxFor(fx), { round: 1, pr: 42, blocking, base: 'main' });

    const after = git(fx.repo, ['rev-parse', 'HEAD']);
    expect(after).not.toBe(before);
    const sha7 = after.slice(0, 7);
    expect(outcome).toEqual({ kind: 'pushed', ending: `pushed ${sha7}` });

    expect(notes(fx)).toEqual([
      'merge fix round 1 start: build (20) failed',
      'merge fix round 1 end: pushed ' + sha7,
    ]);

    const logPath = join(fx.scratch, 'merge-ci-build-r1.log');
    expect(existsSync(logPath)).toBe(true);
    expect(readFileSync(logPath, 'utf8')).toContain('AssertionError: build broke');

    const briefText = scratchText(fx);
    expect(briefText).toContain('# PR #42 — merge fix round 1');
    expect(briefText).toContain('merge-ci-build-r1.log');

    const role = loadRole('sdd-implementer');
    const spawnStarts = rows(fx).filter((r) => r.type === 'spawn.start');
    expect(spawnStarts).toHaveLength(1);
    expect(spawnStarts[0]).toMatchObject({
      agent: 'sdd-implementer', role: 'merge fix round 1', model: role.model, effort: role.effort,
    });
    expect(rows(fx).filter((r) => r.type === 'spawn.end')).toHaveLength(1);
    expect(rows(fx).filter((r) => r.type === 'spawn.usage')).toHaveLength(1);

    expect(git(fx.origin, ['log', '--format=%s', 'feat/x'])).toContain('fix: build');
  }, 30000);

  it('reports no commit and renders the conflict merge instruction when the branch conflicts (S3 no commit, S6, S7 conflict merge)', async () => {
    fx = setupFx();
    writeGhScript(fx, []);
    writeClaudeScript(fx, [noCommitRun()]);
    const blocking: BlockingReason[] = [{ kind: 'conflict', text: 'merge conflict with main' }];
    const before = git(fx.repo, ['rev-parse', 'HEAD']);

    const outcome = await runMergeFixRound(ctxFor(fx), { round: 1, pr: 42, blocking, base: 'main' });

    expect(outcome).toEqual({ kind: 'ended', ending: 'no commit' });
    expect(git(fx.repo, ['rev-parse', 'HEAD'])).toBe(before);
    expect(notes(fx)).toEqual([
      'merge fix round 1 start: merge conflict with main',
      'merge fix round 1 end: no commit',
    ]);

    const briefText = scratchText(fx);
    expect(briefText).toContain('the branch conflicts with `main`');
    expect(briefText).toContain('git merge origin/main');

    // No push attempted: the origin branch still ends at the only commit pushed in setup.
    expect(git(fx.origin, ['log', '--format=%s', 'feat/x'])).toBe('init');
  }, 30000);

  it('does not push when the implementer rewrites history instead of committing on top (S3 rewritten, S4, S6)', async () => {
    fx = setupFx();
    writeGhScript(fx, []);
    writeClaudeScript(fx, [amendRun()]);
    const blocking: BlockingReason[] = [{ kind: 'check', text: 'test failed', check: { name: 'test' } }];
    const before = git(fx.repo, ['rev-parse', 'HEAD']);

    const outcome = await runMergeFixRound(ctxFor(fx), { round: 1, pr: 42, blocking, base: 'main' });

    const after = git(fx.repo, ['rev-parse', 'HEAD']);
    expect(after).not.toBe(before); // the amend did replace the commit, just not on top of it
    expect(outcome).toEqual({ kind: 'ended', ending: 'history rewritten; not pushed' });
    expect(notes(fx)).toEqual([
      'merge fix round 1 start: test failed',
      'merge fix round 1 end: history rewritten; not pushed',
    ]);

    // Never pushed (R1 AC 3): the origin branch tip is still the pre-round commit.
    expect(git(fx.origin, ['rev-parse', 'feat/x'])).toBe(before);
  }, 30000);

  it('reruns the failing workflow run once per run id and ends the round as rechecked on INFRA (S3 infra, S5, S6)', async () => {
    fx = setupFx();
    const ghScript = writeGhScript(fx, [
      { argvIncludes: ['run', 'view', '22', '--log-failed'], stdout: 'boom\n' },
      { argvIncludes: ['run', 'rerun', '22', '--failed'], stdout: '' },
    ]);
    writeClaudeScript(fx, [infraRun('runner ran out of memory')]);
    const blocking: BlockingReason[] = [{ kind: 'check', text: 'build (20) failed', check: { name: 'build', runId: 22 } }];

    const outcome = await runMergeFixRound(ctxFor(fx), { round: 1, pr: 42, blocking, base: 'main' });

    expect(outcome).toEqual({ kind: 'rechecked', ending: 'infra: runner ran out of memory' });
    expect(notes(fx)).toEqual([
      'merge fix round 1 start: build (20) failed',
      'merge fix round 1 end: infra: runner ran out of memory',
    ]);

    const argv = readFileSync(`${ghScript}.argv`, 'utf8').trim().split('\n').map((l) => JSON.parse(l) as string[]);
    const reruns = argv.filter((a) => a[0] === 'run' && a[1] === 'rerun');
    expect(reruns).toEqual([['run', 'rerun', '22', '--failed']]);
  }, 30000);
});
