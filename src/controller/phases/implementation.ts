// src/controller/phases/implementation.ts
//
// Step (c2) of the foundation rework (docs/foundation-review.md §6,
// docs/controller-design.md §5 "Implementation", docs/controller-tasks.md T12).
// The implementation phase in code: the per-task loop (test author, implementer,
// the review gate, the verifier, fix rounds, the adjudicator), the completion
// gate (end-to-end verification, INDEX, HANDOFF, the push and the pull request)
// and the PR checks loop (reconcile a red check, then the adjudicator). The rule
// source is `harness/skills/sdd-implementation-phase/SKILL.md` and its
// references (`completion.md`, `stops.md`); each function names the rule it
// carries. Every mechanical step is code; only the role steps are model calls.
//
// What this deliberately does not carry from the skill: the five-task budget
// (it capped an orchestrator's context, and there is no orchestrator), the
// batched verifier (one verifier per task that needs one), the graph refresh
// (the controller passes no graph values), and the decision-id citation check
// (a judgement, not a mechanic). The deferral bar is a judgement too: an
// `AFFECTS-FUTURE-SPECS` flag becomes a `note` row and a HANDOFF gotcha, never
// a record the controller invents.
import { randomUUID, createHash } from 'crypto';
import {
  existsSync, readFileSync, writeFileSync, appendFileSync, mkdirSync,
} from 'fs';
import { join, basename } from 'path';
import { execFile, execFileSync } from 'child_process';
import {
  runStep, loadRole, type StepResult, type StepSpec, type RateLimitWindows,
} from '../step.js';
import { routeForTask } from '../implementer-route.js';
import { type RunRecord, withStoreLock } from '../state.js';
import { commitSpecStore as commitStore, type RunLedger, type Serialize } from '../ledger.js';
import { harnessHandler } from '../../tools/harness.js';
import { reviewTaskHandler } from '../../tools/review-task.js';
import { specIndexHandler } from '../../tools/spec-index.js';
import { specStatusHandler } from '../../tools/spec-status.js';
import { buildRedTestsSection } from '../../tools/brief-templates.js';
import type { GateData } from '../../tools/review-gate.js';
import {
  parseTasksFromMarkdown, updateTaskStatus, taskBlock, type ParsedTask,
} from '../../core/task-parser.js';
import { ImplementationLogManager } from '../../dashboard/implementation-log-manager.js';
import { DeferralStorage } from '../../core/deferral-storage.js';
import { PathUtils } from '../../core/path-utils.js';
import { handoffPath } from '../../watch/index.js';
import { scrubbedGitEnv, defaultBranchIfOnIt } from '../../core/git-utils.js';
import { findPullRequest, readCiState, type CiState } from '../merge.js';
import {
  e2ePassStands, readSecurityState, classifySecurityReport, suspicionKey,
  SECURITY_SCHEMA, type SecurityFinding, type SecuritySuspicion, type SecurityState,
} from './security-pass.js';
import { parseSensitivePaths, isSensitivePath } from '../../core/gate-rules.js';
import type { ToolContext } from '../../types.js';

/** Fix rounds per task before the adjudicator rules (SKILL.md step 5). */
const FIX_ROUNDS_CAP = 3;
/** Repair rounds after a failed end-to-end verification (sdd-continue: at most two). */
const REPAIR_CAP = 2;
/** Reconcile rounds per red PR before the adjudicator (completion.md "Reconcile a red PR"). */
const RECONCILE_CAP = 3;
/** The PR checks gate waits this long for a pending check (completion.md 10b). */
const CI_MAX_WAIT_MS = 30 * 60 * 1000;
const CI_POLL_MS = 20 * 1000;
/** Lines of a failing job's log kept for the reconcile brief (completion.md step 1). */
const CI_LOG_TAIL = 80;

/** `--max-turns` per role; a backstop, not a budget (design §4). */
const TURN_CAP: Record<string, number> = {
  'sdd-implementer': 150,
  'sdd-test-author': 100,
  'sdd-verifier': 100,
  'sdd-adjudicator': 120,
};

// ---------------------------------------------------------------------------
// Context and outcome.
// ---------------------------------------------------------------------------

export interface ImplementationPhaseContext {
  run: RunRecord;
  /** The project root that holds `.spec-workflow` and is the git repo to commit spec-store files in. */
  specStoreRoot: string;
  /** `<specStoreRoot>/.spec-workflow/specs/<spec>`. */
  specDir: string;
  /** The run's worktree: where code work, the gate and the push happen. */
  codeRoot: string;
  /** The main checkout the worktree belongs to (equal to `codeRoot` without a worktree). */
  mainCheckout: string;
  ledger: RunLedger;
  stepLogDir: string;
  mcpConfig?: string | Record<string, unknown>;
  onStepActivity?: (e: { stepId: string; role: string; tool: string; inputSummary: string; ts?: string }) => void;
  onRateLimit?: (w: RateLimitWindows) => void;
  /** A step process started (the controller records it as the run's in-flight step). */
  onStepSpawn?: (s: { id: string; pid: number; startTime: number }) => Promise<void> | void;
  /** A step process ended (the controller clears the in-flight step); awaited before the step's result is acted on. */
  onStepEnd?: (id: string) => Promise<void> | void;
  /** Serialises spec-store commits; defaults to the T2 per-store lock. */
  serialize?: Serialize;
  now?: () => Date;
  /**
   * Checked between steps. A non-null reason (`cancelled`, `usage-window`) ends
   * the phase with `stopped`; the loop resumes from `tasks.md` on re-entry.
   */
  shouldStop?: () => string | null;
  /**
   * Where briefs and the standing files go. Defaults to
   * `/tmp/scratchpad/sdd/<spec>`, the path the fix, verifier and adjudicator
   * templates name for the standing files.
   */
  scratchDir?: string;
  /** The operator's answers to earlier escalation waits of this run, oldest first. */
  operatorRulings?: string[];
  /** PR checks polling; tests shorten both. */
  ci?: { pollMs?: number; maxWaitMs?: number };
  /** The operator's answers to this run's security escalation waits (C6), oldest first. */
  securityAnswers?: { waitId: string; value: string }[];
}

export interface ImplementationPhaseOutcome {
  /**
   * `complete`: every task done, verified end to end, pushed, the PR open with
   * green checks (or no remote). `design-defect` / `escalate`: a worker flag;
   * the task is back to `[ ]`. `verify-failed`: the end-to-end verification or
   * the PR checks stayed red after the caps. `security-open`: a sensitive spec's
   * security pass still has open findings after the adjudicator (C6); `findings`
   * carries them and the controller opens an escalation wait. `error`: a step or
   * tool failure the loop cannot route around (`reason` names it; `usage-limit`
   * is one). `stopped`: the caller asked the loop to stop between steps.
   */
  result: 'complete' | 'design-defect' | 'escalate' | 'verify-failed' | 'security-open' | 'error' | 'stopped';
  reason?: string;
  tasks: { done: number; total: number };
  pr?: { number: number; url?: string };
  /** The open security findings when `result` is `security-open` (C6). */
  findings?: SecurityFinding[];
}

// ---------------------------------------------------------------------------
// Report schemas (design §4: a typed report per role). The stub ignores them; a
// real `claude` validates its structured output. Every schema allows extra
// keys, and the loop also reads the flags off the report text as a fallback.
// ---------------------------------------------------------------------------

const AUTHOR_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['commit', 'files', 'flag'],
  properties: {
    commit: { type: 'string', description: 'The red commit sha, or "none"' },
    files: { type: 'array', items: { type: 'string' }, description: 'The test files written, root-relative' },
    tests: { type: 'number' },
    folds: { type: 'string' },
    flag: { type: 'string', description: '"none", "SEAM-DEFECT: …" or "RED-IMPOSSIBLE: …"' },
    redImpossible: { type: 'string', enum: ['none', 'some', 'all'] },
    retro: { type: 'string' },
  },
} as const;

export const IMPLEMENTER_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['logged', 'commit', 'checksFile', 'flag'],
  properties: {
    logged: { type: 'string', description: '"yes/<taskId>" or "no"' },
    commit: { type: 'string', description: 'The commit sha, or "none"' },
    checks: { type: 'string' },
    checksFile: { type: 'string', description: 'Path of a JSON array of the shell commands run' },
    green: { type: 'string' },
    flag: { type: 'string', description: '"none", "DESIGN-DEFECT: …", "ESCALATE: …", "AFFECTS-FUTURE-SPECS: …" or "INFRA: …"' },
    retro: { type: 'string', description: '"none" or "<category> — <one line>"' },
    reproduce: { type: 'string', description: 'CI fix only: the command that reproduces the check locally' },
  },
} as const;

const VERIFIER_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['verdict'],
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fix-required'] },
    findings: { type: 'string', description: 'A path, the findings text, or "none"' },
    retro: { type: 'string' },
  },
} as const;

const E2E_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['verify'],
  properties: {
    verify: { type: 'string', enum: ['pass', 'fail'] },
    deferredCommand: { type: 'string', description: 'When the scenario could only be verified in-process: the exact command to re-run once the checkout is rebuilt, else ""' },
    findings: { type: 'string' },
    retro: { type: 'string' },
  },
} as const;

const ADJUDICATOR_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['fixed', 'ruledOut'],
  properties: {
    commit: { type: 'string' },
    fixed: { type: 'array', items: { type: 'string' } },
    ruledOut: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
    flags: { type: 'string' },
  },
} as const;

interface AuthorReport { commit?: string; files?: string[]; tests?: number; folds?: string; flag?: string; redImpossible?: string; retro?: string }
interface ImplementerReport { logged?: string; commit?: string; checks?: string; checksFile?: string; green?: string; flag?: string; retro?: string; reproduce?: string }
interface VerifierReport { verdict?: string; findings?: string; retro?: string }
interface E2eReport { verify?: string; deferredCommand?: string; findings?: string; retro?: string }
interface AdjudicatorReport { commit?: string; fixed?: string[]; ruledOut?: string[]; notes?: string; flags?: string }

// ---------------------------------------------------------------------------
// Small pure helpers.
// ---------------------------------------------------------------------------

/** The text after `<FLAG>:` in a report field or the report text, or undefined. */
function flagText(flag: string, ...sources: (string | null | undefined)[]): string | undefined {
  const re = new RegExp(`${flag}:\\s*([^\\n]+)`);
  for (const s of sources) {
    if (!s) continue;
    const m = s.match(re);
    if (m) return m[1].trim();
  }
  return undefined;
}

