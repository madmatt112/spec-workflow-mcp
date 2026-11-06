// src/controller/__tests__/deploy-e2e.test.ts
//
// Design "Testing Strategy" (Integration): scenarios 1 to 6 with a real
// `Controller`, a temp `SDD_HOME` and the real `scripts/sdd-self-update.sh` in
// a toy checkout, under a `DeployUnit` that spawns the script as a detached
// child. Fixture helpers for the controller/project side are copied from
// `liveness-e2e.test.ts:49-56,63-80,128-164` (`setup`, `streamingDraftRun`,
// `writeScript`, `makeController`, `waitForRun`); the toy-checkout helpers are
// copied from `service-scripts.test.ts:42-76` (`git`, `makeDivergedCheckout`,
// `stageBuildStub`) and `:528-540` (the `dist/controller/waits.js` stub).
//
// Task 14 Note: every criterion here already holds once tasks 1-9 land, so
// this task is implementer-only (no red test, no verifier) and a failure here
// is a defect in one of those tasks, not a new requirement.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, existsSync, readFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync, spawn, type ChildProcess } from 'child_process';
import { Controller } from '../controller.js';
import {
  readRun, writeRun, readWait, isProcessAlive, processStartTime, type RunRecord,
} from '../state.js';
import { createWait, answerWait } from '../waits.js';
import { approvalsHandler } from '../../tools/approvals.js';
import { readDeployRecord, deployRecordPath, type DeployUnit, type UnitState } from '../deploy.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, '..', '..', '..', 'scripts', 'stub-claude.mjs');
const STUB_GH = join(HERE, '..', '..', '..', 'scripts', 'stub-gh.mjs');
const SELF_UPDATE_SH = join(HERE, '..', '..', '..', 'scripts', 'sdd-self-update.sh');
const SPEC = 'ctrl-deploy';
const savedEnv = { ...process.env };

function git(cwd: string, ...args: string[]): void {
  execFileSync('git', args, { cwd, stdio: 'ignore' });
}

function cleanDoc(title: string): string {
  return [
    `# ${title}`, '',
    '## Introduction',
    'The controller drafts documents. It serves the operator. It changes nothing else.', '',
    '## Requirements',
    'The controller SHALL draft, review and approve each document in order.', '',
    '## Revision History', '- **v1** (2026-11-05) — Initial draft.', '',
  ].join('\n');
}

const USAGE = {
  input_tokens: 5, output_tokens: 50, cache_read_input_tokens: 10,
  cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 20 },
};

interface StubRun {
  edits?: { path: string; content: string }[];
  result: Record<string, unknown>;
  stream?: unknown[];
  eventDelayMs?: number;
  commands?: string[];
}

/** Copied from `liveness-e2e.test.ts:63-80`: a long-running, genuinely-live step. */
function streamingDraftRun(doc: string, count: number, eventDelayMs: number): StubRun {
  const stream = Array.from({ length: count }, (_, i) => ({
    type: 'assistant',
    message: { content: [{ type: 'text', text: `thinking ${i}` }] },
  }));
  return {
    stream,
    eventDelayMs,
    edits: [
      { path: `.spec-workflow/specs/${SPEC}/${doc}.md`, content: cleanDoc(doc) },
      { path: `.spec-workflow/specs/${SPEC}/codebase-context.md`, content: '# ctx\n' },
    ],
    result: {
      subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: 'drafted',
      structured_output: { wordCount: 40, decisions: [], contextFileWritten: true }, usage: USAGE,
    },
  };
}

