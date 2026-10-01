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
import { ToolContext, ToolResponse, TddArgs, TddBlock } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { parseTasksFromMarkdown } from '../core/task-parser.js';
import { criteria } from '../core/lint-markdown.js';
import {
  proveRedGreen,
  proofReasons,
  type ProofRules,
  type ProofResult,
} from '../core/red-green.js';
import { judgeTdd } from '../core/judge.js';
import { ImplementationLogManager } from '../dashboard/implementation-log-manager.js';
import { TaskReviewManager } from '../core/task-review-manager.js';
import { loadSettings, isTypecheckEnabled } from '../core/adversarial-settings.js';
import {
  runProjectTypecheck,
  type TypecheckDiagnostic,
} from '../core/typecheck.js';
import { computeHygieneSignals, type HygieneSignal } from '../core/hygiene-signals.js';
import { computeRangeStats, listDirtyTrackedFiles, type RangeSelector } from '../core/task-diff.js';
import { runChecks, type CheckResult } from '../core/check-runner.js';
import {
  parseSensitivePaths,
  parseGeneratedPaths,
  parseAgentRuleKey,
  isGeneratedPath,
  isDocPath,
  normalizePath,
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
  tdd?: TddArgs;
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
  /** The proof and judge block; present only when `tdd` was given (Component 8). */
  tdd?: TddBlock;
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
 * The acceptance-criteria texts the task's `_Requirements:` ids name, read from
 * the spec's `requirements.md` with the shared `criteria` reader (Component 8).
 * An id is `<requirement>.<index>`. A missing or unreadable file, or no ids,
 * yields an empty list — the judge input degrades, the gate does not fail.
 */
async function readRequirementCriteria(specPath: string, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  let content: string;
  try {
    content = await fs.readFile(`${specPath}/requirements.md`, 'utf-8');
  } catch {
    return [];
  }
  const wanted = new Set(ids);
  return criteria(content.split('\n'))
    .filter((c) => wanted.has(`${c.requirement}.${c.index}`))
    .map((c) => c.text);
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

    // Component 8 step 1: the tdd argument is a task-only proof. In item mode
    // (which includes files-only) it is refused, and its fields are validated
    // before any git work (4.1, 4.3).
    const tdd = args.tdd;
    if (tdd) {
      if (mode !== 'task') {
        return {
          success: false,
          message: `tdd needs a task: '${taskId}' is not a task in tasks.md`,
        };
      }
      if (!Array.isArray(tdd.testFiles) || tdd.testFiles.length === 0) {
        return { success: false, message: 'tdd.testFiles must be a non-empty array of paths.' };
      }
      if (tdd.testFiles.some((f) => typeof f !== 'string')) {
        return { success: false, message: 'tdd.testFiles entries must be strings.' };
      }
      if (typeof tdd.redCommit !== 'string' || tdd.redCommit.length === 0) {
        return { success: false, message: 'tdd.redCommit must be a non-empty string.' };
      }
    }

    // Step 3: files-only detection (D23, R1-2). A task-mode `files`-only call
    // still takes the git path.
    const filesOnly = mode === 'item' && !hasCommit && !baseRef && hasFiles;

    // Step 4: the machine-read sensitive-path list. ENOENT ⇒ every path is
    // sensitive (`null`); any other read error is a hard failure (2.1-2.4, 1.8).
    let sensitive: string[] | null = null;
    let generated: string[] | null = null;
    // The proof obeys the two agent-rules keys plus `red-on-base` (Component 7);
    // ENOENT leaves this all-null so the base run is skipped as inconclusive.
    let proofRules: ProofRules = { testCommand: null, setupCommand: null, off: false };
    const agentRulesPath = path.join(PathUtils.getWorkflowRoot(workflowRoot), 'agent-rules.md');
    try {
      const agentRules = await fs.readFile(agentRulesPath, 'utf-8');
      sensitive = parseSensitivePaths(agentRules);
      generated = parseGeneratedPaths(agentRules);
      proofRules = {
        testCommand: parseAgentRuleKey(agentRules, 'tdd-test-command'),
        setupCommand: parseAgentRuleKey(agentRules, 'red-on-base-setup'),
        off: parseAgentRuleKey(agentRules, 'red-on-base') === 'off',
      };
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
    let dirtyTracked: string[] = [];
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
      // Tracked files already dirty at base capture (retro P6): in baseRef mode
      // the range diffs the work tree, so a file the implementer never committed
      // shows up though it is not their work. Commit mode ranges only the commit,
      // so working-tree dirt never enters `touched` there and the call is skipped.
      if (!commit) {
        dirtyTracked = await listDirtyTrackedFiles(root);
      }
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

    // Component 8 step 3: the red-on-base proof, the shadow judge and the block.
    // Runs after the checks; only reached in task mode (item mode was refused).
    // `writeLatestTdd` records the sidecar before the review below reads it.
    let proof: { fail: string[]; risk: string[] } = { fail: [], risk: [] };
    let tddBlock: TddBlock | null = null;
    if (tdd && task) {
      const taskTests = task.tests ?? [];
      // Key each seam by the caller's `testFiles` string, matched to the task's
      // `tests[]` through the one path form (carried item R2-1); a path with no
      // matching entry gets no key.
      const seams: Record<string, string> = {};
      for (const tf of tdd.testFiles) {
        const match = taskTests.find((t) => t.path === normalizePath(tf));
        if (match) seams[tf] = match.seam;
      }

      const proofResult: ProofResult = await proveRedGreen(root, tdd, proofRules);
      proof = proofReasons(proofResult);

      // The judge input criteria: the task's `Success` prompt section and the
      // requirement criteria its `_Requirements:` ids name in requirements.md.
      const successCriteria =
        task.promptStructured?.find((s) => s.key === 'Success')?.value ?? '';
      const requirementCriteria = await readRequirementCriteria(
        specPath,
        task.requirements ?? [],
      );
      const cacheDir = path.join(PathUtils.getWorkflowRoot(workflowRoot), '.cache');
      const judged = await judgeTdd(
        {
          redText: proofResult.redText,
          successCriteria,
          requirementCriteria,
          testLines: taskTests,
          base: proofResult.base,
        },
        { cacheDir, env: process.env },
      );

      tddBlock = {
        testFiles: tdd.testFiles,
        seams,
        redCommit: tdd.redCommit,
        baseSha: proofResult.baseSha,
        base: proofResult.base,
        head: proofResult.head,
        amended: proofResult.amended.length > 0,
        judged,
      };
      await new TaskReviewManager(specPath).writeLatestTdd(taskId, tddBlock);
    }

    // Step 8: verdict and risk over the whole touched list, then truncate. When
    // `tdd` was given the author test files count as listed for `file-outside-list`
    // (only when a list was given) and as touched test paths for `tests-not-touched`
    // (only when the range touched something) — no rule body changes (design D4).
    const gateFiles = hasFiles ? (files as string[]) : null;
    const gateFilesWithTdd = tdd && gateFiles ? [...gateFiles, ...tdd.testFiles] : gateFiles;
    const scoredTouched = tdd && touched.length > 0 ? [...touched, ...tdd.testFiles] : touched;
    const verdict = decideGate({
      checks,
      diagnostics,
      hygiene: hygieneSignals,
      touched,
      files: gateFilesWithTdd,
      generated,
      untracked,
      dirtyTracked,
      missing,
      filesOnly,
    });
    const scored = filesOnly
      ? { risk: 'low' as const, reasons: [] as string[] }
      : scoreRisk({
          mode,
          sensitive,
          touched: scoredTouched,
          stats,
          perFile,
          generated,
          untracked,
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
    // Step 8b: a weak proof forces high, but only a `tdd-structural-red` or
    // `tdd-amended` reason counts (design step 6, 5.3). `tdd-inconclusive` is
    // expected on a type-level or pure-function seam — no runnable red-at-base
    // command — so it is neutral and never forces high on its own (retro P3); it
    // stays an informational reason while the sensitive-path, line-count and gate
    // components decide, so a sensitive, gate or data-loss task still scores high
    // through those and keeps its verifier. Otherwise the no-product-code down-rank
    // from high to medium stands (retro P7 docs-only; retro P10 generated-only and
    // spec-store-only): a change is "no product code" when it touched no path under
    // the code root at all (spec-store-only), or every touched path is documentation
    // (*.md, *.mdx, docs/**), or every touched path is a generated artifact
    // (`## Generated paths`). There is nothing the per-task verifier could judge, so
    // it is skipped and CI is the net; any other touched path keeps it high. Medium
    // still requires the log — the gate already refuses a task with no log above.
    const hardProofRisk = proof.risk.filter((r) => !r.startsWith('tdd-inconclusive'));
    const softProofRisk = proof.risk.filter((r) => r.startsWith('tdd-inconclusive'));
    let risk: { risk: 'low' | 'medium' | 'high'; reasons: string[] };
    if (hardProofRisk.length > 0) {
      risk = { risk: 'high', reasons: [...scored.reasons, ...proof.risk] };
    } else if (scored.risk === 'high') {
      let downrank: string | null = null;
      if (touched.length === 0) {
        downrank = 'no-product-code: the change touched no path under the code root; verifier skipped, CI is the net';
      } else if (touched.every(isDocPath)) {
        downrank = 'docs-only: every touched path is documentation; verifier skipped, CI is the net';
      } else if (generated !== null && touched.every((p) => isGeneratedPath(p, generated))) {
        downrank = 'generated-only: every touched path is a generated artifact; verifier skipped, CI is the net';
      }
      risk = downrank !== null
        ? { risk: 'medium', reasons: [downrank, ...scored.reasons, ...softProofRisk] }
        : { risk: 'high', reasons: [...scored.reasons, ...softProofRisk] };
    } else {
      risk = { risk: scored.risk, reasons: [...scored.reasons, ...softProofRisk] };
    }

    // Step 8c: the gate fails when the verdict fails or the proof has fail reasons;
    // the reasons run verdict, proof fail, then risk (design step 5).
    const gateOutcome: 'pass' | 'fail' =
      verdict.gate === 'fail' || proof.fail.length > 0 ? 'fail' : 'pass';
    const reasons = [...verdict.reasons, ...proof.fail, ...risk.reasons].map(truncateLine);

    // Step 9: record a `reviewer: gate` review for a task-mode pass at low or the
    // docs-only medium down-rank (retro P7); both skip the verifier and the gate
    // stands as the review. No prepare marker is written or checked (5.1). The
    // review picks up the tdd sidecar written above (task 6).
    const hygiene = filesOnly ? {} : hygieneCounts(hygieneSignals);
    let recorded: { reviewId: string; version: number } | null = null;
    if (mode === 'task' && gateOutcome === 'pass' && risk.risk !== 'high' && stats) {
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
      gate: gateOutcome,
      risk: risk.risk,
      reasons,
      checks,
      stats,
      touched: { paths: touched.slice(0, MAX_TOUCHED_LISTED), total: touched.length },
      typecheck: typecheckState,
      hygiene,
      recorded,
      // `data.tdd` appears only when `tdd` was given; the proof output otherwise
      // surfaces only as a cause in a reason (design step 7).
      ...(tdd && tddBlock ? { tdd: tddBlock } : {}),
    };

    return {
      success: true,
      message: `Gate ${gateOutcome} for ${mode === 'task' ? `task` : `item`} '${taskId}': risk ${risk.risk}.`,
      data,
      nextSteps: gateNextSteps(gateOutcome, risk.risk),
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