/** `RETRO: <category> — <line>` or `<category> — <line>` ⇒ the pair, else undefined. */
function retroFlag(...sources: (string | null | undefined)[]): { category: string; line: string } | undefined {
  for (const s of sources) {
    if (!s || /^\s*(none|n\/a|-)?\s*$/i.test(s)) continue;
    const m = s.match(/(?:RETRO:\s*)?([a-z-]+)\s*[—–-]\s*([^\n]+)/i);
    if (m && RETRO_CATEGORIES.has(m[1].toLowerCase())) return { category: m[1].toLowerCase(), line: m[2].trim() };
  }
  return undefined;
}
const RETRO_CATEGORIES = new Set([
  'gotcha', 'bug', 'tool-error', 'mcp-deficiency', 'harness-defect', 'misunderstanding',
  'inefficiency', 'doc-gap', 'model-behaviour', 'ruling', 'escalation', 'cleanup', 'deviation',
]);

/** Is this a `[-]`/`[ ]` task whose `- Test:` seam routes it to the test author? */
function isTddMarked(task: ParsedTask, block: string): boolean {
  if (!task.tests || task.tests.length === 0) return false;
  return !/\bkind:\s*e2e\b/i.test(block);
}

/**
 * A task that adds or changes wiring (SKILL.md step 4, retro P6): an entrypoint,
 * CLI or route file, or a title that names one. Judged from the task, never the
 * gate's score.
 */
