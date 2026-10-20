import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync, readdirSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import {
  runImplementationPhase, readChecksFile, isWiringTask, setHandoffRow, readHandoffRow,
  type ImplementationPhaseContext,
} from '../implementation.js';
import { openRunLedger } from '../../ledger.js';
import { ImplementationLogManager } from '../../../dashboard/implementation-log-manager.js';
import { parseTasksFromMarkdown } from '../../../core/task-parser.js';
import { approvalsHandler } from '../../../tools/approvals.js';
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
  }, 60000);
});
