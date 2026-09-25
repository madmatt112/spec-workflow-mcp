import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { readFile, readdir, stat, writeFile, mkdir, unlink } from 'node:fs/promises';
import { dirname, basename, resolve, isAbsolute } from 'node:path';
import { PathUtils } from '../core/path-utils.js';
import { selectRoots } from './root-selection.js';
import { SpecParser } from '../core/parser.js';
import { parseTasksFromMarkdown, taskBlock } from '../core/task-parser.js';
import { parseSensitivePaths } from '../core/gate-rules.js';
import { computeClassA, TaskVetoInput } from '../core/veto-rules.js';
import { deriveSpecStatus } from '../core/spec-status-deriver.js';
import { deriveDocumentApprovalStates } from '../core/approval-records.js';
import { parseJsonl, parseHandoffPhaseRows, LedgerEvent, PhaseRow } from '../watch/ledger.js';
import { handoffPath } from '../watch/index.js';
import { buildUsageReport, usageDelta, formatUsageTable } from '../watch/usage.js';

/**
 * The `harness` tool (design Components 1-6). One tool, five actions:
 * `orient` returns the Step 0 state and the next step the SDD orchestrator
 * skills compute by hand today; `brief` writes a worker brief from a named
 * template; `phase-log` regenerates the HANDOFF `## Phase log` rows; `gate`
 * carries the two human gates' payloads across the spec store (design Component
 * 2); `usage` folds one or two ledgers into the tokens-and-spawns-by-phase
 * report the step-4 measurement produces (design Component 6). It reads only
 * under the resolved spec store through `PathUtils.safeJoin` (the pattern
 * `spec-lint` uses) and spawns no child process.
 */
export const harnessTool: Tool = {
  name: 'harness',
  description: `SDD harness bookkeeping: orient, brief, phase-log, gate and usage for the orchestrator skills.

# Instructions
Call \`orient\` at Step 0 to get the routing state and the next step for a spec and phase
in one call, instead of reading many files by hand. For a document phase (requirements,
design, tasks) it returns the document version D, the latest analysis index A with its
verdict, the post-cap marker P, whether the latest analysis is the narrow check, and the
next step. For \`implementation\` it returns the task counts and the next step; for
\`closeout\` the plan item counts, the open items by target class, and the next step. Call
\`gate\` to carry a human gate's payload across the spec store: \`class-a\` computes the
gate-B class (a) veto items, \`put\`/\`get\`/\`delete\` manage the \`gate-<slot>.json\` file.
Call \`usage\` to fold one spec's \`harness-events.jsonl\` into a report of tokens and spawns
by phase and agent; pass \`compareSpecName\` for a second spec side by side with a per-phase
delta. The tool reads only the spec store; it never spawns a process.`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['orient', 'brief', 'phase-log', 'gate', 'usage'],
        description: 'Which harness action to run',
      },
      specName: {
        type: 'string',
        description: 'Name of the specification (kebab-case)',
      },
      compareSpecName: {
        type: 'string',
        description: 'Second spec for a side-by-side usage table (usage action)',
      },
      phase: {
        type: 'string',
        enum: ['requirements', 'design', 'tasks', 'implementation', 'closeout'],
        description: 'The phase to orient for (required for orient)',
      },
      mode: {
        type: 'string',
        enum: ['normal', 'revision', 'repair'],
        description: 'The launch mode, used by orient to pick the revision/repair branch',
      },
      template: {
        type: 'string',
        description: 'The named brief template to fill (brief action)',
      },
      values: {
        type: 'object',
        description: 'Placeholder values for the brief template (brief action)',
      },
      taskId: {
        type: 'string',
        description: 'The task id whose block fills an implementer brief (brief action)',
      },
      op: {
        type: 'string',
        enum: ['class-a', 'put', 'get', 'delete'],
        description: 'The gate op (gate action): class-a computes gate-B class (a); put/get/delete manage the gate-<slot>.json payload',
      },
      slot: {
        type: 'string',
        enum: ['a', 'b'],
        description: 'The gate slot (a | b) for gate put/get/delete',
      },
      payload: {
        type: 'object',
        description: 'The JSON payload object for gate put',
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to the workspace under review (optional - uses the server context roots if not provided). When provided it replaces the context workspace, and the shared workflow root holding .spec-workflow is derived from it.',
      },
    },
    required: ['action', 'specName'],
    additionalProperties: false,
  },
  annotations: {
    title: 'Harness',
    readOnlyHint: false,
  },
};

export async function harnessHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const { action, specName } = args;
  if (!specName || typeof specName !== 'string') {
    return { success: false, message: 'specName is required and must be a string' };
  }

  switch (action) {
    case 'orient':
      return orientAction(args, context);
    case 'brief':
      return briefAction(args, context);
    case 'phase-log':
      return phaseLogAction(args, context);
    case 'gate':
      return gateAction(args, context);
    case 'usage':
      return usageAction(args, context);
    default:
      return { success: false, message: `Unknown action: ${action}. Use 'orient', 'brief', 'phase-log', 'gate', or 'usage'.` };
  }
}

