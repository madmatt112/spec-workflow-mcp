// src/advisor/actions.ts
//
// Staged-action store and store-side executors (design.md C8; requirements.md
// Requirement 6). Every shared-state change the advisor proposes is staged
// first and only runs when the operator confirms it (AC 2, AC 3): `stageAction`
// writes a `StagedAction` record in `advisor/actions/`, `confirmAction` runs
// its executor exactly once and logs one `advisor.action` event, `dismissAction`
// marks it dismissed so a later confirm is refused.
//
// `merge` answers an open merge wait of a run with this pr, else applies
// `mergeByRule` with the project's rules forced to `auto` (design D6/D7, C8).
// `deploy` spawns `scripts/sdd-self-update.sh` detached from the checkout
// root. `launch` calls the real `launchSpec` (`src/dashboard/multi-server.ts`)
// through `deps.launchSpec`, so the admission guards it moved out of stay in
// one place.
import { promises as fs, openSync, closeSync } from 'fs';
import { spawn } from 'child_process';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';
import { EventEmitter } from 'events';
import { fileURLToPath } from 'url';
import { advisorActionsDir, appendEvent } from './home.js';
import {
  controllerHome, listRuns, listWaits, readWait, withStoreLock, writeJsonAtomic, type WaitQuestion,
} from '../controller/state.js';
import { answerWait, type ControllerWaitRecord } from '../controller/waits.js';
import { DeferralStorage } from '../core/deferral-storage.js';
import { checkpoint, openRunLedger } from '../controller/ledger.js';
import { mergeByRule, readMergeRules, type MergeTarget } from '../controller/merge.js';
import type { DeferralOwner } from '../types.js';

export type ActionKind = 'merge' | 'deploy' | 'launch' | 'answer' | 'deferral' | 'decomposition' | 'backlog';
export type ActionState = 'staged' | 'running' | 'done' | 'refused' | 'failed' | 'dismissed';

/** `advisor/actions/<id>.json`: one shared-state change the advisor proposed (C8). */
export interface StagedAction {
  v: 1;
  id: string;
  kind: ActionKind;
  target: Record<string, unknown>;
  params: Record<string, unknown>;
  reason: string;
  conversation: string;
  /** ISO. */
  created: string;
  state: ActionState;
  /** ISO, set when the operator confirms or dismisses. */
  decided?: string;
  outcome?: { status: string; detail: string[] };
}

/** Emits `change` with the changed `StagedAction` after every write, so the hub re-arms on it (C8). */
export const actionEvents = new EventEmitter();

export interface StageActionInput {
  kind: ActionKind;
  target: Record<string, unknown>;
  params: Record<string, unknown>;
  reason: string;
  conversation: string;
}

/** What `launchSpec` (`src/dashboard/multi-server.ts`) reports back to the launch executor. */
export type LaunchSpecResult = { ok: true; runId: string } | { ok: false; error: string };

/** What the server passes a confirm so an executor can resolve a project id to its repo path. */
export interface ActionDeps {
  projectPath(projectId: string): string;
  /** The real `launchSpec`, so a confirmed launch goes through its admission guards (AC 9). */
  launchSpec?(projectId: string, input: Record<string, unknown>): Promise<LaunchSpecResult>;
}

export type ConfirmResult = { ok: true } | { ok: false; error: string };

function actionPath(id: string): string {
  return join(advisorActionsDir(), `${id}.json`);
}