function reviewerRun(suffix: string): { edits: { path: string; content: string }[]; result: Record<string, unknown> } {
  return {
    edits: [{ path: `.spec-workflow/specs/${SPEC}/reviews/adversarial-analysis-${suffix}.md`, content: 'ok\nVERDICT: converged\n' }],
    result: { subtype: 'success', is_error: false, num_turns: 2, session_id: 's', result: 'reviewed', structured_output: { verdict: 'converged', mustFix: [], shouldFix: [], recurring: [], escalate: 'none', analysisPath: '' }, usage: USAGE },
  };
}
const PROPOSALS = [
  `# Retrospective proposals — ${SPEC}`, '',
  '## Proposals',
  '- **P1 (F1) — Tidy the ledger.** Make it nicer.',
  '  Target: harness skills or agents.',
  '  DECISION NEEDED: no.', '',
  '## Graduation candidates', 'None found.', '',
].join('\n');
function e2eRun(): { result: Record<string, unknown> } {
  return {
    result: {
      subtype: 'success', is_error: false, num_turns: 1, session_id: 's', result: 'VERIFY: pass',
      structured_output: { verify: 'pass', deferredCommand: '', findings: '', retro: 'none' }, usage: USAGE,
    },
  };
}
function compileRun(): { edits: { path: string; content: string }[]; result: Record<string, unknown> } {
  return {
    edits: [{ path: `.spec-workflow/specs/${SPEC}/retrospective.md`, content: ['# Retrospective — ' + SPEC, '', '## Gotchas', '- **F1 — x.** y. Evidence: z. Frequency: once. Cost: 1.', '', '## Proposal format (for the analyst)', '', 'One per finding.', ''].join('\n') }],
    result: { subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: 'compiled', structured_output: { findings: 1, path: 'retrospective.md' }, usage: USAGE },
  };
}
function analystRun(): { edits: { path: string; content: string }[]; result: Record<string, unknown> } {
  return {
    edits: [{ path: `.spec-workflow/specs/${SPEC}/retrospective-proposals.md`, content: PROPOSALS }],
    result: { subtype: 'success', is_error: false, num_turns: 3, session_id: 's', result: 'proposed', structured_output: { proposals: 1 }, usage: USAGE },
  };
}
function closeoutBatchRun(): { commands: string[]; result: Record<string, unknown> } {
  return {
    commands: [`echo note >> harness-note.md && git add harness-note.md && git commit -qm "chore(retro): ${SPEC} P1 tidy"`],
    result: { subtype: 'success', is_error: false, num_turns: 4, session_id: 's', result: 'P1: done', structured_output: { items: [{ id: 'P1', status: 'done', commit: 'none', reason: '' }], retro: 'none' }, usage: USAGE },
  };
}

const GH_RUNS_OK = { argvIncludes: ['api'], stdout: { total_count: 1, workflow_runs: [{ name: 'build', status: 'completed', conclusion: 'success' }] } };
const GH_STATUS_OK = { argvIncludes: ['api'], stdout: { state: 'pending', total_count: 0, statuses: [] } };

function scriptMergeablePR(fx: Fixture, branch: string, oid: string): void {
  const view = {
    mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN',
    headRefName: branch, headRefOid: 'deadbeefcafe', body: 'Clean body.',
    commits: [{ oid: 'deadbeefcafe', messageHeadline: 'feat: do it', messageBody: '', committedDate: '2026-11-05T11:00:00.000Z' }],
    author: { login: 'someone' },
  };
  const ghScript = join(fx.base, 'gh-script.json');
  writeFileSync(ghScript, JSON.stringify([
    { argvIncludes: ['pr', 'list'], stdout: [{ number: 7, headRefName: branch, baseRefName: 'main', url: 'x' }] },
    { argvIncludes: ['pr', 'view'], stdout: view },
    GH_RUNS_OK, GH_STATUS_OK,
    { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
    { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid } } },
  ]));
  process.env.STUB_GH_SCRIPT = ghScript;
}

async function approve(fx: Fixture, doc: 'requirements' | 'design' | 'tasks'): Promise<void> {
  const ctx = { projectPath: fx.repo, workspacePath: fx.repo };
  writeFileSync(join(fx.specDir, `${doc}.md`), cleanDoc(doc));
  const req = await approvalsHandler({
    action: 'request', title: `${SPEC} ${doc}`, filePath: `.spec-workflow/specs/${SPEC}/${doc}.md`,
    type: 'document', category: 'spec', categoryName: SPEC,
  }, ctx);
  const approvalId = (req.data as { approvalId: string }).approvalId;
  await approvalsHandler({ action: 'approve', approvalId, response: 'ok' }, ctx);
}

interface Fixture { base: string; repo: string; specDir: string; home: string; }