// --- orient ------------------------------------------------------------------

type DocPhase = 'requirements' | 'design' | 'tasks';
const DOC_PHASES: DocPhase[] = ['requirements', 'design', 'tasks'];

async function orientAction(args: any, context: ToolContext): Promise<ToolResponse> {
  const { specName, phase, mode } = args;
  if (
    phase !== 'requirements' && phase !== 'design' && phase !== 'tasks' &&
    phase !== 'implementation' && phase !== 'closeout'
  ) {
    return {
      success: false,
      message: 'phase is required for orient and must be one of: requirements, design, tasks, implementation, closeout',
    };
  }

  const { workflowRoot } = selectRoots(args, context);
  const specDir = PathUtils.getSpecPath(workflowRoot, specName);

  // The spec directory must exist; a missing spec dir is an error, distinct
  // from a missing document (which is `D: 0` per 1.4).
  try {
    const s = await stat(specDir);
    if (!s.isDirectory()) throw new Error('not a directory');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to read ${specDir}: ${message}` };
  }

  try {
    if (DOC_PHASES.includes(phase as DocPhase)) {
      return await orientDocument(specDir, phase as DocPhase, mode);
    }
    if (phase === 'implementation') {
      return await orientImplementation(workflowRoot, specDir, specName, mode);
    }
    return await orientCloseout(specDir);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to orient ${specName}/${phase}: ${message}` };
  }
}

/**
 * Document-phase orient: derive D, A, verdict, P and narrowCheck from the
 * document Revision History and the `reviews/adversarial-analysis-<phase>*`
 * files, then apply the document Step 0 decision table (first match wins,
 * `harness/skills/sdd-document-phase/SKILL.md:65-75`).
 */
