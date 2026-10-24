import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
  mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync,
} from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runStep, loadRole, type StepSpec, type ActivityEvent, type RateLimitWindows } from '../step.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const STUB = join(HERE, '..', '..', '..', 'scripts', 'stub-claude.mjs');
const FIXTURES = join(HERE, 'fixtures');

interface Run {
  stream?: unknown[];
  result?: Record<string, unknown>;
  exitCode?: number;
  delayMs?: number;
  edits?: { path: string; content: string }[];
}

interface RunOutcome {
  result: Awaited<ReturnType<typeof runStep>>;
  dir: string;
  worktree: string;
  logPath: string;
  lines: Record<string, unknown>[];
  init: Record<string, unknown> | undefined;
  activity: ActivityEvent[];
  windows: RateLimitWindows[];
}

const savedEnv = { ...process.env };

beforeAll(() => {
  // Guarantee the stub is executable even if git did not preserve the mode.
  chmodSync(STUB, 0o755);
});

afterEach(() => {
  // Restore any env keys a test set or deleted.
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(savedEnv)) {
    process.env[key] = value;
  }
});

async function runWithScript(runs: Run[], overrides: Partial<StepSpec> = {}): Promise<RunOutcome> {
  const dir = mkdtempSync(join(tmpdir(), 'ctrl-step-'));
  const worktree = join(dir, 'wt');
  mkdirSync(worktree, { recursive: true });
  const scriptPath = join(dir, 'script.json');
  writeFileSync(scriptPath, JSON.stringify(runs));
  const briefPath = join(dir, 'brief.md');
  writeFileSync(briefPath, 'do the thing');
  const logPath = join(dir, 'logs', 'step-1.jsonl');

  process.env.CONTROLLER_CLAUDE_BIN = STUB;
  process.env.STUB_CLAUDE_SCRIPT = scriptPath;

  const activity: ActivityEvent[] = [];
  const windows: RateLimitWindows[] = [];
  const spec: StepSpec = {
    role: 'sdd-reviewer',
    briefPath,
    worktree,
    logPath,
    maxTurns: 8,
    sessionId: 'sess-1',
    onActivity: (a) => activity.push(a),
    onRateLimit: (w) => windows.push(w),
    ...overrides,
  };
  const result = await runStep(spec);

  const lines = readFileSync(logPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => {
      try { return JSON.parse(l) as Record<string, unknown>; } catch { return { _raw: l }; }
    });
  const init = lines.find((l) => l.type === 'system' && l.subtype === 'init');
  return { result, dir, worktree, logPath, lines, init, activity, windows };
}

function assistantToolUse(name: string, input: Record<string, unknown>): Record<string, unknown> {
  return {
    type: 'assistant',
    timestamp: '2026-10-11T02:43:00.850Z',
    message: { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name, input }] },
  };
}

function readFixtureStream(file: string): unknown[] {
  return readFileSync(join(FIXTURES, file), 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l));
}

function readFixtureObject(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(FIXTURES, file), 'utf8')) as Record<string, unknown>;
}

describe('loadRole', () => {
  it('resolves the reviewer model, effort, tools and body', () => {
    const role = loadRole('sdd-reviewer');
    expect(role.name).toBe('sdd-reviewer');
    expect(role.model).toBe('claude-opus-4-8');
    expect(role.effort).toBe('xhigh');
    expect(role.tools).toContain('Read');
    expect(role.tools).toContain('Write');
    expect(role.body.startsWith('You perform one adversarial review')).toBe(true);
    // The frontmatter is stripped.
    expect(role.body).not.toContain('name: sdd-reviewer');
  });

  it('keeps an agent file\'s mcp tools in the list', () => {
    const role = loadRole('sdd-implementer');
    expect(role.tools).toContain('mcp__spec-workflow__log-implementation');
    expect(role.tools).toContain('mcp__playwright');
  });

  it('throws for an unknown role', () => {
    expect(() => loadRole('sdd-nope')).toThrow(/no agent file/);
  });
});