/** Copied/adapted from `liveness-e2e.test.ts:128-147`: the project side (Controller's own repo). */
function setup(): Fixture {
  const base = mkdtempSync(join(tmpdir(), 'deploy-e2e-'));
  const repo = join(base, 'repo');
  const specDir = join(repo, '.spec-workflow', 'specs', SPEC);
  mkdirSync(specDir, { recursive: true });
  git(repo, 'init', '-q');
  git(repo, 'config', 'user.email', 't@test');
  git(repo, 'config', 'user.name', 'Tester');
  git(repo, 'config', 'commit.gpgsign', 'false');
  writeFileSync(join(repo, 'README.md'), 'init\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  const home = join(base, 'home');
  mkdirSync(home, { recursive: true });
  process.env.SDD_HOME = home;
  process.env.CONTROLLER_CLAUDE_BIN = STUB;
  process.env.CONTROLLER_HARNESS_REPO = repo;
  process.env.CONTROLLER_GH_BIN = STUB_GH;
  return { base, repo, specDir, home };
}

function writeScript(fx: Fixture, runs: StubRun[]): void {
  const scriptPath = join(fx.base, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;
}

function makeController(fx: Fixture, opts: { deployUnit?: DeployUnit; deployWaitLimitMs?: number; deployDisabled?: boolean } = {}): Controller {
  return new Controller({
    resolveProject: () => ({ projectPath: fx.repo, workspacePath: fx.repo }),
    mcpConfigFor: () => ({ mcpServers: {} }),
    ensureWorktree: async () => ({ worktree: fx.repo, branch: 'main' }),
    claudeBin: () => STUB,
    tickMs: 25,
    graceMs: 1500,
    ...opts,
  });
}

/** Poll `predicate` against the run on disk every 5ms until it is true or `ms` elapses. */
async function waitForRun(
  id: string, predicate: (run: RunRecord | undefined) => boolean, ms: number, onTimeout: string,
): Promise<RunRecord | undefined> {
  const deadline = Date.now() + ms;
  for (;;) {
    const run = await readRun(id);
    if (predicate(run)) return run;
    if (Date.now() > deadline) throw new Error(onTimeout);
    await new Promise((r) => setTimeout(r, 5));
  }
}

/** Poll `predicate` against a plain value every 10ms until it is true or `ms` elapses. */
async function waitFor<T>(read: () => T, predicate: (v: T) => boolean, ms: number, onTimeout: string): Promise<T> {
  const deadline = Date.now() + ms;
  for (;;) {
    const v = read();
    if (predicate(v)) return v;
    if (Date.now() > deadline) throw new Error(onTimeout);
    await new Promise((r) => setTimeout(r, 10));
  }
}

// ---------------------------------------------------------------------------
// Toy checkout helpers, copied/adapted from `service-scripts.test.ts:42-76`
// (`git`, `makeDivergedCheckout`, `stageBuildStub`) and `:117-121` (no `home`:
// the deploy target shares the controller's own `SDD_HOME`).
// ---------------------------------------------------------------------------

/** A toy checkout whose `origin` has advanced by one commit (the "merged PR"). */
function makeToyCheckout(base: string): { checkout: string; origin: string } {
  const origin = join(base, 'origin');
  const checkout = join(base, 'checkout');
  mkdirSync(origin, { recursive: true });
  git(origin, 'init', '-q', '-b', 'main');
  git(origin, 'config', 'user.email', 't@example.com');
  git(origin, 'config', 'user.name', 'Test');
  mkdirSync(join(origin, 'src'), { recursive: true });
  writeFileSync(join(origin, 'package.json'), '{"name":"toy","version":"0.0.0"}\n');
  writeFileSync(join(origin, 'src', 'index.ts'), 'export const x = 1;\n');
  git(origin, 'add', '-A');
  git(origin, 'commit', '-qm', 'init');
  execFileSync('git', ['clone', '--quiet', origin, checkout]);
  git(checkout, 'config', 'user.email', 't@example.com');
  git(checkout, 'config', 'user.name', 'Test');
  writeFileSync(join(origin, 'src', 'index.ts'), 'export const x = 1;\n// merged PR\n');
  git(origin, 'add', '-A');
  git(origin, 'commit', '-qm', 'merged PR');
  return { checkout, origin };
}

/** Design Component 10 (D8): a stub `dist/evals/cli.js` so the staged gate needs no real build. */
function stageBuildStub(body: string): string {
  return `mkdir -p dist/evals\ncat > dist/evals/cli.js <<'JSEOF'\n${body}\nJSEOF\n`;
}

/** The gate stub's own body: exits `code`, writing `summary` to `--summary-file` first when given. */
function gateBody(code: number, summary?: string): string {
  const lines = ["const fs = require('fs');"];
  if (summary !== undefined) {
    lines.push("const i = process.argv.indexOf('--summary-file');");
    lines.push(`if (i >= 0) fs.writeFileSync(process.argv[i + 1], ${JSON.stringify(summary)});`);
  }
  lines.push(`process.exit(${code});`);
  return `${lines.join('\n')}\n`;
}

/** A stub `npm`/`systemctl` directory, first on `PATH`: both no-op and exit 0. */
function writeStubBin(dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'npm'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  writeFileSync(join(dir, 'systemctl'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
}

/** A stub `dist/controller/waits.js` (`service-scripts.test.ts:528-540`): records the error-wait text. */
function writeWaitsStub(checkout: string, recordPath: string): void {
  mkdirSync(join(checkout, 'dist', 'controller'), { recursive: true });
  writeFileSync(join(checkout, 'dist', 'controller', 'waits.js'), [
    "const fs = require('fs');",
    "const path = require('path');",
    'exports.createWait = async function (opts) {',
    `  fs.writeFileSync(${JSON.stringify(recordPath)}, opts.questions[0].text);`,
    '};',
    '',
  ].join('\n'));
}

function sh(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

/**
 * The real `DeployUnit` (design C5 seam) task 14 adds for this test only: it
 * spawns `scripts/sdd-self-update.sh` as a detached child (its own process
 * group, as systemd's cgroup would be), tracking it by a pid/start-time file
 * under `home` so a fresh `DeployUnit` object (a restarted controller) finds
 * the same child. `stop()` signals the whole process group, as systemd signals
 * the cgroup.
 */
function makeRealUnit(opts: {
  checkout: string; home: string; stubDir: string;
  buildCmd?: string; smokeCmd?: string; prestartGate?: string;
}): { unit: DeployUnit; pidFilePath: string } {
  const pidFilePath = join(opts.home, 'test-unit-pid.json');
  const unit: DeployUnit = {
    start(recordPath: string): Promise<void> {
      return new Promise<void>((resolve, reject) => {
        const inner = `exec bash ${sh(SELF_UPDATE_SH)} --deploy-record ${sh(recordPath)}`;
        const script = opts.prestartGate
          ? `while [ ! -f ${sh(opts.prestartGate)} ]; do sleep 0.02; done\n${inner}\n`
          : `${inner}\n`;
        let child: ChildProcess;
        try {
          child = spawn('bash', ['-c', script], {
            cwd: opts.checkout,
            env: {
              ...process.env,
              SDD_CHECKOUT: opts.checkout,
              SDD_HOME: opts.home,
              PATH: `${opts.stubDir}:${process.env.PATH ?? ''}`,
              ...(opts.buildCmd !== undefined ? { SDD_STAGE_BUILD: opts.buildCmd } : {}),
              ...(opts.smokeCmd !== undefined ? { SDD_STAGE_SMOKE: opts.smokeCmd } : {}),
            },
            detached: true,
            stdio: 'ignore',
          });
        } catch (err) {
          reject(err as Error);
          return;
        }
        child.once('error', (err) => reject(err));
        child.once('spawn', () => {
          const pid = child.pid as number;
          const startTime = processStartTime(pid) ?? 0;
          writeFileSync(pidFilePath, JSON.stringify({ pid, startTime }));
          child.unref();
          resolve();
        });
      });
    },
    async state(): Promise<UnitState> {
      if (!existsSync(pidFilePath)) return 'gone';
      const { pid, startTime } = JSON.parse(readFileSync(pidFilePath, 'utf-8')) as { pid: number; startTime: number };
      return isProcessAlive(pid, startTime) ? 'live' : 'gone';
    },
    async stop(): Promise<void> {
      if (!existsSync(pidFilePath)) return;
      const { pid } = JSON.parse(readFileSync(pidFilePath, 'utf-8')) as { pid: number; startTime: number };
      try {
        process.kill(-pid, 'SIGTERM');
      } catch {
        // already gone
      }
    },
  };
  return { unit, pidFilePath };
}

function killPidFile(pidFilePath: string): void {
  if (!existsSync(pidFilePath)) return;
  try {
    const { pid } = JSON.parse(readFileSync(pidFilePath, 'utf-8')) as { pid: number };
    process.kill(-pid, 'SIGKILL');
  } catch {
    // already gone
  }
}

/** A simple held run (no live drive): included in `HOLDABLE_STATUSES`, nothing else drives it. */
async function seedHeldRun(fx: Fixture, id: string, status: RunRecord['status'] = 'queued'): Promise<void> {
  const iso = new Date().toISOString();
  await writeRun({
    v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: `${SPEC}-${id}`,
    worktree: fx.repo, branch: 'main', status, created: iso, updated: iso,
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  });
}

/** A `waiting` run with one open, unanswered `question` wait. */
async function seedWaitingRun(fx: Fixture, id: string): Promise<string> {
  const iso = new Date().toISOString();
  await writeRun({
    v: 1, id, project: 'p', codeRoot: fx.repo, specStore: fx.repo, spec: `${SPEC}-${id}`,
    worktree: fx.repo, branch: 'main', status: 'waiting', created: iso, updated: iso,
    phase: 'implementation', cursor: { phase: 'implementation', stepKind: 'implementer', attempt: 1 },
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  });
  const wait = await createWait({
    kind: 'question', runId: id, projectId: 'p', spec: `${SPEC}-${id}`, specDir: fx.specDir,
    questions: [{ id: 'q1', text: 'pick one', options: ['a', 'b'] }],
  });
  return wait.id;
}

let fx: Fixture;
let controllers: Controller[];
let pidFiles: string[];

beforeEach(() => {
  chmodSync(STUB, 0o755);
  chmodSync(STUB_GH, 0o755);
  fx = setup();
  controllers = [];
  pidFiles = [];
});

afterEach(async () => {
  for (const c of controllers) {
    try { await c.stop(); } catch { /* ignore */ }
  }
  for (const p of pidFiles) killPidFile(p);
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value;
  try { rmSync(fx.base, { recursive: true, force: true }); } catch { /* ignore */ }
});

// Source: design.md "Testing Strategy" Integration bullet; tasks.md task 14.
describe('deploy e2e: scenario 1 — restart finishes the deploy, releases, and the held run resumes', () => {
  it('a running and a waiting run both carry the hold; after the restart the record reaches done with commit, the running run resumes from its cursor, the waiting run stays waiting, and no hold remains (requirement 3 AC 7)', async () => {
    await approve(fx, 'design');
    await approve(fx, 'tasks');

    const { checkout, origin } = makeToyCheckout(fx.base);
    const stubDir = join(fx.base, 'stubbin');
    writeStubBin(stubDir);
    const prestartGate = join(fx.base, 'go-restart.txt');

    const { unit: unitA, pidFilePath } = makeRealUnit({ checkout, home: fx.home, stubDir, prestartGate, buildCmd: stageBuildStub(gateBody(0)), smokeCmd: 'true' });
    pidFiles.push(pidFilePath);

    const controllerA = makeController(fx, { deployUnit: unitA });
    controllers.push(controllerA);
    expect(await controllerA.start()).toBe(true);

    writeScript(fx, [
      streamingDraftRun('requirements', 20, 100), reviewerRun('requirements'),
      e2eRun(), compileRun(), analystRun(), closeoutBatchRun(),
    ] as StubRun[]);
    scriptMergeablePR(fx, 'main', 'c0ffee200001');

    const idA = await controllerA.enqueue({ projectId: 'p', spec: SPEC });
    await waitForRun(idA, (r) => r?.status === 'running' && r.inFlight != null, 5000, 'the running run never went live');

    const idB = 'run-20261105-waiting0001';
    await seedWaitingRun(fx, idB);

    const press = await controllerA.pressDeploy();
    expect(press.ok).toBe(true);

    const heldA = await waitForRun(idA, (r) => r?.holdBy === 'deploy', 2000, 'the running run never carried the hold');
    expect(heldA?.pauseRequested).toBeTruthy();
    const heldB = await waitForRun(idB, (r) => r?.holdBy === 'deploy', 2000, 'the waiting run never carried the hold');
    expect(heldB?.status).toBe('waiting');

    // The live drive is not interrupted: it parks paused/operator at its next
    // stop point, after the streaming step ends (requirement 4 AC 5).
    await waitForRun(
      idA, (r) => r?.status === 'paused' && r.pauseReason === 'operator' && r.holdBy === 'deploy',
      5000, 'the running run never parked paused with the hold kept',
    );

    await waitFor(() => existsSync(pidFilePath), (v) => v, 5000, 'the unit never started');
    expect(controllerA.deployRecord()?.stage).toBe('wait');

    await controllerA.stop();

    const unitB2 = makeRealUnit({ checkout, home: fx.home, stubDir }).unit;
    const controllerB = makeController(fx, { deployUnit: unitB2 });
    controllers.push(controllerB);
    expect(await controllerB.start()).toBe(true);

    // onStart found the unit live and left the record and holds alone.
    expect(controllerB.deployRecord()?.stage).toBe('wait');
    expect((await readRun(idA))?.holdBy).toBe('deploy');

    writeFileSync(prestartGate, 'go\n');

    const done = await waitFor(
      () => controllerB.deployRecord(), (r) => r?.stage === 'done', 30000, 'the deploy never reached done',
    );
    const originHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: origin }).toString().trim();
    expect(done?.commit).toBe(originHead);

    await waitForRun(idA, (r) => r?.holdBy === undefined, 5000, 'the running run never released');
    await waitForRun(idB, (r) => r?.holdBy === undefined, 5000, 'the waiting run never released');

    expect((await readRun(idB))?.status).toBe('waiting');

    const resumed = await waitForRun(
      idA, (r) => r?.phase === 'retrospective' && r?.status === 'waiting', 15000,
      'the running run never resumed from its cursor to the retro-plan wait',
    );
    expect(resumed?.status).toBe('waiting');
    expect(existsSync(join(fx.specDir, 'reviews', 'adversarial-analysis-requirements.md'))).toBe(true);
  }, 60000);
});

describe('deploy e2e: scenario 2 — a wait answered during build starts no step until done', () => {
  it('leaves the run waiting, starts no step, and keeps the answer on disk (requirement 4 AC 6)', async () => {
    const { checkout } = makeToyCheckout(fx.base);
    const stubDir = join(fx.base, 'stubbin');
    writeStubBin(stubDir);
    const goFile = join(fx.base, 'go-build.txt');
    const buildCmd = `while [ ! -f ${sh(goFile)} ]; do sleep 0.02; done\n`;

    const { unit, pidFilePath } = makeRealUnit({ checkout, home: fx.home, stubDir, buildCmd, smokeCmd: 'true' });
    pidFiles.push(pidFilePath);

    const controller = makeController(fx, { deployUnit: unit });
    controllers.push(controller);
    expect(await controller.start()).toBe(true);

    const id = 'run-20261105-waiting0002';
    const waitId = await seedWaitingRun(fx, id);

    const press = await controller.pressDeploy();
    expect(press.ok).toBe(true);

    await waitFor(() => controller.deployRecord(), (r) => r?.stage === 'build', 15000, 'the deploy never reached build');

    const answered = await answerWait(waitId, { q1: 'a' }, 'operator');
    expect(answered?.state).toBe('answered');

    await new Promise((r) => setTimeout(r, 200));

    const run = await readRun(id);
    expect(run?.status).toBe('waiting');
    expect(run?.inFlight).toBeUndefined();

    const onDisk = await readWait(waitId);
    expect(onDisk?.state).toBe('answered');
    expect(onDisk?.answer?.q1?.value).toBe('a');
  }, 60000);
});

describe('deploy e2e: scenario 3 — a failing eval leaves failed, an error wait, and the old dist/, releasing both runs', () => {
  it('writes failed with an error starting "gate:", writes the error wait, leaves the old dist/, and releases both runs', async () => {
    const { checkout } = makeToyCheckout(fx.base);
    const stubDir = join(fx.base, 'stubbin');
    writeStubBin(stubDir);

    mkdirSync(join(checkout, 'dist'), { recursive: true });
    writeFileSync(join(checkout, 'dist', 'marker.txt'), 'old\n');

    const waitRecordPath = join(fx.home, 'wait-record.txt');
    writeWaitsStub(checkout, waitRecordPath);

    const buildCmd = stageBuildStub(gateBody(1, 'demo fail 0/1 — a case regressed'));
    const { unit, pidFilePath } = makeRealUnit({ checkout, home: fx.home, stubDir, buildCmd, smokeCmd: 'true' });
    pidFiles.push(pidFilePath);

    const controller = makeController(fx, { deployUnit: unit });
    controllers.push(controller);
    expect(await controller.start()).toBe(true);

    await seedHeldRun(fx, 'run-20261105-held0001');
    await seedHeldRun(fx, 'run-20261105-held0002');

    const press = await controller.pressDeploy();
    expect(press.ok).toBe(true);

    const failed = await waitFor(
      () => controller.deployRecord(), (r) => r?.stage === 'failed', 20000, 'the deploy never failed',
    );
    expect(failed?.error?.startsWith('gate:')).toBe(true);

    await waitFor(() => existsSync(waitRecordPath), (v) => v, 5000, 'the error wait was never written');
    expect(readFileSync(waitRecordPath, 'utf-8')).toContain('demo fail 0/1');

    expect(readFileSync(join(checkout, 'dist', 'marker.txt'), 'utf-8')).toBe('old\n');

    await waitForRun('run-20261105-held0001', (r) => r?.holdBy === undefined, 5000, 'the first held run never released');
    await waitForRun('run-20261105-held0002', (r) => r?.holdBy === undefined, 5000, 'the second held run never released');
  }, 60000);
});

describe('deploy e2e: scenario 4 — cancel at build stops the child, releases both runs, removes the record, and leaves HEAD/dist/ unchanged', () => {
  it('cancel stops the unit, releases, removes the record, and the checkout is untouched (requirement 5 AC 4)', async () => {
    const { checkout } = makeToyCheckout(fx.base);
    const headBefore = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout }).toString().trim();
    const stubDir = join(fx.base, 'stubbin');
    writeStubBin(stubDir);
    const goFile = join(fx.base, 'go-build-cancel.txt');
    const buildCmd = `while [ ! -f ${sh(goFile)} ]; do sleep 0.02; done\n`;

    const { unit, pidFilePath } = makeRealUnit({ checkout, home: fx.home, stubDir, buildCmd, smokeCmd: 'true' });
    pidFiles.push(pidFilePath);

    const controller = makeController(fx, { deployUnit: unit });
    controllers.push(controller);
    expect(await controller.start()).toBe(true);

    await seedHeldRun(fx, 'run-20261105-cancel0001');
    await seedHeldRun(fx, 'run-20261105-cancel0002');

    const press = await controller.pressDeploy();
    expect(press.ok).toBe(true);

    await waitFor(() => controller.deployRecord(), (r) => r?.stage === 'build', 15000, 'the deploy never reached build');

    const cancel = await controller.cancelDeploy();
    expect(cancel.status).toBe(200);

    expect(controller.deployRecord()).toBeNull();

    await waitForRun('run-20261105-cancel0001', (r) => r?.holdBy === undefined, 5000, 'the first held run never released');
    await waitForRun('run-20261105-cancel0002', (r) => r?.holdBy === undefined, 5000, 'the second held run never released');

    const headAfter = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout }).toString().trim();
    expect(headAfter).toBe(headBefore);
    expect(existsSync(join(checkout, 'dist'))).toBe(false);
  }, 60000);
});