async function orientDocument(specDir: string, phase: DocPhase, mode?: string): Promise<ToolResponse> {
  const docPath = PathUtils.safeJoin(specDir, `${phase}.md`);
  let content: string | null = null;
  try {
    content = await readFile(docPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to read ${docPath}: ${message}` };
    }
    content = null;
  }

  const D = content === null ? 0 : documentVersion(content);
  const P = content !== null && postCap(content, D);

  const { A, verdict, narrowCheck, mustFix, shouldFix } = await latestAnalysis(specDir, phase);

  const nextStep = documentNextStep({ mode, D, A, P, narrowCheck, verdict, mustFix, shouldFix });

  return {
    success: true,
    message: `orient ${phase} D=${D} A=${A} verdict=${verdict ?? 'none'} → ${nextStep}`,
    data: { phase, D, A, verdict, P, narrowCheck, nextStep },
  };
}

/** D — the highest `v<n>` in the Revision History; 1 when the doc has none. */
function documentVersion(content: string): number {
  let max = 0;
  for (const line of content.split('\n')) {
    const m = line.match(/^- \*\*v(\d+)\*\*/);
    if (m) {
      const n = Number(m[1]);
      if (n > max) max = n;
    }
  }
  return max === 0 ? 1 : max;
}

/** P — the `v<D>` Revision History line names a post-cap corrective pass. */
function postCap(content: string, D: number): boolean {
  for (const line of content.split('\n')) {
    if (line.match(new RegExp(`^- \\*\\*v${D}\\*\\*`))) {
      return line.includes('Post-cap corrective pass') || line.includes('SHOULD_FIX-only corrective pass');
    }
  }
  return false;
}

/**
 * A — the highest analysis index for the phase; the file with no suffix is r1,
 * `-rN` is rN. Reads the verdict block (last lines) of the latest one: a block
 * whose tail carries `VERIFIED:` rather than `VERDICT:` is the narrow check.
 */
async function latestAnalysis(specDir: string, phase: DocPhase): Promise<{
  A: number; verdict: string | null; narrowCheck: boolean; mustFix: number; shouldFix: number;
}> {
  const reviewsDir = PathUtils.safeJoin(specDir, 'reviews');
  let files: string[];
  try {
    files = await readdir(reviewsDir);
  } catch {
    return { A: 0, verdict: null, narrowCheck: false, mustFix: 0, shouldFix: 0 };
  }

  const re = new RegExp(`^adversarial-analysis-${phase}(?:-r(\\d+))?\\.md$`);
  let A = 0;
  let latestFile: string | null = null;
  for (const f of files) {
    const m = f.match(re);
    if (!m) continue;
    const n = m[1] ? Number(m[1]) : 1;
    if (n > A) {
      A = n;
      latestFile = f;
    }
  }

  if (!latestFile) {
    return { A: 0, verdict: null, narrowCheck: false, mustFix: 0, shouldFix: 0 };
  }

  const analysis = await readFile(PathUtils.safeJoin(reviewsDir, latestFile), 'utf-8');
  const tail = analysis.split('\n').filter((l) => l.trim() !== '').slice(-10);
  const narrowCheck = tail.some((l) => /^VERIFIED:/.test(l.trim()));
  let verdict: string | null = null;
  let mustFix = 0;
  let shouldFix = 0;
  if (!narrowCheck) {
    for (const l of tail) {
      const v = l.trim().match(/^VERDICT:\s*(\S+)/);
      if (v) verdict = v[1];
      const mf = l.trim().match(/^MUST_FIX:\s*(\d+)/);
      if (mf) mustFix = Number(mf[1]);
      const sf = l.trim().match(/^SHOULD_FIX:\s*(\d+)/);
      if (sf) shouldFix = Number(sf[1]);
    }
  }
  return { A, verdict, narrowCheck, mustFix, shouldFix };
}

/** The document Step 0 decision table, first match wins (SKILL.md:65-75). */
function documentNextStep(s: {
  mode?: string; D: number; A: number; P: boolean; narrowCheck: boolean;
  verdict: string | null; mustFix: number; shouldFix: number;
}): string {
  if (s.mode === 'revision') return 'Step R';
  if (s.D === 0) return 'Step 1';
  if (s.P && s.narrowCheck) return 'Step 5';
  if (s.P && !s.narrowCheck) return 'Step 4b';
  if (s.A < s.D) return 'Step 2';
  // A === D from here.
  if (s.verdict === 'converged' || (s.verdict === 'iterate' && s.mustFix === 0 && s.shouldFix === 0)) {
    return 'Step 5';
  }
  if (s.verdict === 'iterate' && s.mustFix === 0 && s.shouldFix > 0 && s.D >= 2) {
    return 'Step 2 item 9';
  }
  if (s.verdict === 'iterate') {
    return s.D >= 4 ? 'Step 4a' : 'Step 3';
  }
  return 'Step 2';
}

/**
 * Implementation-phase orient: task counts from the tasks parser, approval and
 * phase state from `deriveSpecStatus` + `deriveDocumentApprovalStates` (1.6).
 */
async function orientImplementation(
  workflowRoot: string, specDir: string, specName: string, mode?: string,
): Promise<ToolResponse> {
  const tasksPath = PathUtils.safeJoin(specDir, 'tasks.md');
  let tasksContent: string;
  try {
    tasksContent = await readFile(tasksPath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to read ${tasksPath}: ${message}` };
  }

  const parsed = parseTasksFromMarkdown(tasksContent);
  const tasks = {
    total: parsed.summary.total,
    done: parsed.summary.completed,
    inProgress: parsed.summary.inProgress,
    open: parsed.summary.pending,
  };

  // Approval/phase state through the server's existing derivation (1.6).
  const parser = new SpecParser(workflowRoot);
  const spec = await parser.getSpec(specName);
  const currentPhase = spec ? deriveSpecStatus(spec).currentPhase : 'implementation';
  const approvals = await deriveDocumentApprovalStates(workflowRoot, specName);
  const tasksApproved = approvals.tasks.approved;

  let nextStep: string;
  if (!tasksApproved && tasks.done === 0 && tasks.inProgress === 0) {
    nextStep = 'error: tasks.md not approved';
  } else if (mode === 'repair') {
    nextStep = 'Repair';
  } else if (tasks.inProgress > 0) {
    nextStep = `Per-task loop: resume task ${parsed.inProgressTask}`;
  } else if (tasks.open > 0) {
    nextStep = 'Per-task loop';
  } else {
    nextStep = 'Completion gate';
  }

  return {
    success: true,
    message: `orient implementation ${tasks.done}/${tasks.total} → ${nextStep}`,
    data: { phase: 'implementation', tasks, tasksApproved, currentPhase, nextStep },
  };
}

type TargetClass = 'none' | 'store' | 'harness' | 'code' | 'home';
const CLASS_KEYS: TargetClass[] = ['none', 'store', 'harness', 'code', 'home'];

/**
 * Close-out orient: plan items and their open-by-class counts from
 * `retrospective-plan.md`, matching close-out Step 0 (SKILL.md:54-85).
 */