describe('runStep', () => {
  it('parses a clean run with a tool_use and a result', async () => {
    const { result, activity } = await runWithScript([{
      stream: [assistantToolUse('Read', { file_path: '/wt/a.txt' })],
      result: {
        subtype: 'success', is_error: false, num_turns: 4, session_id: 'sess-1',
        result: 'all good',
        usage: {
          input_tokens: 6, output_tokens: 287, cache_read_input_tokens: 81820,
          cache_creation: { ephemeral_1h_input_tokens: 25325, ephemeral_5m_input_tokens: 0 },
        },
        duration_ms: 5582,
      },
      exitCode: 0,
    }]);
    expect(result.classification).toBe('ok');
    expect(result.isError).toBe(false);
    expect(result.resultText).toBe('all good');
    expect(result.numTurns).toBe(4);
    expect(result.exitCode).toBe(0);
    expect(result.durationMs).toBe(5582);
    expect(result.usage).toEqual({
      input: 6, output: 287, cacheRead: 81820, cacheWrite5m: 0, cacheWrite1h: 25325,
    });
    expect(activity).toEqual([
      { tool: 'Read', inputSummary: '/wt/a.txt', ts: '2026-10-11T02:43:00.850Z' },
    ]);
  });

  it('returns a valid structured_output as ok', async () => {
    const { result } = await runWithScript([{
      result: {
        subtype: 'success', is_error: false, num_turns: 2, session_id: 'sess-1',
        result: '{"verdict":"converged"}',
        structured_output: { verdict: 'converged', mustFix: [] },
        usage: {},
      },
    }], { schema: { type: 'object' } });
    expect(result.classification).toBe('ok');
    expect(result.structuredOutput).toEqual({ verdict: 'converged', mustFix: [] });
  });

  it('classifies a turn-cap exit', async () => {
    const { result } = await runWithScript([{
      result: {
        subtype: 'error_max_turns', is_error: true, num_turns: 8, session_id: 'sess-1',
        result: 'hit the cap', usage: {},
      },
      exitCode: 1,
    }]);
    expect(result.classification).toBe('turn-cap');
    expect(result.isError).toBe(true);
  });

  it('classifies a usage-limit rate_limit_event and surfaces the windows', async () => {
    const { result, windows } = await runWithScript([{
      stream: [{
        type: 'rate_limit_event',
        rate_limit_info: {
          status: 'rejected', overageStatus: 'rejected',
          unifiedWindows: {
            five_hour: { utilization: 0.4, resetsAt: 1791703800 },
            seven_day: { utilization: 0.99, resetsAt: 1791730800 },
          },
        },
      }],
      result: {
        subtype: 'error_during_execution', is_error: true, num_turns: 1, session_id: 'sess-1',
        result: '', usage: {},
      },
      exitCode: 1,
    }]);
    expect(result.classification).toBe('usage-limit');
    expect(windows).toHaveLength(1);
    expect(windows[0].status).toBe('rejected');
    expect(windows[0].sevenDay).toEqual({ utilization: 0.99, resetsAt: 1791730800 });
    expect(windows[0].fiveHour.utilization).toBe(0.4);
  });

  it('classifies a schema failure as schema-invalid', async () => {
    const { result } = await runWithScript([{
      result: {
        subtype: 'success', is_error: false, num_turns: 3, session_id: 'sess-1',
        result: 'not json', structured_output: null, usage: {},
      },
    }], { schema: { type: 'object', required: ['verdict'] } });
    expect(result.classification).toBe('schema-invalid');
    expect(result.structuredOutput).toBeNull();
  });

  it('keeps the last reported result when a background wake-up ends in plain text', async () => {
    const { result } = await runWithScript([{
      stream: [{
        type: 'result', subtype: 'success', is_error: false, num_turns: 12, session_id: 'sess-1',
        result: '{"verdict":"done"}', structured_output: { verdict: 'done' }, usage: {},
      }],
      result: {
        subtype: 'success', is_error: false, num_turns: 2, session_id: 'sess-1',
        result: 'Already complete; nothing further to do.', structured_output: null, usage: {},
      },
    }], { schema: { type: 'object', required: ['verdict'] } });
    expect(result.classification).toBe('ok');
    expect(result.structuredOutput).toEqual({ verdict: 'done' });
  });

  it('classifies an expired login as login-expired, not schema-invalid', async () => {
    const { result } = await runWithScript([{
      result: {
        subtype: 'success', is_error: true, num_turns: 1, session_id: 'sess-1',
        result: 'Failed to authenticate: OAuth session expired and could not be refreshed',
        structured_output: null, usage: {},
      },
    }], { schema: { type: 'object', required: ['verdict'] } });
    expect(result.classification).toBe('login-expired');
  });

  it('passes --resume (not --session-id) on a resume', async () => {
    const { init } = await runWithScript([{
      result: { subtype: 'success', is_error: false, num_turns: 1, session_id: 'resume-xyz', result: 'ok', usage: {} },
    }], { resume: 'resume-xyz', sessionId: undefined });
    const argv = init?.argv as string[];
    expect(argv).toContain('--resume');
    expect(argv[argv.indexOf('--resume') + 1]).toBe('resume-xyz');
    expect(argv).not.toContain('--session-id');
  });

  it('scrubs the ANTHROPIC keys and injects the SDD env', async () => {
    process.env.ANTHROPIC_API_KEY = 'secret-key';
    process.env.ANTHROPIC_AUTH_TOKEN = 'secret-token';
    const { init } = await runWithScript([{
      result: { subtype: 'success', is_error: false, num_turns: 1, session_id: 'sess-1', result: 'ok', usage: {} },
    }], { runId: 'run-20261011-010101', stepId: 'step-7', workspace: '/ws', sharedRoot: '/shared' });
    const env = init?.env as Record<string, string>;
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined();
    expect(env.SDD_HEADLESS).toBe('1');
    expect(env.SDD_RUN_ID).toBe('run-20261011-010101');
    expect(env.SDD_STEP_ID).toBe('step-7');
    expect(env.SPEC_WORKFLOW_WORKSPACE).toBe('/ws');
    expect(env.SPEC_WORKFLOW_SHARED_ROOT).toBe('/shared');
  });

  it('runs in the worktree cwd', async () => {
    const { init, worktree } = await runWithScript([{
      result: { subtype: 'success', is_error: false, num_turns: 1, session_id: 'sess-1', result: 'ok', usage: {} },
    }]);
    expect(init?.cwd).toBe(worktree);
  });

  it('emits the T1 flag list verbatim and writes the system-prompt temp file', async () => {
    const { init, logPath } = await runWithScript([{
      result: { subtype: 'success', is_error: false, num_turns: 1, session_id: 'sess-1', result: 'ok', usage: {} },
    }], {
      mcpConfig: { mcpServers: {} },
      schema: { type: 'object' },
      noSessionPersistence: true,
    });
    const argv = (init?.argv as string[]).join(' ');
    expect(argv).toContain('-p Read and execute the instructions in ');
    expect(argv).toContain('--model claude-opus-4-8');
    expect(argv).toContain('--effort xhigh');
    expect(argv).toContain('--append-system-prompt-file ');
    expect(argv).toContain('--allowedTools Read,Grep,Glob,Bash,Write');
    expect(argv).toContain('--permission-mode default --permission-prompts none');
    expect(argv).toContain('--strict-mcp-config');
    expect(argv).toContain('--json-schema ');
    expect(argv).toContain('--output-format stream-json --verbose');
    expect(argv).toContain('--max-turns 8');
    expect(argv).toContain('--no-session-persistence');

    const systemFile = join(dirname(logPath), 'step-1.system.md');
    expect(existsSync(systemFile)).toBe(true);
    expect(readFileSync(systemFile, 'utf8').startsWith('You perform one adversarial review')).toBe(true);
  });

  it('performs the stub\'s file edits in the cwd', async () => {
    const { worktree } = await runWithScript([{
      edits: [{ path: 'out.txt', content: 'edited by stub' }],
      result: { subtype: 'success', is_error: false, num_turns: 1, session_id: 'sess-1', result: 'ok', usage: {} },
    }]);
    expect(readFileSync(join(worktree, 'out.txt'), 'utf8')).toBe('edited by stub');
  });

  it('consumes one script entry per invocation', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'ctrl-step-'));
    const worktree = join(dir, 'wt');
    mkdirSync(worktree, { recursive: true });
    const briefPath = join(dir, 'brief.md');
    writeFileSync(briefPath, 'x');
    const scriptPath = join(dir, 'script.json');
    writeFileSync(scriptPath, JSON.stringify([
      { result: { subtype: 'success', is_error: false, num_turns: 1, session_id: 's', result: 'first', usage: {} } },
      { result: { subtype: 'success', is_error: false, num_turns: 1, session_id: 's', result: 'second', usage: {} } },
    ]));
    process.env.CONTROLLER_CLAUDE_BIN = STUB;
    process.env.STUB_CLAUDE_SCRIPT = scriptPath;
    const base: StepSpec = { role: 'sdd-reviewer', briefPath, worktree, logPath: join(dir, 'a.jsonl'), maxTurns: 4, sessionId: 's' };
    const first = await runStep(base);
    const second = await runStep({ ...base, logPath: join(dir, 'b.jsonl') });
    expect(first.resultText).toBe('first');
    expect(second.resultText).toBe('second');
  });

  it('classifies a failed spawn as error', async () => {
    process.env.CONTROLLER_CLAUDE_BIN = '/does/not/exist/claude-xyz';
    const dir = mkdtempSync(join(tmpdir(), 'ctrl-step-'));
    const worktree = join(dir, 'wt');
    mkdirSync(worktree, { recursive: true });
    writeFileSync(join(dir, 'brief.md'), 'x');
    const bad = await runStep({
      role: 'sdd-reviewer', briefPath: join(dir, 'brief.md'), worktree,
      logPath: join(dir, 'step.jsonl'), maxTurns: 4, sessionId: 's',
    });
    expect(bad.classification).toBe('error');
    expect(bad.isError).toBe(true);
    expect(bad.exitCode).toBeNull();
  });
});

