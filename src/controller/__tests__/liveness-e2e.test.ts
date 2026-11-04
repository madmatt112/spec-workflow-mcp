// src/controller/__tests__/liveness-e2e.test.ts
//
// Design end-to-end scenario 1 (design.md "Testing Strategy"): a stub step
// streams lines, `lastActivity` appears, is absent within 1 second of the
// end, and a cancel mid-step leaves the run `abandoned` with the field
// absent. Task 4 Success (c)-(e). Fixture setup copied from
// `controller.test.ts:95-117` (`setup`) and `:163-172` (`makeController`).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { Controller } from '../controller.js';
import { readRun, type RunRecord } from '../state.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, '..', '..', '..', 'scripts', 'stub-claude.mjs');
const STUB_GH = join(HERE, '..', '..', '..', 'scripts', 'stub-gh.mjs');
const SPEC = 'ctrl-live';
const savedEnv = { ...process.env };

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' });
}

function cleanDoc(title: string): string {
  return [
    `# ${title}`, '',
    '## Introduction',
    'The controller drafts documents. It serves the operator. It changes nothing else.', '',
    '## Requirements',
    'The controller SHALL draft, review and approve each document in order.', '',
    '## Revision History', '- **v1** (2026-10-11) — Initial draft.', '',
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
}

/**
 * The requirements draft step, scripted to stream `count` plain assistant
 * events (none of them `tool_use`, so this also exercises Requirement 1 AC 2 —
 * every parsed line is activity, not only tool use) with `eventDelayMs`
 * between each printed line, so a test can observe the step mid-stream.
 */
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

interface Fixture { base: string; repo: string; specDir: string; home: string; }

function setup(): Fixture {
  const base = mkdtempSync(join(tmpdir(), 'ctrl-live-'));
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

function makeController(fx: Fixture): Controller {
  return new Controller({
    resolveProject: () => ({ projectPath: fx.repo, workspacePath: fx.repo }),
    mcpConfigFor: () => ({ mcpServers: {} }),
    ensureWorktree: async () => ({ worktree: fx.repo, branch: 'main' }),
    claudeBin: () => STUB,
    tickMs: 25,
    graceMs: 1500,
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

let fx: Fixture;
let controller: Controller | null;
beforeEach(() => { chmodSync(STUB, 0o755); chmodSync(STUB_GH, 0o755); fx = setup(); controller = null; });
afterEach(async () => {
  if (controller) { try { await controller.stop(); } catch { /* ignore */ } controller = null; }
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  for (const [key, value] of Object.entries(savedEnv)) process.env[key] = value;
  try { rmSync(fx.base, { recursive: true, force: true }); } catch { /* ignore */ }
});

// Source: tasks.md task 4 Success (c)-(e); design C3, "Testing Strategy"
// end-to-end scenario 1; Requirements 1.2, 1.4, 1.7.
describe('liveness e2e: Controller.enqueue with a stub step that streams lines', () => {
  it('writes lastActivity to run.json while the stub step streams', async () => {
    writeScript(fx, [streamingDraftRun('requirements', 6, 80)]);
    controller = makeController(fx);
    await controller.start();

    // Test: Controller.enqueue with a stub step that streams lines.
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    // Observable result: while the step is still running, `lastActivity` is a
    // string on the record. Source: task 4 Success (c), Requirement 1 AC 2-3.
    const seen = await waitForRun(
      id,
      (run) => run?.status === 'running' && typeof run.lastActivity === 'string',
      3000,
      'lastActivity never appeared on a running run',
    );
    expect(seen?.status).toBe('running');
    expect(typeof seen?.lastActivity).toBe('string');
  });

  it('clears lastActivity within 1 second of the step ending', async () => {
    writeScript(fx, [streamingDraftRun('requirements', 6, 80)]);
    controller = makeController(fx);
    await controller.start();
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    // Pre-condition: the step is actually streaming and writing the field
    // (otherwise "absent" below would hold trivially, with nothing to clear).
    await waitForRun(
      id,
      (run) => typeof run?.lastActivity === 'string',
      3000,
      'lastActivity never appeared before the step ended',
    );

    // Test: continue driving until the step itself ends (`inFlight` clears;
    // by this point in the run `inFlight` is already known set, so this is
    // the step's end, not the pre-spawn state).
    // Observable result: by then `lastActivity` is already absent — the
    // writer task 1 orders the heartbeat's clear before the end-of-step
    // write, so this holds well inside the 1-second budget. Source: task 4
    // Success (d), Requirement 1 AC 4.
    const ended = await waitForRun(
      id,
      (run) => run != null && run.inFlight === undefined,
      3000,
      'the step never ended with inFlight cleared',
    );
    expect(ended?.lastActivity).toBeUndefined();
  });

  it('leaves status abandoned with lastActivity absent when cancelled during the step', async () => {
    writeScript(fx, [streamingDraftRun('requirements', 20, 150)]);
    controller = makeController(fx);
    await controller.start();
    const id = await controller.enqueue({ projectId: 'p', spec: SPEC });

    // Pre-condition: the step is actually streaming and writing the field.
    await waitForRun(
      id,
      (run) => typeof run?.lastActivity === 'string',
      3000,
      'lastActivity never appeared before cancel',
    );

    // Test: cancel the run while its step is still in flight.
    await controller.cancel(id);

    // Observable result: `abandoned`, with the field absent. Source: task 4
    // Success (e), Requirement 1 AC 7.
    const run = await readRun(id);
    expect(run?.status).toBe('abandoned');
    expect(run?.lastActivity).toBeUndefined();
  });
});
