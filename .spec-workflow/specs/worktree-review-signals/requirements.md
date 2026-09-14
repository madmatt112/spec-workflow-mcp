# Requirements Document

> **Status: deferred scope record, not an approved requirements document.**
> This spec was split out of `worktree-execution-context` after its third adversarial design
> review (see `.spec-workflow/spec-decomposition/decomposition.md`). The criteria below were
> approved as part of that spec's v4 requirements and are carried here so nothing is lost.
> They have **not** been through a requirements phase at this scope and are expected to change
> — several are known to need amendment, noted inline. Run the normal Requirements → Design →
> Tasks flow before implementing.

## Introduction

Everything governing the accuracy of the signal a reviewing agent receives: which commit the diff is taken from, whether the typecheck can be trusted, which workspace produced the work, and how all three reach the agent's prompt.

Depends on `worktree-execution-context` for `ToolContext.workspacePath` and for the workspace/workflow-root file partition. Has no dependency on `worktree-dashboard-concurrency`.

## Carried criteria

### From R5 — the diff base is the task's own starting point

- A per-task diff base is recorded on the transition to in-progress, keyed by spec, task ID, **and workspace**. Keying by spec and task alone puts one base on the shared root, where worktree B reviewing A's task reads A's commit.
- `HEAD` is read from the workspace whose task is being marked; nothing is recorded if that read fails.
- Base validation is `git merge-base --is-ancestor`, **not** `git rev-parse --verify` — linked worktrees share one object database, so `--verify` succeeds on any sibling branch's commit.
- No record for the reviewing workspace ⇒ fall back to `HEAD`, disclosed as the expected baseline. A recorded base failing ancestry ⇒ fall back to `HEAD`, disclosed distinctly as degraded.
- Parity: a recorded base equal to `HEAD`, and a non-worktree project with no record, both produce the pre-change file set.
- The base is stored alongside attribution, not in a separate mechanism, and its store is safe against concurrent writers from different worktrees.
- Agents editing `tasks.md` directly record no base. This is the dominant path; the recording site serves dashboard-driven status changes only, and the design must state that hit rate rather than implying general coverage.

**Known to need work at this scope** (from design review v3):
- No component ever plumbed the base into `computeTaskDiff`, which takes two parameters and hardcodes `'HEAD'` at `task-diff.ts:45-46`. The signature change, the substitution, and the read site in `handlePrepare` all need owners.
- The store has two writers (the status endpoint and `log-implementation`) in a fixed order with no merge semantics stated, so attribution erases the base. Read-modify-merge under a lock, with a named owner per field, and reconcile against R8's single-writer criterion.
- `ERR_CHILD_PROCESS_STDIO_MAXBUFFER` was classified benign when the base was always `HEAD`. A base many commits back makes a 16 MB overflow materially more likely, and that path currently tells the agent the changes "were already committed before review".

### From R7 — typecheck degrades honestly

- No compiler under the workspace ⇒ `unavailable`; no borrowing from another root. The reason describes what was observed, not a diagnosis the check did not make.
- Dependency resolution is probed **directly**, not inferred from diagnostic shape. A ratio test over `TS2307` cannot distinguish a broken `node_modules` from a large legitimate file move.
- A typecheck that cannot run is never presented as a completed one, in either direction — neither absence nor presence of diagnostics.
- `tsconfigPath` derives from the workspace. A workspace lacking `tsconfig.json` where the workflow root has one is reported distinctly from a project that has none.
- The cache lives under the workspace so concurrent worktrees do not share one `tsbuildinfo`. Its git exclusion is written to the common directory's `info/exclude`, not to the tracked per-worktree `.gitignore`, with the common directory resolved absolutely.

**Known to need work at this scope:**
- The v3 probe read only `dependencies`. In this repository every type-critical package (`typescript`, `@types/*`, `vitest`, `tsx`, `vite`) is a **devDependency**, so the probe would miss exactly the failure it targets. Sample both sets, drop the 10-item cap over ~52 packages, and run the probe *before* the `tsc` spawn rather than after a 30-second run it no longer consumes anything from.
- A bare repository returns `.` from `--git-common-dir` and **has** an `info/exclude`, so the "skip when bare" branch needs a `--is-bare-repository` probe that no component specified.
- Switching from `.gitignore` to `info/exclude` removes a team-shared, committed ignore rule for every non-worktree user. That regression belongs in Migration.
- **R7 AC 6 is to be amended here.** As approved it unconditionally requires new `unavailable` reasons to be added to `R4_6B_TYPECHECK_UNAVAILABLE` (`review-task.ts:724-725`), which is byte-pinned by a two-way drift test (`review-task.test.ts:1293`) comparing against `tighter-reviews`' gitignored `requirements.md`. Amend to permit surfacing new reasons through the disclosure channel, and record the resulting divergence as a deferred decision against `tighter-reviews`. Note that the constant is *already* non-exhaustive — it omits `'wrapper-config'` (`typecheck.ts:131`).

### From R8 — work is attributable to the workspace that produced it

- `log-implementation` records the absolute workspace path and the `HEAD` commit at logging time, and is the **single** attribution writer.
- A value derived from an `args.projectPath` override is marked override-derived; a detector whose source of truth is corruptible by the override it checks is not a detector.
- Entries predating the change carry no workspace ⇒ **unknown**, a third state distinct from match and mismatch. Every task logged before upgrade is in it.
- Attribution is descriptive, never a lock on who may review or implement.

**Known to need work at this scope:** the approved wording requires both fields in "the stored record", meaning the implementation-log entry. Writing them to a JSON sidecar instead is the better engineering call — the log is hand-parsed markdown — but it is a deviation that needs stating and the criterion amending.

### From R9 — disclosures reach the reviewing agent

- One named execution-context object in the prepare response carrying workspace, workflow root, diff base and provenance, typecheck status and reason, and attribution state.
- It must survive `task-review-runner.ts:110`, which destructures five fields and discards the rest, and reach `buildPrompt`. Disclosure into the discarded `projectContext` reaches direct callers only, never the dashboard-spawned reviewer.
- The expected baseline (no base recorded) is stated factually and emits **no** qualify-your-verdict directive; only genuine degradation does. A signal that fires on every review carries no information.
- Reconciled against the degradation directives the review methodology already emits, with a stated owner per fact.
- Adversarial runs disclose workspace and workflow root only, written into the scaffold by `adversarialReviewHandler` — `AdversarialRunner` builds no prompt.

**Known to need work at this scope:** R9's runner-plumbing criteria had no owning component in the v3 design, only a testing bullet. Also, `ExecutionContext.workflowRoot` and `PathUtils.getWorkflowRoot()` mean different directories, and both would reach the agent under the same field name.

## Non-functional notes carried

- An empty resolved file set must never read as a clean baseline. The denylist can empty the diff independently of the partition, so a count of workspace-resolved files is not sufficient on its own.
- New exported type members (`TypecheckResult` union additions) break exhaustive `switch` statements in any consumer and belong in the migration position taken by spec 1.