async function readAction(id: string): Promise<StagedAction | undefined> {
  try {
    return JSON.parse(await fs.readFile(actionPath(id), 'utf-8')) as StagedAction;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function writeAction(action: StagedAction): Promise<void> {
  await writeJsonAtomic(actionPath(action.id), action);
  actionEvents.emit('change', action);
}

/** Stage a shared-state change for the operator to confirm or dismiss (AC 2). */
export async function stageAction(input: StageActionInput): Promise<StagedAction> {
  const action: StagedAction = {
    v: 1,
    id: `a-${randomBytes(4).toString('hex')}`,
    kind: input.kind,
    target: input.target,
    params: input.params,
    reason: input.reason,
    conversation: input.conversation,
    created: new Date().toISOString(),
    state: 'staged',
  };
  await writeAction(action);
  return action;
}

/** Every staged action, for the dashboard to list (AC 2). */
export async function listActions(): Promise<StagedAction[]> {
  let files: string[];
  try {
    files = await fs.readdir(advisorActionsDir());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const out: StagedAction[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const action = await readAction(file.slice(0, -'.json'.length));
    if (action) out.push(action);
  }
  return out;
}

/** Mark a staged action dismissed: it never runs (AC 3). */
export async function dismissAction(id: string): Promise<StagedAction | undefined> {
  const action = await readAction(id);
  if (!action) return undefined;
  action.state = 'dismissed';
  action.decided = new Date().toISOString();
  await writeAction(action);
  return action;
}

/**
 * The answer route's unknown-question guard (moved here from
 * `src/dashboard/multi-server.ts` so the advisor's own `answer` executor
 * applies the same rule before it calls `answerWait`): an answer under a key
 * the wait never asked is refused, unless the wait asks nothing at all.
 */
export function checkAnswerKeys(
  wait: { questions?: WaitQuestion[]; proposals?: string[] } | undefined,
  answers: Record<string, string>,
): { unknown: string[]; expected: string[] } | null {
  const asked = new Set((wait?.questions ?? []).map((q) => q.id));
  (wait?.proposals ?? []).forEach((_, i) => asked.add(`proposal:${i}`));
  const unknown = asked.size > 0 ? Object.keys(answers ?? {}).filter((k) => !asked.has(k)) : [];
  if (unknown.length === 0) return null;
  return { unknown, expected: [...asked] };
}

interface ExecResult {
  ok: boolean;
  outcome: string;
  detail?: string;
  error?: string;
  /** Overrides the stored action's landing state when it is not plain `done`/`failed` (e.g. `refused`). */
  state?: ActionState;
}

/** The package root this module runs from (`src/advisor/actions.ts` -> repo root), the same pattern `closeout.ts`'s `packageRoot` uses for `CONTROLLER_HARNESS_REPO`. */
function packageRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

type Executor = (action: StagedAction, deps: ActionDeps) => Promise<ExecResult>;

/** `answer`: checkAnswerKeys, then answerWait with `by: 'advisor'` (AC 8). */
async function execAnswer(action: StagedAction): Promise<ExecResult> {
  const waitId = (action.target as { wait?: string }).wait ?? '';
  const answers = (action.params as { answers?: Record<string, string> }).answers ?? {};
  const wait = (await readWait(waitId)) as ControllerWaitRecord | undefined;
  const check = checkAnswerKeys(wait, answers);
  if (check) {
    return { ok: false, outcome: 'unknown-question', detail: JSON.stringify(check), error: 'unknown-question' };
  }
  const updated = await answerWait(waitId, answers, 'advisor');
  if (!updated) return { ok: false, outcome: 'wait-not-found', error: 'wait-not-found' };
  return { ok: true, outcome: `answered ${Object.keys(answers).join(', ')}` };
}

/** `deferral`: DeferralStorage.create then checkpoint of that file, inside one withStoreLock (AC 10). */
async function execDeferral(action: StagedAction, deps: ActionDeps): Promise<ExecResult> {
  const projectId = (action.target as { project?: string }).project ?? '';
  const repo = deps.projectPath(projectId);
  const params = action.params as {
    title: string;
    originSpec: string | null;
    originPhase: 'requirements' | 'design' | 'tasks' | 'implementation' | null;
    revisitTrigger: string;
    tags: string[];
    owner?: DeferralOwner | null;
    body: { context: string; decision: string; revisitCriteria: string };
  };

  const { deferralId, sha } = await withStoreLock(repo, async () => {
    const storage = new DeferralStorage(repo);
    const deferralId = await storage.create({
      title: params.title,
      originSpec: params.originSpec,
      originPhase: params.originPhase,
      revisitTrigger: params.revisitTrigger,
      tags: params.tags,
      owner: params.owner ?? null,
      supersedes: null,
      body: params.body,
    });
    const sha = await checkpoint({
      specStoreRoot: repo,
      message: `chore(deferrals): advisor-staged deferral ${deferralId}`,
      paths: ['.spec-workflow/deferrals'],
    });
    return { deferralId, sha };
  });

  return { ok: true, outcome: `committed ${sha} (${deferralId})` };
}

/**
 * Finds the `### ` section whose heading holds `` `slug` `` and the position
 * of `## Build order`, by scanning every `##`/`###` heading line once.
 */
function findSection(content: string, slug: string): { start: number; end: number } | undefined {
  const slugMarker = '`' + slug + '`';
  const headingRe = /^#{2,3}[ \t].*$/gm;
  let match: RegExpExecArray | null;
  let start = -1;
  while ((match = headingRe.exec(content))) {
    if (start === -1 && match[0].startsWith('### ') && match[0].includes(slugMarker)) {
      start = match.index;
      continue;
    }
    if (start !== -1) return { start, end: match.index };
  }
  return start !== -1 ? { start, end: content.length } : undefined;
}

function findBuildOrder(content: string): number | undefined {
  const headingRe = /^#{2,3}[ \t].*$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRe.exec(content))) {
    if (match[0].trim() === '## Build order') return match.index;
  }
  return undefined;
}

/**
 * Replace the `### ` section for `slug`, or insert the block before
 * `## Build order`, or append it at the end (design C8's decomposition bullet).
 */
function upsertDecompositionSection(content: string, slug: string, markdown: string): string {
  const block = markdown.endsWith('\n') ? markdown : `${markdown}\n`;

  const section = findSection(content, slug);
  if (section) {
    return content.slice(0, section.start) + block + content.slice(section.end);
  }

  const buildOrder = findBuildOrder(content);
  if (buildOrder !== undefined) {
    return content.slice(0, buildOrder) + block + '\n' + content.slice(buildOrder);
  }

  const trimmed = content.endsWith('\n') ? content : `${content}\n`;
  return `${trimmed}\n${block}`;
}

/** `decomposition`: replace or insert the section, then checkpoint, under one withStoreLock (AC 10). */
async function execDecomposition(action: StagedAction, deps: ActionDeps): Promise<ExecResult> {
  const projectId = (action.target as { project?: string }).project ?? '';
  const repo = deps.projectPath(projectId);
  const params = action.params as { slug: string; markdown: string };
  const relPath = join('.spec-workflow', 'spec-decomposition', 'decomposition.md');
  const decompPath = join(repo, relPath);

  const sha = await withStoreLock(repo, async () => {
    const content = await fs.readFile(decompPath, 'utf-8');
    const updated = upsertDecompositionSection(content, params.slug, params.markdown);
    await fs.writeFile(decompPath, updated, 'utf-8');
    return checkpoint({
      specStoreRoot: repo,
      message: `chore(decomposition): advisor-staged ${params.slug}`,
      paths: ['.spec-workflow/spec-decomposition/decomposition.md'],
    });
  });

  return { ok: true, outcome: `committed ${sha}` };
}

/** `backlog`: append one dated line to `owner-backlog.md` in the home, no commit (design D18). */
async function execBacklog(action: StagedAction): Promise<ExecResult> {
  const text = (action.params as { text?: string }).text ?? '';
  const backlogPath = join(controllerHome(), 'owner-backlog.md');
  const date = new Date().toISOString().slice(0, 10);
  await fs.mkdir(dirname(backlogPath), { recursive: true });
  await fs.appendFile(backlogPath, `- ${date}: ${text}\n`, 'utf-8');
  return { ok: true, outcome: 'appended to owner-backlog.md' };
}

/**
 * `merge` (design C8; AC 6, AC 7, AC 9): a run on `target.project` with
 * `target.pr` and an open `merge` wait answers that wait with `merge` by
 * advisor instead of merging directly (D7), outcome `answered-wait`. Else
 * `mergeByRule` runs against a synthetic ledger rooted at
 * `advisor/actions/<id>/`, with the project's own merge rules forced to
 * `auto` (D6): a `merged` status is `ok`, any other status is refused with
 * the rule's reasons (6.6).
 */
async function execMerge(action: StagedAction, deps: ActionDeps): Promise<ExecResult> {
  const target = action.target as { project?: string; spec?: string; pr?: number };
  const projectId = target.project ?? '';
  const spec = target.spec ?? '';
  const prNumber = Number(target.pr);

  const runs = await listRuns();
  const run = runs.find((r) => r.project === projectId && r.pr === prNumber);
  if (run) {
    const openWaits = (await listWaits({ state: 'open' })) as ControllerWaitRecord[];
    const wait = openWaits.find((w) => w.kind === 'merge' && w.run === run.id);
    if (wait) {
      const questionId = wait.questions[0]?.id ?? 'merge';
      await answerWait(wait.id, { [questionId]: 'merge' }, 'advisor');
      return { ok: true, outcome: 'answered-wait' };
    }
  }

  const repoDir = deps.projectPath(projectId);
  const branch = (action.params as { branch?: string }).branch ?? '';
  const rules = { ...readMergeRules(join(repoDir, '.spec-workflow')), merge: 'auto' as const };
  const actionDir = join(advisorActionsDir(), action.id);
  await fs.mkdir(actionDir, { recursive: true });
  const ledger = openRunLedger({ specDir: actionDir, runId: action.id, spec });

  const mergeTarget: MergeTarget = {
    pr: { number: prNumber, repoDir, branch },
    runId: run?.id ?? action.id,
    projectId,
    spec,
    questionId: 'merge',
    label: `PR #${prNumber}`,
  };
  const result = await mergeByRule(mergeTarget, { rules, specDir: actionDir, stepLogDir: actionDir, ledger });

  if (result.status === 'merged') {
    return { ok: true, outcome: result.reasons.join('; ') };
  }
  return { ok: false, outcome: 'refused', detail: result.reasons.join('; '), error: 'refused', state: 'refused' };
}

/**
 * `deploy` (design C8): spawn `scripts/sdd-self-update.sh` detached from the
 * checkout root (`CONTROLLER_HARNESS_REPO`, the same seam `closeout.ts` uses),
 * its output logged to `advisor/actions/<id>/deploy.log`. The script reports
 * its own failures; confirming it only proves the spawn, outcome `started`.
 */
async function execDeploy(action: StagedAction): Promise<ExecResult> {
  const checkoutRoot = process.env.CONTROLLER_HARNESS_REPO ?? packageRoot();
  const scriptPath = join(checkoutRoot, 'scripts', 'sdd-self-update.sh');
  const actionDir = join(advisorActionsDir(), action.id);
  await fs.mkdir(actionDir, { recursive: true });
  const logFd = openSync(join(actionDir, 'deploy.log'), 'a');
  try {
    const child = spawn(scriptPath, [], { cwd: checkoutRoot, detached: true, stdio: ['ignore', logFd, logFd] });
    child.unref();
  } finally {
    closeSync(logFd);
  }
  return { ok: true, outcome: 'started' };
}

/**
 * `launch` (design C8; AC 9): calls the real `launchSpec`
 * (`src/dashboard/multi-server.ts`) through `deps.launchSpec`, so a confirmed
 * launch goes through `enqueue`'s admission guards rather than enqueuing
 * directly.
 */
async function execLaunch(action: StagedAction, deps: ActionDeps): Promise<ExecResult> {
  if (!deps.launchSpec) return { ok: false, outcome: 'failed', detail: 'launchSpec not available', error: 'failed' };
  const target = action.target as { project?: string; spec?: string };
  const projectId = target.project ?? '';
  const input = { spec: target.spec ?? '', ...(action.params as Record<string, unknown>) };

  const result = await deps.launchSpec(projectId, input);
  if (!result.ok) return { ok: false, outcome: 'failed', detail: result.error, error: result.error };
  return { ok: true, outcome: `launched ${result.runId}` };
}

const EXECUTORS: Record<ActionKind, Executor> = {
  answer: execAnswer,
  deferral: execDeferral,
  decomposition: execDecomposition,
  backlog: execBacklog,
  merge: execMerge,
  deploy: execDeploy,
  launch: execLaunch,
};

/**
 * Confirm a staged action: refuse anything not `staged` (dismissed, already
 * confirmed, or unknown), else mark it `running` before running its executor
 * exactly once, then append one `advisor.action` event row (AC 5, AC 10). A
 * throwing executor (lock busy, git error, unknown project) still lands the
 * action `failed` with the message, and still writes the row (design Error
 * Handling flow 6).
 */
export async function confirmAction(id: string, deps: ActionDeps): Promise<ConfirmResult> {
  const action = await readAction(id);
  if (!action || action.state !== 'staged') return { ok: false, error: 'not-staged' };

  action.state = 'running';
  action.decided = new Date().toISOString();
  await writeAction(action);

  const executor = EXECUTORS[action.kind];
  let result: ExecResult;
  try {
    result = await executor(action, deps);
  } catch (error) {
    result = { ok: false, outcome: 'failed', detail: (error as Error).message, error: 'failed' };
  }

  await appendEvent({
    v: 1,
    ts: new Date().toISOString(),
    type: 'advisor.action',
    action: action.id,
    kind: action.kind,
    target: action.target,
    conversation: action.conversation,
    outcome: result.outcome,
    ...(result.detail !== undefined ? { detail: result.detail } : {}),
  });

  action.state = result.ok ? 'done' : (result.state ?? 'failed');
  action.outcome = { status: action.state, detail: result.detail !== undefined ? [result.outcome, result.detail] : [result.outcome] };
  await writeAction(action);

  if (!result.ok) return { ok: false, error: result.error ?? result.outcome };
  return { ok: true };
}
