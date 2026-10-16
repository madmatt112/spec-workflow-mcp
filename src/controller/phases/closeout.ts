// src/controller/phases/closeout.ts
//
// Step (c3), second half (docs/foundation-review.md §6, docs/controller-design.md
// §5 "Retrospective and close-out", docs/controller-tasks.md T14). Close-out in
// code: the approved plan's items, classed by their `Target:` line, are landed
// batch by batch (one implementer step per class) in the place each class lands
// (the spec store's current branch, a `chore/<spec>-retro` worktree of the
// harness or code repository, or in place under `~/.claude`), gated and, at high
// risk, verified; fix rounds are capped at three, then the adjudicator; each item
// gets its close-out line, each repository with commits gets its pull request,
// and the plan is marked CLOSED. The rule source is
// `harness/skills/sdd-closeout-phase/SKILL.md` and its `references/briefs.md`.
// The graph refresh is not carried (the controller passes no graph values).
import { randomUUID } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename, dirname, resolve } from 'path';
import { homedir } from 'os';
import { execFile, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { runStep, loadRole, type StepResult, type StepSpec, type RateLimitWindows } from '../step.js';
import { type RunRecord, withStoreLock } from '../state.js';
import { commitSpecStore, type RunLedger, type Serialize } from '../ledger.js';
import { harnessHandler, parsePlanItems, parseCloseoutDone, classifyTarget, type TargetClass, type PlanItem } from '../../tools/harness.js';
import { reviewTaskHandler } from '../../tools/review-task.js';
import type { GateData } from '../../tools/review-gate.js';
import { PathUtils } from '../../core/path-utils.js';
import { handoffPath } from '../../watch/index.js';
import { parseJsonl } from '../../watch/ledger.js';
import { scrubbedGitEnv } from '../../core/git-utils.js';
import { findPullRequest } from '../merge.js';
import { appendRetroEntry } from './retrospective.js';
import { setHandoffRow, writeHandoffSection } from './implementation.js';
import type { ToolContext } from '../../types.js';

/** Fix rounds per batch before the adjudicator rules (SKILL.md Step 2 item 5). */
const FIX_ROUNDS_CAP = 3;
const TURN_CAP: Record<string, number> = { 'sdd-implementer': 150, 'sdd-verifier': 100, 'sdd-adjudicator': 120 };
/** The order the classes are worked in (SKILL.md Step 0 item 2). */
const CLASS_ORDER: TargetClass[] = ['store', 'harness', 'code', 'home'];

export interface CloseoutPr { repoDir: string; branch: string; number?: number; url?: string }

export interface CloseoutPhaseContext {
  run: RunRecord;
  specStoreRoot: string;
  specDir: string;
  /** The run's worktree; close-out lands code in its own retro worktree, not here. */
  codeRoot: string;
  mainCheckout: string;
  /** The harness checkout `harness` items land in; defaults to this package's root. */
  harnessRepo?: string;
  /** Where `home` items land; defaults to `~/.claude`. */
  homeDir?: string;
  ledger: RunLedger;
  stepLogDir: string;
  mcpConfig?: string | Record<string, unknown>;
  onStepActivity?: (e: { stepId: string; role: string; tool: string; inputSummary: string; ts?: string }) => void;
  onRateLimit?: (w: RateLimitWindows) => void;
  onStepSpawn?: (s: { id: string; pid: number; startTime: number }) => Promise<void> | void;
  onStepEnd?: (id: string) => Promise<void> | void;
  serialize?: Serialize;
  now?: () => Date;
  shouldStop?: () => string | null;
  scratchDir?: string;
}

export interface CloseoutPhaseOutcome {
  result: 'closed' | 'error' | 'stopped';
  reason?: string;
  items: { total: number; done: number; todo: number; skipped: number };
  prs: CloseoutPr[];
}

// ---------------------------------------------------------------------------
// Report schemas.
// ---------------------------------------------------------------------------

const ITEM_STATUS = ['done', 'to-do', 'skipped'] as const;
const BATCH_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'status'],
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ITEM_STATUS },
          commit: { type: 'string', description: 'The commit sha for a done item, else ""' },
          reason: { type: 'string', description: 'Why, for a to-do or skipped item' },
        },
      },
    },
    files: { type: 'array', items: { type: 'string' } },
    checks: { type: 'string' },
    retro: { type: 'string' },
  },
} as const;

const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['items', 'verdict'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'status'],
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['ok', 'not done'] },
          reason: { type: 'string' },
        },
      },
    },
    verdict: { type: 'string', enum: ['pass', 'fix-required'] },
  },
} as const;

interface ItemReport { id: string; status: 'done' | 'to-do' | 'skipped'; commit?: string; reason?: string }
interface BatchReport { items?: ItemReport[]; files?: string[]; checks?: string; retro?: string }
interface VerifyItem { id: string; status: 'ok' | 'not done'; reason?: string }
interface VerifyReport { items?: VerifyItem[]; verdict?: string }

// ---------------------------------------------------------------------------
// Pure helpers.
// ---------------------------------------------------------------------------

/** The bold title of a plan item (`**P1 (F1) — Title.**`), wrapped lines joined. */
export function itemTitle(block: string): string {
  const m = block.match(/\*\*([\s\S]*?)\*\*/);
  return (m ? m[1] : block.replace(/^-\s*/, '')).replace(/\s+/g, ' ').trim();
}

/**
 * The paths an item names, relative to its landing root: backticked tokens
 * that look like a file path (a slash, an extension or a dotfile, no URL
 * scheme), with a leading `./` dropped. The gate's `files` list, once filtered
 * to the paths that exist in the landing root; an item naming none gets no gate.
 */