describe('deploy e2e: scenario 5 — the restarted controller finishes the record, with or without a live unit', () => {
  it('a controller stopped at wait with the child alive leaves it running; a new controller finishes the record', async () => {
    const { checkout, origin } = makeToyCheckout(fx.base);
    const stubDir = join(fx.base, 'stubbin');
    writeStubBin(stubDir);
    const prestartGate = join(fx.base, 'go-s5-live.txt');

    const { unit: unitA, pidFilePath } = makeRealUnit({ checkout, home: fx.home, stubDir, prestartGate, buildCmd: stageBuildStub(gateBody(0)), smokeCmd: 'true' });
    pidFiles.push(pidFilePath);

    const controllerA = makeController(fx, { deployUnit: unitA });
    controllers.push(controllerA);
    expect(await controllerA.start()).toBe(true);

    await seedHeldRun(fx, 'run-20261105-s5live0001');

    const press = await controllerA.pressDeploy();
    expect(press.ok).toBe(true);

    await waitFor(() => existsSync(pidFilePath), (v) => v, 5000, 'the unit never started');
    expect(controllerA.deployRecord()?.stage).toBe('wait');

    await controllerA.stop();
    // The child is a separate OS process: it stays alive after the controller stops.
    expect(existsSync(pidFilePath)).toBe(true);

    const unitB = makeRealUnit({ checkout, home: fx.home, stubDir }).unit;
    const controllerB = makeController(fx, { deployUnit: unitB });
    controllers.push(controllerB);
    expect(await controllerB.start()).toBe(true);

    expect(controllerB.deployRecord()?.stage).toBe('wait');
    expect((await readRun('run-20261105-s5live0001'))?.holdBy).toBe('deploy');

    writeFileSync(prestartGate, 'go\n');

    const done = await waitFor(
      () => controllerB.deployRecord(), (r) => r?.stage === 'done', 30000, 'the deploy never reached done',
    );
    const originHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: origin }).toString().trim();
    expect(done?.commit).toBe(originHead);
    await waitForRun('run-20261105-s5live0001', (r) => r?.holdBy === undefined, 5000, 'the held run never released');
  }, 60000);

  it('no unit and unitStarted unset: the new controller starts the unit and finishes the record', async () => {
    const { checkout, origin } = makeToyCheckout(fx.base);
    const stubDir = join(fx.base, 'stubbin');
    writeStubBin(stubDir);

    const unitA = makeRealUnit({ checkout, home: fx.home, stubDir }).unit;
    const controllerA = makeController(fx, { deployUnit: unitA, deployDisabled: true });
    controllers.push(controllerA);
    expect(await controllerA.start()).toBe(true);

    await seedHeldRun(fx, 'run-20261105-s5nounit0001');

    const press = await controllerA.pressDeploy();
    expect(press.ok).toBe(true);
    expect(controllerA.deployRecord()?.stage).toBe('wait');
    expect((await readDeployRecord())?.unitStarted).toBeFalsy();

    await controllerA.stop();

    const buildCmd = stageBuildStub(gateBody(0));
    const { unit: unitB, pidFilePath } = makeRealUnit({ checkout, home: fx.home, stubDir, buildCmd, smokeCmd: 'true' });
    pidFiles.push(pidFilePath);
    const controllerB = makeController(fx, { deployUnit: unitB });
    controllers.push(controllerB);
    expect(await controllerB.start()).toBe(true);

    const done = await waitFor(
      () => controllerB.deployRecord(), (r) => r?.stage === 'done', 30000, 'the deploy never reached done',
    );
    const originHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: origin }).toString().trim();
    expect(done?.commit).toBe(originHead);
    await waitForRun('run-20261105-s5nounit0001', (r) => r?.holdBy === undefined, 5000, 'the held run never released');
  }, 60000);
});

