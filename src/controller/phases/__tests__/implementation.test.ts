import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync, readdirSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import {
  runImplementationPhase, readChecksFile, isWiringTask, setHandoffRow, readHandoffRow, reviewCoverageGap,
  type ImplementationPhaseContext,
} from '../implementation.js';
import { openRunLedger } from '../../ledger.js';
import { ImplementationLogManager } from '../../../dashboard/implementation-log-manager.js';
import { parseTasksFromMarkdown } from '../../../core/task-parser.js';
import { approvalsHandler } from '../../../tools/approvals.js';
import { DeferralStorage } from '../../../core/deferral-storage.js';
import type { RunRecord } from '../../state.js';

// Contract for step (c2) (docs/controller-design.md §5 "Implementation",
// docs/controller-tasks.md T12): the per-task loop, the completion gate and the
// PR checks loop run in code against the stub `claude` and the stub `gh`, so no
// test calls a model or GitHub. Every scenario asserts the files the loop writes
// (tasks.md, the ledger, the retro log, HANDOFF, INDEX) and the spec-store commits.

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

const USAGE = {
  input_tokens: 5, output_tokens: 50, cache_read_input_tokens: 10,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 20 },
};

interface StubRun {
  edits?: { path: string; content: string }[];
  commands?: string[];
  result: Record<string, unknown>;
  stream?: unknown[];
  exitCode?: number;
}

interface Fixture { base: string; repo: string; specDir: string; home: string; logs: string; scratch: string; spec: string }

let counter = 0;

/** A task block: `- Test:` lines make it TDD-marked. */
function taskMd(id: string, title: string, files: string[], opts: { test?: string } = {}): string {
  return [
    `- [ ] ${id}. ${title}`,
    ...files.map((f) => `  - File: ${f}`),
    ...(opts.test ? [`  - Test: ${opts.test}`] : []),
    '  - Purpose: do the thing.',
    `  - _Requirements: 1.1_`,
    `  - _Prompt: Task: do it | Restrictions: none | Success: it works_`,
    '',
  ].join('\n');
}

/** Approve the tasks document the way the document phase does (the loop refuses an unapproved one). */
async function approveTasks(fx: Fixture): Promise<void> {
  const ctx = { projectPath: fx.repo, workspacePath: fx.repo };
  const req = await approvalsHandler({
    action: 'request', title: `${fx.spec} tasks`, filePath: `.spec-workflow/specs/${fx.spec}/tasks.md`,
    type: 'document', category: 'spec', categoryName: fx.spec,
  }, ctx);
  await approvalsHandler({ action: 'approve', approvalId: (req.data as { approvalId: string }).approvalId, response: 'ok' }, ctx);
  git(fx.repo, ['add', '-A']);
  git(fx.repo, ['commit', '-q', '-m', 'docs(sdd): tasks approved']);
}

async function setup(tasks: string[]): Promise<Fixture> {
  const fx = setupSync(tasks);
  process.env.SDD_HOME = fx.home;
  await approveTasks(fx);
  return fx;
}