async function orientCloseout(specDir: string): Promise<ToolResponse> {
  const planPath = PathUtils.safeJoin(specDir, 'retrospective-plan.md');
  let content: string;
  try {
    content = await readFile(planPath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to read ${planPath}: ${message}` };
  }

  const items = parsePlanItems(content);
  const doneIds = parseCloseoutDone(content);
  const open = items.filter((it) => !doneIds.has(it.id));

  const byClass: Record<TargetClass, number> = { none: 0, store: 0, harness: 0, code: 0, home: 0 };
  for (const it of open) {
    byClass[classifyTarget(it.block)]++;
  }

  let nextStep: string;
  if (open.length === 0) {
    nextStep = 'Step 3';
  } else if (byClass.none > 0) {
    nextStep = 'Step 1';
  } else {
    nextStep = 'Step 2';
  }

  const itemCounts = { total: items.length, done: items.length - open.length, open: open.length };
  return {
    success: true,
    message:
      `orient closeout items ${itemCounts.done}/${itemCounts.total}; open: ` +
      CLASS_KEYS.map((k) => `${k} ${byClass[k]}`).join(' ') + ` → ${nextStep}`,
    data: { phase: 'closeout', items: itemCounts, byClass, nextStep },
  };
}

interface PlanItem { id: string; block: string; }

/** Items — `- **P<n>`/`- **G<n>` bullets under the two proposal sections. */
function parsePlanItems(content: string): PlanItem[] {
  const lines = content.split('\n');
  const items: PlanItem[] = [];
  let inSection = false;
  let current: { id: string; lines: string[] } | null = null;

  const flush = () => {
    if (current) items.push({ id: current.id, block: current.lines.join('\n') });
    current = null;
  };

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      flush();
      const title = heading[1].trim();
      inSection = title === 'Approved proposals' || title === 'Graduation candidates';
      continue;
    }
    const itemMatch = line.match(/^- \*\*(P\d+|G\d+)/);
    if (inSection && itemMatch) {
      flush();
      current = { id: itemMatch[1], lines: [line] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  flush();
  return items;
}

/** Done items — `- P<n>:`/`- G<n>:` lines inside a `## Close-out` section. */
function parseCloseoutDone(content: string): Set<string> {
  const lines = content.split('\n');
  const done = new Set<string>();
  let inCloseout = false;
  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/);
    if (heading) {
      inCloseout = heading[1].trim() === 'Close-out';
      continue;
    }
    const m = line.match(/^-\s+(P\d+|G\d+):/);
    if (inCloseout && m) done.add(m[1]);
  }
  return done;
}

/**
 * Target class of one open item from its `Target:` and `Decision:` text, first
 * match wins down the Step 0 table (SKILL.md:68-76). The `HARNESS_REPO: none`
 * adjustment is a launch-time value the skill applies, not the server.
 */
function classifyTarget(block: string): TargetClass {
  const target = (block.match(/Target:\s*([^\n]*)/i)?.[1] ?? '').toLowerCase();
  const decision = (block.match(/Decision:\s*([^\n]*)/i)?.[1] ?? '').toLowerCase();
  // `none` reads the whole item — its marker often sits in Decision. The class regexes
  // match the Target value alone, so Decision text cannot misfile an item (retro P3).
  if (/\bnone\b|human action|ratified|closed|no change/.test(`${target} ${decision}`)) return 'none';
  if (/agent-rules|steering|\brules?\b|decomposition|spec[ -]?store|\bstore\b/.test(target)) return 'store';
  if (/harness|skill|\bagents?\b|hook|server|\bdocs?\b|template/.test(target)) return 'harness';
  if (/memory|claude\.md|settings|~\/\.claude/.test(target)) return 'home';
  if (/\bcode\b|checkout|\brepo\b|src\//.test(target)) return 'code';
  return 'none';
}

// --- brief -------------------------------------------------------------------

/**
 * Named server-side brief templates, one per brief kind the harness spawns
 * (design Component 3, D2). Placeholders are `{{key}}`, filled from `values`;
 * an unknown template name or a `{{key}}` with no value fails naming it and
 * writes nothing (2.3). `{{agentRules}}` is filled with the spec-store
 * `agent-rules.md` path when that file exists, and its line is dropped when it
 * does not (2.4, `harness/skills/sdd-document-phase/references/briefs.md:4-11`).
 * The implementer template's `{{taskBlock}}` is filled by the tasks parser, not
 * the caller (2.2). Porting the skills' `references/briefs.md` verbatim and
 * guarding the two in sync is a deferred follow-up (design Scope notes, D2).
 */
const BRIEF_TEMPLATES: Record<string, string> = {
  drafter: [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Job',
    '{{job}}',
    '',
  ].join('\n'),
  reviser: [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Job',
    '{{job}}',
    '',
    '## Findings',
    '{{findings}}',
    '',
  ].join('\n'),
  adjudicator: [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Open items',
    '{{items}}',
    '',
  ].join('\n'),
  verifier: [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Job',
    '{{job}}',
    '',
  ].join('\n'),
  implementer: [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Task text (from tasks.md)',
    '',
    '{{taskBlock}}',
    '',
  ].join('\n'),
};

/** Placeholder keys the server fills itself; never required from `values`. */
const SERVER_BRIEF_KEYS = new Set(['agentRules', 'taskBlock']);

/**
 * `brief` action: fill a named template's `{{key}}` placeholders from `values`,
 * write the read-and-obey first line when `agent-rules.md` exists at the spec
 * store root, fill an implementer brief's task block from the tasks parser, and
 * write the file through `PathUtils.safeJoin` under the caller-named path,
 * returning its absolute path (Requirement 2).
 */
async function briefAction(args: any, context: ToolContext): Promise<ToolResponse> {
  const { specName, template, taskId } = args;
  const values: Record<string, unknown> =
    args.values && typeof args.values === 'object' ? args.values : {};

  // Missing or unknown template: fail naming it, write nothing (2.3).
  if (typeof template !== 'string' || template.length === 0) {
    return {
      success: false,
      message: `brief: a template name is required, one of: ${Object.keys(BRIEF_TEMPLATES).join(', ')}`,
    };
  }
  const templateBody = BRIEF_TEMPLATES[template];
  if (templateBody === undefined) {
    return {
      success: false,
      message: `brief: unknown template '${template}'. Known templates: ${Object.keys(BRIEF_TEMPLATES).join(', ')}`,
    };
  }

  // The output path the caller names in `values`; a missing one is a missing value.
  const outPath = values.path;
  if (typeof outPath !== 'string' || outPath.length === 0) {
    return {
      success: false,
      message: `brief: required value 'path' (the output file path) is missing; no file written`,
    };
  }

  const { workflowRoot } = selectRoots(args, context);
  const specStoreRoot = PathUtils.getWorkflowRoot(workflowRoot);
  const serverValues: Record<string, string> = {};

  // agent-rules.md at the spec-store root ⇒ keep and fill the read-and-obey line;
  // otherwise drop that line entirely (2.4, briefs.md:4-11).
  let body = templateBody;
  const agentRulesPath = PathUtils.safeJoin(specStoreRoot, 'agent-rules.md');
  let agentRulesExists = false;
  try {
    await stat(agentRulesPath);
    agentRulesExists = true;
  } catch {
    agentRulesExists = false;
  }
  if (agentRulesExists) {
    serverValues.agentRules = agentRulesPath;
  } else {
    body = body.split('\n').filter((l) => !l.includes('{{agentRules}}')).join('\n');
  }

  // The implementer template's task block comes from the parser, byte for byte (2.2).
  if (body.includes('{{taskBlock}}')) {
    if (typeof taskId !== 'string' || taskId.length === 0) {
      return { success: false, message: `brief: template '${template}' needs a taskId; no file written` };
    }
    const tasksPath = PathUtils.safeJoin(PathUtils.getSpecPath(workflowRoot, specName), 'tasks.md');
    let tasksContent: string;
    try {
      tasksContent = await readFile(tasksPath, 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to read ${tasksPath}: ${message}` };
    }
    const block = taskBlock(tasksContent, taskId);
    if (block === undefined) {
      return { success: false, message: `brief: task ${taskId} not found in ${tasksPath}; no file written` };
    }
    serverValues.taskBlock = block;
  }

  // Every remaining {{key}} must have a caller value. Report ALL missing keys at
  // once, with the template's full required-placeholder list, so a single re-call
  // fixes them instead of one failed call per missing key (2.3, F2).
  const keys = new Set((body.match(/\{\{(\w+)\}\}/g) ?? []).map((p) => p.slice(2, -2)));
  const required = [...keys].filter((key) => !SERVER_BRIEF_KEYS.has(key));
  const missing = required.filter((key) => values[key] === undefined || values[key] === null);
  if (missing.length > 0) {
    const plural = missing.length > 1 ? 's' : '';
    return {
      success: false,
      message:
        `brief: required value${plural} ${missing.map((k) => `'${k}'`).join(', ')} missing; no file written. ` +
        `Template '${template}' requires: ${required.map((k) => `'${k}'`).join(', ')}`,
    };
  }

  const filled = body.replace(/\{\{(\w+)\}\}/g, (_full, key: string) =>
    key in serverValues ? serverValues[key] : String(values[key]),
  );

  // Write through safeJoin under the caller-named directory; return the path.
  // A relative output path resolves against the spec-store root, never the
  // process cwd (the code workspace), so a brief lands in the spec store
  // regardless of where the server was launched (P5). An absolute path is
  // honoured as given (e.g. a scratch-dir brief).
  const finalPath = isAbsolute(outPath)
    ? PathUtils.safeJoin(dirname(outPath), basename(outPath))
    : PathUtils.safeJoin(specStoreRoot, outPath);
  try {
    await mkdir(dirname(finalPath), { recursive: true });
    await writeFile(finalPath, filled, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to write ${finalPath}: ${message}` };
  }

  const absolute = resolve(finalPath);
  return { success: true, message: `brief ${template} → ${absolute}`, data: { path: absolute } };
}

// --- phase-log ---------------------------------------------------------------

const PHASE_LOG_HEADING = '## Phase log';
const PHASE_LOG_HEADER = '| Date | Spec | Stage | State | Result | Note |';
const PHASE_LOG_SEPARATOR = '| --- | --- | --- | --- | --- | --- |';

/** Milliseconds of an ISO timestamp; 0 when absent or unparseable (as `buildModel`). */
function ms(ts: string | undefined): number {
  const n = ts ? new Date(ts).getTime() : NaN;
  return Number.isNaN(n) ? 0 : n;
}

/**
 * `phase-log` action: regenerate the HANDOFF `## Phase log` rows for one spec
 * from its `harness-events.jsonl`, rewriting only that block (design Component 4,
 * Requirement 5). Rows whose `Spec` cell is another spec stay verbatim, the
 * routing header and the `## <spec> — <stage>` sections are untouched. A
 * `phase.end` with no existing row adds a row (dedup as `src/watch/ledger.ts:209-211`),
 * a pre-ledger hand-written row with no matching `phase.end` is kept (5.3), and a
 * `phase.start` with no matching `phase.end` that is not the live phase — the run
 * ended or it belongs to a prior run — emits a row with Result `interrupted` and
 * its entry-snapshot state (5.4). A live phase is never stamped `interrupted`.
 */
async function phaseLogAction(args: any, context: ToolContext): Promise<ToolResponse> {
  const { specName } = args;
  const { workflowRoot } = selectRoots(args, context);
  const specDir = PathUtils.getSpecPath(workflowRoot, specName);

  // The spec directory must exist; a missing one is an error naming the path.
  try {
    const s = await stat(specDir);
    if (!s.isDirectory()) throw new Error('not a directory');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to read ${specDir}: ${message}` };
  }

  // The spec's ledger; a missing file is an empty ledger (a run never needs one).
  const ledgerPath = PathUtils.safeJoin(specDir, 'harness-events.jsonl');
  let ledgerText: string | undefined;
  try {
    ledgerText = await readFile(ledgerPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to read ${ledgerPath}: ${message}` };
    }
    ledgerText = undefined;
  }

  // HANDOFF lives at the spec-store root; a missing file is an error naming it,
  // because the block is rewritten in place beside the supervisor's own sections.
  const specStoreRoot = PathUtils.getWorkflowRoot(workflowRoot);
  const hoPath = handoffPath(specStoreRoot);
  let handoffMd: string;
  try {
    handoffMd = await readFile(hoPath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to read ${hoPath}: ${message}` };
  }

  const events = parseJsonl<LedgerEvent>(ledgerText);
  const derived = derivePhaseRows(events, parseHandoffPhaseRows(handoffMd, specName));
  const updated = rewriteHandoffPhaseLog(handoffMd, specName, derived);

  try {
    await writeFile(hoPath, updated, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to write ${hoPath}: ${message}` };
  }

  return {
    success: true,
    message: `phase-log ${specName}: ${derived.length} row(s) added to ${hoPath}`,
    data: { path: hoPath, added: derived.length },
  };
}

/**
 * The rows to append for this spec: a `phase.end` with no existing row (dedup on
 * phase+result+state, `src/watch/ledger.ts:209-211`) and an `interrupted` row for
 * each unclosed, not-live `phase.start` (`src/watch/ledger.ts:216-224`). Existing
 * rows are kept verbatim by the caller, so this returns only the additions.
 */
function derivePhaseRows(events: LedgerEvent[], existing: PhaseRow[]): PhaseRow[] {
  const sorted = [...events].sort((a, b) => ms(a.ts) - ms(b.ts));
  const derived: PhaseRow[] = [];
  // `seen` grows so a repeated phase+result+state adds only one row.
  const seen: PhaseRow[] = [...existing];
  const isDup = (r: PhaseRow) =>
    seen.some(p => p.phase === r.phase && p.result === r.result && p.state === r.state);
  const add = (r: PhaseRow) => { if (!isDup(r)) { derived.push(r); seen.push(r); } };

  // A `phase.end` with no matching existing or already-added row.
  for (const e of sorted.filter(e => e.type === 'phase.end')) {
    add({
      date: (e.ts ?? '').slice(0, 10),
      phase: e.phase ?? '',
      state: e.state ?? '',
      result: e.result ?? '',
      note: e.note ?? '',
    });
  }

  // The live phase.start (never stamped interrupted): the last phase.start of the
  // current run with no later phase.end for it, and only while the run has not
  // ended (`src/watch/ledger.ts:216-224`).
  const runStart = [...sorted].reverse().find(e => e.type === 'run.start');
  const currentRun = runStart?.run;
  const currentRunEvents = currentRun ? sorted.filter(e => e.run === currentRun) : sorted;
  const runEnded = currentRunEvents.some(e => e.type === 'run.end');
  const currentStarts = currentRunEvents.filter(e => e.type === 'phase.start');
  const lastStart = currentStarts[currentStarts.length - 1];
  let livePhaseStart: LedgerEvent | undefined;
  if (lastStart && !runEnded) {
    const ended = currentRunEvents.some(
      e => e.type === 'phase.end' && e.phase === lastStart.phase && ms(e.ts) >= ms(lastStart.ts),
    );
    if (!ended) livePhaseStart = lastStart;
  }

  // An unclosed phase.start that is not live: interrupted, with its entry state.
  for (const start of sorted.filter(e => e.type === 'phase.start')) {
    if (start === livePhaseStart) continue;
    const runScope = start.run ? sorted.filter(e => e.run === start.run) : sorted;
    const ended = runScope.some(
      e => e.type === 'phase.end' && e.phase === start.phase && ms(e.ts) >= ms(start.ts),
    );
    if (ended) continue;
    add({
      date: (start.ts ?? '').slice(0, 10),
      phase: start.phase ?? '',
      state: start.state ?? '',
      result: 'interrupted',
      note: start.note ?? '',
    });
  }

  return derived;
}

/** Escape free text for one markdown table cell (as `IndexGenerator.cell`). */
function phaseLogCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\s*\n+\s*/g, ' ').trim();
}