describe('deploy e2e: scenario 6 — the child killed by hand leaves failed on the next start', () => {
  it('with the child killed by hand at build, the next start writes failed and releases', async () => {
    const { checkout } = makeToyCheckout(fx.base);
    const stubDir = join(fx.base, 'stubbin');
    writeStubBin(stubDir);
    const goFile = join(fx.base, 'go-build-kill.txt');
    const buildCmd = `while [ ! -f ${sh(goFile)} ]; do sleep 0.02; done\n`;

    const { unit: unitA, pidFilePath } = makeRealUnit({ checkout, home: fx.home, stubDir, buildCmd, smokeCmd: 'true' });

    // `deployDisabled` so controllerA's own tick never notices the unit is
    // gone (design's "the tick or the next start"): this scenario proves the
    // next-start path specifically, so the unit is started by hand instead of
    // through the tick, and no concurrent tick can race the assertions below.
    const controllerA = makeController(fx, { deployUnit: unitA, deployDisabled: true });
    controllers.push(controllerA);
    expect(await controllerA.start()).toBe(true);

    await seedHeldRun(fx, 'run-20261105-kill0001');

    const press = await controllerA.pressDeploy();
    expect(press.ok).toBe(true);
    await unitA.start(deployRecordPath());

    await waitFor(() => controllerA.deployRecord(), (r) => r?.stage === 'build', 15000, 'the deploy never reached build');

    // The operator kills the child by hand: no trap runs, no `failed` write.
    killPidFile(pidFilePath);
    await waitFor(() => existsSync(pidFilePath) && isProcessAliveFromFile(pidFilePath), (alive) => !alive, 5000, 'the child never died');
    expect(controllerA.deployRecord()?.stage).toBe('build');

    await controllerA.stop();

    const unitB = makeRealUnit({ checkout, home: fx.home, stubDir }).unit;
    const controllerB = makeController(fx, { deployUnit: unitB });
    controllers.push(controllerB);
    expect(await controllerB.start()).toBe(true);

    await waitFor(() => controllerB.deployRecord(), (r) => r?.stage === 'failed', 5000, 'the next start never wrote failed');
    await waitForRun('run-20261105-kill0001', (r) => r?.holdBy === undefined, 5000, 'the held run never released');
  }, 60000);
});

function isProcessAliveFromFile(pidFilePath: string): boolean {
  if (!existsSync(pidFilePath)) return false;
  const { pid, startTime } = JSON.parse(readFileSync(pidFilePath, 'utf-8')) as { pid: number; startTime: number };
  return isProcessAlive(pid, startTime);
}