function setupSync(tasks: string[]): Fixture {
  const spec = `ctrl-impl-${process.pid}-${counter++}`;
  const base = mkdtempSync(join(tmpdir(), 'ctrl-impl-'));
  const repo = join(base, 'repo');
  const wf = join(repo, '.spec-workflow');
  const specDir = join(wf, 'specs', spec);
  mkdirSync(specDir, { recursive: true });
  mkdirSync(join(wf, 'spec-decomposition'), { recursive: true });
  mkdirSync(join(repo, 'src'), { recursive: true });
  git(repo, ['init', '-q', '-b', 'main']);
  git(repo, ['config', 'user.email', 't@test']);
  git(repo, ['config', 'user.name', 'Tester']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
  writeFileSync(join(repo, 'README.md'), 'init\n');
  writeFileSync(join(repo, 'src', 'base.js'), 'module.exports = 1;\n');
  writeFileSync(join(wf, 'agent-rules.md'), [
    '# Agent rules', '', 'typecheck: none', 'red-on-base: off', 'merge: auto', '',
    '## Sensitive paths', '', '- package.json', '',
    '## PR body', '', '- Forbidden terms in a PR body: none.', '',
  ].join('\n'));
  writeFileSync(join(wf, 'HANDOFF.md'), `> **READ FIRST — SDD routing.** Active spec **\`${spec}\`**.\n\n## Phase log\n\n| Date | Spec | Stage | State | Result | Note |\n| --- | --- | --- | --- | --- | --- |\n`);
  writeFileSync(join(wf, 'spec-decomposition', 'decomposition.md'), [
    '# Decomposition', '', `### 1. \`${spec}\` — the fixture spec (active)`, '',
    '**Delivers.** A thing.', '', '**End-to-end verification.** `node -e 1` exits 0.', '',
  ].join('\n'));
  writeFileSync(join(specDir, 'requirements.md'), '# Requirements\n\n### Requirement 1\n\n1. It works.\n');
  writeFileSync(join(specDir, 'design.md'), '# Design\n');
  writeFileSync(join(specDir, 'tasks.md'), `# Tasks Document\n\nDocument version: v1\n\n${tasks.join('\n')}`);
  git(repo, ['add', '-A']);
  git(repo, ['commit', '-q', '-m', 'init']);
  const home = join(base, 'home');
  const logs = join(base, 'logs');
  const scratch = join(base, 'scratch');
  for (const d of [home, logs, scratch]) mkdirSync(d, { recursive: true });
  return { base, repo, specDir, home, logs, scratch, spec };
}

function writeScript(fx: Fixture, runs: StubRun[]): void {
  const scriptPath = join(fx.base, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.CONTROLLER_CLAUDE_BIN = STUB;
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;
  process.env.SDD_HOME = fx.home;
}

function writeGhScript(fx: Fixture, runs: unknown[]): void {
  const scriptPath = join(fx.base, 'gh-script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.CONTROLLER_GH_BIN = STUB_GH;
  process.env.STUB_GH_SCRIPT = scriptPath;
}

/** The markdown and file name of one implementation log entry, as the manager writes it. */
async function logFile(fx: Fixture, taskId: string, files: string[]): Promise<{ path: string; content: string }> {
  const tmp = join(fx.base, `logtmp-${taskId}-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  await new ImplementationLogManager(tmp).addLogEntry({
    taskId, timestamp: NOW().toISOString(), summary: `task ${taskId} done`,
    filesModified: [], filesCreated: files, statistics: { linesAdded: 1, linesRemoved: 0, filesChanged: files.length }, artifacts: {},
  });
  const dir = join(tmp, 'Implementation Logs');
  const name = readdirSync(dir)[0];
  return { path: `.spec-workflow/specs/${fx.spec}/Implementation Logs/${name}`, content: readFileSync(join(dir, name), 'utf-8') };
}

function result(structured: Record<string, unknown>, text = ''): Record<string, unknown> {
  return { subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: text, structured_output: structured, usage: USAGE };
}

/** A stubbed implementer: commits `file`, writes the log and the checks-file, reports. */
async function implRun(fx: Fixture, taskId: string, file: string, opts: { checks?: string[]; flag?: string; message?: string } = {}): Promise<StubRun> {
  const log = await logFile(fx, taskId, [file]);
  const checksPath = join(fx.scratch, `checks-${taskId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.json`);
  return {
    edits: [log, { path: checksPath, content: JSON.stringify(opts.checks ?? ['true']) }],
    // A real implementer stages only its own files (impl-standing); so does the stub.
    commands: [`mkdir -p "$(dirname ${file})" && echo "line ${Date.now()}" >> ${file} && git add ${file} && git commit -qm "${opts.message ?? `feat: task ${taskId}`}"`],
    result: result({ logged: `yes/${taskId}`, commit: 'none', checks: 'ran', checksFile: checksPath, green: '', flag: opts.flag ?? 'none', retro: 'none' }),
  };
}

function verifierRun(verdict: 'pass' | 'fix-required', findings = 'none'): StubRun {
  return { result: result({ verdict, findings, retro: 'none' }, `VERDICT: ${verdict}`) };
}

function e2eRun(verify: 'pass' | 'fail', findings = ''): StubRun {
  return { result: result({ verify, deferredCommand: '', findings, retro: 'none' }, `VERIFY: ${verify}`) };
}

interface SecurityFindingLike { title: string; file: string; command: string; output: string }
interface SecuritySuspicionLike { title: string; file: string; why: string }

/** A security pass/recheck verifier report (design C6 `SECURITY_SCHEMA`). */
function securityPassRun(findings: SecurityFindingLike[], suspicions: SecuritySuspicionLike[] = []): StubRun {
  return { result: result({ findings, suspicions, retro: 'none' }) };
}

/** A security fix round: commits a change, no push (R3 AC 6, R2 AC 10). */
function securityFixRun(file: string, message: string): StubRun {
  return {
    commands: [`echo "patched" >> ${file} && git add ${file} && git commit -qm "${message}"`],
    result: result({ logged: 'n/a', commit: 'none', checks: '', checksFile: '', green: '', flag: 'none', retro: 'none' }),
  };
}

function adjudicatorRun(): StubRun {
  return { result: result({ commit: 'none', fixed: [], ruledOut: [], notes: '', flags: 'none' }) };
}

/** A multi-file implementer commit (one task touching more than one file). */
async function implRunMulti(fx: Fixture, taskId: string, files: string[], opts: { message?: string } = {}): Promise<StubRun> {
  const log = await logFile(fx, taskId, files);
  const checksPath = join(fx.scratch, `checks-${taskId}-multi-${Date.now()}.json`);
  const writes = files.map((f) => `mkdir -p "$(dirname ${f})" && echo "line ${Date.now()}" >> ${f}`).join(' && ');
  return {
    edits: [log, { path: checksPath, content: JSON.stringify(['true']) }],
    commands: [`${writes} && git add ${files.join(' ')} && git commit -qm "${opts.message ?? `feat: task ${taskId}`}"`],
    result: result({ logged: `yes/${taskId}`, commit: 'none', checks: 'ran', checksFile: checksPath, green: '', flag: 'none', retro: 'none' }),
  };
}

function ctxFor(fx: Fixture, over: Partial<ImplementationPhaseContext> = {}): ImplementationPhaseContext {
  const iso = NOW().toISOString();
  const run: RunRecord = {
    v: 1, id: RUN_ID, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: fx.spec,
    worktree: fx.repo, branch: 'main', status: 'running', created: iso, updated: iso,
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  };
  return {
    run, specStoreRoot: fx.repo, specDir: fx.specDir, codeRoot: fx.repo, mainCheckout: fx.repo,
    ledger: openRunLedger({ specDir: fx.specDir, runId: RUN_ID, spec: fx.spec, now: NOW }),
    stepLogDir: fx.logs, mcpConfig: { mcpServers: {} }, scratchDir: fx.scratch, now: NOW,
    serialize: (fn) => fn(), ci: { pollMs: 5, maxWaitMs: 200 },
    ...over,
  };
}

function rows(fx: Fixture): Record<string, string>[] {
  return readFileSync(join(fx.specDir, 'harness-events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l) as Record<string, string>);
}

function taskStatus(fx: Fixture, id: string): string | undefined {
  return parseTasksFromMarkdown(readFileSync(join(fx.specDir, 'tasks.md'), 'utf8')).tasks.find((t) => t.id === id)?.status;
}

/** The real argv the stub recorded on the step's init event (design C5: the route's `--model`/`--effort`). */
function initArgv(fx: Fixture, stepId: string): string[] {
  const first = readFileSync(join(fx.logs, `${stepId}.jsonl`), 'utf8').split('\n').find((l) => l.trim().length > 0);
  if (!first) return [];
  return ((JSON.parse(first) as { argv?: string[] }).argv) ?? [];
}

let fx: Fixture | undefined;
beforeEach(() => {
  chmodSync(STUB, 0o755);
  chmodSync(STUB_GH, 0o755);
  delete process.env.ANTHROPIC_API_KEY; // the gate's TDD judge must never reach a model here
  delete process.env.ANTHROPIC_AUTH_TOKEN;
});
afterEach(() => {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value;
  if (fx) { try { rmSync(fx.base, { recursive: true, force: true }); } catch { /* ignore */ } }
  fx = undefined;
});

describe('readChecksFile and isWiringTask', () => {
  it('reads a flat array, drops a bare typecheck and a prettier check on dotenv', () => {
    const dir = mkdtempSync(join(tmpdir(), 'checks-'));
    writeFileSync(join(dir, 'c.json'), JSON.stringify(['npx tsc --noEmit', 'npx vitest run x', 'prettier --check .env.example', ' ']));
    expect(readChecksFile(join(dir, 'c.json'), dir)).toEqual(['npx vitest run x']);
    writeFileSync(join(dir, 'bad.json'), JSON.stringify([{ cmd: 'x' }]));
    expect(readChecksFile(join(dir, 'bad.json'), dir)).toBeNull();
    expect(readChecksFile(join(dir, 'missing.json'), dir)).toBeNull();
    rmSync(dir, { recursive: true, force: true });
  });

  it('judges wiring from the files and the title, not a score', () => {
    expect(isWiringTask({ description: 'Add the --bye flag', files: ['src/cli.js'] })).toBe(true);
    expect(isWiringTask({ description: 'Add a route', files: ['src/api/users.ts'] })).toBe(true);
    expect(isWiringTask({ description: 'Move the name rule', files: ['src/name.js'] })).toBe(false);
  });
});

describe('reviewCoverageGap (retro P9)', () => {
  it('names a logged-but-unreviewed task, and is silent when coverage matches or data is missing', () => {
    // reviewCoverage 15/16 while logCoverage 16/16: task 16 reached the PR unreviewed.
    expect(reviewCoverageGap({ logged: 16, unlogged: [] }, { reviewed: 15, unreviewed: ['16'] })).toEqual(['16']);
    expect(reviewCoverageGap({ logged: 2, unlogged: [] }, { reviewed: 2, unreviewed: [] })).toEqual([]);
    // An unreviewed task that is also unlogged is a logging gap, not a review-coverage gap.
    expect(reviewCoverageGap({ logged: 1, unlogged: ['2'] }, { reviewed: 1, unreviewed: ['2'] })).toEqual([]);
    expect(reviewCoverageGap(undefined, { reviewed: 0, unreviewed: ['1'] })).toEqual([]);
    expect(reviewCoverageGap({ logged: 1, unlogged: [] }, undefined)).toEqual([]);
  });
});

describe('HANDOFF rows', () => {
  it('creates the section, replaces a row and reads it back', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ho-'));
    const ho = join(dir, 'HANDOFF.md');
    writeFileSync(ho, '# H\n\n## x — tasks\n\n| Field | Value |\n| --- | --- |\n| Cut scope | none |\n');
    setHandoffRow(ho, '## x — implementation', 'State', 'tasks 0/2');
    setHandoffRow(ho, '## x — implementation', 'State', 'tasks 1/2');
    expect(readHandoffRow(ho, '## x — implementation', 'State')).toBe('tasks 1/2');
    expect(readHandoffRow(ho, '## x — tasks', 'Cut scope')).toBe('none');
    expect(readFileSync(ho, 'utf8').match(/\| State \|/g)).toHaveLength(1);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('runImplementationPhase', () => {
  it('works two low-risk tasks to complete with no remote', async () => {
    fx = await setup([taskMd('1', 'Add the first module', ['src/a.js']), taskMd('2', 'Add the second module', ['src/b.js'])]);
    writeScript(fx, [await implRun(fx, '1', 'src/a.js'), await implRun(fx, '2', 'src/b.js'), e2eRun('pass')]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'complete', reason: undefined });
    expect(outcome.pr).toBeUndefined();
    expect(outcome.tasks).toEqual({ done: 2, total: 2 });
    expect(taskStatus(fx, '1')).toBe('completed');
    expect(taskStatus(fx, '2')).toBe('completed');

    const r = rows(fx);
    expect(r.filter((e) => e.type === 'phase.start' && e.phase === 'implementation')).toHaveLength(1);
    expect(r.filter((e) => e.type === 'task.pick').map((e) => e.task)).toEqual(['1', '2']);
    expect(r.filter((e) => e.type === 'task.done').map((e) => e.outcome)).toEqual(['gate', 'gate']);
    expect(r.filter((e) => e.type === 'note' && /^gate: task \d pass risk (low|medium)/.test(e.text))).toHaveLength(2);
    const roles = r.filter((e) => e.type === 'spawn.usage').map((e) => e.role);
    expect(roles).toEqual(['implement task 1', 'implement task 2', 'end-to-end verification']);
    const end = r.filter((e) => e.type === 'phase.end' && e.phase === 'implementation');
    expect(end).toHaveLength(1);
    expect(end[0].result).toBe('complete');
    expect(end[0].state).toBe('tasks 2/2');

    const retro = readFileSync(join(fx.specDir, 'retrospective-log.md'), 'utf8');
    expect(retro).toContain(`# Retrospective log — ${fx.spec}`);
    expect(retro).toContain('· cleanup');
    expect(retro).toContain('implementation complete: 2 tasks');

    const ho = readFileSync(join(fx.repo, '.spec-workflow', 'HANDOFF.md'), 'utf8');
    expect(ho).toContain(`## ${fx.spec} — implementation`);
    expect(ho).toMatch(/\| Coverage \| logCoverage 2\/2; reviewCoverage 2\/2/);
    expect(ho).toMatch(/\| Verifier-skipped \| task 1, task 2/);
    expect(ho).toMatch(/\| PR \| none/);
    expect(ho).toMatch(/\| .* \| .* \| implementation \| tasks 2\/2 \| complete \|/); // the phase log row
    expect(existsSync(join(fx.repo, '.spec-workflow', 'spec-decomposition', 'INDEX.md'))).toBe(true);

    const log = git(fx.repo, ['log', '--format=%s']);
    expect(log).toContain(`docs(sdd): ${fx.spec} task 1`);
    expect(log).toContain(`docs(sdd): ${fx.spec} task 2`);
    expect(log).toContain(`docs(sdd): ${fx.spec} implemented, 2 tasks`);
    expect(log).toContain('feat: task 1');
    // The spec-store commits carry no attribution.
    expect(git(fx.repo, ['log', '--format=%B'])).not.toMatch(/Co-Authored-By|Generated with/);
  }, 60000);

  it('routes an unflagged task to the Sonnet route and a sensitive-path task to the Opus profile, with matching spawn rows and one route note per task', async () => {
    fx = await setup([
      taskMd('1', 'Add the first module', ['src/a.js']),
      taskMd('2', 'Touch the manifest', ['package.json']),
    ]);
    writeScript(fx, [
      await implRun(fx, '1', 'src/a.js'),
      await implRun(fx, '2', 'package.json'),
      verifierRun('pass'), // package.json is sensitive, so the gate's risk is high
      e2eRun('pass'),
      securityPassRun([], []), // the sensitive spec gets a security pass that finds nothing
    ]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'complete', reason: undefined });

    // The unflagged task's implementer runs the Sonnet route (the sdd-test-author
    // profile's model/effort), never resumed.
    const argv1 = initArgv(fx, 'implementer-task-1');
    expect(argv1).toEqual(expect.arrayContaining(['--model', 'claude-sonnet-5', '--effort', 'high']));
    expect(argv1).not.toContain('--resume');

    // The sensitive-path task's implementer keeps the sdd-implementer (Opus) profile.
    const argv2 = initArgv(fx, 'implementer-task-2');
    expect(argv2).toEqual(expect.arrayContaining(['--model', 'claude-opus-4-8', '--effort', 'xhigh']));

    const r = rows(fx);
    const implStarts = r.filter((e) => e.type === 'spawn.start' && e.agent === 'sdd-implementer');
    expect(implStarts.map((e) => ({ model: e.model, effort: e.effort }))).toEqual([
      { model: 'claude-sonnet-5', effort: 'high' },
      { model: 'claude-opus-4-8', effort: 'xhigh' },
    ]);
    const implEnds = r.filter((e) => e.type === 'spawn.end' && e.agent === 'sdd-implementer');
    expect(implEnds.map((e) => e.model)).toEqual(['claude-sonnet-5', 'claude-opus-4-8']);

    const routeNotes = r.filter((e) => e.type === 'note' && /^task \d+ route /.test(e.text)).map((e) => e.text);
    expect(routeNotes).toEqual([
      'task 1 route claude-sonnet-5 high: no sensitive-path flag',
      'task 2 route claude-opus-4-8 xhigh: sensitive-path: package.json',
    ]);
  }, 60000);

  it('runs a fix round after a gate fail, then passes', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    writeScript(fx, [
      await implRun(fx, '1', 'src/a.js', { checks: ['false'] }),
      await implRun(fx, '1', 'src/a.js', { checks: ['true'], message: 'fix: task 1' }),
      e2eRun('pass'),
    ]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'complete', reason: undefined });
    const r = rows(fx);
    expect(r.filter((e) => e.type === 'spawn.usage').map((e) => e.role)).toEqual(['implement task 1', 'fix task 1 round 1', 'end-to-end verification']);
    const notes = r.filter((e) => e.type === 'note' && e.text.startsWith('gate: task 1')).map((e) => e.text);
    expect(notes[0]).toMatch(/^gate: task 1 fail/);
    expect(notes[1]).toMatch(/^gate: task 1 pass .* round 1/);
    expect(r.find((e) => e.type === 'task.done')).toMatchObject({ task: '1', rounds: '1', outcome: 'gate' });
    expect(readFileSync(join(fx.specDir, 'retrospective-log.md'), 'utf8')).toContain('1 fix round(s)');
    // The fix brief carried the gate output.
    expect(readFileSync(join(fx.scratch, 'impl-brief-task-1-fix-1.md'), 'utf8')).toContain('## Gate output');
    // Two implementer spawns for the same task write only one route note (R2 AC 9).
    const routeNotes = r.filter((e) => e.type === 'note' && /^task 1 route /.test(e.text)).map((e) => e.text);
    expect(routeNotes).toEqual(['task 1 route claude-sonnet-5 high: no sensitive-path flag']);
  }, 60000);

  it('verifies a wiring task: fix-required, a fix round, then pass', async () => {
    fx = await setup([taskMd('1', 'Add the --bye flag', ['src/cli.js'])]);
    writeScript(fx, [
      await implRun(fx, '1', 'src/cli.js'),
      verifierRun('fix-required', 'The flag is case-insensitive; the design says exact.'),
      await implRun(fx, '1', 'src/cli.js', { message: 'fix: exact flag' }),
      verifierRun('pass'),
      e2eRun('pass'),
    ]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'complete', reason: undefined });
    const r = rows(fx);
    expect(r.filter((e) => e.type === 'spawn.usage').map((e) => e.role)).toEqual([
      'implement task 1', 'verify task 1', 'fix task 1 round 1', 'verify task 1 round 1', 'end-to-end verification',
    ]);
    expect(r.find((e) => e.type === 'task.done')).toMatchObject({ task: '1', rounds: '1', outcome: 'pass' });
    expect(readFileSync(join(fx.scratch, 'impl-brief-task-1-fix-1.md'), 'utf8')).toContain('case-insensitive');
    expect(readFileSync(join(fx.scratch, 'verify-brief-task-1.md'), 'utf8')).toContain('## Gate results');
    expect(readFileSync(join(fx.repo, '.spec-workflow', 'HANDOFF.md'), 'utf8')).toMatch(/\| Verifier-skipped \| none/);
    // Regression guard (R2 AC 11): the verifier keeps its own (Opus) profile even
    // though this task's own route is Sonnet.
    const verifyArgv = initArgv(fx, 'verifier-task-1-task-r0');
    expect(verifyArgv).toEqual(expect.arrayContaining(['--model', 'claude-opus-4-8', '--effort', 'xhigh']));
  }, 60000);

  it('adjudicates after three fix rounds and closes the task as adjudicated', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    writeScript(fx, [
      await implRun(fx, '1', 'src/a.js', { checks: ['false'] }),
      await implRun(fx, '1', 'src/a.js', { checks: ['false'], message: 'fix 1' }),
      await implRun(fx, '1', 'src/a.js', { checks: ['false'], message: 'fix 2' }),
      await implRun(fx, '1', 'src/a.js', { checks: ['false'], message: 'fix 3' }),
      { result: result({ commit: 'none', fixed: ['the check'], ruledOut: [], notes: '', flags: 'none' }) }, // adjudicator
      verifierRun('pass'), // the narrow verification
      e2eRun('pass'),
    ]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'complete', reason: undefined });
    const r = rows(fx);
    const roles = r.filter((e) => e.type === 'spawn.usage').map((e) => e.role);
    expect(roles).toEqual([
      'implement task 1', 'fix task 1 round 1', 'fix task 1 round 2', 'fix task 1 round 3',
      'adjudicate task 1', 'verify task 1 round 4 narrow', 'end-to-end verification',
    ]);
    expect(r.find((e) => e.type === 'task.done')).toMatchObject({ task: '1', outcome: 'adjudicated' });
    expect(r.some((e) => e.type === 'note' && e.text.startsWith('ruling: task 1 adjudicated'))).toBe(true);
    expect(readFileSync(join(fx.specDir, 'retrospective-log.md'), 'utf8')).toContain('· ruling');
  }, 60000);

  it('escalates an unfixable file-outside-list verdict as a design defect after one fix round', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    const log = await logFile(fx, '1', ['src/a.js']);
    const checksPath = join(fx.scratch, 'checks-outside.json');
    // The implementer commits the listed file plus a test file the task never listed.
    const firstImpl: StubRun = {
      edits: [log, { path: checksPath, content: JSON.stringify(['true']) }],
      commands: [`echo "a" >> src/a.js && mkdir -p test && echo "t" > test/a.test.js && git add src/a.js test/a.test.js && git commit -qm "feat: task 1"`],
      result: result({ logged: 'yes/1', commit: 'none', checks: 'ran', checksFile: checksPath, green: '', flag: 'none', retro: 'none' }),
    };
    // The fix round makes no new commit, so the file-list verdict cannot move.
    const fixNoCommit: StubRun = {
      result: result({ logged: 'yes/1', commit: 'none', checks: '', checksFile: '', green: '', flag: 'none', retro: 'none' }),
    };
    writeScript(fx, [firstImpl, fixNoCommit]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect(outcome.result).toBe('design-defect');
    expect(outcome.reason).toMatch(/test\/a\.test\.js/);
    expect(outcome.reason).toMatch(/tasks\.md/);
    expect(taskStatus(fx, '1')).toBe('pending');
    const r = rows(fx);
    // Exactly one fix implementer spawned; no second fix round.
    expect(r.filter((e) => e.type === 'spawn.usage').map((e) => e.role)).toEqual(['implement task 1', 'fix task 1 round 1']);
    expect(r.find((e) => e.type === 'phase.end')).toMatchObject({ phase: 'implementation', result: 'design-defect' });
    expect(readFileSync(join(fx.specDir, 'retrospective-log.md'), 'utf8')).toContain('· deviation');
  }, 60000);

  it('a fix round that changes the commit clears the file-outside-list verdict and completes', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    const log = await logFile(fx, '1', ['src/a.js']);
    const checksPath = join(fx.scratch, 'checks-outside2.json');
    const firstImpl: StubRun = {
      edits: [log, { path: checksPath, content: JSON.stringify(['true']) }],
      commands: [`echo "a" >> src/a.js && mkdir -p test && echo "t" > test/a.test.js && git add src/a.js test/a.test.js && git commit -qm "feat: task 1"`],
      result: result({ logged: 'yes/1', commit: 'none', checks: 'ran', checksFile: checksPath, green: '', flag: 'none', retro: 'none' }),
    };
    // The fix round drops the stray file in a new commit, so the verdict clears.
    const fixDrop: StubRun = {
      commands: ['git rm -q test/a.test.js && git commit -qm "fix: drop the unlisted test"'],
      result: result({ logged: 'yes/1', commit: 'none', checks: '', checksFile: '', green: '', flag: 'none', retro: 'none' }),
    };
    writeScript(fx, [firstImpl, fixDrop, e2eRun('pass')]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'complete', reason: undefined });
    const r = rows(fx);
    expect(r.filter((e) => e.type === 'spawn.usage').map((e) => e.role)).toEqual(['implement task 1', 'fix task 1 round 1', 'end-to-end verification']);
    const notes = r.filter((e) => e.type === 'note' && e.text.startsWith('gate: task 1')).map((e) => e.text);
    expect(notes[0]).toMatch(/^gate: task 1 fail/);
    expect(notes[1]).toMatch(/^gate: task 1 pass .* round 1/);
    expect(taskStatus(fx, '1')).toBe('completed');
  }, 60000);

  it('a DESIGN-DEFECT flag reverts the task and stops the phase', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    writeScript(fx, [await implRun(fx, '1', 'src/a.js', { flag: 'DESIGN-DEFECT: the design names a seam that does not exist' })]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect(outcome.result).toBe('design-defect');
    expect(outcome.reason).toMatch(/seam that does not exist/);
    expect(taskStatus(fx, '1')).toBe('pending');
    const end = rows(fx).find((e) => e.type === 'phase.end');
    expect(end).toMatchObject({ phase: 'implementation', result: 'design-defect' });
    expect(readFileSync(join(fx.specDir, 'retrospective-log.md'), 'utf8')).toContain('· deviation');
    expect(git(fx.repo, ['log', '--format=%s'])).toContain(`docs(sdd): ${fx.spec} implementation design-defect`);
  }, 60000);

  it('re-enters after a stop, writes a new phase.start, and hands the operator ruling to the implementer', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    writeScript(fx, [
      await implRun(fx, '1', 'src/a.js', { flag: 'ESCALATE: the vendor probe failed' }),
      await implRun(fx, '1', 'src/a.js'),
      e2eRun('pass'),
    ]);
    const first = await runImplementationPhase(ctxFor(fx));
    expect(first.result).toBe('escalate');

    const second = await runImplementationPhase(ctxFor(fx, { operatorRulings: ['Use the sandbox endpoint instead.'] }));
    expect({ result: second.result, reason: second.reason }).toEqual({ result: 'complete', reason: undefined });
    const r = rows(fx);
    expect(r.filter((e) => e.type === 'phase.start')).toHaveLength(2);
    expect(r.filter((e) => e.type === 'phase.start')[1].mode).toBe('repair');
    expect(readFileSync(join(fx.scratch, 'impl-brief-task-1.md'), 'utf8')).toContain('## Operator rulings\n- Use the sandbox endpoint instead.');
  }, 60000);

  it('repairs a failed end-to-end verification, then passes', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    writeScript(fx, [
      await implRun(fx, '1', 'src/a.js'),
      e2eRun('fail', 'node -e 1 printed nothing'),
      await implRun(fx, 'repair', 'src/a.js', { message: 'fix: repair' }),
      e2eRun('pass'),
    ]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'complete', reason: undefined });
    const roles = rows(fx).filter((e) => e.type === 'spawn.usage').map((e) => e.role);
    expect(roles).toEqual(['implement task 1', 'end-to-end verification', 'repair round 1', 'end-to-end verification']);
    expect(readFileSync(join(fx.specDir, 'retrospective-log.md'), 'utf8')).toContain('end-to-end verification failed (round 0)');
    // Regression guard (R2 AC 10): a repair round belongs to no task and keeps the
    // sdd-implementer (Opus) profile even though task 1's own route is Sonnet.
    const repairArgv = initArgv(fx, 'implementer-repair-1');
    expect(repairArgv).toEqual(expect.arrayContaining(['--model', 'claude-opus-4-8', '--effort', 'xhigh']));
  }, 60000);

  it('stays verify-failed after two repairs', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    writeScript(fx, [
      await implRun(fx, '1', 'src/a.js'),
      e2eRun('fail', 'still red'),
      await implRun(fx, 'repair', 'src/a.js', { message: 'fix: r1' }),
      e2eRun('fail', 'still red'),
      await implRun(fx, 'repair', 'src/a.js', { message: 'fix: r2' }),
      e2eRun('fail', 'still red'),
    ]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect(outcome.result).toBe('verify-failed');
    expect(outcome.reason).toMatch(/after 2 repairs/);
    expect(rows(fx).find((e) => e.type === 'phase.end')).toMatchObject({ result: 'verify-failed' });
  }, 60000);

  it('resumes a [-] task that already carries its log and commit without re-implementing', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    // The controller died after the implementer finished: tasks.md says [-], the
    // pick rows are on the ledger, the commit and the log exist.
    const tasks = readFileSync(join(fx.specDir, 'tasks.md'), 'utf8').replace('- [ ] 1.', '- [-] 1.');
    writeFileSync(join(fx.specDir, 'tasks.md'), tasks);
    const preHead = git(fx.repo, ['rev-parse', 'HEAD']);
    const ledger = openRunLedger({ specDir: fx.specDir, runId: RUN_ID, spec: fx.spec, now: NOW });
    ledger.phaseStart('implementation', { mode: 'normal', state: 'tasks 0/1' });
    ledger.taskPick({ task: '1', title: 'Add the module' });
    ledger.note(`task 1 pick head ${preHead}`);
    writeFileSync(join(fx.repo, 'src', 'a.js'), 'done\n');
    git(fx.repo, ['add', '-A']);
    git(fx.repo, ['commit', '-q', '-m', 'feat: task 1 (before the crash)']);
    const log = await logFile(fx, '1', ['src/a.js']);
    mkdirSync(dirname(join(fx.repo, log.path)), { recursive: true });
    writeFileSync(join(fx.repo, log.path), log.content);
    writeScript(fx, [e2eRun('pass')]); // no implementer step is scripted

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'complete', reason: undefined });
    const r = rows(fx);
    expect(r.filter((e) => e.type === 'phase.start')).toHaveLength(1); // not duplicated on re-entry
    expect(r.filter((e) => e.type === 'task.pick')).toHaveLength(1);
    expect(r.some((e) => e.type === 'note' && e.text.startsWith('task 1 resumed with its log present'))).toBe(true);
    expect(r.filter((e) => e.type === 'spawn.usage').map((e) => e.role)).toEqual(['end-to-end verification']);
    expect(taskStatus(fx, '1')).toBe('completed');
  }, 60000);

  // Regression guard (retro europe-employer-sources F5/P5): a non-resumed re-pick —
  // an escalation resets the task to pending, so a resume or same-run re-serve
  // re-spawned an implementer that only re-confirmed the existing commit. An
  // existing log plus committed work in range is the HEAD-satisfied signal, so
  // the controller reconciles without a re-spawn even though the task is not [-].
  it('reconciles a re-picked task that already carries its log and commit without re-spawning', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    // tasks.md stays [ ] (the escalation reset the task to pending), but the pick
    // rows, the commit and the log from the first spawn are all already present.
    const preHead = git(fx.repo, ['rev-parse', 'HEAD']);
    const ledger = openRunLedger({ specDir: fx.specDir, runId: RUN_ID, spec: fx.spec, now: NOW });
    ledger.phaseStart('implementation', { mode: 'normal', state: 'tasks 0/1' });
    ledger.taskPick({ task: '1', title: 'Add the module' });
    ledger.note(`task 1 pick head ${preHead}`);
    writeFileSync(join(fx.repo, 'src', 'a.js'), 'done\n');
    git(fx.repo, ['add', '-A']);
    git(fx.repo, ['commit', '-q', '-m', 'feat: task 1 (first spawn, before the escalation reset)']);
    const log = await logFile(fx, '1', ['src/a.js']);
    mkdirSync(dirname(join(fx.repo, log.path)), { recursive: true });
    writeFileSync(join(fx.repo, log.path), log.content);
    writeScript(fx, [e2eRun('pass')]); // no implementer step is scripted

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'complete', reason: undefined });
    const r = rows(fx);
    expect(r.some((e) => e.type === 'note' && e.text.startsWith('task 1 already satisfied at HEAD'))).toBe(true);
    expect(r.filter((e) => e.type === 'spawn.usage').map((e) => e.role)).toEqual(['end-to-end verification']);
    expect(taskStatus(fx, '1')).toBe('completed');
  }, 60000);

  // Contract (R3 AC 13, design C6 flow steps 1 and 5): a pass through the completion
  // gate writes the `e2e verification passed` note once, and the note
  // `completion handoff written` lands only after the HANDOFF write, also once.
  // Pre-condition: one task, approved, no prior ledger rows for this run.
  // Call: runImplementationPhase(ctx) run to completion.
  // Observable: the ledger's `note` rows carry each text exactly once, pass before handoff.
  // Source of expected value: task 11's Success clause and design C6 Data Models note texts.
  it('writes the e2e pass note once and the handoff note once, pass before handoff', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    writeScript(fx, [await implRun(fx, '1', 'src/a.js'), e2eRun('pass')]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect(outcome.result).toBe('complete');
    const texts = rows(fx).filter((e) => e.type === 'note').map((e) => e.text);
    expect(texts.filter((t) => t === 'e2e verification passed')).toHaveLength(1);
    expect(texts.filter((t) => t === 'completion handoff written')).toHaveLength(1);
    expect(texts.indexOf('e2e verification passed')).toBeLessThan(texts.indexOf('completion handoff written'));
  }, 60000);

  // Contract (R3 AC 13, design C6 flow step 1 "skip the e2e loop... else run it as today"):
  // a completion-gate re-entry after the pass note and before the handoff note reads the
  // pass from the ledger and does not re-spawn the e2e verifier.
  // Pre-condition: the one task is already `[x]` complete; the ledger carries a prior
  // `phase.start` and the `e2e verification passed` note, but no `completion handoff
  // written` note yet (a restart between the two markers); the stub script holds no run,
  // so any spawn attempt breaks the `complete` outcome below.
  // Call: runImplementationPhase(ctx).
  // Observable: no `spawn.usage` row with role `end-to-end verification`; the run still
  // reaches `complete` and gets its `completion handoff written` note.
  // Source of expected value: task 11's Test and Success clauses ("a re-entry... spawns
  // no e2e verifier (the stub script holds no e2e run)").
  it('a re-entry after the e2e pass note and before the handoff note spawns no e2e verifier', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    const tasks = readFileSync(join(fx.specDir, 'tasks.md'), 'utf8').replace('- [ ] 1.', '- [x] 1.');
    writeFileSync(join(fx.specDir, 'tasks.md'), tasks);
    const ledger = openRunLedger({ specDir: fx.specDir, runId: RUN_ID, spec: fx.spec, now: NOW });
    ledger.phaseStart('implementation', { mode: 'normal', state: 'tasks 1/1' });
    ledger.note('e2e verification passed');
    writeScript(fx, []); // the stub script holds no e2e run

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect(outcome.result).toBe('complete');
    const r = rows(fx);
    expect(r.filter((e) => e.type === 'spawn.usage' && e.role === 'end-to-end verification')).toHaveLength(0);
    expect(r.filter((e) => e.type === 'note' && e.text === 'e2e verification passed')).toHaveLength(1);
    expect(r.filter((e) => e.type === 'note' && e.text === 'completion handoff written')).toHaveLength(1);
  }, 60000);

  // Contract (R3 AC 13 "a re-entry after the HANDOFF write behaves as today", design D8
  // "the e2e pass stands until the next HANDOFF marker"): once `completion handoff
  // written` is the newer marker, the gate runs the e2e loop again on the next entry.
  // Pre-condition: the one task is already `[x]` complete; the ledger carries
  // `e2e verification passed` followed by a newer `completion handoff written` note (a
  // restart after the first full pass completed its gate once already).
  // Call: runImplementationPhase(ctx), with one `e2eRun('pass')` scripted.
  // Observable: one `spawn.usage` row with role `end-to-end verification` runs, and a
  // second `e2e verification passed` note is written.
  // Source of expected value: task 11's Test clause ("a run whose newest marker is the
  // handoff note runs e2e again").
  it('a re-entry whose newest marker is the handoff note runs e2e again', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    const tasks = readFileSync(join(fx.specDir, 'tasks.md'), 'utf8').replace('- [ ] 1.', '- [x] 1.');
    writeFileSync(join(fx.specDir, 'tasks.md'), tasks);
    const ledger = openRunLedger({ specDir: fx.specDir, runId: RUN_ID, spec: fx.spec, now: NOW });
    ledger.phaseStart('implementation', { mode: 'normal', state: 'tasks 1/1' });
    ledger.note('e2e verification passed');
    ledger.note('completion handoff written');
    writeScript(fx, [e2eRun('pass')]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect(outcome.result).toBe('complete');
    const r = rows(fx);
    expect(r.filter((e) => e.type === 'spawn.usage' && e.role === 'end-to-end verification')).toHaveLength(1);
    expect(r.filter((e) => e.type === 'note' && e.text === 'e2e verification passed')).toHaveLength(2);
  }, 60000);

  it('stops between tasks when asked and resumes from tasks.md', async () => {
    fx = await setup([taskMd('1', 'Add the first module', ['src/a.js']), taskMd('2', 'Add the second module', ['src/b.js'])]);
    writeScript(fx, [await implRun(fx, '1', 'src/a.js'), await implRun(fx, '2', 'src/b.js'), e2eRun('pass')]);
    // The seam is read before every step; ask for the stop once task 1 is `[x]`.
    const stopAfterOne = (): string | null => (taskStatus(fx!, '1') === 'completed' ? 'usage-window' : null);
    const first = await runImplementationPhase(ctxFor(fx, { shouldStop: stopAfterOne }));
    expect(first.result).toBe('stopped');
    expect(first.reason).toBe('usage-window');
    expect(taskStatus(fx, '1')).toBe('completed');
    expect(taskStatus(fx, '2')).toBe('pending');

    const second = await runImplementationPhase(ctxFor(fx));
    expect({ result: second.result, reason: second.reason }).toEqual({ result: 'complete', reason: undefined });
    expect(rows(fx).filter((e) => e.type === 'phase.start')).toHaveLength(1);
  }, 60000);

  it('runs the test author on a marked task and briefs the implementer with the red tests', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js', 'test/a.test.js'], { test: 'test/a.test.js — a()' })]);
    const authorRun: StubRun = {
      commands: [`mkdir -p test && echo "red" > test/a.test.js && git add test/a.test.js && git commit -qm "test(${fx.spec}): task 1 red"`],
      result: result({ commit: 'see git', files: ['test/a.test.js'], tests: 1, folds: 'none', flag: 'none', redImpossible: 'none', retro: 'none' }, 'commit: x\nfiles: test/a.test.js'),
    };
    writeScript(fx, [authorRun, await implRun(fx, '1', 'src/a.js'), e2eRun('pass')]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'complete', reason: undefined });
    const r = rows(fx);
    expect(r.filter((e) => e.type === 'spawn.usage').map((e) => e.role)).toEqual(['author task 1', 'implement task 1', 'end-to-end verification']);
    const brief = readFileSync(join(fx.scratch, 'impl-brief-task-1.md'), 'utf8');
    expect(brief).toContain('## Red tests (from the test author)');
    expect(brief).toContain('test/a.test.js');
    // The gate ran with the tdd proof (off ⇒ inconclusive) and said so.
    expect(r.some((e) => e.type === 'note' && /^gate: task 1 pass .* tdd inconclusive/.test(e.text))).toBe(true);
  }, 60000);

  it('briefs the implementer with no red tests when the author finds every criterion red-impossible', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js', 'test/a.test.js'], { test: 'test/a.test.js — a()' })]);
    const authorRun: StubRun = {
      commands: [`mkdir -p test && echo "guard" > test/a.test.js && git add test/a.test.js && git commit -qm "test(${fx.spec}): task 1 red"`],
      result: result({ commit: 'see git', files: ['test/a.test.js'], tests: 0, folds: 'none', flag: 'none', redImpossible: 'all', retro: 'none' }, 'all criteria pass at base'),
    };
    writeScript(fx, [authorRun, await implRun(fx, '1', 'src/a.js'), e2eRun('pass')]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'complete', reason: undefined });
    expect(rows(fx).filter((e) => e.type === 'spawn.usage').map((e) => e.role)).toEqual(['author task 1', 'implement task 1', 'end-to-end verification']);
    expect(readFileSync(join(fx.scratch, 'impl-brief-task-1.md'), 'utf8')).not.toContain('## Red tests (from the test author)');
  }, 60000);

  it('hands the operator rulings to the test author', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js', 'test/a.test.js'], { test: 'test/a.test.js — a()' })]);
    const authorRun: StubRun = {
      commands: [`mkdir -p test && echo "red" > test/a.test.js && git add test/a.test.js && git commit -qm "test(${fx.spec}): task 1 red"`],
      result: result({ commit: 'see git', files: ['test/a.test.js'], tests: 1, folds: 'none', flag: 'none', redImpossible: 'none', retro: 'none' }, 'commit: x\nfiles: test/a.test.js'),
    };
    writeScript(fx, [authorRun, await implRun(fx, '1', 'src/a.js'), e2eRun('pass')]);

    await runImplementationPhase(ctxFor(fx, { operatorRulings: ['use --no-verify for the red commit'] }));

    expect(readFileSync(join(fx.scratch, 'author-brief-task-1.md'), 'utf8'))
      .toContain('## Operator rulings\n- use --no-verify for the red commit');
  }, 60000);

  it('keeps the test author on its own profile even on a sensitive-path task (regression guard)', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['package.json', 'test/a.test.js'], { test: 'test/a.test.js — a()' })]);
    const authorRun: StubRun = {
      commands: [`mkdir -p test && echo "red" > test/a.test.js && git add test/a.test.js && git commit -qm "test(${fx.spec}): task 1 red"`],
      result: result({ commit: 'see git', files: ['test/a.test.js'], tests: 1, folds: 'none', flag: 'none', redImpossible: 'none', retro: 'none' }, 'commit: x\nfiles: test/a.test.js'),
    };
    writeScript(fx, [authorRun, await implRun(fx, '1', 'package.json'), verifierRun('pass'), e2eRun('pass'), securityPassRun([], [])]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'complete', reason: undefined });
    // R2 AC 11: the test author keeps its own (Sonnet) profile though the task's
    // own implementer route is Opus (package.json is sensitive).
    const authorArgv = initArgv(fx, 'author-task-1');
    expect(authorArgv).toEqual(expect.arrayContaining(['--model', 'claude-sonnet-5', '--effort', 'high']));
    const implArgv = initArgv(fx, 'implementer-task-1');
    expect(implArgv).toEqual(expect.arrayContaining(['--model', 'claude-opus-4-8', '--effort', 'xhigh']));
  }, 60000);

  it('opens the PR, reconciles a red check, and completes green', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    // A bare origin and a feature branch, so the push has somewhere to go.
    const origin = join(fx.base, 'origin.git');
    git(fx.repo, ['init', '-q', '--bare', origin]);
    git(fx.repo, ['remote', 'add', 'origin', origin]);
    git(fx.repo, ['push', '-q', 'origin', 'main']);
    git(fx.repo, ['checkout', '-q', '-b', 'feat/x']);
    mkdirSync(join(fx.repo, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(fx.repo, '.github', 'workflows', 'ci.yml'), 'name: test\n');
    git(fx.repo, ['add', '-A']);
    git(fx.repo, ['commit', '-q', '-m', 'ci: add a workflow']);

    const redRuns = { argvIncludes: ['api'], stdout: { total_count: 1, workflow_runs: [{ id: 11, name: 'test', status: 'completed', conclusion: 'failure' }] } };
    const greenRuns = { argvIncludes: ['api'], stdout: { total_count: 1, workflow_runs: [{ id: 12, name: 'test', status: 'completed', conclusion: 'success' }] } };
    const statusOk = { argvIncludes: ['api'], stdout: { state: 'pending', total_count: 0, statuses: [] } };
    writeGhScript(fx, [
      { argvIncludes: ['auth', 'status'], stdout: 'Logged in' },
      { argvIncludes: ['pr', 'list'], stdout: [] },
      { argvIncludes: ['pr', 'create'], stdout: 'https://github.com/x/y/pull/7\n' },
      redRuns, statusOk,
      { argvIncludes: ['run', 'view', '11', '--log-failed'], stdout: 'line 1\nAssertionError: expected 1 to be 2\n' },
      greenRuns, statusOk,
    ]);
    writeScript(fx, [
      await implRun(fx, '1', 'src/a.js'),
      e2eRun('pass'),
      { ...(await implRun(fx, 'ci', 'src/a.js', { message: 'fix: the test' })), result: result({ logged: 'n/a', commit: 'none', checks: '', checksFile: '', green: '', flag: 'none', retro: 'none', reproduce: 'npm test' }) },
      verifierRun('pass'),
    ]);

    const outcome = await runImplementationPhase(ctxFor(fx, { run: { ...ctxFor(fx).run, branch: 'feat/x' } }));

    expect({ result: outcome.result, reason: outcome.reason }).toEqual({ result: 'complete', reason: undefined });
    const problems = rows(fx).filter((e) => e.type === 'note' && /failed|not opened|unreadable/.test(e.text)).map((e) => e.text);
    expect(problems).toEqual([]);
    expect(outcome.pr).toEqual({ number: 7, url: 'https://github.com/x/y/pull/7' });
    const r = rows(fx);
    expect(r.filter((e) => e.type === 'spawn.usage').map((e) => e.role)).toEqual([
      'implement task 1', 'end-to-end verification', 'fix ci test round 1', 'verify ci test round 1',
    ]);
    expect(r.some((e) => e.type === 'note' && e.text === 'ci red: test, round 1')).toBe(true);
    expect(readFileSync(join(fx.scratch, 'ci-test-r1.log'), 'utf8')).toContain('AssertionError');
    expect(readFileSync(join(fx.scratch, 'impl-brief-ci-r1.md'), 'utf8')).toContain('ci-test-r1.log');
    expect(readFileSync(join(fx.scratch, 'verify-brief-ci-r1.md'), 'utf8')).toContain('npm test');
    // The PR body: one bullet per task, the test plan, no attribution.
    const body = readFileSync(join(fx.scratch, 'pr-body.md'), 'utf8');
    expect(body).toContain('## Summary\n- Add the module');
    expect(body).toContain('## Test plan');
    expect(body).toContain('- [x] `true`');
    expect(body).not.toMatch(/Generated with|Co-Authored/);
    const argv = readFileSync(join(fx.base, 'gh-script.json.argv'), 'utf8');
    expect(argv).toContain('"--title","the fixture spec"'); // the "(active)" marker is not part of the title
    // Pushed twice: once to open the PR, once after the fix.
    expect(git(origin, ['log', '--format=%s', 'feat/x'])).toContain('fix: the test');
    expect(readFileSync(join(fx.repo, '.spec-workflow', 'HANDOFF.md'), 'utf8')).toMatch(/\| PR \| https:\/\/github.com\/x\/y\/pull\/7/);
    expect(rows(fx).find((e) => e.type === 'phase.end')).toMatchObject({ result: 'complete', note: 'PR #7' });
    // Regression guard (R2 AC 10): a PR-checks reconcile round belongs to no task
    // and keeps the sdd-implementer (Opus) profile even though task 1's own route
    // is Sonnet.
    const reconcileArgv = initArgv(fx, 'implementer-ci-r1');
    expect(reconcileArgv).toEqual(expect.arrayContaining(['--model', 'claude-opus-4-8', '--effort', 'xhigh']));
  }, 60000);
});

