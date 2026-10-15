// src/controller/phases/retrospective.ts
//
// Step (c3), first half (docs/foundation-review.md §6, docs/controller-design.md
// §5 "Retrospective and close-out", docs/controller-tasks.md T13). The
// retrospective in code: the preconditions, the compile step (judgement and
// prose: the findings file), the analyst step (the proposals file), the checks
// on both files, the commit, the retro-log entry and the phase rows. The rule
// source is `harness/skills/sdd-retrospective/SKILL.md` and its
// `references/formats.md`. What follows the phase is the controller's existing
// `retro-plan` wait (runs.ts): the proposals file is what routing reads, so this
// phase never writes a DRAFT plan.
import { randomUUID, createHash } from 'crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { runStep, loadRole, type StepResult, type StepSpec, type RateLimitWindows } from '../step.js';
import { type RunRecord, withStoreLock } from '../state.js';
import { commitSpecStore, type RunLedger, type Serialize } from '../ledger.js';
import { harnessHandler } from '../../tools/harness.js';
import { parseTasksFromMarkdown } from '../../core/task-parser.js';
import { parseJsonl } from '../../watch/ledger.js';
import { PathUtils } from '../../core/path-utils.js';
import { handoffPath } from '../../watch/index.js';
import { scrubbedGitEnv } from '../../core/git-utils.js';
import type { ToolContext } from '../../types.js';

const TURN_CAP: Record<string, number> = { 'sdd-retro-compiler': 150, 'sdd-retro-analyst': 100 };

export interface RetrospectivePhaseContext {
  run: RunRecord;
  specStoreRoot: string;
  specDir: string;
  /** The run's worktree (the code the findings cite). */
  codeRoot: string;
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
  serialize?: Serialize;
  now?: () => Date;
  shouldStop?: () => string | null;
  scratchDir?: string;
}

export interface RetrospectivePhaseOutcome {
  /** `retro-ready`: both files exist and are committed; the retro-plan wait follows. */
  result: 'retro-ready' | 'error' | 'stopped';
  reason?: string;
  findings?: number;
  proposals?: number;
  decisionsNeeded?: number;
}

const COMPILE_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['findings', 'path'],
  properties: {
    findings: { type: 'number' },
    categories: { type: 'string' },
    words: { type: 'number' },
    path: { type: 'string' },
  },
} as const;

const ANALYST_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['proposals'],
  properties: {
    proposals: { type: 'number' },
    decisions: { type: 'number' },
    graduation: { type: 'number' },
  },
} as const;

/** `- **F<n>` bullets in the findings file; `- **P<n>` in the proposals file. */
function countBullets(text: string, letter: 'F' | 'P' | 'G'): number {
  return (text.match(new RegExp(`^- \\*\\*${letter}\\d+`, 'gm')) ?? []).length;
}

