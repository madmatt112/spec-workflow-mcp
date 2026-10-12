// src/controller/step.ts
//
// T1 of the controller (docs/controller-tasks.md "T1 `step`", design §4).
// One model step: a single fresh headless `claude` process that the controller
// spawns with a role, a brief and a report schema, and that exits with a typed
// result. No model runs in this code path; the only model is the spawned
// `claude`. The module is deep: `runStep` and `loadRole` and the types are the
// whole public surface.
import { spawn } from 'child_process';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, basename, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  SPEC_WORKFLOW_WORKSPACE_ENV, SPEC_WORKFLOW_SHARED_ROOT_ENV,
} from '../core/git-utils.js';

/** Environment variables the controller never passes to a step (design §4). */
const SCRUBBED_STEP_ENV_VARS = ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN'];

/** The binary name, overridable so tests swap in `scripts/stub-claude.mjs`. */
function claudeBin(): string {
  return process.env.CONTROLLER_CLAUDE_BIN || 'claude';
}

// ---------------------------------------------------------------------------
// Types (the public surface besides the two functions).
// ---------------------------------------------------------------------------

/** A harness agent resolved from `harness/agents/<name>.md` and the profiles. */
export interface Role {
  name: string;
  model: string;
  effort: string;
  tools: string[];
  /** The agent file body, frontmatter stripped. */
  body: string;
}

/** One assistant tool_use, surfaced live for the Run page's current-tool line. */
export interface ActivityEvent {
  tool: string;
  inputSummary: string;
  ts?: string;
}

/** One usage window from a `rate_limit_event`. */
export interface RateLimitWindow {
  utilization: number;
  resetsAt: number;
}

/** The two windows plus the status the controller's capacity check reads. */
export interface RateLimitWindows {
  status: string;
  overageStatus?: string;
  fiveHour: RateLimitWindow;
  sevenDay: RateLimitWindow;
}

/** Token usage from the final result, with the cache tiers split out. */
export interface StepUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
}

/** How a step ended, driving the controller's fixed per-class response. */
export type StepClassification =
  | 'ok'
  | 'turn-cap'
  | 'usage-limit'
  | 'schema-invalid'
  | 'error';

/** What one step tells the controller. */
export interface StepResult {
  structuredOutput: unknown | null;
  usage: StepUsage;
  sessionId: string | null;
  numTurns: number;
  isError: boolean;
  subtype: string | null;
  resultText: string | null;
  exitCode: number | null;
  classification: StepClassification;
  durationMs: number | null;
}

/** Everything one step needs. The caller resolves the brief, schema and roots. */
export interface StepSpec {
  /** Agent name under `harness/agents/`, e.g. `sdd-reviewer`. */
  role: string;
  /** Path to the brief file the step reads and executes. */
  briefPath: string;
  /** `cwd` of the spawned process: the run's worktree. */
  worktree: string;
  /** The raw stream is appended here; its directory owns the system-prompt temp file. */
  logPath: string;
  /** `--max-turns`. */
  maxTurns: number;
  /** `--session-id <uuid>`; ignored when `resume` is set. */
  sessionId?: string;
  /** `--resume <id>`; wins over `sessionId`. */
  resume?: string;
  /** Overrides the role profile's model when set. */
  model?: string;
  /** Overrides the role profile's effort when set. */
  effort?: string;
  /** `--mcp-config`: a file path or an inline config object. */
  mcpConfig?: string | Record<string, unknown>;
  /** `--json-schema`: a JSON string or a schema object. */
  schema?: string | Record<string, unknown>;
  /** Adds `--no-session-persistence` when true. */
  noSessionPersistence?: boolean;
  /** `SDD_RUN_ID`. */
  runId?: string;
  /** `SDD_STEP_ID`. */
  stepId?: string;
  /** `SPEC_WORKFLOW_WORKSPACE`. */
  workspace?: string;
  /** `SPEC_WORKFLOW_SHARED_ROOT`. */
  sharedRoot?: string;
  onActivity?: (activity: ActivityEvent) => void;
  onRateLimit?: (windows: RateLimitWindows) => void;
}

// ---------------------------------------------------------------------------
// Role loading.
// ---------------------------------------------------------------------------

interface Frontmatter {
  model?: string;
  effort?: string;
  tools: string[];
}

