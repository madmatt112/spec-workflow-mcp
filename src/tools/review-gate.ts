/**
 * `handleGate` — the deterministic review gate (design Component 2, requirements
 * 1.2-1.8, 4.5, 5.1, 5.2, 7.2).
 *
 * One handler drives the range-statistics function (task 2), the two
 * pre-computations, the sequential check runner (task 3), the pure rules module
 * (task 4) and `TaskReviewManager`, then shapes one response for a task gate and
 * an item gate. Task 6 wires it into the `review-task` dispatch; the tests call
 * it directly (bridge).
 *
 * The `review-task ↔ review-gate` import (its unwrap helpers and the methodology
 * state function) is a call-time-only cycle, benign by D13.
 */
import path from 'node:path';
import { promises as fs, existsSync } from 'node:fs';
import { ToolContext, ToolResponse } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { parseTasksFromMarkdown } from '../core/task-parser.js';
import { ImplementationLogManager } from '../dashboard/implementation-log-manager.js';
import { TaskReviewManager } from '../core/task-review-manager.js';
import { loadSettings, isTypecheckEnabled } from '../core/adversarial-settings.js';
import {
  runProjectTypecheck,
  type TypecheckDiagnostic,
} from '../core/typecheck.js';
import { computeHygieneSignals, type HygieneSignal } from '../core/hygiene-signals.js';
import { computeRangeStats, type RangeSelector } from '../core/task-diff.js';
import { runChecks, type CheckResult } from '../core/check-runner.js';
import {
  parseSensitivePaths,
  parseGeneratedPaths,
  isGeneratedPath,
  taskBlock,
  scoreRisk,
  decideGate,
  truncateLine,
  worstTypecheckState,
  MAX_TOUCHED_LISTED,
} from '../core/gate-rules.js';
import {
  computeTypecheckMethodologyState,
  unwrapTypecheck,
  unwrapHygiene,
  type TypecheckMethodologyState,
} from './review-task.js';

/** Tool input for `action: 'gate'` (design Data Models). */
export type GateArgs = {
  baseRef?: string;
  commit?: string;
  checks?: string[];
  files?: string[];
  root?: string;
  projectPath?: string;
};

type HygienePattern = HygieneSignal['pattern'];

/** Response `data` for a gate call (design Data Models). No diff body (1.7). */
export type GateData = {
  gate: 'pass' | 'fail';
  risk: 'low' | 'medium' | 'high';
  reasons: string[];
  checks: CheckResult[];
  stats: { filesChanged: number; linesAdded: number; linesRemoved: number } | null;
  touched: { paths: string[]; total: number };
  typecheck: TypecheckMethodologyState | { kind: 'skipped' };
  hygiene: Partial<Record<HygienePattern, number>>;
  recorded: { reviewId: string; version: number } | null;
};

/** Counts of hygiene signals by pattern, bounded to the four patterns (D27). */
function hygieneCounts(signals: HygieneSignal[]): Partial<Record<HygienePattern, number>> {
  const counts: Partial<Record<HygienePattern, number>> = {};
  for (const s of signals) {
    counts[s.pattern] = (counts[s.pattern] ?? 0) + 1;
  }
  return counts;
}

/** The recorded review's one-line summary (D28). */
function recordedSummary(
  stats: { filesChanged: number; linesAdded: number; linesRemoved: number },
  checks: CheckResult[],
  typecheckKind: string,
  hygiene: Partial<Record<HygienePattern, number>>,
  risk: 'low' | 'medium',
): string {
  const passed = checks.filter((c) => c.status === 'pass').length;
  return (
    `gate pass, risk ${risk}: ${stats.filesChanged} files, +${stats.linesAdded}/-${stats.linesRemoved}; ` +
    `checks ${passed}/${checks.length} pass; typecheck ${typecheckKind}; ` +
    `hygiene console ${hygiene.console ?? 0} todo ${hygiene.todo ?? 0} fixme ${hygiene.fixme ?? 0}`
  );
}

