import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { readFile, readdir, stat, writeFile, mkdir } from 'node:fs/promises';
import { dirname, basename, resolve } from 'node:path';
import { PathUtils } from '../core/path-utils.js';
import { selectRoots } from './root-selection.js';
import { SpecParser } from '../core/parser.js';
import { parseTasksFromMarkdown, taskBlock } from '../core/task-parser.js';
import { deriveSpecStatus } from '../core/spec-status-deriver.js';
import { deriveDocumentApprovalStates } from '../core/approval-records.js';

/**
 * The `harness` tool (design Components 1-4). One tool, three actions:
 * `orient` returns the Step 0 state and the next step the SDD orchestrator
 * skills compute by hand today; `brief` writes a worker brief from a named
 * template; `phase-log` regenerates the HANDOFF `## Phase log` rows. It reads
 * only under the resolved spec store through `PathUtils.safeJoin` (the pattern
 * `spec-lint` uses) and spawns no child process. `brief` fills a named
 * server template and writes the worker brief; `phase-log` lands in a later
 * task and returns a not-implemented `success:false`.
 */
export const harnessTool: Tool = {
  name: 'harness',
  description: `SDD harness bookkeeping: orient, brief and phase-log for the orchestrator skills.

# Instructions
Call \`orient\` at Step 0 to get the routing state and the next step for a spec and phase
in one call, instead of reading many files by hand. For a document phase (requirements,
design, tasks) it returns the document version D, the latest analysis index A with its
verdict, the post-cap marker P, whether the latest analysis is the narrow check, and the
next step. For \`implementation\` it returns the task counts and the next step; for
\`closeout\` the plan item counts, the open items by target class, and the next step. The
tool reads only the spec store; it never spawns a process.`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['orient', 'brief', 'phase-log'],
        description: 'Which harness action to run',
      },
      specName: {
        type: 'string',
        description: 'Name of the specification (kebab-case)',
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
      // Bridge: task 4 implements the phase-log action.
      return { success: false, message: 'harness action `phase-log` is not yet implemented' };
    default:
      return { success: false, message: `Unknown action: ${action}. Use 'orient', 'brief', or 'phase-log'.` };
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
  const hay = `${target} ${decision}`;

  if (/\bnone\b|human action|ratified|closed|no change/.test(hay)) return 'none';
  if (/agent-rules|steering|\brules?\b|decomposition|spec[ -]?store|\bstore\b/.test(hay)) return 'store';
  if (/harness|skill|\bagents?\b|hook|server|\bdocs?\b|template/.test(hay)) return 'harness';
  if (/memory|claude\.md|settings|~\/\.claude/.test(hay)) return 'home';
  if (/\bcode\b|checkout|\brepo\b|src\//.test(hay)) return 'code';
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

  // Every remaining {{key}} must have a caller value, else fail naming it (2.3).
  const keys = new Set((body.match(/\{\{(\w+)\}\}/g) ?? []).map((p) => p.slice(2, -2)));
  for (const key of keys) {
    if (SERVER_BRIEF_KEYS.has(key)) continue;
    if (values[key] === undefined || values[key] === null) {
      return { success: false, message: `brief: required value '${key}' is missing; no file written` };
    }
  }

  const filled = body.replace(/\{\{(\w+)\}\}/g, (_full, key: string) =>
    key in serverValues ? serverValues[key] : String(values[key]),
  );

  // Write through safeJoin under the caller-named directory; return the path.
  const finalPath = PathUtils.safeJoin(dirname(outPath), basename(outPath));
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