export function isWiringTask(task: { description: string; files?: string[] }): boolean {
  const fileHit = (task.files ?? []).some((f) =>
    /^(cli|index|main|server|app|routes?|router|entry)\.[cm]?[jt]sx?$/i.test(basename(f))
    || /(^|\/)(routes?|cli|bin)\//i.test(f));
  const titleHit = /\b(cli|entry ?point|route|command[- ]line|flag|endpoint|server start)\b/i.test(task.description);
  return fileHit || titleHit;
}

/** A spec-store-only task: no `File:` under the code root (SKILL.md step 3). */
function isVerificationOnly(task: ParsedTask): boolean {
  const files = task.files ?? [];
  return files.length === 0 || files.every((f) => f.replace(/^\.\//, '').startsWith('.spec-workflow/'));
}

/**
 * The gate's `checks` from the implementer's checks-file (SKILL.md step 4): a
 * flat JSON array of shell strings, minus a bare typecheck command (the gate runs
 * the project typecheck itself) and a `prettier --check` on a dotenv path.
 * Returns `null` when the file is missing or not a flat string array.
 */
export function readChecksFile(path: string | undefined, root: string): string[] | null {
  if (!path) return null;
  const abs = path.startsWith('/') ? path : join(root, path);
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(abs, 'utf-8'));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || !parsed.every((c) => typeof c === 'string')) return null;
  return (parsed as string[])
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
    .filter((c) => !/^(npx\s+|yarn\s+|pnpm\s+)?tsc\b(\s+--noEmit)?\s*$/.test(c))
    .filter((c) => !(/\bprettier\b.*--check/.test(c) && /\.env/.test(c)));
}

/** The `gh` binary, overridable so tests swap in `scripts/stub-gh.mjs` (as merge.ts does). */
function ghBin(): string {
  return process.env.CONTROLLER_GH_BIN || 'gh';
}

/** The pull request number at the end of a `gh pr create` URL. */
function prNumberFromUrl(text: string): number | undefined {
  const m = text.match(/\/pull\/(\d+)/);
  return m ? Number(m[1]) : undefined;
}

/** Two gate-reason lists, equal when they hold the same entries in the same order. */
function sameReasons(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((r, i) => r === b[i]);
}

// ---------------------------------------------------------------------------
// The loop.
// ---------------------------------------------------------------------------

export async function runImplementationPhase(ctx: ImplementationPhaseContext): Promise<ImplementationPhaseOutcome> {
  const specName = ctx.run.spec;
  const phase = 'implementation';
  const workflowRoot = PathUtils.getWorkflowRoot(ctx.specStoreRoot);
  const tasksPath = join(ctx.specDir, 'tasks.md');
  const retroLogPath = join(ctx.specDir, 'retrospective-log.md');
  const toolContext: ToolContext = { projectPath: ctx.specStoreRoot, workspacePath: ctx.codeRoot };
  const serialize: Serialize = ctx.serialize ?? ((fn) => withStoreLock(ctx.specStoreRoot, fn));
  const now = ctx.now ?? (() => new Date());
  const scratch = ctx.scratchDir ?? join('/tmp/scratchpad/sdd', specName);
  mkdirSync(scratch, { recursive: true });
  const logManager = new ImplementationLogManager(ctx.specDir);
  const gotchas: string[] = [];
  const verifierSkipped: string[] = [];
  const securityAccepted: SecurityFinding[] = [];
  const checksRun = new Set<string>();

  // --- git in the code root and the spec store --------------------------------
  const git = (cwd: string, args: string[]): string =>
    execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf-8', env: scrubbedGitEnv(), stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const gitTry = (cwd: string, args: string[]): string | undefined => {
    try { return git(cwd, args); } catch { return undefined; }
  };

  // --- ledger readers (resume idempotency, as document.ts) --------------------
  const ledgerRows = (): Record<string, string>[] => {
    let text: string;
    try { text = readFileSync(ctx.ledger.path, 'utf-8'); } catch { return []; }
    const rows: Record<string, string>[] = [];
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      try { rows.push(JSON.parse(line) as Record<string, string>); } catch { /* torn tail */ }
    }
    return rows.filter((r) => r.run === ctx.run.id);
  };

  // --- tasks.md -----------------------------------------------------------------
  const readTasks = () => parseTasksFromMarkdown(readFileSync(tasksPath, 'utf-8'));
  const setTask = (id: string, status: 'pending' | 'in-progress' | 'completed'): void => {
    writeFileSync(tasksPath, updateTaskStatus(readFileSync(tasksPath, 'utf-8'), id, status), 'utf-8');
  };
  const progress = (): { done: number; total: number } => {
    const p = readTasks().summary;
    return { done: p.completed, total: p.total };
  };

  // --- the retro log (formats.md "Retro-log entry", book.sh `retro`) ----------
  // Idempotent through the `mark <run> <hash>` marker book.sh appends to the
  // evidence, so a re-entry never lands the same entry twice.
  const retro = (stage: string, ref: string, category: string, body: string, evidence: string, cost: string): void => {
    const hash = createHash('sha1').update([stage, ref, category, body].join('|')).digest('hex').slice(0, 8);
    const marker = `mark ${ctx.run.id} ${hash}`;
    let existing = '';
    try { existing = readFileSync(retroLogPath, 'utf-8'); } catch { existing = ''; }
    if (existing.includes(marker)) return;
    const ts = now().toISOString().replace(/\.\d{3}Z$/, 'Z');
    const head = existing.length === 0 ? `# Retrospective log — ${specName}\n` : existing;
    const entry = `\n## ${ts} · ${stage} · ${ref} · ${category}\n${body}\nEvidence: ${evidence} · ${marker}\nCost: ${cost}\n`;
    writeFileSync(retroLogPath, head + entry, 'utf-8');
  };

  // --- HANDOFF `## <spec> — implementation` ------------------------------------
  const hoFile = handoffPath(workflowRoot);
  const handoffState = (text: string): void => setHandoffRow(hoFile, `## ${specName} — implementation`, 'State', text);

  // --- the spec-store commit (book.sh `commit`: only the spec-store paths) ------
  const commitSpecStore = (message: string): Promise<string | undefined> =>
    commitStore({ specStoreRoot: ctx.specStoreRoot, spec: specName, message }, serialize);

  // --- security pass: the `## Sensitive paths` list and the diff base (C6) ------
  const sensitivePathEntries = (): string[] => {
    try { return parseSensitivePaths(readFileSync(join(workflowRoot, 'agent-rules.md'), 'utf-8')) ?? []; } catch { return []; }
  };
  // The run branch's merge base with the default branch (origin/HEAD's target,
  // else main, else master); with none, the first `task <id> pick head` note.
  const securityBase = (): string => {
    const sym = gitTry(ctx.codeRoot, ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD']);
    let def: string | undefined;
    if (sym) def = sym.replace(/^refs\/remotes\//, '');
    else if (gitTry(ctx.codeRoot, ['rev-parse', '--verify', '--quiet', 'refs/heads/main'])) def = 'main';
    else if (gitTry(ctx.codeRoot, ['rev-parse', '--verify', '--quiet', 'refs/heads/master'])) def = 'master';
    if (def) {
      const mb = gitTry(ctx.codeRoot, ['merge-base', 'HEAD', def]);
      if (mb) return mb;
    }
    const pick = ledgerRows().find((r) => r.type === 'note' && / pick head /.test(r.text ?? ''));
    const m = pick ? /pick head (\S+)/.exec(pick.text ?? '') : null;
    return m ? m[1] : 'HEAD';
  };
  // One deferral per unseen suspicion (owner matthew, tag security), deduped by key.
  const createSuspicionDeferrals = async (suspicions: SecuritySuspicion[]): Promise<void> => {
    if (suspicions.length === 0) return;
    const storage = new DeferralStorage(ctx.specStoreRoot);
    for (const s of suspicions) {
      const key = suspicionKey(s);
      if (ledgerRows().some((r) => r.type === 'note' && (r.text ?? '').startsWith(`security: suspicion ${key} deferral `))) continue;
      const did = await storage.create({
        title: `Security suspicion: ${s.title}`, originSpec: specName, originPhase: 'implementation',
        revisitTrigger: 'the next security review of this spec', tags: ['security'], owner: 'matthew', supersedes: null,
        body: { context: `${s.file}: ${s.why}`, decision: 'reported as a suspicion by the security pass; not reproduced', revisitCriteria: `re-check ${s.file}` },
      });
      ctx.ledger.note(`security: suspicion ${key} deferral ${did}`);
    }
  };

  // --- a model step: the spawn boundary rows plus the classified result --------
  // `override` (the implementer route, C5) replaces the role profile's model and
  // effort in the boundary rows, so they match the `--model`/`--effort` argv.
  const stepUsage = (kind: 'start' | 'end' | 'usage', role: string, label: string,
    result?: StepResult, resultText?: string, task?: string, round?: string,
    override?: { model: string; effort: string }): void => {
    const profile = override ?? loadRole(role);
    if (kind === 'start') {
      ctx.ledger.spawnStart({ agent: role, role: label, model: profile.model, effort: profile.effort });
    } else if (kind === 'end' && result) {
      ctx.ledger.spawnEnd({ agent: role, model: profile.model, usage: result.usage });
    } else {
      ctx.ledger.spawnUsage({ agent: role, role: label, result: resultText, phase, task, round });
    }
  };

  const runModelStep = async (opts: {
    role: string; label: string; briefPath: string; stepId: string;
    schema?: Record<string, unknown>; task?: string; round?: string; resultLine?: (r: StepResult) => string;
    /** The implementer route (C5): overrides the role profile's model and effort for this step. */
    model?: { model: string; effort: string };
  }): Promise<{ result: StepResult; error?: ImplementationPhaseOutcome }> => {
    stepUsage('start', opts.role, opts.label, undefined, undefined, undefined, undefined, opts.model);
    let spawnWrite: Promise<void> | void = undefined;
    const spec: StepSpec = {
      role: opts.role,
      briefPath: opts.briefPath,
      worktree: ctx.codeRoot,
      logPath: join(ctx.stepLogDir, `${opts.stepId}.jsonl`),
      maxTurns: TURN_CAP[opts.role] ?? 100,
      sessionId: randomUUID(),
      model: opts.model?.model,
      effort: opts.model?.effort,
      mcpConfig: ctx.mcpConfig,
      schema: opts.schema,
      runId: ctx.run.id,
      stepId: opts.stepId,
      workspace: ctx.codeRoot,
      sharedRoot: ctx.specStoreRoot,
      onActivity: (a) => ctx.onStepActivity?.({ stepId: opts.stepId, role: opts.role, tool: a.tool, inputSummary: a.inputSummary, ts: a.ts }),
      onRateLimit: ctx.onRateLimit,
      onSpawn: (pid, startTime) => { spawnWrite = ctx.onStepSpawn?.({ id: opts.stepId, pid, startTime }); },
    };
    const result = await runStep(spec);
    // Both record writes land before the result is acted on, so a status the
    // caller writes next is never overwritten by a late in-flight update.
    await spawnWrite;
    await ctx.onStepEnd?.(opts.stepId);
    stepUsage('end', opts.role, opts.label, result, undefined, undefined, undefined, opts.model);
    const line = result.classification === 'ok' ? (opts.resultLine?.(result) ?? 'ok') : result.classification;
    stepUsage('usage', opts.role, opts.label, result, line, opts.task, opts.round);
    if (result.classification !== 'ok') {
      return { result, error: { result: 'error', reason: result.classification, tasks: progress() } };
    }
    return { result };
  };

  // --- the implementer model route (design C5, R2) ---------------------------
  // The gate-B class (a) veto items for this run, re-read at every task step
  // start so the route sees the current `tasks.md` and `## Sensitive paths`
  // (R2 AC 4). `null` is the strict path (the call failed), which `routeForTask`
  // routes to the Opus profile (design D7).
  const classAItems = async (): Promise<{ taskId: string; kind: string; reason: string }[] | null> => {
    const res = await harnessHandler({ action: 'gate', op: 'class-a', specName }, toolContext);
    if (!res.success) return null;
    return (res.data as { items?: { taskId: string; kind: string; reason: string }[] } | undefined)?.items ?? [];
  };

  /**
   * The route for a task's implementer step (model + effort), writing the route
   * note at the task's first step and again only when the route changes from the
   * newest route note for the task (R2 AC 9).
   */
  const routeForStep = async (taskId: string): Promise<{ model: string; effort: string }> => {
    const route = routeForTask(await classAItems(), taskId);
    const noteText = `task ${taskId} route ${route.model} ${route.effort}: ${route.reason}`;
    const prev = ledgerRows().filter((r) => r.type === 'note' && (r.text ?? '').startsWith(`task ${taskId} route `)).pop();
    if (!prev || prev.text !== noteText) ctx.ledger.note(noteText);
    return { model: route.model, effort: route.effort };
  };

  /** Write a brief through the server's `brief` action (the task block and read-and-obey line are its job). */
  const brief = async (template: string, path: string, values: Record<string, string>, taskId?: string): Promise<string> => {
    const res = await harnessHandler({ action: 'brief', template, specName, taskId, values: { ...values, path } }, toolContext);
    if (!res.success) throw new Error(`brief ${template} failed: ${res.message}`);
    return (res.data as { path: string }).path;
  };

  /** Append the operator's earlier rulings to a worker brief (an answered escalation wait). */
  const appendRulings = (briefPath: string): void => {
    const rulings = (ctx.operatorRulings ?? []).filter((r) => r.trim().length > 0);
    if (rulings.length === 0) return;
    appendFileSync(briefPath, `\n## Operator rulings\n${rulings.map((r) => `- ${r}`).join('\n')}\n`);
  };

  // --- stops (stops.md): HANDOFF, retro entry, commit, phase.end, outcome -------
  const phaseEnd = (result: string, note: string): void => {
    const p = progress();
    ctx.ledger.phaseEnd(phase, { result, state: `tasks ${p.done}/${p.total}`, note });
  };
  const stop = async (
    result: ImplementationPhaseOutcome['result'], reason: string,
    opts: { task?: ParsedTask; category?: string } = {},
  ): Promise<ImplementationPhaseOutcome> => {
    if (opts.task) setTask(opts.task.id, 'pending');
    if (opts.category && opts.task) retro(phase, `task ${opts.task.id}`, opts.category, reason, `task ${opts.task.id}`, 'unknown');
    const p = progress();
    handoffState(`tasks ${p.done}/${p.total}, stopped: ${result} — ${reason}`);
    phaseEnd(result, reason);
    await harnessHandler({ action: 'phase-log', specName }, toolContext);
    await commitSpecStore(`docs(sdd): ${specName} implementation ${result}`);
    return { result, reason, tasks: p };
  };

  // =========================================================================
  // Step 0 — orient, phase.start, standing briefs (SKILL.md Step 0).
  // =========================================================================
  const rows = ledgerRows();
  const implRows = rows.filter((r) => r.phase === phase && (r.type === 'phase.start' || r.type === 'phase.end'));
  const last = implRows[implRows.length - 1];
  if (last && last.type === 'phase.end' && last.result === 'complete') {
    // Idempotent completion (design §5/§8): already complete in this run.
    const pr = await findPullRequest({ repoDir: ctx.codeRoot, branch: ctx.run.branch, number: ctx.run.pr });
    return { result: 'complete', tasks: progress(), pr: pr ? { number: pr.number, url: pr.url } : undefined };
  }
  if (!last || last.type === 'phase.end') {
    const p = progress();
    ctx.ledger.phaseStart(phase, { mode: last ? 'repair' : 'normal', state: `tasks ${p.done}/${p.total}` });
  }

  const stdValues = {
    codeRoot: ctx.codeRoot, mainCheckout: ctx.mainCheckout, specStoreRoot: workflowRoot, specDir: ctx.specDir,
  };
  try {
    await brief('impl-standing', join(scratch, 'impl-standing.md'), stdValues);
    await brief('verify-standing', join(scratch, 'verify-standing.md'), stdValues);
  } catch (err) {
    return { result: 'error', reason: (err as Error).message, tasks: progress() };
  }

  // The gh precheck (retro P3): a note up front when gh cannot authenticate.
  if (gitTry(ctx.codeRoot, ['remote']) && !rows.some((r) => r.type === 'note' && /^gh unauthenticated/.test(r.text ?? ''))) {
    const auth = await runCommand(ghBin(), ['auth', 'status'], ctx.codeRoot);
    if (auth.code !== 0 && auth.code !== null) {
      ctx.ledger.note('gh unauthenticated; authenticate gh to open the PR');
      gotchas.push('gh was unauthenticated at phase start; the PR step reports what it could do');
    }
  }

  // =========================================================================
  // The per-task loop (SKILL.md "Per-task loop").
  // =========================================================================
  for (;;) {
    const halt = ctx.shouldStop?.();
    if (halt) return { result: 'stopped', reason: halt, tasks: progress() };

    const orient = await harnessHandler({ action: 'orient', specName, phase }, toolContext);
    if (!orient.success) return { result: 'error', reason: `orient failed: ${orient.message}`, tasks: progress() };
    const data = orient.data as {
      queue: { id: string; title: string; status: string; files: string[] }[];
      tasksApproved: boolean; tasks: { done: number; total: number; open: number; inProgress: number };
    };
    if (!data.tasksApproved && data.tasks.done === 0 && data.tasks.inProgress === 0) {
      return { result: 'error', reason: 'tasks.md not approved', tasks: progress() };
    }
    if (data.queue.length === 0) break;

    const parsed = readTasks();
    const task = parsed.tasks.find((t) => t.id === data.queue[0].id);
    if (!task) return { result: 'error', reason: `task ${data.queue[0].id} vanished from tasks.md`, tasks: progress() };

    const outcome = await runTask(task);
    if (outcome) return outcome;
  }

  // =========================================================================
  // The completion gate (completion.md steps 8-11).
  // =========================================================================
  return completionGate();

  // -------------------------------------------------------------------------
  // One task, from pick to `[x]`. Returns an outcome only on a stop.
  // -------------------------------------------------------------------------
  async function runTask(task: ParsedTask): Promise<ImplementationPhaseOutcome | undefined> {
    const id = task.id;
    const block = taskBlock(readFileSync(tasksPath, 'utf-8'), id) ?? '';
    const resumed = task.status === 'in-progress';
    let redCommit: string | undefined;

    // 1. Pick: `[-]`, task.pick, and the pre-implement HEAD as a note (a record
    // of where the task started, never the gate base: SKILL.md step 1). The note
    // is what a resume reads to find the task's own commits.
    if (!resumed) setTask(id, 'in-progress');
    const picked = ledgerRows().find((r) => r.type === 'task.pick' && r.task === id);
    if (!picked) ctx.ledger.taskPick({ task: id, title: task.description });
    const headNote = ledgerRows().find((r) => r.type === 'note' && (r.text ?? '').startsWith(`task ${id} pick head `));
    let preHead = headNote ? (headNote.text ?? '').slice(`task ${id} pick head `.length).trim() : '';
    if (!preHead) {
      preHead = gitTry(ctx.codeRoot, ['rev-parse', 'HEAD']) ?? '';
      if (preHead) ctx.ledger.note(`task ${id} pick head ${preHead}`);
    }
    /** The task's commits since its pick, oldest first, minus the author's red commit. */
    const taskCommits = (): string[] => (gitTry(ctx.codeRoot, ['log', '--reverse', '--format=%H', `${preHead}..HEAD`]) ?? '')
      .split('\n').filter((c) => c && c !== redCommit);

    // 1b. Author (marked tasks only). A resumed task whose red commit exists
    // skips the author (SKILL.md step 1b).
    const marked = isTddMarked(task, block);
    let authorFiles: string[] = [];
    let authorReport = '';
    let tddOff = !marked;
    if (marked) {
      redCommit = gitTry(ctx.codeRoot, ['log', '-1', '--format=%H', `--grep=^test(${specName}): task ${id} red$`]) || undefined;
      if (redCommit) {
        authorFiles = (gitTry(ctx.codeRoot, ['show', '--name-only', '--format=', redCommit]) ?? '').split('\n').filter(Boolean);
        authorReport = `commit: ${redCommit}\nfiles: ${authorFiles.join(', ')}\n(resumed: the author ran on an earlier turn)`;
      } else {
        const halt = ctx.shouldStop?.();
        if (halt) return { result: 'stopped', reason: halt, tasks: progress() };
        let briefPath: string;
        try {
          briefPath = await brief('test-author', join(scratch, `author-brief-task-${id}.md`), {
            title: task.description,
            job: `Spec dir: ${ctx.specDir}. Code root: ${ctx.codeRoot}. Spec store: ${workflowRoot}. `
              + 'Read the files your standing rules name from these roots; commit in the code root.',
          }, id);
          appendRulings(briefPath);
        } catch (err) {
          return { result: 'error', reason: (err as Error).message, tasks: progress() };
        }
        const step = await runModelStep({
          role: 'sdd-test-author', label: `author task ${id}`, briefPath, stepId: `author-task-${id}`,
          schema: AUTHOR_SCHEMA, task: id, resultLine: (r) => (r.structuredOutput as AuthorReport)?.flag ?? 'ok',
        });
        if (step.error) return step.error;
        const report = (step.result.structuredOutput ?? {}) as AuthorReport;
        const text = step.result.resultText;
        const seam = flagText('SEAM-DEFECT', report.flag, text);
        if (seam) return stop('design-defect', seam, { task, category: 'deviation' });
        const redImpossible = flagText('RED-IMPOSSIBLE', report.flag, text);
        const allImpossible = report.redImpossible === 'all' || (!!redImpossible && !report.commit?.match(/^[0-9a-f]{7,40}$/));
        if (allImpossible) {
          // Already satisfied by the shipped code (the F17 ruling): implementer-only, no tdd.
          retro(phase, `task ${id}`, 'doc-gap', `red-impossible on every criterion: ${redImpossible ?? 'author report'}; routed implementer-only`, `task ${id}`, '1 spawn');
          tddOff = true;
        } else {
          if (redImpossible) retro(phase, `task ${id}`, 'doc-gap', `red-impossible: ${redImpossible}`, `task ${id}`, '1 spawn');
          redCommit = gitTry(ctx.codeRoot, ['log', '-1', '--format=%H', `--grep=^test(${specName}): task ${id} red$`]) || undefined;
          if (!redCommit && report.commit && /^[0-9a-f]{7,40}$/.test(report.commit)) redCommit = report.commit;
          authorFiles = report.files ?? [];
          if (authorFiles.length === 0 && redCommit) {
            authorFiles = (gitTry(ctx.codeRoot, ['show', '--name-only', '--format=', redCommit]) ?? '').split('\n').filter(Boolean);
          }
          authorReport = text ?? JSON.stringify(report);
          if (!redCommit) tddOff = true; // nothing committed: the gate has no red proof to run
        }
        const r = retroFlag(report.retro, text);
        if (r) retro(phase, `task ${id}`, r.category, r.line, `task ${id}`, 'author');
      }
    }

    // 2. Implement (or reconcile a task already satisfied at HEAD).
    // The reconcile path also covers a non-resumed re-pick: an escalation resets
    // the task to pending (stop() above), so a resume or same-run re-serve then
    // re-spawns an implementer for a task its own commit already satisfies, which
    // only writes a 0-line "already complete at HEAD" log (retro F5/P5). An
    // existing completion log plus committed work in the task's range is the
    // HEAD-satisfied signal; a partial commit carries no completion log, so it
    // still re-spawns, and the gate runs on the committed range as the backstop.
    let commit: string | undefined;
    let implementerFiles: string[] = [];
    let checks: string[] = [];
    const existingLogs = await logManager.getTaskLogs(id);
    const priorCommits = taskCommits();
    // Not after an operator ruling: an answered escalation must reach a fresh
    // implementer with the ruling in its brief, even when the task has a log.
    const hasRulings = (ctx.operatorRulings ?? []).some((r) => r.trim().length > 0);
    if (existingLogs.length > 0 && (resumed || (priorCommits.length > 0 && !hasRulings))) {
      // stops.md "Resume recovery": a commit with no report is ambiguous state,
      // not unfinished work. Take the task's commits since its pick as the range.
      commit = priorCommits[0];
      implementerFiles = existingLogs.flatMap((e) => [...e.filesModified, ...e.filesCreated]);
      ctx.ledger.note(resumed
        ? `task ${id} resumed with its log present; gating from ${commit ? commit.slice(0, 7) : 'HEAD (no range)'}`
        : `task ${id} already satisfied at HEAD (log present, ${priorCommits.length} commit(s) in range); reconciling without a re-spawn`);
    } else {
      const halt = ctx.shouldStop?.();
      if (halt) return { result: 'stopped', reason: halt, tasks: progress() };
      const values: Record<string, string> = { title: task.description };
      if (!tddOff && authorFiles.length > 0) {
        values.authorFiles = authorFiles.join(', ');
        values.authorReport = authorReport;
      } else if (marked) {
        // A marked task routed implementer-only (red-impossible on every
        // criterion, or nothing committed): the brief tool requires both keys on
        // a marked task, so pass them empty; the brief then has no red tests.
        values.authorFiles = '';
        values.authorReport = '';
      }
      let briefPath: string;
      try {
        briefPath = await brief('implementer', join(scratch, `impl-brief-task-${id}.md`), values, id);
      } catch (err) {
        return { result: 'error', reason: (err as Error).message, tasks: progress() };
      }
      appendRulings(briefPath);

      let report: ImplementerReport = {};
      let text: string | null = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        const route = await routeForStep(id);
        const step = await runModelStep({
          role: 'sdd-implementer', label: attempt === 1 ? `implement task ${id}` : `implement task ${id} retry`,
          briefPath, stepId: `implementer-task-${id}${attempt > 1 ? `-retry` : ''}`, schema: IMPLEMENTER_SCHEMA, task: id,
          model: route, resultLine: (r) => (r.structuredOutput as ImplementerReport)?.logged ?? 'ok',
        });
        if (step.error) return step.error;
        report = (step.result.structuredOutput ?? {}) as ImplementerReport;
        text = step.result.resultText;
        const flagged = await routeImplementerFlags(task, report, text);
        if (flagged) return flagged;
        if ((await logManager.getTaskLogs(id)).length > 0) break;
        if (attempt === 1) {
          // `logged: no` (SKILL.md step 3): one fresh implementer with the brief plus the order.
          appendFileSync(briefPath, `\nCall log-implementation for task ${id} now; the code is done.\n`);
          continue;
        }
        return stop('error', `task ${id} was never logged (log-implementation not called twice)`);
      }

      commit = report.commit && /^[0-9a-f]{7,40}$/.test(report.commit) && gitTry(ctx.codeRoot, ['cat-file', '-e', `${report.commit}^{commit}`]) !== undefined
        ? git(ctx.codeRoot, ['rev-parse', report.commit])
        : taskCommits()[0];
      implementerFiles = (await logManager.getTaskLogs(id)).flatMap((e) => [...e.filesModified, ...e.filesCreated]);

      // The checks-file (SKILL.md step 4): one re-spawn asking for a flat array, then an empty list.
      let parsedChecks = readChecksFile(report.checksFile, ctx.codeRoot);
      if (parsedChecks === null && report.checksFile) {
        appendFileSync(briefPath, '\nRe-emit `checks-file` as a JSON array of the runnable shell-command strings you ran, one per entry.\n');
        const again = await runModelStep({
          role: 'sdd-implementer', label: `implement task ${id} retry`, briefPath,
          stepId: `implementer-task-${id}-checks`, schema: IMPLEMENTER_SCHEMA, task: id, model: await routeForStep(id),
        });
        if (again.error) return again.error;
        parsedChecks = readChecksFile(((again.result.structuredOutput ?? {}) as ImplementerReport).checksFile, ctx.codeRoot);
      }
      if (parsedChecks === null) ctx.ledger.note(`task ${id}: no usable checks-file; the gate ran the project checks only`);
      checks = parsedChecks ?? [];
      checks.forEach((c) => checksRun.add(c));
    }

    // Verification-only task (SKILL.md step 3): no gate, no verifier; it still needed its log.
    if (isVerificationOnly(task)) {
      verifierSkipped.push(id);
      return complete(task, 0, 'gate');
    }

    // 4. The gate, the verifier and the fix rounds (SKILL.md steps 4-5).
    const base = commit ? `${commit}^` : undefined;
    const tdd = !tddOff && redCommit && authorFiles.length > 0 ? { testFiles: authorFiles, redCommit } : undefined;
    let rounds = 0;
    let adjudicated = false;
    // P8 (dashboard-loop-views retro): the task HEAD and the gate reasons at the
    // previous gate, to spot a fix round that could not move the verdict.
    let prevGateHead: string | undefined;
    let prevReasons: string[] | undefined;
    for (;;) {
      const halt = ctx.shouldStop?.();
      if (halt) return { result: 'stopped', reason: halt, tasks: progress() };

      const gateRes = await reviewTaskHandler({
        action: 'gate', specName, taskId: id, root: ctx.codeRoot, baseRef: base, files: task.files ?? [], checks, tdd,
      }, toolContext);
      if (!gateRes.success) {
        // A gate tool error after `logged: yes` is not a fix round (SKILL.md step 4).
        return stop('error', `gate for task ${id} failed: ${gateRes.message}`);
      }
      const gate = gateRes.data as GateData;
      const tddNote = gate.tdd ? ` tdd ${gate.tdd.base}` : '';
      const why = gate.gate === 'fail' ? `: ${gate.reasons.slice(0, 3).join('; ')}`.slice(0, 300) : '';
      ctx.ledger.note(`gate: task ${id} ${gate.gate} risk ${gate.risk}${rounds > 0 ? ` round ${rounds}` : ''}${tddNote}${why}`);
      if (gate.tdd?.judged) {
        const j = gate.tdd.judged;
        ctx.ledger.judge({
          task: id, site: 'tdd',
          tautological: String(j.answers.tautological), asserts_criteria: String(j.answers.asserts_criteria),
          through_seam: String(j.answers.through_seam), mocks_internals: String(j.answers.mocks_internals),
          tokens: String((j as { inputTokens?: number }).inputTokens ?? ''), ms: String((j as { ms?: number }).ms ?? ''),
        });
      }

      // P8: a `file-outside-list` verdict no implementer edit can move. When the
      // last fix round produced no new commit (HEAD unchanged since the previous
      // gate) and the gate returned the identical reasons including a
      // file-outside-list reason, escalate as a design defect — the fix is in
      // tasks.md, not the code — rather than spend another implementer on the
      // same unchanged commit for the same verdict.
      const gateHead = gitTry(ctx.codeRoot, ['rev-parse', 'HEAD']);
      const outsideList = gate.reasons.filter((r) => r.startsWith('file-outside-list:'));
      if (outsideList.length > 0 && prevReasons && gateHead && gateHead === prevGateHead
        && sameReasons(gate.reasons, prevReasons)) {
        const files = outsideList.map((r) => r.slice('file-outside-list:'.length).trim()).join(', ');
        return stop('design-defect',
          `task ${id}: a fix round left the commit unchanged and the gate returned the same `
          + `file-outside-list verdict for ${files}; no implementer edit can move a file-list `
          + 'verdict — the fix is to list the file(s) in the task\'s File entries in tasks.md',
          { task, category: 'deviation' });
      }
      prevGateHead = gateHead;
      prevReasons = gate.reasons;

      let findings: string | undefined;
      let variant: 'gate' | 'verifier' = 'gate';
      if (gate.gate === 'fail') {
        findings = [...gate.reasons, ...gate.checks.map((c) => `${c.status} (${c.exitCode ?? 'signal'}): ${c.command} — ${c.output}`)].join('\n');
      } else if (gate.risk === 'high' || isWiringTask(task)) {
        // 4b. Verify (high risk, or the wiring exception at low/medium).
        const verdict = await verifyTask(task, rounds, implementerFiles, gate, 'task');
        if ('error' in verdict) return verdict.error;
        if (verdict.verdict === 'pass') return complete(task, rounds, adjudicated ? 'adjudicated' : 'pass');
        findings = verdict.findings;
        variant = 'verifier';
      } else {
        // Low or medium: the gate stands as the review (retro P6).
        if (!adjudicated) verifierSkipped.push(id);
        return complete(task, rounds, adjudicated ? 'adjudicated' : 'gate');
      }

      if (adjudicated) {
        // The narrow verification after adjudication does not open more rounds.
        retro(phase, `task ${id}`, 'ruling', `post-adjudication verdict fix-required: ${findings.slice(0, 200)}`, `task ${id}`, `${rounds} fix rounds`);
        return complete(task, rounds, 'adjudicated');
      }

      // 5. Fix round, or the adjudicator after the cap.
      rounds += 1;
      if (rounds > FIX_ROUNDS_CAP) {
        const adj = await adjudicateTask(task, findings);
        if (adj) return adj;
        adjudicated = true;
        const narrow = await verifyTask(task, rounds, implementerFiles, gate, 'narrow', findings);
        if ('error' in narrow) return narrow.error;
        retro(phase, `task ${id}`, 'ruling', `adjudicated after ${FIX_ROUNDS_CAP} fix rounds; narrow verdict ${narrow.verdict}`, `task ${id}`, `${rounds} rounds`);
        return complete(task, rounds, 'adjudicated');
      }
      const fixFindings = tdd ? `${buildRedTestsSection(authorFiles.join(', '), '', authorReport)}\n\n${findings}` : findings;
      let fixBrief: string;
      try {
        fixBrief = await brief('fix', join(scratch, `impl-brief-task-${id}-fix-${rounds}.md`), {
          taskId: id, round: String(rounds), variant, findings: fixFindings, commit: commit ?? 'none',
        });
      } catch (err) {
        return { result: 'error', reason: (err as Error).message, tasks: progress() };
      }
      appendRulings(fixBrief);
      const fixRoute = await routeForStep(id);
      const fix = await runModelStep({
        role: 'sdd-implementer', label: `fix task ${id} round ${rounds}`, briefPath: fixBrief,
        stepId: `implementer-task-${id}-fix-${rounds}`, schema: IMPLEMENTER_SCHEMA, task: id, round: String(rounds),
        model: fixRoute, resultLine: (r) => (r.structuredOutput as ImplementerReport)?.logged ?? 'ok',
      });
      if (fix.error) return fix.error;
      const fixReport = (fix.result.structuredOutput ?? {}) as ImplementerReport;
      const flagged = await routeImplementerFlags(task, fixReport, fix.result.resultText);
      if (flagged) return flagged;
      const fixChecks = readChecksFile(fixReport.checksFile, ctx.codeRoot);
      if (fixChecks) { checks = fixChecks; fixChecks.forEach((c) => checksRun.add(c)); }
      implementerFiles = (await logManager.getTaskLogs(id)).flatMap((e) => [...e.filesModified, ...e.filesCreated]);
    }
  }

  /** The implementer flags that stop the phase or leave a trace (SKILL.md step 3). */
  async function routeImplementerFlags(
    task: ParsedTask, report: ImplementerReport, text: string | null,
  ): Promise<ImplementationPhaseOutcome | undefined> {
    const defect = flagText('DESIGN-DEFECT', report.flag, text);
    if (defect) return stop('design-defect', defect, { task, category: 'deviation' });
    const escalate = flagText('ESCALATE', report.flag, text);
    if (escalate) return stop('escalate', escalate, { task, category: 'escalation' });
    const affects = flagText('AFFECTS-FUTURE-SPECS', report.flag, text);
    if (affects) {
      ctx.ledger.note(`affects-future-specs (task ${task.id}): ${affects}`);
      gotchas.push(`task ${task.id} affects future specs: ${affects}`);
    }
    const r = retroFlag(report.retro, text);
    if (r) retro(phase, `task ${task.id}`, r.category, r.line, `task ${task.id}`, 'implementer');
    return undefined;
  }

  /** One verifier step for a task (`task` or `narrow` variant). */
  async function verifyTask(
    task: ParsedTask, round: number, files: string[], gate: GateData, variant: 'task' | 'narrow', openFindings?: string,
  ): Promise<{ verdict: 'pass' | 'fix-required'; findings: string } | { error: ImplementationPhaseOutcome }> {
    const gateResults = variant === 'narrow'
      ? `Open findings to verify:\n${openFindings ?? ''}\n\nLast gate:\n${renderGateResults(gate)}`
      : renderGateResults(gate) + (gate.tdd?.amended ? '\nJudge the amended author test against the task\'s criteria first.' : '');
    let briefPath: string;
    try {
      briefPath = await brief('verifier', join(scratch, `verify-brief-task-${task.id}${variant === 'narrow' ? '-narrow' : round > 0 ? `-r${round}` : ''}.md`), {
        variant, title: task.description, taskIds: task.id, files: (files.length > 0 ? files : task.files ?? []).join(', '),
        round: String(round), gateResults, scenario: '',
      });
    } catch (err) {
      return { error: { result: 'error', reason: (err as Error).message, tasks: progress() } };
    }
    const step = await runModelStep({
      role: 'sdd-verifier', label: `verify task ${task.id}${round > 0 ? ` round ${round}` : ''}${variant === 'narrow' ? ' narrow' : ''}`,
      briefPath, stepId: `verifier-task-${task.id}-${variant}-r${round}`, schema: VERIFIER_SCHEMA, task: task.id,
      round: round > 0 ? String(round) : undefined,
      resultLine: (r) => `VERDICT: ${(r.structuredOutput as VerifierReport)?.verdict ?? 'unknown'}`,
    });
    if (step.error) return { error: step.error };
    const report = (step.result.structuredOutput ?? {}) as VerifierReport;
    const text = step.result.resultText ?? '';
    const verdict: 'pass' | 'fix-required' = report.verdict === 'pass' || (!report.verdict && /VERDICT:\s*pass/i.test(text)) ? 'pass' : 'fix-required';
    const r = retroFlag(report.retro, text);
    if (r) retro(phase, `task ${task.id}`, r.category, r.line, `task ${task.id}`, 'verifier');
    let findings = report.findings ?? text;
    if (findings && !findings.includes('\n') && existsSync(findings)) {
      try { findings = readFileSync(findings, 'utf-8'); } catch { /* keep the path */ }
    }
    return { verdict, findings: findings || text };
  }

  /** The adjudicator after three fix rounds (SKILL.md step 5). */
  async function adjudicateTask(task: ParsedTask, items: string): Promise<ImplementationPhaseOutcome | undefined> {
    let briefPath: string;
    try {
      briefPath = await brief('adjudicator', join(scratch, `adjudication-brief-task-${task.id}.md`), {
        taskId: task.id, phase, items,
      });
    } catch (err) {
      return { result: 'error', reason: (err as Error).message, tasks: progress() };
    }
    const step = await runModelStep({
      role: 'sdd-adjudicator', label: `adjudicate task ${task.id}`, briefPath,
      stepId: `adjudicator-task-${task.id}`, schema: ADJUDICATOR_SCHEMA, task: task.id,
    });
    if (step.error) return step.error;
    const report = (step.result.structuredOutput ?? {}) as AdjudicatorReport;
    ctx.ledger.note(`ruling: task ${task.id} adjudicated; fixed ${(report.fixed ?? []).length}, ruled out ${(report.ruledOut ?? []).length}`);
    return undefined;
  }

  /** `[x]`, task.done, the retro entry, the State row, the commit (SKILL.md step 6). */
  async function complete(task: ParsedTask, rounds: number, outcome: 'pass' | 'adjudicated' | 'gate'): Promise<undefined> {
    setTask(task.id, 'completed');
    ctx.ledger.taskDone({ task: task.id, rounds, outcome });
    retro(phase, `task ${task.id}`, rounds > 1 ? 'inefficiency' : 'gotcha',
      `task ${task.id} closed: ${rounds} fix round(s), outcome ${outcome}`, `task ${task.id}`, `${rounds + 1} implementer spawn(s)`);
    const p = progress();
    const head = gitTry(ctx.codeRoot, ['rev-parse', '--short', 'HEAD']) ?? 'unknown';
    const next = readTasks().tasks.find((t) => (t.status === 'pending' || t.status === 'in-progress') && !t.isHeader);
    handoffState(`tasks ${p.done}/${p.total}, last commit ${head}, next ${next ? `task ${next.id}` : 'completion gate'}`);
    await commitSpecStore(`docs(sdd): ${specName} task ${task.id}`);
    return undefined;
  }

  // -------------------------------------------------------------------------
  // The security pass for a sensitive spec (design C6 flow steps 2-4, R3).
  // Drives the loop from `readSecurityState`; returns `security-open`/`stopped`/
  // `error` to end the gate, or `undefined` to continue to the HANDOFF write.
  // -------------------------------------------------------------------------
  async function securityPass(): Promise<ImplementationPhaseOutcome | undefined> {
    // Sensitive = a `sensitive-path` class (a) item, or the class-a call failed.
    const items = await classAItems();
    const sensitive = items === null || items.some((i) => i.kind === 'sensitive-path');
    if (!sensitive) return undefined;

    for (;;) {
      const halt = ctx.shouldStop?.();
      if (halt) return { result: 'stopped', reason: halt, tasks: progress() };
      const state = readSecurityState(ledgerRows());
      if (state.epoch === 0) { ctx.ledger.note('security: epoch 1'); continue; }
      if (state.next === 'done') break;

      if (state.next === 'escalate') {
        ctx.ledger.note('security: escalated');
        return { result: 'security-open', findings: state.open, tasks: progress() };
      }
      if (state.next === 'await-answer') {
        const answer = (ctx.securityAnswers ?? []).find((a) => !state.answered.includes(a.waitId));
        if (!answer) return { result: 'security-open', findings: state.open, tasks: progress() };
        if (answer.value === 'accept') {
          ctx.ledger.note(`security: answer ${answer.waitId} accept`);
          ctx.ledger.note(`security: accepted ${JSON.stringify(state.open)}`);
          for (const f of state.open) {
            retro(phase, 'security', 'ruling', `accepted security finding: ${f.title} (${f.file}): ${f.command}`, 'security pass', 'operator accept');
          }
          ctx.ledger.note('security: done');
        } else if (answer.value === 'retry') {
          ctx.ledger.note(`security: answer ${answer.waitId} retry`);
          ctx.ledger.note(`security: epoch ${state.epoch + 1}`);
        } else {
          // `abandon` (or anything else): the controller cancels the run (C7), so
          // the gate never reaches the HANDOFF write or the push.
          return { result: 'security-open', findings: state.open, tasks: progress() };
        }
        continue;
      }

      const err = await runSecurityModelStep(state);
      if (err) return err;
    }

    // At `done`, each accepted finding goes to the Gotchas row and the PR body.
    for (const f of readSecurityState(ledgerRows()).accepted) {
      gotchas.push(`accepted security finding: ${f.title} (${f.file})`);
      securityAccepted.push(f);
    }
    return undefined;
  }

  /** The findings text for a security fix, re-check or adjudication brief. */
  function renderSecurityFindings(open: SecurityFinding[]): string {
    if (open.length === 0) return 'none';
    return open.map((f, i) => `${i + 1}. ${f.title} (${f.file})\n   reproduce: ${f.command}\n   output: ${f.output}`).join('\n\n');
  }

  /** One security step (pass, fix, re-check, adjudicator); writes its counts and open notes. */
  async function runSecurityModelStep(state: SecurityState): Promise<ImplementationPhaseOutcome | undefined> {
    const epoch = state.epoch;
    const open = state.open;
    const findingsText = renderSecurityFindings(open);

    if (state.next === 'pass') {
      const base = securityBase();
      const entries = sensitivePathEntries();
      const diff = (gitTry(ctx.codeRoot, ['diff', '--name-only', `${base}...HEAD`]) ?? '').split('\n').filter(Boolean);
      const sens = diff.filter((f) => isSensitivePath(f, entries));
      const other = diff.filter((f) => !isSensitivePath(f, entries));
      let briefPath: string;
      try {
        briefPath = await brief('verifier', join(scratch, `verify-security-pass-e${epoch}.md`), {
          variant: 'security', title: '', taskIds: '', files: '', round: '', gateResults: '', scenario: '',
          base, sensitiveFiles: sens.join('\n'), otherFiles: other.join('\n'), scratch,
        });
      } catch (err) { return { result: 'error', reason: (err as Error).message, tasks: progress() }; }
      const step = await runModelStep({ role: 'sdd-verifier', label: 'security pass', briefPath, stepId: `security-pass-e${epoch}`, schema: SECURITY_SCHEMA });
      if (step.error) return step.error;
      const { findings, suspicions } = classifySecurityReport(step.result.structuredOutput);
      await createSuspicionDeferrals(suspicions);
      ctx.ledger.note(`security: pass: findings ${findings.length}, suspicions ${suspicions.length}`);
      ctx.ledger.note(`security: open ${JSON.stringify(findings)}`);
      return undefined;
    }

    if (state.next === 'fix') {
      const k = state.fixRounds + 1;
      let briefPath: string;
      try {
        briefPath = await brief('fix', join(scratch, `impl-brief-security-e${epoch}-r${k}.md`), {
          variant: 'security', round: String(k), taskId: 'security', findings: findingsText, commit: 'none',
        });
      } catch (err) { return { result: 'error', reason: (err as Error).message, tasks: progress() }; }
      appendRulings(briefPath);
      // The security fix round keeps the role profile model (R2 AC 10) and never pushes.
      const step = await runModelStep({ role: 'sdd-implementer', label: `fix security round ${k}`, briefPath, stepId: `security-fix-e${epoch}-r${k}`, schema: IMPLEMENTER_SCHEMA });
      if (step.error) return step.error;
      ctx.ledger.note(`security: fix round ${k}: findings ${open.length}, suspicions 0`);
      ctx.ledger.note(`security: open ${JSON.stringify(open)}`);
      return undefined;
    }

    if (state.next === 'recheck' || state.next === 'recheck-adjudicated') {
      const adjudicated = state.next === 'recheck-adjudicated';
      const k = state.fixRounds;
      let briefPath: string;
      try {
        briefPath = await brief('verifier', join(scratch, adjudicated ? `verify-security-adj-e${epoch}.md` : `verify-security-recheck-e${epoch}-r${k}.md`), {
          variant: 'security-narrow', title: '', taskIds: '', files: '', round: String(k), gateResults: '', scenario: '',
          findings: findingsText, base: '', sensitiveFiles: '', otherFiles: '', scratch,
        });
      } catch (err) { return { result: 'error', reason: (err as Error).message, tasks: progress() }; }
      const step = await runModelStep({
        role: 'sdd-verifier', label: adjudicated ? 'verify security adjudicated' : `verify security round ${k}`,
        briefPath, stepId: adjudicated ? `security-recheck-adj-e${epoch}` : `security-recheck-e${epoch}-r${k}`, schema: SECURITY_SCHEMA,
      });
      if (step.error) return step.error;
      const { findings, suspicions } = classifySecurityReport(step.result.structuredOutput);
      await createSuspicionDeferrals(suspicions);
      ctx.ledger.note(`security: ${adjudicated ? 'recheck adjudicated' : `recheck ${k}`}: findings ${findings.length}, suspicions ${suspicions.length}`);
      ctx.ledger.note(`security: open ${JSON.stringify(findings)}`);
      return undefined;
    }

    // 'adjudicate': the adjudicator rules on the open findings; it re-checks nothing.
    let briefPath: string;
    try {
      briefPath = await brief('adjudicator', join(scratch, `adjudication-brief-security-e${epoch}.md`), { taskId: 'security', phase, items: findingsText });
    } catch (err) { return { result: 'error', reason: (err as Error).message, tasks: progress() }; }
    const step = await runModelStep({ role: 'sdd-adjudicator', label: 'adjudicate security', briefPath, stepId: `security-adjudicate-e${epoch}`, schema: ADJUDICATOR_SCHEMA });
    if (step.error) return step.error;
    ctx.ledger.note(`security: adjudicator: findings ${open.length}, suspicions 0`);
    ctx.ledger.note(`security: open ${JSON.stringify(open)}`);
    return undefined;
  }

  // -------------------------------------------------------------------------
  // The completion gate (completion.md steps 8-11) and the PR checks loop.
  // -------------------------------------------------------------------------
  async function completionGate(): Promise<ImplementationPhaseOutcome> {
    const orient = await harnessHandler({ action: 'orient', specName, phase }, toolContext);
    const decomposition = (orient.data as { decomposition?: { title: string | null; scenario: string | null } } | undefined)?.decomposition;
    const scenario = decomposition?.scenario ?? `read the decomposition entry for ${specName} yourself`;

    // 8. End-to-end verification, with the repair rounds on a fail. A re-entry whose
    // newest marker is the e2e pass (design C6 flow step 1, D8, R3 AC 13) skips the
    // loop: the pass stands until the next HANDOFF write.
    if (!e2ePassStands(ledgerRows())) {
      for (let repair = 0; ; repair++) {
        const halt = ctx.shouldStop?.();
        if (halt) return { result: 'stopped', reason: halt, tasks: progress() };
        const e2e = await verifyEndToEnd(scenario, repair);
        if ('error' in e2e) return e2e.error;
        if (e2e.verify === 'pass') {
          if (e2e.deferredCommand) {
            const storage = new DeferralStorage(ctx.specStoreRoot);
            const did = await storage.create({
              title: `Deferred verification: ${specName}`, originSpec: specName, originPhase: 'implementation',
              revisitTrigger: 'the checkout is rebuilt and the session restarted', tags: ['verification'], supersedes: null,
              body: {
                context: e2e.findings || 'the scenario needed a tool or skill the running session lacked',
                decision: 'verified the in-process half; the live half runs after the rebuild',
                revisitCriteria: e2e.deferredCommand,
              },
            });
            ctx.ledger.note(`deferred verification ${did}: ${e2e.deferredCommand}`);
            gotchas.push(`verification deferred (${did}): ${e2e.deferredCommand}`);
          }
          // The pass marker (design C6 flow step 5, D8): a re-entry reads it and skips the loop above.
          ctx.ledger.note('e2e verification passed');
          break;
        }
        retro(phase, 'phase', 'bug', `end-to-end verification failed (round ${repair}): ${e2e.findings.slice(0, 300)}`, 'completion gate', `${repair} repair(s)`);
        if (repair >= REPAIR_CAP) return stop('verify-failed', `end-to-end verification failed after ${REPAIR_CAP} repairs: ${e2e.findings.slice(0, 300)}`);
        const fixed = await repairRound(repair + 1, e2e.findings);
        if (fixed) return fixed;
      }
    }

    // 8.5. The security pass for a sensitive spec (design C6 flow steps 2-4).
    const sec = await securityPass();
    if (sec) return sec;

    // 9. Close the spec: INDEX, deferral counts, HANDOFF, the retro summary, the commit.
    const p = progress();
    await specIndexHandler({ action: 'generate' }, toolContext);
    const storage = new DeferralStorage(ctx.specStoreRoot);
    const deferred = await storage.list({ status: 'deferred' });
    const mine = deferred.filter((d) => d.originSpec === specName);
    const deferredVerification = mine.filter((d) => d.tags.includes('verification')).map((d) => d.id);
    const coverage = await readCoverage();
    const date = now().toISOString().slice(0, 10);
    writeHandoffSection(hoFile, `## ${specName} — implementation`, [
      ['State', `tasks ${p.done}/${p.total}, implemented ${date}`],
      ['Implemented', date],
      ['PR', 'pending'],
      ['Coverage', coverage],
      ['Deferrals', `${mine.length} added by this spec, ${deferred.length} open in all`],
      ['Verifier-skipped', verifierSkipped.length > 0 ? `${verifierSkipped.map((t) => `task ${t}`).join(', ')} (gate-only review, retro P6/P15)` : 'none'],
      ...deferredVerification.map((d) => ['Deferred verification', d] as [string, string]),
      ['Next', mine.slice(0, 3).map((d) => `${d.id} ${d.title}`).join('; ') || 'none'],
      ['Gotchas', gotchas.join('; ') || 'none'],
    ]);
    // The HANDOFF marker (design C6 flow step 5, D8): it makes the e2e pass above stale,
    // so the next re-entry runs the e2e loop again.
    ctx.ledger.note('completion handoff written');
    retro(phase, 'phase', 'cleanup',
      `implementation complete: ${p.total} tasks, ${ledgerRows().filter((r) => r.type === 'spawn.usage' && /^fix task/.test(r.role ?? '')).length} fix rounds, `
      + `${ledgerRows().filter((r) => r.type === 'spawn.usage' && /^adjudicate/.test(r.role ?? '')).length} adjudications, `
      + `${ledgerRows().filter((r) => r.type === 'spawn.start').length} spawns, ${mine.length} deferrals added`,
      'completion gate', 'see the ledger');
    await commitSpecStore(`docs(sdd): ${specName} implemented, ${p.total} tasks`);

    // 10. Push and PR (one per code repo per spec), then 10b the checks gate.
    // The decomposition heading's state marker ("(active)", "(done)") is not part of the title.
    const title = (decomposition?.title ?? specName).replace(/\s*\((active|done|next|parked|superseded)\)\s*$/i, '').trim() || specName;
    const pr = await pushAndOpenPr(title, p);
    if (pr) {
      const ci = await prChecksGate(pr.number);
      if (ci) return ci;
    }

    // 11. Report.
    setHandoffRow(hoFile, `## ${specName} — implementation`, 'PR', pr ? (pr.url ?? `#${pr.number}`) : 'none (no remote, or not opened: see Gotchas)');
    setHandoffRow(hoFile, `## ${specName} — implementation`, 'Gotchas', gotchas.join('; ') || 'none');
    phaseEnd('complete', pr ? `PR #${pr.number}` : 'no PR');
    await harnessHandler({ action: 'phase-log', specName }, toolContext);
    await commitSpecStore(`docs(sdd): ${specName} implementation complete`);
    return { result: 'complete', tasks: progress(), pr };
  }

  async function verifyEndToEnd(scenario: string, round: number): Promise<{ verify: 'pass' | 'fail'; deferredCommand?: string; findings: string } | { error: ImplementationPhaseOutcome }> {
    let briefPath: string;
    try {
      briefPath = await brief('verifier', join(scratch, `verify-e2e${round > 0 ? `-r${round}` : ''}.md`), {
        variant: 'e2e', scenario, title: '', taskIds: '', files: '', round: '', gateResults: '',
      });
    } catch (err) {
      return { error: { result: 'error', reason: (err as Error).message, tasks: progress() } };
    }
    const step = await runModelStep({
      role: 'sdd-verifier', label: 'end-to-end verification', briefPath, stepId: `verifier-e2e-r${round}`,
      schema: E2E_SCHEMA, round: round > 0 ? String(round) : undefined,
      resultLine: (r) => `VERIFY: ${(r.structuredOutput as E2eReport)?.verify ?? 'unknown'}`,
    });
    if (step.error) return { error: step.error };
    const report = (step.result.structuredOutput ?? {}) as E2eReport;
    const text = step.result.resultText ?? '';
    const r = retroFlag(report.retro, text);
    if (r) retro(phase, 'phase', r.category, r.line, 'end-to-end verification', 'verifier');
    const verify: 'pass' | 'fail' = report.verify === 'pass' || (!report.verify && /VERIFY:\s*pass/i.test(text)) ? 'pass' : 'fail';
    const deferredCommand = report.deferredCommand?.trim() || text.match(/VERIFY:\s*pass\s*\(deferred:\s*([^)]+)\)/i)?.[1]?.trim() || undefined;
    return { verify, deferredCommand, findings: report.findings || text };
  }

  /** One repair implementer after a failed end-to-end verification (completion.md "Repair"). */
  async function repairRound(k: number, failure: string): Promise<ImplementationPhaseOutcome | undefined> {
    let briefPath: string;
    try {
      briefPath = await brief('fix', join(scratch, `impl-brief-repair-${k}.md`), {
        taskId: 'repair', round: String(k), variant: 'repair', commit: 'none',
        findings: `${failure}\n\nReproduce first, fix the cause, add coverage that fails without the fix, and report.`,
      });
    } catch (err) {
      return { result: 'error', reason: (err as Error).message, tasks: progress() };
    }
    appendRulings(briefPath);
    const step = await runModelStep({
      role: 'sdd-implementer', label: `repair round ${k}`, briefPath, stepId: `implementer-repair-${k}`,
      schema: IMPLEMENTER_SCHEMA, round: String(k),
    });
    if (step.error) return step.error;
    const report = (step.result.structuredOutput ?? {}) as ImplementerReport;
    const r = retroFlag(report.retro, step.result.resultText);
    if (r) retro(phase, 'phase', r.category, r.line, `repair ${k}`, 'implementer');
    return undefined;
  }

  /** Push the branch and open (or reuse) the PR; a failure is a note, never a halt (completion.md step 10, retro P7). */
  async function pushAndOpenPr(title: string, p: { done: number; total: number }): Promise<{ number: number; url?: string } | undefined> {
    const remotes = gitTry(ctx.codeRoot, ['remote']) ?? '';
    if (!remotes.trim()) return undefined;
    const onDefault = defaultBranchIfOnIt(ctx.codeRoot);
    if (onDefault) {
      ctx.ledger.note(`on the default branch ${onDefault}: nothing pushed, no PR`);
      return undefined;
    }
    const branch = gitTry(ctx.codeRoot, ['rev-parse', '--abbrev-ref', 'HEAD']) ?? ctx.run.branch;
    const push = await runCommand('git', ['push', '-u', 'origin', 'HEAD'], ctx.codeRoot);
    if (push.code !== 0) {
      ctx.ledger.note(`push failed: ${tail(push.stderr || push.stdout, 3)}`);
      gotchas.push(`push failed: ${tail(push.stderr || push.stdout, 1)}; push and open the PR by hand`);
      return undefined;
    }
    const existing = await findPullRequest({ repoDir: ctx.codeRoot, branch, number: ctx.run.pr });
    if (existing) return { number: existing.number, url: existing.url };

    const bodyPath = join(scratch, 'pr-body.md');
    writeFileSync(bodyPath, buildPrBody(p), 'utf-8');
    const created = await runCommand(ghBin(), ['pr', 'create', '--head', branch, '--title', title, '--body-file', bodyPath], ctx.codeRoot);
    if (created.code !== 0) {
      const why = tail(created.stderr || created.stdout, 3);
      ctx.ledger.note(`PR not opened: ${why}; operator must run gh pr create`);
      gotchas.push(`PR not opened (${tail(why, 1)}); run: gh pr create --head ${branch} --title "${title}" --body-file ${bodyPath}`);
      return undefined;
    }
    const number = prNumberFromUrl(created.stdout);
    if (number === undefined) {
      const found = await findPullRequest({ repoDir: ctx.codeRoot, branch });
      return found ? { number: found.number, url: found.url } : undefined;
    }
    return { number, url: created.stdout.trim().split('\n').pop() };
  }

  /** The PR body (completion.md "PR body rules"): task titles, the cut scope, the checks run. */
  function buildPrBody(p: { done: number; total: number }): string {
    const tasks = readTasks().tasks.filter((t) => !t.isHeader);
    const lines = ['## Summary', ...tasks.map((t) => `- ${t.description}`)];
    const cuts = ['requirements', 'design', 'tasks']
      .map((ph) => readHandoffRow(hoFile, `## ${specName} — ${ph}`, 'Cut scope'))
      .filter((v): v is string => !!v && v !== 'none');
    if (cuts.length > 0) lines.push(`- Not in this PR: ${cuts.join('; ')}`);
    lines.push('', '## Test plan', `- [x] End-to-end verification scenario (sdd-verifier), ${p.done}/${p.total} tasks gated`);
    for (const c of checksRun) lines.push(`- [x] \`${c}\``);
    for (const g of gotchas.filter((x) => x.startsWith('verification deferred'))) lines.push(`- [ ] ${g}`);
    for (const f of securityAccepted) lines.push(`- [ ] accepted security finding: ${f.title} (${f.file}): ${f.command}`);
    let body = lines.join('\n') + '\n';
    for (const term of forbiddenPrTerms()) {
      body = body.split(term).join('[redacted]');
    }
    return body;
  }

  /** `Forbidden terms in a PR body: a, b` under `## PR body` in agent-rules.md; `none` or absent ⇒ []. */
  function forbiddenPrTerms(): string[] {
    let rules: string;
    try { rules = readFileSync(join(workflowRoot, 'agent-rules.md'), 'utf-8'); } catch { return []; }
    const m = rules.match(/Forbidden terms in a PR body:\s*([^\n]+)/i);
    if (!m || /^\s*none\.?\s*$/i.test(m[1])) return [];
    return m[1].split(/\s*,\s*/).map((t) => t.replace(/^`|`$/g, '').replace(/\.$/, '').trim()).filter((t) => t.length > 0);
  }

  /** The PR checks gate and the reconcile loop (completion.md 10b, "Reconcile a red PR"). */
  async function prChecksGate(prNumber: number): Promise<ImplementationPhaseOutcome | undefined> {
    const pollMs = ctx.ci?.pollMs ?? CI_POLL_MS;
    const maxWaitMs = ctx.ci?.maxWaitMs ?? CI_MAX_WAIT_MS;

    const poll = async (): Promise<CiState> => {
      const started = now().getTime();
      for (;;) {
        const halt = ctx.shouldStop?.();
        if (halt) return { state: 'pending', failing: [], reason: halt };
        const head = gitTry(ctx.codeRoot, ['rev-parse', 'HEAD']) ?? '';
        // Each poll starts right after a push (the PR, or a reconcile fix).
        const ci = await readCiState(ctx.codeRoot, head, now, started);
        if (ci.state !== 'pending') return ci;
        if (now().getTime() - started >= maxWaitMs) {
          return { state: 'red', failing: [{ name: 'pending', runId: undefined }], reason: 'checks still pending after the wait' };
        }
        await new Promise((r) => setTimeout(r, pollMs));
      }
    };

    for (let round = 1; ; round++) {
      let ci = await poll();
      if (ci.state === 'green') return undefined;
      if (ci.state === 'pending') return { result: 'stopped', reason: ci.reason ?? 'stopped', tasks: progress() };
      if (ci.state === 'unreadable') {
        ctx.ledger.note(`ci unreadable: ${ci.reason ?? 'unknown'}`);
        gotchas.push(`PR checks could not be read (${ci.reason ?? 'unknown'}); the merge stage reads them again`);
        return undefined; // the merge stage owns the unreadable case (an error wait with retry)
      }
      const names = ci.failing.map((f) => f.name).join(', ');
      ctx.ledger.note(`ci red: ${names}, round ${round}`);
      if (round > RECONCILE_CAP) {
        const items = ci.failing.map((f) => `${f.name}: ${f.log ?? 'no log'} — rule on it: fix it, or state why it cannot be fixed here`).join('\n');
        let adjBrief: string;
        try {
          adjBrief = await brief('adjudicator', join(scratch, 'adjudication-brief-ci.md'), { taskId: 'ci', phase, items });
        } catch (err) {
          return { result: 'error', reason: (err as Error).message, tasks: progress() };
        }
        const adj = await runModelStep({ role: 'sdd-adjudicator', label: 'adjudicate ci', briefPath: adjBrief, stepId: 'adjudicator-ci', schema: ADJUDICATOR_SCHEMA });
        if (adj.error) return adj.error;
        await runCommand('git', ['push'], ctx.codeRoot);
        ci = await poll();
        if (ci.state === 'green') return undefined;
        retro(phase, 'phase', 'escalation', `PR checks red after ${RECONCILE_CAP} reconcile rounds and an adjudication: ${names}`, `PR #${prNumber}`, `${round} rounds`);
        return stop('verify-failed', `ci: ${names}`);
      }

      // 1. The log tail of each failing run, saved for the brief; never read here.
      const logPaths: string[] = [];
      for (const f of ci.failing) {
        if (f.runId === undefined) continue;
        const log = await runCommand(ghBin(), ['run', 'view', String(f.runId), '--log-failed'], ctx.codeRoot);
        const path = join(scratch, `ci-${f.name.replace(/[^A-Za-z0-9_.-]+/g, '_')}-r${round}.log`);
        writeFileSync(path, tail(log.stdout || log.stderr, CI_LOG_TAIL) + '\n', 'utf-8');
        f.log = path;
        logPaths.push(path);
      }
      // 2. Fix.
      let fixBrief: string;
      try {
        fixBrief = await brief('fix', join(scratch, `impl-brief-ci-r${round}.md`), {
          variant: 'reconcile', round: String(round), checkNames: names, logPaths: logPaths.join(', '),
          taskId: 'ci', findings: '', commit: 'none',
        });
      } catch (err) {
        return { result: 'error', reason: (err as Error).message, tasks: progress() };
      }
      const fix = await runModelStep({
        role: 'sdd-implementer', label: `fix ci ${names} round ${round}`, briefPath: fixBrief,
        stepId: `implementer-ci-r${round}`, schema: IMPLEMENTER_SCHEMA, round: String(round),
      });
      if (fix.error) return fix.error;
      const fixReport = (fix.result.structuredOutput ?? {}) as ImplementerReport;
      const infra = flagText('INFRA', fixReport.flag, fix.result.resultText);
      if (infra) {
        retro(phase, 'phase', 'tool-error', `ci infrastructure failure: ${infra}`, names, `round ${round}`);
        for (const f of ci.failing) if (f.runId !== undefined) await runCommand(ghBin(), ['run', 'rerun', String(f.runId), '--failed'], ctx.codeRoot);
        continue;
      }
      // 3. Verify, then push.
      const sha = gitTry(ctx.codeRoot, ['rev-parse', 'HEAD']) ?? 'HEAD';
      let verifyBrief: string;
      try {
        verifyBrief = await brief('verifier', join(scratch, `verify-brief-ci-r${round}.md`), {
          variant: 'ci', round: String(round), checkNames: names, sha, command: fixReport.reproduce ?? 'the check\'s own command',
          title: '', taskIds: '', files: '', gateResults: '', scenario: '',
        });
      } catch (err) {
        return { result: 'error', reason: (err as Error).message, tasks: progress() };
      }
      const verify = await runModelStep({
        role: 'sdd-verifier', label: `verify ci ${names} round ${round}`, briefPath: verifyBrief,
        stepId: `verifier-ci-r${round}`, schema: VERIFIER_SCHEMA, round: String(round),
        resultLine: (r) => `VERIFY: ${(r.structuredOutput as VerifierReport)?.verdict ?? 'unknown'}`,
      });
      if (verify.error) return verify.error;
      const vr = (verify.result.structuredOutput ?? {}) as VerifierReport;
      retro(phase, 'phase', 'bug', `ci red (${names}), fix round ${round}, verifier ${vr.verdict ?? 'unknown'}`, `${names} ${sha.slice(0, 7)}`, `round ${round}`);
      if (vr.verdict === 'pass') await runCommand('git', ['push'], ctx.codeRoot);
      // A fail goes round again without a push (completion.md step 3).
    }
  }

  /** `spec-status`'s coverage numbers, stated verbatim (completion.md step 11). */
  async function readCoverage(): Promise<string> {
    const res = await specStatusHandler({ specName }, toolContext);
    const d = (res.data ?? {}) as {
      logCoverage?: { logged: number; unlogged: string[] };
      reviewCoverage?: { reviewed: number; unreviewed: string[] };
      tddCoverage?: { tasks: number; base: Record<string, number>; tddTestCommandWired?: boolean };
    };
    const p = progress();
    const parts: string[] = [];
    if (d.logCoverage) parts.push(`logCoverage ${d.logCoverage.logged}/${p.done}${d.logCoverage.unlogged.length ? ` (unlogged: ${d.logCoverage.unlogged.join(', ')})` : ''}`);
    if (d.reviewCoverage) parts.push(`reviewCoverage ${d.reviewCoverage.reviewed}/${p.done}${d.reviewCoverage.unreviewed.length ? ` (unreviewed: ${d.reviewCoverage.unreviewed.join(', ')})` : ''}`);
    if (d.tddCoverage) {
      parts.push(d.tddCoverage.tddTestCommandWired === false
        ? 'TDD: N/A (no tdd-test-command wired)'
        : `TDD ${d.tddCoverage.tasks} task(s): ${Object.entries(d.tddCoverage.base).map(([k, v]) => `${k} ${v}`).join(', ')}`);
    }
    return parts.join('; ') || 'unknown';
  }
}