/** One `## Phase log` table row for this spec. */
function serializePhaseRow(spec: string, r: PhaseRow): string {
  return `| ${phaseLogCell(r.date ?? '')} | ${phaseLogCell(spec)} | ${phaseLogCell(r.phase)} `
    + `| ${phaseLogCell(r.state)} | ${phaseLogCell(r.result)} | ${phaseLogCell(r.note)} |`;
}

/**
 * Rewrite only the `## Phase log` block: keep every existing data row verbatim
 * (other specs' rows and this spec's pre-ledger rows), then append the derived
 * rows. The routing header and the `## <spec> — <stage>` sections are untouched.
 * When the block is absent it is created before the first `## ` section (else at
 * end), so the sections stay after it (`formats.md:80-81`).
 */
function rewriteHandoffPhaseLog(handoff: string, spec: string, derived: PhaseRow[]): string {
  const lines = handoff.split('\n');

  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === PHASE_LOG_HEADING) { start = i; break; }
  }

  // The block runs from its heading to the next `## ` heading (exclusive) or EOF.
  let end = lines.length;
  if (start !== -1) {
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].startsWith('## ')) { end = i; break; }
    }
  }

  // Existing data rows (all specs) inside the old block, kept verbatim in order.
  const existingRaw: string[] = [];
  if (start !== -1) {
    for (let i = start + 1; i < end; i++) {
      const line = lines[i];
      if (!line.startsWith('|')) continue;
      const cells = line.split('|').slice(1, -1).map(c => c.trim());
      if (cells.length < 6 || cells[0] === 'Date' || cells[0].startsWith('---')) continue;
      existingRaw.push(line);
    }
  }

  const block = [
    PHASE_LOG_HEADING,
    '',
    PHASE_LOG_HEADER,
    PHASE_LOG_SEPARATOR,
    ...existingRaw,
    ...derived.map(r => serializePhaseRow(spec, r)),
  ];

  let out: string[];
  if (start !== -1) {
    out = [...lines.slice(0, start), ...block];
    if (end < lines.length) out.push('');
    out.push(...lines.slice(end));
  } else {
    // No block yet: insert before the first `## ` section, else append at end.
    let h = lines.findIndex(l => l.startsWith('## '));
    if (h === -1) h = lines.length;
    const before = lines.slice(0, h);
    const after = lines.slice(h);
    const lead = before.length > 0 && before[before.length - 1].trim() !== '' ? [''] : [];
    const tail = after.length > 0 ? ['', ...after] : [];
    out = [...before, ...lead, ...block, ...tail];
  }

  let text = out.join('\n');
  if (!text.endsWith('\n')) text += '\n';
  return text;
}