export function itemPaths(block: string): string[] {
  const out = new Set<string>();
  for (const m of block.matchAll(/`([^`\n]+)`/g)) {
    const t = m[1].trim();
    if (/^[a-z]+:\/\//i.test(t) || /\s/.test(t) || t.startsWith('-') || t.length > 200) continue;
    if (!(t.includes('/') || /\.[A-Za-z0-9]{1,8}$/.test(t) || /^\.[A-Za-z0-9_.-]+$/.test(t))) continue;
    if (/[*?{}|&;<>()$]/.test(t)) continue;
    out.add(t.replace(/^\.\//, '').replace(/:\d+(-\d+)?$/, ''));
  }
  return [...out];
}

/** Report lines `P1: done <sha>` | `P1: to-do — <reason>` | `P1: skipped — <reason>` from text, as a fallback. */
export function parseItemLines(text: string): ItemReport[] {
  const out: ItemReport[] = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*[-*]?\s*((?:P|G)\d+)\s*:\s*(done|to-do|todo|skipped)\b\s*(?:[—–-]\s*)?(.*)$/i);
    if (!m) continue;
    const status = m[2].toLowerCase() === 'todo' ? 'to-do' : (m[2].toLowerCase() as ItemReport['status']);
    const rest = m[3].trim();
    if (status === 'done') out.push({ id: m[1], status, commit: rest.match(/\b([0-9a-f]{7,40})\b/)?.[1] });
    else out.push({ id: m[1], status, reason: rest });
  }
  return out;
}

/** The `.spec-workflow/..` package root this module runs from (the harness checkout by default). */
function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
}

interface CommandResult { code: number | null; stdout: string; stderr: string }
function runCommand(bin: string, args: string[], cwd: string): Promise<CommandResult> {
  return new Promise((resolveCmd) => {
    execFile(bin, args, { cwd, env: bin === 'git' ? scrubbedGitEnv() : process.env, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      const e = err as NodeJS.ErrnoException | null;
      resolveCmd({ code: e && typeof e.code === 'number' ? e.code : e ? null : 0, stdout: stdout ?? '', stderr: stderr ?? '' });
    });
  });
}
function ghBin(): string {
  return process.env.CONTROLLER_GH_BIN || 'gh';
}
function tail(text: string, lines: number): string {
  return text.replace(/\s+$/, '').split('\n').slice(-lines).join('\n');
}

/** The close-out commit script every brief names (briefs.md). */
const COMMIT_SCRIPT = `#!/bin/bash
# One commit for one close-out item: stages only the named files.
set -e
ROOT="$1"; MSG="$2"; shift 2
cd "$ROOT"
/usr/bin/git add -- "$@"
if /usr/bin/git diff --cached --quiet; then echo "nothing to commit"; else
  /usr/bin/git -c core.hooksPath=/dev/null commit -q -m "$MSG" -o -- "$@"
  echo "committed: $(/usr/bin/git rev-parse --short HEAD) $MSG"
fi
`;

// ---------------------------------------------------------------------------
// The phase.
// ---------------------------------------------------------------------------

interface Landing {
  cls: TargetClass;
  root: string;
  branch: string;
  /** The repository the worktree belongs to (harness/code), for the PR. */
  repoDir?: string;
  /** How the landing is described in the brief. */
  text: string;
  commitHow: string;
  checks: string[];
}

export async function runCloseoutPhase(ctx: CloseoutPhaseContext): Promise<CloseoutPhaseOutcome> {
  const specName = ctx.run.spec;
  const phase = 'closeout';
  const workflowRoot = PathUtils.getWorkflowRoot(ctx.specStoreRoot);
  const toolContext: ToolContext = { projectPath: ctx.specStoreRoot, workspacePath: ctx.codeRoot };
  const serialize: Serialize = ctx.serialize ?? ((fn) => withStoreLock(ctx.specStoreRoot, fn));
  const now = ctx.now ?? (() => new Date());
  const scratch = ctx.scratchDir ?? join('/tmp/scratchpad/sdd', specName);
  mkdirSync(scratch, { recursive: true });
  const planPath = join(ctx.specDir, 'retrospective-plan.md');
  const retroLogPath = join(ctx.specDir, 'retrospective-log.md');
  const hoFile = handoffPath(workflowRoot);
  const harnessRepo = ctx.harnessRepo ?? process.env.CONTROLLER_HARNESS_REPO ?? packageRoot();
  const homeDir = ctx.homeDir ?? join(homedir(), '.claude');
  const prs: CloseoutPr[] = [];
  const todos: string[] = [];
  const gotchas: string[] = [];

  const git = (cwd: string, args: string[]): string | undefined => {
    try {
      return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf-8', env: scrubbedGitEnv(), stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch {
      return undefined;
    }
  };

  const ledgerRows = (): Record<string, string>[] => {
    let text: string;
    try { text = readFileSync(ctx.ledger.path, 'utf-8'); } catch { return []; }
    return parseJsonl<Record<string, string>>(text).filter((r) => r.run === ctx.run.id);
  };

  // --- the plan ---------------------------------------------------------------
  const readPlan = (): string => readFileSync(planPath, 'utf-8');
  const status = (): string | undefined => readPlan().match(/^Status:\s*([A-Za-z]+)/m)?.[1]?.toUpperCase();
  const openItems = (): (PlanItem & { cls: TargetClass; title: string })[] => {
    const text = readPlan();
    const done = parseCloseoutDone(text);
    return parsePlanItems(text).filter((it) => !done.has(it.id)).map((it) => ({ ...it, cls: classifyTarget(it.block), title: itemTitle(it.block) }));
  };
  const counts = (): CloseoutPhaseOutcome['items'] => {
    const text = readPlan();
    const total = parsePlanItems(text).length;
    const lines = (text.match(/^- (?:P|G)\d+:\s*(done|to-do|skipped)/gm) ?? []).map((l) => l.replace(/^- (?:P|G)\d+:\s*/, ''));
    return { total, done: lines.filter((l) => l === 'done').length, todo: lines.filter((l) => l === 'to-do').length, skipped: lines.filter((l) => l === 'skipped').length };
  };
  /** Append one close-out line (SKILL.md Step 4), creating the section; idempotent per item. */
  const closeoutLine = (id: string, line: string): void => {
    let text = readPlan();
    if (parseCloseoutDone(text).has(id)) return;
    if (!/^## Close-out\s*$/m.test(text)) {
      text = text.replace(/\s*$/, '') + '\n\n## Close-out\n\nOne line per proposal, written by the close-out phase.\n';
    }
    writeFileSync(planPath, text.replace(/\s*$/, '') + `\n- ${id}: ${line}\n`, 'utf-8');
    ctx.ledger.taskDone({ task: id, outcome: line.split(/\s/)[0] as string });
  };
  const repoLine = (line: string): void => {
    const text = readPlan();
    if (text.includes(line)) return;
    writeFileSync(planPath, text.replace(/\s*$/, '') + `\n${line}\n`, 'utf-8');
  };

  const commitStore = (message: string): Promise<string | undefined> =>
    commitSpecStore({ specStoreRoot: ctx.specStoreRoot, spec: specName, message }, serialize);
  const retro = (ref: string, category: string, body: string, evidence: string, cost: string): void =>
    appendRetroEntry(retroLogPath, ctx.run.id, now(), phase, ref, category, body, evidence, cost);

  const fail = async (reason: string): Promise<CloseoutPhaseOutcome> => {
    const c = counts();
    setHandoffRow(hoFile, `## ${specName} — closeout`, 'State', `items ${c.done + c.todo + c.skipped}/${c.total}, stopped: ${reason}`);
    ctx.ledger.phaseEnd(phase, { result: 'error', state: `items ${c.done + c.todo + c.skipped}/${c.total}`, note: reason });
    await harnessHandler({ action: 'phase-log', specName }, toolContext);
    await commitStore(`docs(sdd): ${specName} closeout error`);
    return { result: 'error', reason, items: c, prs };
  };

  // --- a model step -------------------------------------------------------------
  const runModelStep = async (opts: { role: string; label: string; briefPath: string; stepId: string; schema: Record<string, unknown>; cwd: string; task?: string; round?: string }):
    Promise<{ result: StepResult; error?: CloseoutPhaseOutcome }> => {
    const profile = loadRole(opts.role);
    ctx.ledger.spawnStart({ agent: opts.role, role: opts.label, model: profile.model, effort: profile.effort });
    let spawnWrite: Promise<void> | void = undefined;
    const spec: StepSpec = {
      role: opts.role, briefPath: opts.briefPath, worktree: opts.cwd,
      logPath: join(ctx.stepLogDir, `${opts.stepId}.jsonl`), maxTurns: TURN_CAP[opts.role] ?? 100,
      sessionId: randomUUID(), mcpConfig: ctx.mcpConfig, schema: opts.schema,
      runId: ctx.run.id, stepId: opts.stepId, workspace: opts.cwd, sharedRoot: ctx.specStoreRoot,
      onActivity: (a) => ctx.onStepActivity?.({ stepId: opts.stepId, role: opts.role, tool: a.tool, inputSummary: a.inputSummary, ts: a.ts }),
      onRateLimit: ctx.onRateLimit,
      onSpawn: (pid, startTime) => { spawnWrite = ctx.onStepSpawn?.({ id: opts.stepId, pid, startTime }); },
    };
    const result = await runStep(spec);
    await spawnWrite;
    await ctx.onStepEnd?.(opts.stepId);
    ctx.ledger.spawnEnd({ agent: opts.role, model: profile.model, usage: result.usage });
    ctx.ledger.spawnUsage({ agent: opts.role, role: opts.label, result: result.classification === 'ok' ? 'ok' : result.classification, phase, task: opts.task, round: opts.round });
    if (result.classification !== 'ok') return { result, error: { result: 'error', reason: result.classification, items: counts(), prs } };
    return { result };
  };

  const brief = async (template: string, path: string, values: Record<string, string>): Promise<string> => {
    const res = await harnessHandler({ action: 'brief', template, specName, values: { ...values, path } }, toolContext);
    if (!res.success) throw new Error(`brief ${template} failed: ${res.message}`);
    return (res.data as { path: string }).path;
  };

  // =========================================================================
  // Step 0 — orient, phase.start, the standing brief and the commit script.
  // =========================================================================
  if (!existsSync(planPath)) return { result: 'error', reason: 'no retrospective-plan.md', items: { total: 0, done: 0, todo: 0, skipped: 0 }, prs };
  const st = status();
  if (st !== 'APPROVED' && st !== 'CLOSED') return { result: 'error', reason: `plan status is ${st ?? 'missing'}, not APPROVED`, items: counts(), prs };

  const phaseRows = ledgerRows().filter((r) => r.phase === phase && (r.type === 'phase.start' || r.type === 'phase.end'));
  const last = phaseRows[phaseRows.length - 1];
  if (last && last.type === 'phase.end' && last.result === 'closed' && st === 'CLOSED') {
    return { result: 'closed', items: counts(), prs: ctx.run.closeoutPrs ?? [] };
  }
  if (!last || last.type === 'phase.end') {
    const c = counts();
    ctx.ledger.phaseStart(phase, { mode: 'normal', state: `items ${c.done + c.todo + c.skipped}/${c.total}` });
  }
  const commitScript = join(scratch, 'closeout-commit.sh');
  writeFileSync(commitScript, COMMIT_SCRIPT, { mode: 0o755 });
  let standing: string;
  try {
    standing = await brief('closeout-standing', join(scratch, 'closeout-standing.md'), { commitScript });
  } catch (err) {
    return fail((err as Error).message);
  }

  // =========================================================================
  // Step 1 — items with nothing to land (class `none`).
  // =========================================================================
  for (const it of openItems().filter((i) => i.cls === 'none')) {
    ctx.ledger.taskPick({ task: it.id, title: it.title });
    const decision = it.block.match(/Decision:\s*([^\n]*)/i)?.[1]?.trim().replace(/\.$/, '');
    // A human action is one the Target or Decision line names, not one the body
    // mentions: a "no change" item that argues about what the human might want is
    // skipped, not handed back as a to-do (shout close-out, P8).
    const target = it.block.match(/Target:\s*([^\n]*)/i)?.[1] ?? '';
    const human = /\bhuman\b|\boperator\b|matthew/i.test(`${target} ${decision ?? ''}`);
    const line = human
      ? `to-do (human) — ${decision ?? 'a human action'}`
      : `skipped — ${decision ?? 'no change chosen'}`;
    closeoutLine(it.id, line);
    if (human) todos.push(`${it.id}: ${decision ?? it.title}`);
  }

  // =========================================================================
  // Step 2 — one batch per landing class, in order.
  // =========================================================================
  let batchNo = 0;
  for (const cls of CLASS_ORDER) {
    const items = openItems().filter((i) => i.cls === cls);
    if (items.length === 0) continue;
    const halt = ctx.shouldStop?.();
    if (halt) return { result: 'stopped', reason: halt, items: counts(), prs };
    batchNo += 1;

    // 1. Landing.
    let landing: Landing;
    try {
      landing = await prepareLanding(cls);
    } catch (err) {
      // No place to land (no harness checkout, a worktree that cannot be made): every item is a to-do.
      for (const it of items) {
        ctx.ledger.taskPick({ task: it.id, title: it.title });
        closeoutLine(it.id, `to-do (human) — ${(err as Error).message}`);
        todos.push(`${it.id}: ${(err as Error).message}`);
      }
      continue;
    }

    // 2. Brief and 3. implement.
    for (const it of items) ctx.ledger.taskPick({ task: it.id, title: it.title });
    const itemsText = items.map((it) => `### ${it.id} — ${it.title}\n${it.block}`).join('\n\n');
    let briefPath: string;
    try {
      briefPath = await brief('closeout-batch', join(scratch, `closeout-brief-${cls}-${batchNo}.md`), {
        cls, batch: String(batchNo), standing, root: landing.root, landing: landing.text, commitHow: landing.commitHow,
        checks: landing.checks.length > 0 ? landing.checks.map((c) => `\`${c}\``).join(', ') : 'none', items: itemsText,
      });
    } catch (err) {
      return fail((err as Error).message);
    }
    const batchStart = git(landing.root, ['rev-parse', 'HEAD']) ?? '';
    const step = await runModelStep({
      role: 'sdd-implementer', label: `implement ${cls} batch ${batchNo}`, briefPath,
      stepId: `implementer-${cls}-${batchNo}`, schema: BATCH_SCHEMA, cwd: landing.root,
    });
    if (step.error) return step.error.reason === 'usage-limit' ? step.error : fail(step.error.reason ?? 'implementer step failed');
    let reports = readItemReports(step.result, items.map((i) => i.id));
    const retroFlag = ((step.result.structuredOutput ?? {}) as BatchReport).retro;
    if (retroFlag && !/^\s*(none|n\/a)?\s*$/i.test(retroFlag)) retro(`${cls} batch ${batchNo}`, 'gotcha', retroFlag, `batch ${batchNo}`, 'implementer');

    // 3b-5. Gate, verify and fix rounds for the done items.
    const state = new Map<string, { report: ItemReport; gate?: GateData; ok: boolean; findings?: string }>();
    for (const it of items) state.set(it.id, { report: reports.find((r) => r.id === it.id) ?? { id: it.id, status: 'to-do', reason: 'no report line' }, ok: false });
    const resolveCommit = (id: string, sha?: string): string | undefined => {
      if (sha && /^[0-9a-f]{7,40}$/i.test(sha) && git(landing.root, ['cat-file', '-e', `${sha}^{commit}`]) !== undefined) return git(landing.root, ['rev-parse', sha]);
      const found = git(landing.root, ['log', '-1', '--format=%H', `--grep=${specName} ${id}\\b`, `${batchStart ? `${batchStart}..` : ''}HEAD`]);
      return found || undefined;
    };
    const gateItem = async (id: string, round: number): Promise<void> => {
      const s = state.get(id)!;
      const it = items.find((i) => i.id === id)!;
      const named = itemPaths(it.block);
      if (cls === 'home') {
        const files = named;
        // In place, no commit: a files-only gate when paths are named, else ok as it stands.
        if (files.length === 0) { s.ok = true; return; }
        const res = await reviewTaskHandler({ action: 'gate', specName, taskId: id, root: landing.root, files, checks: [] }, toolContext);
        if (!res.success) { s.ok = true; ctx.ledger.note(`gate: item ${id} skipped (${res.message})`); return; }
        const g = res.data as GateData;
        s.gate = g; s.ok = g.gate === 'pass';
        if (!s.ok) s.findings = g.reasons.join('; ');
        ctx.ledger.note(`gate: item ${id} ${g.gate} risk ${g.risk}${round > 0 ? ` round ${round}` : ''}`);
        return;
      }
      const commit = resolveCommit(id, s.report.commit);
      if (!commit) {
        s.ok = false; s.findings = 'reported done but no commit for the item was found on the branch';
        ctx.ledger.note(`gate: item ${id} fail (no commit)`);
        return;
      }
      s.report.commit = commit;
      // The gate's file list is the paths the item names that exist in the landing
      // root. A Target that names a functional area, or a token that only looks like
      // a path (`feat/shout`), yields none: then the commit's own files are the list,
      // so the checks still run and the touched-paths rule cannot misfire on a
      // correct change (shout close-out, P9).
      let files = named.filter((p) => existsSync(join(landing.root, p)));
      if (files.length === 0) {
        files = (git(landing.root, ['show', '--name-only', '--format=', commit]) ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
        if (files.length > 0) ctx.ledger.note(`gate: item ${id} files taken from the commit (no named path exists in the root)`);
      }
      if (files.length === 0) { s.ok = true; ctx.ledger.note(`gate: item ${id} ok (no path named)`); return; }
      const res = await reviewTaskHandler({ action: 'gate', specName, taskId: id, root: landing.root, commit, files, checks: landing.checks }, toolContext);
      if (!res.success) { s.ok = false; s.findings = `gate error: ${res.message}`; ctx.ledger.note(`gate: item ${id} error`); return; }
      const g = res.data as GateData;
      s.gate = g;
      s.ok = g.gate === 'pass';
      if (!s.ok) s.findings = [...g.reasons, ...g.checks.filter((c) => c.status !== 'pass').map((c) => `${c.command}: ${c.output}`)].join('; ');
      ctx.ledger.note(`gate: item ${id} ${g.gate} risk ${g.risk}${round > 0 ? ` round ${round}` : ''}`);
    };
    const needsVerifier = (id: string): boolean => {
      const s = state.get(id)!;
      return (cls === 'harness' || cls === 'code') && s.ok && s.gate?.risk === 'high';
    };
    const verify = async (ids: string[], round: number, narrow = false): Promise<CloseoutPhaseOutcome | undefined> => {
      if (ids.length === 0) return undefined;
      const text = ids.map((id) => {
        const it = items.find((i) => i.id === id)!;
        const s = state.get(id)!;
        return `### ${id} — ${it.title} · implementer: ${s.report.status}${s.report.commit ? ` ${s.report.commit.slice(0, 7)}` : ''}\n${it.block}\n\n#### Gate results (verbatim)\n\`\`\`json\n${JSON.stringify(s.gate ? { reasons: s.gate.reasons, checks: s.gate.checks, stats: s.gate.stats, touched: s.gate.touched, typecheck: s.gate.typecheck } : null)}\n\`\`\``;
      }).join('\n\n');
      let vb: string;
      try {
        vb = await brief('closeout-verify', join(scratch, `closeout-verify-${cls}-${batchNo}-r${round}${narrow ? '-narrow' : ''}.md`), {
          cls, batch: String(batchNo), round: String(round), root: landing.root, branch: landing.branch, items: text,
        });
      } catch (err) {
        return fail((err as Error).message);
      }
      const v = await runModelStep({
        role: 'sdd-verifier', label: `verify ${cls} batch ${batchNo}${round > 0 ? ` round ${round}` : ''}${narrow ? ' narrow' : ''}`,
        briefPath: vb, stepId: `verifier-${cls}-${batchNo}-r${round}${narrow ? '-narrow' : ''}`, schema: VERIFY_SCHEMA, cwd: landing.root, round: round > 0 ? String(round) : undefined,
      });
      if (v.error) return v.error.reason === 'usage-limit' ? v.error : fail(v.error.reason ?? 'verifier step failed');
      const vr = (v.result.structuredOutput ?? {}) as VerifyReport;
      for (const id of ids) {
        const line = (vr.items ?? []).find((x) => x.id === id);
        const s = state.get(id)!;
        if (line && line.status === 'not done') { s.ok = false; s.findings = `verifier: ${line.reason ?? 'not done'}`; }
      }
      return undefined;
    };

    for (const it of items) {
      const s = state.get(it.id)!;
      if (s.report.status === 'done') await gateItem(it.id, 0);
    }
    let v = await verify(items.map((i) => i.id).filter(needsVerifier), 0);
    if (v) return v;

    let round = 0;
    for (;;) {
      const failing = items.filter((i) => state.get(i.id)!.report.status === 'done' && !state.get(i.id)!.ok);
      if (failing.length === 0) break;
      round += 1;
      const findingsText = failing.map((it) => `### ${it.id} — ${it.title} · ${state.get(it.id)!.findings ?? 'not done'}\n${it.block}`).join('\n\n');
      if (round > FIX_ROUNDS_CAP) {
        let ab: string;
        try {
          ab = await brief('closeout-adjudication', join(scratch, `closeout-adjudication-${cls}-${batchNo}.md`), {
            cls, batch: String(batchNo), standing, root: landing.root, branch: landing.branch,
            checks: landing.checks.length > 0 ? landing.checks.map((c) => `\`${c}\``).join(', ') : 'none', items: findingsText,
          });
        } catch (err) {
          return fail((err as Error).message);
        }
        const adj = await runModelStep({ role: 'sdd-adjudicator', label: `adjudicate ${cls} batch ${batchNo}`, briefPath: ab, stepId: `adjudicator-${cls}-${batchNo}`, schema: BATCH_SCHEMA, cwd: landing.root });
        if (adj.error) return adj.error.reason === 'usage-limit' ? adj.error : fail(adj.error.reason ?? 'adjudicator step failed');
        const ruled = readItemReports(adj.result, failing.map((i) => i.id));
        for (const it of failing) {
          const r = ruled.find((x) => x.id === it.id);
          const s = state.get(it.id)!;
          if (r && r.status === 'done') { s.report = r; await gateItem(it.id, round); if (!s.ok) { s.report = { id: it.id, status: 'skipped', reason: s.findings ?? 'not landed after adjudication' }; } }
          else s.report = r ?? { id: it.id, status: 'skipped', reason: 'adjudicated: not landed' };
        }
        v = await verify(failing.map((i) => i.id).filter((id) => state.get(id)!.report.status === 'done' && needsVerifier(id)), round, true);
        if (v) return v;
        for (const it of failing) {
          const s = state.get(it.id)!;
          if (s.report.status === 'done' && !s.ok) s.report = { id: it.id, status: 'skipped', reason: s.findings ?? 'not verified after adjudication' };
        }
        retro(`${cls} batch ${batchNo}`, 'ruling', `adjudicated after ${FIX_ROUNDS_CAP} fix rounds: ${failing.map((i) => i.id).join(', ')}`, `batch ${batchNo}`, `${round} rounds`);
        break;
      }
      let fb: string;
      try {
        fb = await brief('closeout-fix', join(scratch, `closeout-fix-${cls}-${batchNo}-r${round}.md`), {
          cls, batch: String(batchNo), round: String(round), standing, root: landing.root, branch: landing.branch,
          checks: landing.checks.length > 0 ? landing.checks.map((c) => `\`${c}\``).join(', ') : 'none', items: findingsText,
        });
      } catch (err) {
        return fail((err as Error).message);
      }
      const fix = await runModelStep({ role: 'sdd-implementer', label: `fix ${cls} batch ${batchNo} round ${round}`, briefPath: fb, stepId: `implementer-${cls}-${batchNo}-fix-${round}`, schema: BATCH_SCHEMA, cwd: landing.root, round: String(round) });
      if (fix.error) return fix.error.reason === 'usage-limit' ? fix.error : fail(fix.error.reason ?? 'fix step failed');
      const fixed = readItemReports(fix.result, failing.map((i) => i.id));
      for (const it of failing) {
        const r = fixed.find((x) => x.id === it.id);
        const s = state.get(it.id)!;
        if (r && r.status !== 'done') { s.report = r; continue; }
        if (r?.commit) s.report.commit = r.commit;
        await gateItem(it.id, round);
      }
      v = await verify(failing.map((i) => i.id).filter(needsVerifier), round);
      if (v) return v;
    }

    // 5b. Revert the commits of items that did not land, so the branch matches
    // the plan: an item that committed but ends to-do or skipped (gate failed,
    // fix reported to-do, adjudicator did not land it, verifier said not done)
    // would otherwise ship its commit in the close-out PR. `home` makes no
    // commit. A commit a landed item also carries, or one whose revert
    // conflicts, is left on the branch and its item's line says so. Newest first,
    // never rewriting history.
    const leftOnBranch = new Map<string, string>();
    if (cls !== 'home') {
      const range = batchStart ? `${batchStart}..HEAD` : 'HEAD';
      const order = (git(landing.root, ['log', '--format=%H', range]) ?? '').split('\n').filter(Boolean); // newest first
      const commitsOf = (id: string, sha?: string): string[] => {
        const want = new Set<string>();
        if (sha && /^[0-9a-f]{7,40}$/i.test(sha)) {
          const full = git(landing.root, ['rev-parse', '-q', '--verify', `${sha}^{commit}`]);
          if (full) want.add(full);
        }
        for (const h of (git(landing.root, ['log', '--format=%H', `--grep=${specName} ${id}\\b`, range]) ?? '').split('\n').filter(Boolean)) want.add(h);
        return order.filter((h) => want.has(h));
      };
      const landed = (id: string): boolean => { const s = state.get(id)!; return s.report.status === 'done' && s.ok; };
      const keptByDone = new Set<string>();
      for (const it of items) if (landed(it.id)) for (const h of commitsOf(it.id, state.get(it.id)!.report.commit)) keptByDone.add(h);
      const toRevert: { id: string; sha: string }[] = [];
      for (const it of items) {
        if (landed(it.id)) continue;
        for (const sha of commitsOf(it.id, state.get(it.id)!.report.commit)) {
          if (keptByDone.has(sha)) {
            leftOnBranch.set(it.id, `${leftOnBranch.get(it.id) ?? ''} (commit ${sha.slice(0, 7)} left on the branch: shared with a landed item)`);
            ctx.ledger.note(`closeout: item ${it.id} not landed, commit ${sha.slice(0, 7)} left on the branch (shared with a landed item)`);
          } else {
            toRevert.push({ id: it.id, sha });
          }
        }
      }
      toRevert.sort((a, b) => order.indexOf(a.sha) - order.indexOf(b.sha)); // newest first
      for (const { id, sha } of toRevert) {
        const short = sha.slice(0, 7);
        const res = await runCommand('git', ['revert', '--no-edit', sha], landing.root);
        if (res.code === 0) {
          ctx.ledger.note(`closeout: item ${id} not landed, reverted ${short}`);
        } else {
          await runCommand('git', ['revert', '--abort'], landing.root);
          leftOnBranch.set(id, `${leftOnBranch.get(id) ?? ''} (commit ${short} left on the branch: revert failed)`);
          ctx.ledger.note(`closeout: item ${id} not landed, revert of ${short} failed, left on the branch`);
        }
      }
    }

    // 6. Close-out lines, retro entries.
    let done = 0;
    for (const it of items) {
      const s = state.get(it.id)!;
      if (s.report.status === 'done' && s.ok) { closeoutLine(it.id, `done — ${s.report.commit ?? 'in place'}`); done += 1; }
      else if (s.report.status === 'to-do') { closeoutLine(it.id, `to-do (human) — ${s.report.reason ?? 'not landed'}${leftOnBranch.get(it.id) ?? ''}`); todos.push(`${it.id}: ${s.report.reason ?? it.title}`); }
      else { closeoutLine(it.id, `skipped — ${s.report.reason ?? s.findings ?? 'not landed'}${leftOnBranch.get(it.id) ?? ''}`); retro(`${cls} batch ${batchNo}`, 'deviation', `${it.id} skipped: ${s.report.reason ?? s.findings ?? 'not landed'}`, it.id, 'unknown'); }
    }
    retro(`${cls} batch ${batchNo}`, 'cleanup', `${cls} batch ${batchNo}: ${done} done of ${items.length}, ${round} fix round(s)`, `batch ${batchNo}`, `${1 + round} implementer spawn(s)`);

    // 7. The PR for a harness/code repository with commits on the retro branch.
    if (landing.repoDir && (cls === 'harness' || cls === 'code')) {
      const pr = await openRetroPr(landing, items.filter((i) => state.get(i.id)!.report.status === 'done' && state.get(i.id)!.ok).map((i) => `${i.id} ${i.title}`));
      if (pr) {
        const existing = prs.find((p) => p.repoDir === pr.repoDir);
        if (!existing) prs.push(pr);
        repoLine(pr.number ? `- ${basename(pr.repoDir)}: PR ${pr.url ?? `#${pr.number}`}` : `- ${basename(pr.repoDir)}: branch ${pr.branch} (no remote)`);
      }
    }

    // 8. Checkpoint.
    await commitStore(`docs(sdd): ${specName} closeout ${cls} batch ${batchNo}`);
  }

  // =========================================================================
  // Step 3 — close.
  // =========================================================================
  const left = openItems();
  if (left.length > 0) return fail(`${left.length} item(s) still open: ${left.map((i) => i.id).join(', ')}`);
  const text = readPlan().replace(/^Status:\s*APPROVED[^\n]*$/m, 'Status: CLOSED');
  writeFileSync(planPath, text, 'utf-8');
  const c = counts();
  writeHandoffSection(hoFile, `## ${specName} — closeout`, [
    ['State', `items ${c.done + c.todo + c.skipped}/${c.total}: ${c.done} done, ${c.todo} to-do, ${c.skipped} skipped`],
    ['PRs', prs.length > 0 ? prs.map((p) => p.url ?? `${basename(p.repoDir)} branch ${p.branch}`).join('; ') : 'none'],
    ['To-dos', todos.join('; ') || 'none'],
    ['Gotchas', gotchas.join('; ') || 'none'],
  ]);
  retro('phase', 'cleanup', `close-out: ${c.done} done, ${c.todo} to-do, ${c.skipped} skipped of ${c.total}; ${ledgerRows().filter((r) => r.type === 'spawn.start' && r.ts >= (phaseRows[phaseRows.length - 1]?.ts ?? '')).length} spawns`, 'retrospective-plan.md', 'see the ledger');
  ctx.ledger.phaseEnd(phase, { result: 'closed', state: `items ${c.total}/${c.total}`, note: `${c.done} done, ${c.todo} to-do, ${c.skipped} skipped` });
  await harnessHandler({ action: 'phase-log', specName }, toolContext);
  await commitStore(`docs(sdd): ${specName} closed`);
  return { result: 'closed', items: c, prs };

  // -------------------------------------------------------------------------
  // Helpers that close over the context.
  // -------------------------------------------------------------------------

  /** Where a class lands (SKILL.md Step 2 item 1): the store, a retro worktree, or the home. */
  async function prepareLanding(cls: TargetClass): Promise<Landing> {
    if (cls === 'store') {
      const branch = git(ctx.specStoreRoot, ['rev-parse', '--abbrev-ref', 'HEAD']) ?? 'main';
      return {
        cls, root: ctx.specStoreRoot, branch,
        text: `the current branch \`${branch}\` of the spec store repository; only files under \`${workflowRoot}\` and the paths \`agent-rules.md\` allows for direct commits may change; an item that needs another file is a to-do`,
        commitHow: `one commit per item with \`bash ${join(scratch, 'closeout-commit.sh')} "${ctx.specStoreRoot}" "<message>" <files>\``,
        checks: [],
      };
    }
    if (cls === 'home') {
      return { cls, root: homeDir, branch: 'n/a', text: `in place under \`${homeDir}\`; never \`settings.json\` or \`settings.local.json\` (an item that needs them is a to-do)`, commitHow: 'none (home)', checks: [] };
    }
    const repo = cls === 'harness' ? harnessRepo : ctx.mainCheckout;
    if (!repo || !existsSync(join(repo, '.git')) && !existsSync(repo)) throw new Error(`the ${cls} checkout is not on this machine`);
    const wt = await ensureRetroWorktree(repo, specName);
    const checks: string[] = [];
    return {
      cls, root: wt.path, branch: wt.branch, repoDir: repo,
      text: `a worktree of \`${repo}\` on branch \`${wt.branch}\``,
      commitHow: `one commit per item with \`bash ${join(scratch, 'closeout-commit.sh')} "${wt.path}" "<message>" <files>\`; never push`,
      checks,
    };
  }

  /** The `chore/<spec>-retro` worktree of a repository, reused when present (briefs.md worktree script). */
  async function ensureRetroWorktree(repo: string, spec: string): Promise<{ path: string; branch: string }> {
    const branch = `chore/${spec}-retro`;
    const path = join(repo, '.claude', 'worktrees', `${spec}-retro`);
    if (existsSync(path)) return { path, branch };
    if ((git(repo, ['remote']) ?? '').trim()) await runCommand('git', ['fetch', '-q', 'origin'], repo);
    const defRef = git(repo, ['symbolic-ref', '-q', '--short', 'refs/remotes/origin/HEAD']);
    const def = defRef ? defRef.replace(/^origin\//, '') : (git(repo, ['symbolic-ref', '-q', '--short', 'HEAD']) ?? 'main');
    let base = `origin/${def}`;
    if (git(repo, ['rev-parse', '-q', '--verify', base]) === undefined) base = def;
    mkdirSync(dirname(path), { recursive: true });
    const exists = git(repo, ['rev-parse', '-q', '--verify', branch]) !== undefined;
    const add = exists
      ? await runCommand('git', ['worktree', 'add', path, branch], repo)
      : await runCommand('git', ['worktree', 'add', '-b', branch, path, base], repo);
    if (add.code !== 0) throw new Error(`could not add the retro worktree of ${repo}: ${tail(add.stderr || add.stdout, 3)}`);
    if (existsSync(join(path, 'package.json')) && !existsSync(join(path, 'node_modules'))) {
      const ci = await runCommand('npm', ['ci', '--no-audit', '--no-fund'], path);
      if (ci.code !== 0) gotchas.push(`npm ci failed in ${path}: ${tail(ci.stderr || ci.stdout, 1)}`);
    }
    return { path, branch };
  }

  /** Push the retro branch and open (or reuse) its PR (SKILL.md Step 2 item 7); no remote ⇒ the branch line. */
  async function openRetroPr(landing: Landing, landed: string[]): Promise<CloseoutPr | undefined> {
    const repo = landing.repoDir!;
    const base = git(landing.root, ['rev-parse', '-q', '--verify', 'origin/HEAD']) ?? git(repo, ['rev-parse', 'HEAD']) ?? '';
    const ahead = git(landing.root, ['log', '--format=%H', `${base}..HEAD`]) ?? '';
    if (!ahead.trim()) return undefined; // nothing landed on the branch
    const remotes = (git(repo, ['remote']) ?? '').trim();
    if (!remotes) return { repoDir: repo, branch: landing.branch };
    const push = await runCommand('git', ['push', '-u', 'origin', landing.branch], landing.root);
    if (push.code !== 0) {
      gotchas.push(`push of ${landing.branch} in ${basename(repo)} failed: ${tail(push.stderr || push.stdout, 1)}`);
      return { repoDir: repo, branch: landing.branch };
    }
    const existing = await findPullRequest({ repoDir: landing.root, branch: landing.branch });
    if (existing) return { repoDir: repo, branch: landing.branch, number: existing.number, url: existing.url };
    const bodyPath = join(scratch, `pr-body-${basename(repo)}.md`);
    // A branch can carry commits while no item closed as done (the gate or the
    // verifier turned them back): the body then lists the commits, not nothing.
    const summary = landed.length > 0
      ? landed.map((l) => `- ${l}`)
      : ['No item closed as done; the branch carries these commits:', ...(git(landing.root, ['log', '--format=%s', `${base}..HEAD`]) ?? '').split('\n').filter(Boolean).map((s) => `- ${s}`)];
    writeFileSync(bodyPath, ['## Summary', ...summary, '', '## Test plan', `- [x] The review gate per item${landing.checks.length ? ` and ${landing.checks.map((c) => `\`${c}\``).join(', ')}` : ''}`, ''].join('\n'), 'utf-8');
    const created = await runCommand(ghBin(), ['pr', 'create', '--head', landing.branch, '--title', `chore(retro): ${specName} retrospective follow-ups`, '--body-file', bodyPath], landing.root);
    if (created.code !== 0) {
      gotchas.push(`PR not opened for ${basename(repo)}: ${tail(created.stderr || created.stdout, 1)}; run: gh pr create --head ${landing.branch} --body-file ${bodyPath}`);
      return { repoDir: repo, branch: landing.branch };
    }
    const number = Number(created.stdout.match(/\/pull\/(\d+)/)?.[1]) || undefined;
    return { repoDir: repo, branch: landing.branch, number, url: created.stdout.trim().split('\n').pop() };
  }
}

/** The item lines of an implementer or adjudicator report: the schema's `items`, else the text lines. */
function readItemReports(result: StepResult, ids: string[]): ItemReport[] {
  const structured = (result.structuredOutput ?? {}) as BatchReport;
  const fromSchema = (structured.items ?? []).filter((i) => i && typeof i.id === 'string' && ITEM_STATUS.includes(i.status));
  const fromText = parseItemLines(result.resultText ?? '');
  const out: ItemReport[] = [];
  for (const id of ids) {
    const r = fromSchema.find((i) => i.id === id) ?? fromText.find((i) => i.id === id);
    if (r) out.push({ id, status: r.status, commit: r.commit && r.commit !== 'none' ? r.commit : undefined, reason: r.reason });
  }
  return out;
}