// ---------------------------------------------------------------------------
// Rendering and file helpers (module level, no closure state).
// ---------------------------------------------------------------------------

/** The `## Gate results` block for a verifier brief: the gate's data, verbatim. */
function renderGateResults(gate: GateData): string {
  const { reasons, checks, stats, touched, typecheck, tdd } = gate;
  return '```json\n' + JSON.stringify({ gate: gate.gate, risk: gate.risk, reasons, checks, stats, touched, typecheck, tdd }, null, 2) + '\n```';
}

interface CommandResult { code: number | null; stdout: string; stderr: string }

function runCommand(bin: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolve) => {
    execFile(bin, args, { cwd, env: bin === 'git' ? scrubbedGitEnv() : process.env, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      const e = err as NodeJS.ErrnoException | null;
      const code = e && typeof e.code === 'number' ? e.code : e ? null : 0;
      resolve({ code, stdout: stdout ?? '', stderr: stderr ?? '' });
    });
  });
}

function tail(text: string, lines: number): string {
  return text.replace(/\s+$/, '').split('\n').slice(-lines).join('\n');
}

// --- HANDOFF sections: `## <spec> — <stage>` tables -----------------------

function readHandoff(hoFile: string): string[] {
  try { return readFileSync(hoFile, 'utf-8').split('\n'); } catch { return []; }
}