// --- gate --------------------------------------------------------------------

/**
 * `gate` action (design Component 2): the server surface both human gates'
 * payloads cross. One action, four ops. `class-a` computes the gate-B class (a)
 * veto items; `put`/`get`/`delete` manage the `specs/<spec>/gate-<slot>.json`
 * payload file through `PathUtils.safeJoin`, reusing the `briefAction` write
 * pattern (`selectRoots`, `mkdir`+`writeFile`). It reads only the spec store and
 * spawns no process.
 */
async function gateAction(args: any, context: ToolContext): Promise<ToolResponse> {
  const { op } = args;

  if (op === 'class-a') {
    return gateClassA(args, context);
  }

  if (op !== 'put' && op !== 'get' && op !== 'delete') {
    return { success: false, message: `gate: unknown op '${op}'. Use 'class-a', 'put', 'get', or 'delete'.` };
  }

  // put/get/delete address one payload file; slot is `a` or `b` only.
  const { specName, slot } = args;
  if (slot !== 'a' && slot !== 'b') {
    return { success: false, message: `gate ${op}: slot is required and must be 'a' or 'b'` };
  }

  const { workflowRoot } = selectRoots(args, context);
  const specDir = PathUtils.getSpecPath(workflowRoot, specName);
  const gatePath = PathUtils.safeJoin(specDir, `gate-${slot}.json`);

  if (op === 'put') {
    // A missing or non-object payload fails naming it and writes nothing — the
    // same fail-fast shape as briefAction's missing-value guard (Error Handling 6).
    const { payload } = args;
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return { success: false, message: `gate put: required argument 'payload' (an object) is missing; no file written` };
    }
    try {
      await mkdir(dirname(gatePath), { recursive: true });
      await writeFile(gatePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to write ${gatePath}: ${message}` };
    }
    return { success: true, message: `gate put slot=${slot} → ${gatePath}`, data: { path: gatePath } };
  }

  if (op === 'get') {
    // ENOENT ⇒ `present: false`, so the supervisor sees an empty surface without
    // failing (design Component 2, Error Handling 4).
    let raw: string;
    try {
      raw = await readFile(gatePath, 'utf-8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
        return { success: true, message: `gate get slot=${slot}: present=false`, data: { present: false, payload: null } };
      }
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to read ${gatePath}: ${message}` };
    }
    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `gate get slot=${slot}: ${gatePath} is not valid JSON: ${message}` };
    }
    return { success: true, message: `gate get slot=${slot}: present=true`, data: { present: true, payload } };
  }

  // op === 'delete': ENOENT is a no-op success (Req 5 AC 6).
  try {
    await unlink(gatePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return { success: true, message: `gate delete slot=${slot}: nothing to remove`, data: { removed: false } };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to delete ${gatePath}: ${message}` };
  }
  return { success: true, message: `gate delete slot=${slot} → removed`, data: { removed: true } };
}

/**
 * `gate class-a` op: build one `TaskVetoInput` per parsed task from `tasks.md`
 * (header rows included, absent `files` coalesced to `[]`, `block` from a second
 * `taskBlock` call, design Component 2 resolving R2-5), read the `## Sensitive
 * paths` list from `agent-rules.md` at the spec-store root (ENOENT or no heading
 * gives `null`, mirroring `src/tools/review-gate.ts:177-194`), and return
 * `computeClassA` (task 1). Read-only.
 */
async function gateClassA(args: any, context: ToolContext): Promise<ToolResponse> {
  const { specName } = args;
  const { workflowRoot } = selectRoots(args, context);
  const specDir = PathUtils.getSpecPath(workflowRoot, specName);

  // tasks.md is required for a class-(a) computation; a missing one is an error.
  const tasksPath = PathUtils.safeJoin(specDir, 'tasks.md');
  let tasksContent: string;
  try {
    tasksContent = await readFile(tasksPath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to read ${tasksPath}: ${message}` };
  }

  // One TaskVetoInput per parsed task, header rows included, files coalesced to
  // [] when the task declares none, block from a second taskBlock call.
  const parsed = parseTasksFromMarkdown(tasksContent);
  const tasks: TaskVetoInput[] = parsed.tasks.map((t) => ({
    id: t.id,
    title: t.description,
    files: t.files ?? [],
    block: taskBlock(tasksContent, t.id) ?? '',
  }));

  // The `## Sensitive paths` list from agent-rules.md at the spec-store root;
  // ENOENT gives null, which computeClassA reads as no path match (Req 4 AC 5).
  const specStoreRoot = PathUtils.getWorkflowRoot(workflowRoot);
  const agentRulesPath = PathUtils.safeJoin(specStoreRoot, 'agent-rules.md');
  let sensitive: string[] | null = null;
  try {
    const agentRules = await readFile(agentRulesPath, 'utf-8');
    sensitive = parseSensitivePaths(agentRules);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to read ${agentRulesPath}: ${message}` };
    }
    sensitive = null;
  }

  const items = computeClassA(tasks, sensitive);
  return {
    success: true,
    message: `gate class-a: ${items.length} item(s) from ${tasks.length} task(s)`,
    data: { items },
  };
}

// --- usage --------------------------------------------------------------------

/**
 * Read one spec's ledger events under the spec store (design Component 6). The
 * spec dir must exist — a missing one is an error naming the path — and a missing
 * `harness-events.jsonl` is an empty ledger, the same read pattern `phase-log`
 * uses (`:664-683`). A `safeJoin` throw (a traversing spec name) is caught and
 * returned as the error naming the path (design Error Handling 6).
 */
async function readSpecLedger(
  workflowRoot: string, specName: string,
): Promise<{ events: LedgerEvent[] } | { error: string }> {
  let specDir: string;
  let ledgerPath: string;
  try {
    specDir = PathUtils.getSpecPath(workflowRoot, specName);
    ledgerPath = PathUtils.safeJoin(specDir, 'harness-events.jsonl');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Failed to resolve ledger for ${specName}: ${message}` };
  }

  // The spec directory must exist; a missing one is an error naming the path.
  try {
    const s = await stat(specDir);
    if (!s.isDirectory()) throw new Error('not a directory');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Failed to read ${specDir}: ${message}` };
  }

  // The spec's ledger; a missing file is an empty ledger (Req 5.8).
  let ledgerText: string | undefined;
  try {
    ledgerText = await readFile(ledgerPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      const message = err instanceof Error ? err.message : String(err);
      return { error: `Failed to read ${ledgerPath}: ${message}` };
    }
    ledgerText = undefined;
  }

  return { events: parseJsonl<LedgerEvent>(ledgerText) };
}

/**
 * `usage` action (design Component 6): fold one spec's ledger into the
 * tokens-and-spawns-by-phase report, or two specs into a side-by-side table with
 * a per-phase delta when `compareSpecName` is given (Req 5.7). Read-only; spawns
 * no process. `compare` and `delta` sit on `data` only for two specs.
 */
async function usageAction(args: any, context: ToolContext): Promise<ToolResponse> {
  const { specName, compareSpecName } = args;
  const { workflowRoot } = selectRoots(args, context);

  const primary = await readSpecLedger(workflowRoot, specName);
  if ('error' in primary) return { success: false, message: primary.error };
  const report = buildUsageReport(primary.events, specName);

  if (typeof compareSpecName === 'string' && compareSpecName.length > 0) {
    const second = await readSpecLedger(workflowRoot, compareSpecName);
    if ('error' in second) return { success: false, message: second.error };
    const compare = buildUsageReport(second.events, compareSpecName);
    const delta = usageDelta(report, compare);
    return {
      success: true,
      message: formatUsageTable(report, compare),
      data: { report, compare, delta },
    };
  }

  return { success: true, message: formatUsageTable(report), data: { report } };
}