/** `harness/` next to this module's package root (src/controller → root; dist/controller → root). */
function harnessDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(resolve(here, '..', '..'), 'harness');
}

/** Strips one layer of surrounding quotes from a frontmatter scalar. */
function unquote(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && ((v[0] === '"' && v.endsWith('"')) || (v[0] === "'" && v.endsWith("'")))) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Splits `--- ... ---` frontmatter from the body and reads the three fields the
 * step needs: `model`, `effort` (scalars) and `tools` (a `- item` list). A tiny
 * reader for a fixed shape, so no YAML runtime dependency is added.
 */
function parseAgentFile(raw: string): { frontmatter: Frontmatter; body: string } {
  const lines = raw.split('\n');
  if (lines[0]?.trim() !== '---') {
    return { frontmatter: { tools: [] }, body: raw.trim() };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) {
    return { frontmatter: { tools: [] }, body: raw.trim() };
  }
  const fm: Frontmatter = { tools: [] };
  let inTools = false;
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    const listItem = /^\s*-\s+(.*)$/.exec(line);
    if (inTools && listItem) {
      fm.tools.push(unquote(listItem[1]));
      continue;
    }
    const kv = /^([A-Za-z0-9_]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const [, key, value] = kv;
    inTools = false;
    if (key === 'tools') {
      inTools = true;
      const inline = value.trim();
      if (inline.startsWith('[') && inline.endsWith(']')) {
        fm.tools = inline
          .slice(1, -1)
          .split(',')
          .map((t) => unquote(t))
          .filter((t) => t.length > 0);
        inTools = false;
      }
    } else if (key === 'model') {
      fm.model = unquote(value);
    } else if (key === 'effort') {
      fm.effort = unquote(value);
    }
  }
  const body = lines.slice(end + 1).join('\n').trim();
  return { frontmatter: fm, body };
}

interface AgentProfile { model?: string; effort?: string }

/** Reads `harness/agent-profiles.json`, the designated model/effort source. */
function readProfiles(): Record<string, AgentProfile> {
  const path = join(harnessDir(), 'agent-profiles.json');
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Record<string, AgentProfile>;
  } catch {
    return {};
  }
}

/**
 * Resolves a role: body and tool list from `harness/agents/<name>.md`, model and
 * effort from `harness/agent-profiles.json` (the designated source) falling back
 * to the agent file's own frontmatter. Throws when the agent file is missing.
 */
export function loadRole(roleName: string): Role {
  const path = join(harnessDir(), 'agents', `${roleName}.md`);
  if (!existsSync(path)) {
    throw new Error(`loadRole: no agent file for role "${roleName}" at ${path}`);
  }
  const { frontmatter, body } = parseAgentFile(readFileSync(path, 'utf8'));
  const profile = readProfiles()[roleName];
  const model = profile?.model ?? frontmatter.model;
  const effort = profile?.effort ?? frontmatter.effort;
  if (!model || !effort) {
    throw new Error(`loadRole: role "${roleName}" has no model/effort in its profile or frontmatter`);
  }
  return { name: roleName, model, effort, tools: frontmatter.tools, body };
}

// ---------------------------------------------------------------------------
// Stream parsing helpers.
// ---------------------------------------------------------------------------