// Contract (design C6 flow steps 2-4, R3 AC 1-3, 6-12): the completion gate's security
// pass loop, driven from the state reader task 10 exports (security-pass.ts) and the
// brief variants task 5 adds. Fold record: AC 3.1, 3.3, 3.6, 3.7 and 3.8 are folded into
// the single "a flagged spec runs..." case below (one spec exercising the full pass ->
// fix -> recheck -> adjudicate -> recheck sequence and the brief's scoping); AC 3.12 (the
// counts note after each step) is folded into the same case's note-prefix assertions; AC
// 3.10 and 3.11 (one deferral per suspicion, a suspicion never blocks) are folded into the
// "creates one deferral per suspicion..." case.
describe('security pass loop (design C6, R3 AC 1-3, 6-12)', () => {
  // Pre-condition: a spec with no `sensitive-path` class (a) item.
  // Call: runImplementationPhase(ctx) run to completion.
  // Observable: no `note` row whose text starts `security:`, and no `spawn.usage` row
  // whose role mentions "security".
  // Source of expected value: R3 AC 2 ("no task... THEN the controller SHALL run no
  // security pass and the completion gate SHALL behave as today").
  it('an unflagged spec writes no security: note and spawns no security step', async () => {
    fx = await setup([taskMd('1', 'Add the module', ['src/a.js'])]);
    writeScript(fx, [await implRun(fx, '1', 'src/a.js'), e2eRun('pass')]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect(outcome.result).toBe('complete');
    const r = rows(fx);
    expect(r.filter((e) => e.type === 'note' && (e.text ?? '').startsWith('security:'))).toHaveLength(0);
    expect(r.filter((e) => e.type === 'spawn.usage' && /security/i.test(e.role ?? ''))).toHaveLength(0);
  }, 60000);

  // Pre-condition: one task with a `sensitive-path` item (package.json), on a branch
  // that diverges from `main` so the pass brief's diff is non-empty; the security pass
  // reports the same finding on every pass/recheck (it never reproduces as fixed).
  // Call: runImplementationPhase(ctx) run to completion.
  // Observable: the spawn.usage role sequence (pass, two fix/recheck cycles, the
  // adjudicator, a final recheck); the `security:` note prefixes in that order, ending
  // `security: escalated`; the outcome `security-open` with the still-open finding; the
  // pass brief lists the sensitive file before the other changed file and names the
  // `security/` scratch directory; no `completion handoff written` note (the run stops
  // short of the HANDOFF write and the push).
  // Source of expected value: R3 AC 1 (run the pass once the spec is flagged), AC 3
  // (scope and sensitive-first ordering), AC 6-7 (at most 2 fix/recheck rounds, then the
  // adjudicator), AC 8 (escalate with the open findings), AC 12 (a counts note per step,
  // read here as the stage-prefixed note existing once per step); design C6 Interfaces
  // (the `security-pass.ts` note prefixes `readSecurityState` reads) and Flow steps 2-4.
  it('a flagged spec runs pass, two fix/recheck rounds, the adjudicator and a final recheck, then returns security-open, scoping the pass brief to the diff with sensitive files first', async () => {
    fx = await setup([taskMd('1', 'Touch the manifest', ['package.json', 'src/other.js'])]);
    const origin = join(fx.base, 'origin.git');
    git(fx.repo, ['init', '-q', '--bare', origin]);
    git(fx.repo, ['remote', 'add', 'origin', origin]);
    git(fx.repo, ['push', '-q', 'origin', 'main']);
    git(fx.repo, ['fetch', '-q', 'origin']);
    git(fx.repo, ['remote', 'set-head', 'origin', 'main']);
    git(fx.repo, ['checkout', '-q', '-b', 'feat/sec']);

    const finding = { title: 'Hardcoded secret', file: 'package.json', command: 'grep -n SECRET package.json', output: 'SECRET_KEY=abc123' };
    writeGhScript(fx, [{ argvIncludes: ['auth', 'status'], stdout: 'Logged in' }]);
    writeScript(fx, [
      await implRunMulti(fx, '1', ['package.json', 'src/other.js']),
      verifierRun('pass'),
      e2eRun('pass'),
      securityPassRun([finding]),
      securityFixRun('src/other.js', 'security fix 1'),
      securityPassRun([finding]),
      securityFixRun('src/other.js', 'security fix 2'),
      securityPassRun([finding]),
      adjudicatorRun(),
      securityPassRun([finding]),
    ]);

    const outcome = (await runImplementationPhase(
      ctxFor(fx, { run: { ...ctxFor(fx).run, branch: 'feat/sec' } }),
    )) as unknown as { result: string; findings?: SecurityFindingLike[]; tasks: { done: number; total: number } };

    expect(outcome.result).toBe('security-open');
    expect(outcome.findings).toEqual([finding]);
    expect(outcome.tasks).toEqual({ done: 1, total: 1 });

    const r = rows(fx);
    const roles = r.filter((e) => e.type === 'spawn.usage').map((e) => e.role);
    expect(roles).toEqual([
      'implement task 1', 'verify task 1', 'end-to-end verification',
      'security pass', 'fix security round 1', 'verify security round 1',
      'fix security round 2', 'verify security round 2',
      'adjudicate security', 'verify security adjudicated',
    ]);

    const secNotes = r.filter((e) => e.type === 'note' && (e.text ?? '').startsWith('security:')).map((e) => e.text ?? '');
    expect(secNotes[0]).toMatch(/^security: epoch 1\b/);
    expect(secNotes.filter((t) => t.startsWith('security: pass'))).toHaveLength(1);
    expect(secNotes.filter((t) => t.startsWith('security: fix round'))).toHaveLength(2);
    expect(secNotes.filter((t) => t.startsWith('security: recheck adjudicated'))).toHaveLength(1);
    expect(secNotes.filter((t) => t.startsWith('security: recheck ') && !t.startsWith('security: recheck adjudicated'))).toHaveLength(2);
    expect(secNotes.some((t) => t.startsWith('security: adjudicator'))).toBe(true);
    expect(secNotes[secNotes.length - 1]).toMatch(/^security: escalated\b/);
    expect(r.some((e) => e.type === 'note' && e.text === 'completion handoff written')).toBe(false);

    // AC 3.3: `git diff <base>...HEAD`, the sensitive file listed before the other one.
    const briefFiles = readdirSync(fx.scratch).filter((f) => f.endsWith('.md'));
    const passBriefName = briefFiles.find((f) => readFileSync(join(fx!.scratch, f), 'utf8').includes(`# Security review — spec ${fx!.spec}`));
    expect(passBriefName).toBeDefined();
    const passBrief = readFileSync(join(fx.scratch, passBriefName as string), 'utf8');
    const sIdx = passBrief.indexOf('### Sensitive files');
    const oIdx = passBrief.indexOf('### Other changed files');
    expect(sIdx).toBeGreaterThan(-1);
    expect(oIdx).toBeGreaterThan(sIdx);
    expect(passBrief.slice(sIdx, oIdx)).toContain('package.json');
    expect(passBrief.slice(oIdx)).toContain('src/other.js');
    expect(passBrief).toContain('security/');
  }, 60000);

  // Pre-condition: one sensitive-path task; the pass reports a finding and a suspicion,
  // the fix round resolves the finding, and the recheck re-reports the same suspicion
  // (the suspicion never reproduces as "fixed" because it was never a finding).
  // Call: runImplementationPhase(ctx) run to completion.
  // Observable: exactly one deferral exists for this spec tagged `security`, owned by
  // `matthew`, phase `implementation`, whose body names the file and the why; exactly
  // one `security: suspicion <key> deferral <id>` note despite the suspicion being
  // reported twice; the run still reaches `complete` (the suspicion opens no wait and
  // stops nothing).
  // Source of expected value: R3 AC 10 ("a re-entry SHALL NOT create the same deferral
  // twice") and AC 11 ("A suspicion SHALL NOT start a fix round, open a wait, or stop the
  // run"); design C6 flow step 3's deferral paragraph (`body.context` = `<file>: <why>`).
  it('creates one deferral per suspicion even when a later security step repeats it, and does not block the run', async () => {
    fx = await setup([taskMd('1', 'Touch the manifest', ['package.json'])]);
    const suspicion = { title: 'Possible secret leak', file: 'package.json', why: 'env var name looks sensitive' };
    const finding = { title: 'Hardcoded secret', file: 'package.json', command: 'grep -n SECRET package.json', output: 'SECRET_KEY=abc123' };
    writeScript(fx, [
      await implRun(fx, '1', 'package.json'),
      verifierRun('pass'),
      e2eRun('pass'),
      securityPassRun([finding], [suspicion]),
      securityFixRun('package.json', 'security fix 1'),
      securityPassRun([], [suspicion]),
    ]);

    const outcome = await runImplementationPhase(ctxFor(fx));

    expect(outcome.result).toBe('complete');
    const storage = new DeferralStorage(fx.repo);
    const defs = await storage.list({ originSpec: fx.spec, tag: 'security' });
    expect(defs).toHaveLength(1);
    expect(defs[0]).toMatchObject({ owner: 'matthew', originPhase: 'implementation' });
    expect(defs[0].tags).toContain('security');
    expect(defs[0].body.context).toBe('package.json: env var name looks sensitive');

    const r = rows(fx);
    expect(r.filter((e) => e.type === 'note' && /^security: suspicion [0-9a-f]{8} deferral \S+/.test(e.text ?? ''))).toHaveLength(1);
  }, 60000);

  // Pre-condition: the run already escalated (the ledger carries `security: epoch 1`,
  // `security: open [<finding>]` and `security: escalated` for one finding) and reaches
  // its completion gate again with the operator's `accept` answer; a remote and a bare
  // origin exist so the PR body is built.
  // Call: runImplementationPhase(ctx) with `securityAnswers: [{ waitId: 'w1', value:
  // 'accept' }]`.
  // Observable: the run reaches `complete`; the HANDOFF Gotchas row names the accepted
  // finding; the PR body's Test plan carries an unchecked line with the finding and its
  // reproduce command; the retro log carries a `ruling` entry naming the finding; the
  // security pass is not re-run and the e2e verifier is not re-spawned.
  // Source of expected value: R3 AC 9's `accept` clause (Gotchas row, unchecked PR body
  // Test plan line, retro-log entry, continue to the HANDOFF write and the push without
  // running the pass again) and AC 13 (the e2e verifier is not re-spawned on this
  // re-entry).
  it('accept resumes to the HANDOFF write and push, recording the finding in Gotchas, the PR body and the retro log', async () => {
    fx = await setup([taskMd('1', 'Touch the manifest', ['package.json'])]);
    const tasks = readFileSync(join(fx.specDir, 'tasks.md'), 'utf8').replace('- [ ] 1.', '- [x] 1.');
    writeFileSync(join(fx.specDir, 'tasks.md'), tasks);

    const origin = join(fx.base, 'origin.git');
    git(fx.repo, ['init', '-q', '--bare', origin]);
    git(fx.repo, ['remote', 'add', 'origin', origin]);
    git(fx.repo, ['push', '-q', 'origin', 'main']);
    git(fx.repo, ['checkout', '-q', '-b', 'feat/x']);

    const finding = { title: 'Hardcoded secret', file: 'package.json', command: 'grep -n SECRET package.json', output: 'SECRET_KEY=abc123' };
    const ledger = openRunLedger({ specDir: fx.specDir, runId: RUN_ID, spec: fx.spec, now: NOW });
    ledger.phaseStart('implementation', { mode: 'normal', state: 'tasks 1/1' });
    ledger.note('e2e verification passed');
    ledger.note('security: epoch 1');
    ledger.note(`security: open ${JSON.stringify([finding])}`);
    ledger.note('security: escalated');

    writeGhScript(fx, [
      { argvIncludes: ['auth', 'status'], stdout: 'Logged in' },
      { argvIncludes: ['pr', 'list'], stdout: [] },
      { argvIncludes: ['pr', 'create'], stdout: 'https://github.com/x/y/pull/9\n' },
      { argvIncludes: ['api'], stdout: { total_count: 0, workflow_runs: [] } },
      { argvIncludes: ['api'], stdout: { total_count: 0, statuses: [] } },
    ]);
    writeScript(fx, []);

    const over = {
      run: { ...ctxFor(fx).run, branch: 'feat/x' },
      securityAnswers: [{ waitId: 'w1', value: 'accept' }],
    } as unknown as Partial<ImplementationPhaseContext>;
    const outcome = (await runImplementationPhase(ctxFor(fx, over))) as unknown as { result: string };

    expect(outcome.result).toBe('complete');
    const ho = readFileSync(join(fx.repo, '.spec-workflow', 'HANDOFF.md'), 'utf8');
    expect(ho).toMatch(/\| Gotchas \|.*accepted security finding: Hardcoded secret \(package\.json\)/);
    const body = readFileSync(join(fx.scratch, 'pr-body.md'), 'utf8');
    expect(body).toContain('- [ ] accepted security finding: Hardcoded secret (package.json): grep -n SECRET package.json');
    const retroLog = readFileSync(join(fx.specDir, 'retrospective-log.md'), 'utf8');
    expect(retroLog).toContain('· ruling');
    expect(retroLog).toContain('Hardcoded secret');

    const r = rows(fx);
    expect(r.some((e) => e.type === 'note' && e.text === 'security: answer w1 accept')).toBe(true);
    expect(r.some((e) => e.type === 'note' && (e.text ?? '').startsWith('security: accepted '))).toBe(true);
    expect(r.filter((e) => e.type === 'note' && (e.text ?? '').startsWith('security: pass'))).toHaveLength(0);
    expect(r.filter((e) => e.type === 'spawn.usage' && e.role === 'end-to-end verification')).toHaveLength(0);
  }, 60000);

  // Pre-condition: the run already escalated, same seeded state as the `accept` case
  // above, but no remote (the PR path is not exercised here); the new epoch's pass finds
  // nothing.
  // Call: runImplementationPhase(ctx) with `securityAnswers: [{ waitId: 'w2', value:
  // 'retry' }]`.
  // Observable: a `security: answer w2 retry` note and a `security: epoch 2` note; the
  // run spawns exactly one new security-labelled step (the new epoch's pass) and no
  // `end-to-end verification` spawn; the run reaches `complete`.
  // Source of expected value: R3 AC 9's `retry` clause ("write a `note` row that opens a
  // new security-pass epoch and run the pass from round 1... the e2e verification SHALL
  // NOT be re-run") and AC 13 (a security re-entry never re-spawns the e2e verifier).
  it('retry opens a new epoch and runs the pass again without re-running e2e', async () => {
    fx = await setup([taskMd('1', 'Touch the manifest', ['package.json'])]);
    const tasks = readFileSync(join(fx.specDir, 'tasks.md'), 'utf8').replace('- [ ] 1.', '- [x] 1.');
    writeFileSync(join(fx.specDir, 'tasks.md'), tasks);

    const finding = { title: 'Hardcoded secret', file: 'package.json', command: 'grep -n SECRET package.json', output: 'SECRET_KEY=abc123' };
    const ledger = openRunLedger({ specDir: fx.specDir, runId: RUN_ID, spec: fx.spec, now: NOW });
    ledger.phaseStart('implementation', { mode: 'normal', state: 'tasks 1/1' });
    ledger.note('e2e verification passed');
    ledger.note('security: epoch 1');
    ledger.note(`security: open ${JSON.stringify([finding])}`);
    ledger.note('security: escalated');

    writeScript(fx, [securityPassRun([], [])]);

    const over = { securityAnswers: [{ waitId: 'w2', value: 'retry' }] } as unknown as Partial<ImplementationPhaseContext>;
    const outcome = (await runImplementationPhase(ctxFor(fx, over))) as unknown as { result: string };

    expect(outcome.result).toBe('complete');
    const r = rows(fx);
    expect(r.some((e) => e.type === 'note' && e.text === 'security: answer w2 retry')).toBe(true);
    expect(r.some((e) => e.type === 'note' && e.text === 'security: epoch 2')).toBe(true);
    expect(r.filter((e) => e.type === 'spawn.usage' && e.role === 'end-to-end verification')).toHaveLength(0);
    expect(r.filter((e) => e.type === 'spawn.usage' && /security/i.test(e.role ?? ''))).toHaveLength(1);
  }, 60000);
});