describe('runStep against real Claude Code samples', () => {
  it('parses the full p6 stream-json run', async () => {
    const { result, activity, windows } = await runWithScript([{
      stream: readFixtureStream('p6-stream.jsonl'),
    }]);
    expect(result.classification).toBe('ok');
    expect(result.resultText).toBe('done');
    expect(result.sessionId).toBe('74465f8c-b493-4c5d-af71-265f785c26f2');
    expect(result.numTurns).toBe(3);
    expect(activity.map((a) => a.tool)).toEqual(['Read', 'Bash']);
    expect(activity[0].inputSummary).toContain('a.txt');
    expect(activity[1].inputSummary).toBe('echo beta');
    expect(windows).toHaveLength(1);
    expect(windows[0].status).toBe('allowed_warning');
    expect(windows[0].sevenDay.utilization).toBe(0.91);
    expect(result.usage.cacheWrite1h).toBe(24958);
  });

  it('parses the p1-default final result object', async () => {
    const { result } = await runWithScript([{ result: readFixtureObject('p1-default.json') }]);
    expect(result.classification).toBe('ok');
    expect(result.numTurns).toBe(4);
    expect(result.sessionId).toBe('4a47b813-6318-4325-b4c1-6142754a4a0c');
    expect(result.resultText).toContain('hello.txt now contains only');
    expect(result.usage).toEqual({
      input: 6, output: 287, cacheRead: 81820, cacheWrite5m: 0, cacheWrite1h: 25325,
    });
  });

  it('parses the p5 structured-output result object', async () => {
    const { result } = await runWithScript([{ result: readFixtureObject('p5-1.json') }], {
      schema: { type: 'object', required: ['verdict'] },
    });
    expect(result.classification).toBe('ok');
    const out = result.structuredOutput as { verdict: string; must_fix: string[] };
    expect(out.verdict).toBe('iterate');
    expect(out.must_fix).toHaveLength(3);
    expect(result.usage.cacheWrite1h).toBe(41827);
  });
});