/**
 * A documentation path: a Markdown/MDX file, or anything under a `docs/`
 * directory (retro P7). A change whose whole file set is docs is down-ranked so
 * the per-task verifier is skipped and CI is the net.
 */
function isDocPath(relPath: string): boolean {
  const p = relPath.replace(/\\/g, '/').replace(/^\.\//, '').trim();
  if (p.endsWith('.md') || p.endsWith('.mdx')) return true;
  return p === 'docs' || p.startsWith('docs/') || p.includes('/docs/');
}

/** `nextSteps` by outcome; the skills route on `gate`/`risk`, this is guidance. */
function gateNextSteps(gate: 'pass' | 'fail', risk: 'low' | 'medium' | 'high'): string[] {
  if (gate === 'fail') {
    return ['Address the gate reasons, then run the gate again.'];
  }
  if (risk === 'high') {
    return ['Risk is high; spawn sdd-verifier with the gate results.'];
  }
  if (risk === 'medium') {
    return ['Risk is medium (no product code — docs-only, generated-only, or spec-store-only); the verifier is skipped and CI is the net. The gate recorded the review; mark the task complete.'];
  }
  return ['Risk is low; the gate recorded the review. Mark the task complete.'];
}

/**
 * Run the review gate end to end for a task or a close-out item and shape one
 * response (design Component 2). The tests call this directly; task 6 adds the
 * `gate` dispatch case.
 */
export async function handleGate(
  args: GateArgs,
  specPath: string,
  specName: string,
  taskId: string,
  /** Shared workflow root — the directory that contains `.spec-workflow`. */
  workflowRoot: string,
  workspacePath: string,
  context: ToolContext,
): Promise<ToolResponse> {
  try {
    const { baseRef, commit, files } = args;

    // Step 1: resolve `root`; it must be an absolute, existing directory (1.8).
    const root = args.root ?? workspacePath;
    if (!path.isAbsolute(root)) {
      return { success: false, message: `root is not an absolute path: ${root}` };
    }
    try {
      const st = await fs.stat(root);
      if (!st.isDirectory()) {
        return { success: false, message: `root is not a directory: ${root}` };
      }
    } catch {
      return { success: false, message: `root is not a directory: ${root}` };
    }

    // Step 2: task or item mode. A missing tasks.md is an empty task list (D25).
    let tasksContent = '';
    try {
      tasksContent = await fs.readFile(`${specPath}/tasks.md`, 'utf-8');
    } catch {
      tasksContent = '';
    }
    const task = parseTasksFromMarkdown(tasksContent).tasks.find((t) => t.id === taskId);

    const hasCommit = typeof commit === 'string' && commit.length > 0;
    const hasFiles = Array.isArray(files) && files.length > 0;

    let mode: 'task' | 'item';
    if (task) {
      mode = 'task';
      const logManager = new ImplementationLogManager(specPath);
      const taskLogs = await logManager.getTaskLogs(taskId);
      if (taskLogs.length === 0) {
        return {
          success: false,
          message: `No implementation log found for task '${taskId}'. Must call log-implementation before review-task.`,
          nextSteps: ['Call log-implementation to record what was implemented', 'Then run the gate again'],
        };
      }
    } else {
      mode = 'item';
      if (!hasCommit && !hasFiles) {
        return {
          success: false,
          message: `Task '${taskId}' not found; an item gate needs a commit or files.`,
        };
      }
    }

    // Step 3: files-only detection (D23, R1-2). A task-mode `files`-only call
    // still takes the git path.
    const filesOnly = mode === 'item' && !hasCommit && !baseRef && hasFiles;

    // Step 4: the machine-read sensitive-path list. ENOENT ⇒ every path is
    // sensitive (`null`); any other read error is a hard failure (2.1-2.4, 1.8).
    let sensitive: string[] | null = null;
    let generated: string[] | null = null;
    const agentRulesPath = path.join(PathUtils.getWorkflowRoot(workflowRoot), 'agent-rules.md');
    try {
      const agentRules = await fs.readFile(agentRulesPath, 'utf-8');
      sensitive = parseSensitivePaths(agentRules);
      generated = parseGeneratedPaths(agentRules);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
        sensitive = null;
        generated = null;
      } else {
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, message: `Failed to read agent-rules.md: ${message}` };
      }
    }

    let touched: string[];
    let untracked: string[] = [];
    let stats: { filesChanged: number; linesAdded: number; linesRemoved: number } | null;
    let perFile: Record<string, number> = {};
    let trivialChange = false;
    let missing: string[] = [];
    let diagnostics: TypecheckDiagnostic[] = [];
    let hygieneSignals: HygieneSignal[] = [];
    let hygieneRejection: string | null = null;
    let typecheckState: TypecheckMethodologyState | { kind: 'skipped' };

    if (!filesOnly) {
      // Step 5: git path. Range, stats and the two pre-computations.
      const range: RangeSelector = commit ? { commit } : { baseRef: baseRef ?? 'HEAD' };
      // Git revisions the hygiene scan diffs for added lines (retro P6): a single
      // commit against its first parent, else the baseRef against the work tree.
      const hygieneBase = commit ? [`${commit}^`, commit] : [baseRef ?? 'HEAD'];
      const rangeResult = await computeRangeStats(root, range);
      if (!rangeResult.ok) {
        return { success: false, message: rangeResult.message };
      }
      stats = rangeResult.stats;
      touched = rangeResult.touched;
      untracked = rangeResult.untracked;
      perFile = rangeResult.perFile;
      // Trivial-change fast path (retro P14): when files changed but the diff has
      // no semantic content (a whitespace-only re-indent or a no-op), a second
      // range stat that ignores whitespace reports zero changed lines. A new,
      // untracked file still adds its newline count, so it never reads as trivial.
      if (touched.length > 0) {
        const wsResult = await computeRangeStats(root, range, { ignoreWhitespace: true });
        trivialChange = wsResult.ok && wsResult.stats.linesAdded + wsResult.stats.linesRemoved === 0;
      }
      const touchedAbs = touched.map((p) => path.join(root, p));
      // Generated paths (agent-rules `## Generated paths`) stay in `touched` but
      // are not scanned for hygiene signals (retro P2).
      const hygieneTargets = generated
        ? touched.filter((p) => !isGeneratedPath(p, generated!)).map((p) => path.join(root, p))
        : touchedAbs;

      const enabled = isTypecheckEnabled(loadSettings(workflowRoot));
      const settled = await Promise.allSettled([
        runProjectTypecheck(root, workflowRoot, touchedAbs, { enabled }),
        computeHygieneSignals(hygieneTargets, { root, base: hygieneBase }),

      ]);
      const typecheckResults = unwrapTypecheck(settled[0], root);
      const hygieneResult = unwrapHygiene(settled[1]);
      hygieneSignals = hygieneResult.signals;
      hygieneRejection = hygieneResult.rejection ? hygieneResult.rejection.message : null;
      diagnostics = typecheckResults.flatMap((r) => (r.status === 'success' ? r.diagnostics : []));
      typecheckState = worstTypecheckState(typecheckResults.map(computeTypecheckMethodologyState));
    } else {
      // Step 6: files-only path. No git, no pre-computations (1.3).
      touched = files as string[];
      missing = touched.filter((p) => !existsSync(path.join(root, p)));
      stats = null;
      typecheckState = { kind: 'skipped' };
    }

    // Step 7: run the caller's checks in order, after the range and the
    // pre-computations.
    const checks = await runChecks(root, args.checks ?? []);

    // Step 8: verdict and risk over the whole touched list, then truncate.
    const gateFiles = hasFiles ? (files as string[]) : null;
    const verdict = decideGate({
      checks,
      diagnostics,
      hygiene: hygieneSignals,
      touched,
      files: gateFiles,
      generated,
      untracked,
      missing,
      filesOnly,
    });
    const scored = filesOnly
      ? { risk: 'low' as const, reasons: [] as string[] }
      : scoreRisk({
          mode,
          sensitive,
          touched,
          stats,
          perFile,
          generated,
          block: mode === 'task' && task ? taskBlock(tasksContent, task.lineNumber) : '',
          rangeGiven: !!(baseRef || hasCommit || hasFiles),
          typecheck: typecheckState,
          hygieneRejection,
          trivialChange,
        });
    // Step 8b: down-rank a change with no product code from high to medium (retro
    // P7 docs-only; retro P10 generated-only and spec-store-only). A change is
    // "no product code" when it touched no path under the code root at all
    // (spec-store-only), or every touched path is documentation (*.md, *.mdx,
    // docs/**), or every touched path is a generated artifact (`## Generated
    // paths`). There is nothing the per-task verifier could judge, so it is
    // skipped and CI is the net; any other touched path keeps it high. Medium
    // still requires the log — the gate already refuses a task with no log above.
    let risk: { risk: 'low' | 'medium' | 'high'; reasons: string[] } = scored;
    if (scored.risk === 'high') {
      let downrank: string | null = null;
      if (touched.length === 0) {
        downrank = 'no-product-code: the change touched no path under the code root; verifier skipped, CI is the net';
      } else if (touched.every(isDocPath)) {
        downrank = 'docs-only: every touched path is documentation; verifier skipped, CI is the net';
      } else if (generated !== null && touched.every((p) => isGeneratedPath(p, generated))) {
        downrank = 'generated-only: every touched path is a generated artifact; verifier skipped, CI is the net';
      }
      if (downrank !== null) {
        risk = { risk: 'medium', reasons: [downrank, ...scored.reasons] };
      }
    }

    const reasons = [...verdict.reasons, ...risk.reasons].map(truncateLine);

    // Step 9: record a `reviewer: gate` review for a task-mode pass at low or the
    // docs-only medium down-rank (retro P7); both skip the verifier and the gate
    // stands as the review. No prepare marker is written or checked (5.1).
    const hygiene = filesOnly ? {} : hygieneCounts(hygieneSignals);
    let recorded: { reviewId: string; version: number } | null = null;
    if (mode === 'task' && verdict.gate === 'pass' && risk.risk !== 'high' && stats) {
      const reviewManager = new TaskReviewManager(specPath);
      const review = await reviewManager.saveReview({
        taskId,
        specName,
        verdict: 'pass',
        summary: recordedSummary(stats, checks, typecheckState.kind, hygiene, risk.risk),
        findings: [],
        reviewer: 'gate',
      });
      recorded = { reviewId: review.id, version: review.version };
    }

    // Step 10: the response. `data.touched.paths` is cut to 100 for display only,
    // after every rule saw the whole list (R4-1).
    const data: GateData = {
      gate: verdict.gate,
      risk: risk.risk,
      reasons,
      checks,
      stats,
      touched: { paths: touched.slice(0, MAX_TOUCHED_LISTED), total: touched.length },
      typecheck: typecheckState,
      hygiene,
      recorded,
    };

    return {
      success: true,
      message: `Gate ${verdict.gate} for ${mode === 'task' ? `task` : `item`} '${taskId}': risk ${risk.risk}.`,
      data,
      nextSteps: gateNextSteps(verdict.gate, risk.risk),
      projectContext: {
        projectPath: workflowRoot,
        workflowRoot: PathUtils.getWorkflowRoot(workflowRoot),
        specName,
        dashboardUrl: context.dashboardUrl,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Failed to run gate: ${message}` };
  }
}