function sectionBounds(lines: string[], header: string): { start: number; end: number } | undefined {
  const start = lines.findIndex((l) => l.trim() === header);
  if (start === -1) return undefined;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) { end = i; break; }
  }
  return { start, end };
}

/** Replace (or create) one `| Key | Value |` row in the section, creating the section when missing. */
export function setHandoffRow(hoFile: string, header: string, key: string, value: string): void {
  const lines = readHandoff(hoFile);
  const row = `| ${key} | ${value.replace(/\|/g, '\\|').replace(/\s*\n+\s*/g, ' ')} |`;
  const bounds = sectionBounds(lines, header);
  if (!bounds) {
    const content = lines.join('\n');
    const sep = content.length === 0 ? '' : (content.endsWith('\n') ? '\n' : '\n\n');
    writeFileSync(hoFile, `${content}${sep}${header}\n\n| Field | Value |\n| --- | --- |\n${row}\n`, 'utf-8');
    return;
  }
  const { start, end } = bounds;
  for (let i = start + 1; i < end; i++) {
    if (lines[i].trim().startsWith(`| ${key} |`)) {
      lines[i] = row;
      writeFileSync(hoFile, lines.join('\n'), 'utf-8');
      return;
    }
  }
  // No such row: append after the last table row of the section.
  let insertAt = end;
  for (let i = end - 1; i > start; i--) {
    if (lines[i].startsWith('|')) { insertAt = i + 1; break; }
  }
  if (insertAt === end && !lines.slice(start + 1, end).some((l) => l.startsWith('|'))) {
    lines.splice(start + 1, 0, '', '| Field | Value |', '| --- | --- |', row);
  } else {
    lines.splice(insertAt, 0, row);
  }
  writeFileSync(hoFile, lines.join('\n'), 'utf-8');
}