/** A short, readable one-liner for a tool_use input, for the current-tool line. */
function summariseToolInput(input: unknown): string {
  if (input == null || typeof input !== 'object') return '';
  const obj = input as Record<string, unknown>;
  for (const key of ['file_path', 'path', 'command', 'description', 'pattern', 'prompt', 'url']) {
    const v = obj[key];
    if (typeof v === 'string' && v.length > 0) {
      return v.length > 120 ? `${v.slice(0, 117)}...` : v;
    }
  }
  const json = JSON.stringify(obj);
  return json.length > 120 ? `${json.slice(0, 117)}...` : json;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Maps a result `usage` block to the five-field StepUsage, cache tiers split. */
function mapUsage(usage: unknown): StepUsage {
  const u = (usage ?? {}) as Record<string, unknown>;
  const creation = (u.cache_creation ?? {}) as Record<string, unknown>;
  return {
    input: num(u.input_tokens),
    output: num(u.output_tokens),
    cacheRead: num(u.cache_read_input_tokens),
    cacheWrite5m: num(creation.ephemeral_5m_input_tokens),
    cacheWrite1h: num(creation.ephemeral_1h_input_tokens),
  };
}

/** Maps a `rate_limit_event`'s `rate_limit_info` to the two windows. */
function mapWindows(info: Record<string, unknown>): RateLimitWindows {
  const windows = (info.unifiedWindows ?? {}) as Record<string, unknown>;
  const win = (w: unknown): RateLimitWindow => {
    const o = (w ?? {}) as Record<string, unknown>;
    return { utilization: num(o.utilization), resetsAt: num(o.resetsAt) };
  };
  return {
    status: typeof info.status === 'string' ? info.status : 'unknown',
    overageStatus: typeof info.overageStatus === 'string' ? info.overageStatus : undefined,
    fiveHour: win(windows.five_hour),
    sevenDay: win(windows.seven_day),
  };
}

/** A status that is not an `allowed*` state is a rejecting one (design §9). */
function isRejecting(status: string): boolean {
  return status.length > 0 && !status.startsWith('allowed');
}

/**
 * The exit classification (T1). Order matters: capacity and turn caps are read
 * before schema and generic errors so a rejected window is never mislabelled.
 */
function classify(
  result: Record<string, unknown> | null,
  lastRateLimit: RateLimitWindows | null,
  exitCode: number | null,
  schemaRequested: boolean,
  hasStructuredOutput: boolean,
): StepClassification {
  const subtype = result && typeof result.subtype === 'string' ? result.subtype : '';
  const stopReason = result && typeof result.stop_reason === 'string' ? result.stop_reason : '';
  const isError = result ? result.is_error === true : true;

  if ((lastRateLimit && isRejecting(lastRateLimit.status)) || /usage|limit/i.test(subtype)) {
    return 'usage-limit';
  }
  if (/max.?turns|turn.?cap/i.test(subtype) || /max.?turns/i.test(stopReason)) {
    return 'turn-cap';
  }
  if ((schemaRequested && !hasStructuredOutput) || /schema|structured/i.test(subtype)) {
    return 'schema-invalid';
  }
  if (exitCode !== 0 || isError || !result) {
    return 'error';
  }
  return 'ok';
}

// ---------------------------------------------------------------------------
// runStep.
// ---------------------------------------------------------------------------

function asConfigArg(value: string | Record<string, unknown>): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

/**
 * Spawns one `claude -p` step, parses its stream-json, appends the raw stream to
 * the log the caller named, fires `onActivity` and `onRateLimit` live, and
 * resolves a typed StepResult. Never throws for a step that merely fails; a
 * failed spawn or an exit is a classified result.
 */
export function runStep(spec: StepSpec): Promise<StepResult> {
  const role = loadRole(spec.role);
  const model = spec.model ?? role.model;
  const effort = spec.effort ?? role.effort;

  mkdirSync(dirname(spec.logPath), { recursive: true });

  // The system-prompt body is a temp file the log dir owns (design §4).
  const stem = basename(spec.logPath).replace(/\.[^.]+$/, '') || 'step';
  const systemFile = join(dirname(spec.logPath), `${stem}.system.md`);
  writeFileSync(systemFile, role.body, 'utf8');

  const args: string[] = [
    '-p', `Read and execute the instructions in ${spec.briefPath}`,
    '--model', model,
    '--effort', effort,
    '--append-system-prompt-file', systemFile,
  ];
  if (role.tools.length > 0) {
    args.push('--allowedTools', role.tools.join(','));
  }
  args.push('--permission-mode', 'default', '--permission-prompts', 'none');
  if (spec.mcpConfig !== undefined) {
    args.push('--mcp-config', asConfigArg(spec.mcpConfig), '--strict-mcp-config');
  }
  if (spec.schema !== undefined) {
    args.push('--json-schema', asConfigArg(spec.schema));
  }
  args.push('--output-format', 'stream-json', '--verbose', '--max-turns', String(spec.maxTurns));
  if (spec.resume) {
    args.push('--resume', spec.resume);
  } else if (spec.sessionId) {
    args.push('--session-id', spec.sessionId);
  }
  if (spec.noSessionPersistence) {
    args.push('--no-session-persistence');
  }

  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const name of SCRUBBED_STEP_ENV_VARS) delete env[name];
  env.SDD_HEADLESS = '1';
  if (spec.runId) env.SDD_RUN_ID = spec.runId;
  if (spec.stepId) env.SDD_STEP_ID = spec.stepId;
  if (spec.workspace) env[SPEC_WORKFLOW_WORKSPACE_ENV] = spec.workspace;
  if (spec.sharedRoot) env[SPEC_WORKFLOW_SHARED_ROOT_ENV] = spec.sharedRoot;

  const schemaRequested = spec.schema !== undefined;

  return new Promise<StepResult>((resolvePromise) => {
    const log = createWriteStream(spec.logPath, { flags: 'a' });

    let initSessionId: string | null = null;
    let resultEvent: Record<string, unknown> | null = null;
    let lastRateLimit: RateLimitWindows | null = null;
    let settled = false;

    const handleEvent = (event: Record<string, unknown>): void => {
      const type = event.type;
      if (type === 'system' && event.subtype === 'init') {
        if (typeof event.session_id === 'string') initSessionId = event.session_id;
      } else if (type === 'assistant') {
        const message = (event.message ?? {}) as Record<string, unknown>;
        const content = Array.isArray(message.content) ? message.content : [];
        for (const block of content) {
          const b = block as Record<string, unknown>;
          if (b.type === 'tool_use' && typeof b.name === 'string') {
            spec.onActivity?.({
              tool: b.name,
              inputSummary: summariseToolInput(b.input),
              ts: typeof event.timestamp === 'string' ? event.timestamp : undefined,
            });
          }
        }
      } else if (type === 'rate_limit_event') {
        const info = (event.rate_limit_info ?? {}) as Record<string, unknown>;
        lastRateLimit = mapWindows(info);
        spec.onRateLimit?.(lastRateLimit);
      } else if (type === 'result') {
        resultEvent = event;
      }
    };

    const handleLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return; // Non-JSON noise is kept in the log but not interpreted.
      }
      if (parsed && typeof parsed === 'object') {
        handleEvent(parsed as Record<string, unknown>);
      }
    };

    let buffer = '';
    const onStdout = (chunk: Buffer): void => {
      log.write(chunk);
      buffer += chunk.toString('utf8');
      let idx: number;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        handleLine(line);
      }
    };

    const finish = (exitCode: number | null): void => {
      if (settled) return;
      settled = true;
      if (buffer.length > 0) {
        handleLine(buffer);
        buffer = '';
      }
      const result = resultEvent as Record<string, unknown> | null;
      const structuredOutput = result && 'structured_output' in result
        ? result.structured_output ?? null
        : null;
      const hasStructuredOutput = structuredOutput != null;
      const classification = classify(
        result, lastRateLimit, exitCode, schemaRequested, hasStructuredOutput,
      );
      const stepResult: StepResult = {
        structuredOutput,
        usage: mapUsage(result?.usage),
        sessionId: (result && typeof result.session_id === 'string' ? result.session_id : null)
          ?? initSessionId,
        numTurns: num(result?.num_turns),
        isError: result ? result.is_error === true : true,
        subtype: result && typeof result.subtype === 'string' ? result.subtype : null,
        resultText: result && typeof result.result === 'string' ? result.result : null,
        exitCode,
        classification,
        durationMs: result && typeof result.duration_ms === 'number' ? result.duration_ms : null,
      };
      // Resolve only once the raw-stream log has flushed to disk. Callers (and
      // the tests) read the log file the instant runStep resolves; a write
      // stream that is merely `end()`ed can still hold its last chunks in the
      // buffer, so resolving synchronously hands back a truncated log under load.
      // `resolve` is idempotent, so the error fallback cannot resolve twice.
      log.once('error', () => resolvePromise(stepResult));
      log.end(() => resolvePromise(stepResult));
    };

    const child = spawn(claudeBin(), args, {
      cwd: spec.worktree,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', onStdout);
    child.stderr.on('data', (chunk: Buffer) => log.write(chunk));
    child.on('error', (err: NodeJS.ErrnoException) => {
      if (settled) return;
      settled = true;
      log.write(`claude spawn error: ${err.message}\n`);
      log.end();
      resolvePromise({
        structuredOutput: null,
        usage: mapUsage(null),
        sessionId: null,
        numTurns: 0,
        isError: true,
        subtype: `spawn_error:${err.code ?? err.message}`,
        resultText: err.message,
        exitCode: null,
        classification: 'error',
        durationMs: null,
      });
    });
    child.on('close', (code) => finish(code));
  });
}