export async function runRetrospectivePhase(ctx: RetrospectivePhaseContext): Promise<RetrospectivePhaseOutcome> {
  const specName = ctx.run.spec;
  const phase = 'retrospective';
  const workflowRoot = PathUtils.getWorkflowRoot(ctx.specStoreRoot);
  const toolContext: ToolContext = { projectPath: ctx.specStoreRoot, workspacePath: ctx.codeRoot };
  const serialize: Serialize = ctx.serialize ?? ((fn) => withStoreLock(ctx.specStoreRoot, fn));
  const now = ctx.now ?? (() => new Date());
  const scratch = ctx.scratchDir ?? join('/tmp/scratchpad/sdd', specName);
  mkdirSync(scratch, { recursive: true });
  const findingsPath = join(ctx.specDir, 'retrospective.md');
  const proposalsPath = join(ctx.specDir, 'retrospective-proposals.md');
  const retroLogPath = join(ctx.specDir, 'retrospective-log.md');

  const ledgerRows = (): Record<string, string>[] => {
    let text: string;
    try { text = readFileSync(ctx.ledger.path, 'utf-8'); } catch { return []; }
    return parseJsonl<Record<string, string>>(text).filter((r) => r.run === ctx.run.id);
  };

  const counts = (): { findings: number; proposals: number; decisionsNeeded: number } => {
    const f = existsSync(findingsPath) ? readFileSync(findingsPath, 'utf-8') : '';
    const p = existsSync(proposalsPath) ? readFileSync(proposalsPath, 'utf-8') : '';
    return {
      findings: countBullets(f, 'F'),
      proposals: countBullets(p, 'P'),
      decisionsNeeded: (p.match(/DECISION NEEDED:\s*yes/gi) ?? []).length,
    };
  };

  // Idempotent completion: this run already reported retro-ready.
  const phaseRows = ledgerRows().filter((r) => r.phase === phase && (r.type === 'phase.start' || r.type === 'phase.end'));
  const last = phaseRows[phaseRows.length - 1];
  if (last && last.type === 'phase.end' && last.result === 'retro-ready' && existsSync(proposalsPath)) {
    return { result: 'retro-ready', ...counts() };
  }
  if (!last || last.type === 'phase.end') ctx.ledger.phaseStart(phase, { mode: 'normal' });

  const fail = async (reason: string): Promise<RetrospectivePhaseOutcome> => {
    ctx.ledger.phaseEnd(phase, { result: 'error', note: reason });
    await harnessHandler({ action: 'phase-log', specName }, toolContext);
    return { result: 'error', reason };
  };

  // --- Step 0: preconditions (SKILL.md Step 0) -------------------------------
  // The spec is complete when no task is open and the implementation phase ended
  // on `complete` (the routing rule); a spec with no retro log was built before
  // the harness and gets the one-section findings file the skill writes.
  const tasksText = existsSync(join(ctx.specDir, 'tasks.md')) ? readFileSync(join(ctx.specDir, 'tasks.md'), 'utf-8') : '';
  const tp = parseTasksFromMarkdown(tasksText).summary;
  if (tp.pending > 0 || tp.inProgress > 0) {
    return fail(`spec not complete (${tp.pending} open, ${tp.inProgress} in progress)`);
  }
  if (!existsSync(retroLogPath)) {
    writeFileSync(findingsPath, [
      `# Retrospective — ${specName}`, '',
      `Compiled ${now().toISOString().slice(0, 10)} by the controller.`, '',
      '## No harness log', '',
      'This spec has no `retrospective-log.md`: it was built before the harness kept one, so there are no findings to compile and no analyst runs.', '',
    ].join('\n'), 'utf-8');
    return fail('no retrospective log');
  }

  // --- a model step: spawn rows plus the classified result --------------------
  const runModelStep = async (opts: { role: string; label: string; briefPath: string; stepId: string; schema: Record<string, unknown> }):
    Promise<{ result: StepResult; error?: RetrospectivePhaseOutcome }> => {
    const profile = loadRole(opts.role);
    ctx.ledger.spawnStart({ agent: opts.role, role: opts.label, model: profile.model, effort: profile.effort });
    let spawnWrite: Promise<void> | void = undefined;
    const spec: StepSpec = {
      role: opts.role, briefPath: opts.briefPath, worktree: ctx.codeRoot,
      logPath: join(ctx.stepLogDir, `${opts.stepId}.jsonl`), maxTurns: TURN_CAP[opts.role] ?? 100,
      sessionId: randomUUID(), mcpConfig: ctx.mcpConfig, schema: opts.schema,
      runId: ctx.run.id, stepId: opts.stepId, workspace: ctx.codeRoot, sharedRoot: ctx.specStoreRoot,
      onActivity: (a) => ctx.onStepActivity?.({ stepId: opts.stepId, role: opts.role, tool: a.tool, inputSummary: a.inputSummary, ts: a.ts }),
      onRateLimit: ctx.onRateLimit,
      onSpawn: (pid, startTime) => { spawnWrite = ctx.onStepSpawn?.({ id: opts.stepId, pid, startTime }); },
    };
    const result = await runStep(spec);
    // Both record writes land before the result is acted on, so a status the
    // caller writes next is never overwritten by a late in-flight update.
    await spawnWrite;
    await ctx.onStepEnd?.(opts.stepId);
    ctx.ledger.spawnEnd({ agent: opts.role, model: profile.model, usage: result.usage });
    ctx.ledger.spawnUsage({ agent: opts.role, role: opts.label, result: result.classification === 'ok' ? 'ok' : result.classification, phase });
    if (result.classification !== 'ok') return { result, error: { result: 'error', reason: result.classification } };
    return { result };
  };

  const brief = async (template: string, path: string, values: Record<string, string>): Promise<string> => {
    const res = await harnessHandler({ action: 'brief', template, specName, values: { ...values, path } }, toolContext);
    if (!res.success) throw new Error(`brief ${template} failed: ${res.message}`);
    return (res.data as { path: string }).path;
  };

  const git = (cwd: string, args: string[]): string | undefined => {
    try {
      return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf-8', env: scrubbedGitEnv(), stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch {
      return undefined;
    }
  };

  // --- Step 1: compile the findings (a step; skipped on re-entry when the file exists) ---
  if (!existsSync(findingsPath)) {
    const halt = ctx.shouldStop?.();
    if (halt) return { result: 'stopped', reason: halt };
    const defaultRef = git(ctx.codeRoot, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD']);
    const defaultBranch = defaultRef ? defaultRef.replace(/^origin\//, '') : 'main';
    let briefPath: string;
    try {
      briefPath = await brief('retro-compile', join(scratch, 'retro-compile-brief.md'), {
        specDir: ctx.specDir, specStoreRoot: workflowRoot, specStoreRepo: ctx.specStoreRoot,
        codeRoot: ctx.codeRoot, mainCheckout: ctx.mainCheckout, outputPath: findingsPath,
        handoff: handoffPath(workflowRoot), date: now().toISOString().slice(0, 10), defaultBranch,
      });
    } catch (err) {
      return fail((err as Error).message);
    }
    const step = await runModelStep({
      role: 'sdd-retro-compiler', label: 'compile findings', briefPath, stepId: 'retro-compile', schema: COMPILE_SCHEMA,
    });
    if (step.error) return step.error.reason === 'usage-limit' ? step.error : fail(step.error.reason ?? 'compile step failed');
    if (!existsSync(findingsPath)) return fail('the compile step wrote no retrospective.md');
    if (!/^## Proposal format/m.test(readFileSync(findingsPath, 'utf-8'))) {
      ctx.ledger.note('retrospective.md lacks the proposal-format block; the analyst brief carries it');
    }
  }

  // --- Step 2: the analyst (a step; skipped on re-entry when the file exists) ---
  if (!existsSync(proposalsPath)) {
    const halt = ctx.shouldStop?.();
    if (halt) return { result: 'stopped', reason: halt };
    let briefPath: string;
    try {
      briefPath = await brief('retro-analyst', join(scratch, 'retro-analyst-brief.md'), {
        findingsPath, outputPath: proposalsPath, specStoreRoot: workflowRoot, codeRoot: ctx.codeRoot,
        date: now().toISOString().slice(0, 10),
      });
    } catch (err) {
      return fail((err as Error).message);
    }
    const step = await runModelStep({
      role: 'sdd-retro-analyst', label: 'proposals', briefPath, stepId: 'retro-analyst', schema: ANALYST_SCHEMA,
    });
    if (step.error) return step.error.reason === 'usage-limit' ? step.error : fail(step.error.reason ?? 'analyst step failed');
    if (!existsSync(proposalsPath)) return fail('the analyst wrote no retrospective-proposals.md');
    const text = readFileSync(proposalsPath, 'utf-8');
    if (!/^## Graduation candidates/m.test(text)) return fail('retrospective-proposals.md does not end with ## Graduation candidates');
    const c = counts();
    if (c.proposals < c.findings) ctx.ledger.note(`retro: ${c.proposals} proposals for ${c.findings} findings`);
  }

  // --- Step 3: the retro-log entry, the phase rows, the commit ----------------
  const c = counts();
  appendRetroEntry(retroLogPath, ctx.run.id, now(), 'retrospective', 'phase', 'cleanup',
    `retrospective compiled: ${c.findings} findings, ${c.proposals} proposals, ${c.decisionsNeeded} decisions needed`,
    'retrospective.md, retrospective-proposals.md', '2 spawns');
  ctx.ledger.phaseEnd(phase, { result: 'retro-ready', note: `${c.findings} findings, ${c.proposals} proposals` });
  await harnessHandler({ action: 'phase-log', specName }, toolContext);
  await commitSpecStore({ specStoreRoot: ctx.specStoreRoot, spec: specName, message: `docs(sdd): ${specName} retrospective findings and proposals` }, serialize);
  return { result: 'retro-ready', ...c };
}

/** One retro-log entry in the formats.md shape, idempotent through the `mark` marker book.sh uses. */
export function appendRetroEntry(
  retroLogPath: string, runId: string, at: Date, stage: string, ref: string, category: string,
  body: string, evidence: string, cost: string,
): void {
  const hash = createHash('sha1').update([stage, ref, category, body].join('|')).digest('hex').slice(0, 8);
  const marker = `mark ${runId} ${hash}`;
  let existing = '';
  try { existing = readFileSync(retroLogPath, 'utf-8'); } catch { existing = ''; }
  if (existing.includes(marker)) return;
  const ts = at.toISOString().replace(/\.\d{3}Z$/, 'Z');
  const entry = `\n## ${ts} · ${stage} · ${ref} · ${category}\n${body}\nEvidence: ${evidence} · ${marker}\nCost: ${cost}\n`;
  writeFileSync(retroLogPath, existing + entry, 'utf-8');
}