/** The value of one `| Key | Value |` row, or undefined. */
export function readHandoffRow(hoFile: string, header: string, key: string): string | undefined {
  const lines = readHandoff(hoFile);
  const bounds = sectionBounds(lines, header);
  if (!bounds) return undefined;
  for (let i = bounds.start + 1; i < bounds.end; i++) {
    const m = new RegExp(`^\\|\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\|\\s*(.*?)\\s*\\|\\s*$`).exec(lines[i]);
    if (m) return m[1].trim();
  }
  return undefined;
}

/** Replace the whole section with a fresh table (the completion write). */
export function writeHandoffSection(hoFile: string, header: string, rows: [string, string][]): void {
  const lines = readHandoff(hoFile);
  const block = [header, '', '| Field | Value |', '| --- | --- |',
    ...rows.map(([k, v]) => `| ${k} | ${v.replace(/\|/g, '\\|').replace(/\s*\n+\s*/g, ' ')} |`), ''];
  const bounds = sectionBounds(lines, header);
  if (!bounds) {
    const content = lines.join('\n');
    const sep = content.length === 0 ? '' : (content.endsWith('\n') ? '\n' : '\n\n');
    writeFileSync(hoFile, content + sep + block.join('\n') + '\n', 'utf-8');
    return;
  }
  const rebuilt = [...lines.slice(0, bounds.start), ...block, ...lines.slice(bounds.end)];
  writeFileSync(hoFile, rebuilt.join('\n'), 'utf-8');
}
