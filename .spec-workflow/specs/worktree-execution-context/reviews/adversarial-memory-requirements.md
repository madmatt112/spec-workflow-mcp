# Adversarial Review Memory — requirements
Last updated: 2026-07-29 (after v2 review)

## Cumulative Findings Summary

### Accepted
Stance inferred from the target document: v1 raised these, and the v2 requirements text incorporates them.

- **Runners need two path fields** (v1): `RunOptions` had one `projectPath` spent three incompatible ways → now R6 AC 1/5.
- **`cleanupSpecs`/`cleanupArchivedSpecs` are not agent spawns** (v1): v1 warned the AC pointed a destructive delete at the worktree → reversed into R6 AC 10 ("continue to pass the workflow root").
- **`workspacePath` must be required, not optional-with-fallback** (v1): → R3 AC 1, with the rationale quoted almost verbatim.
- **`multi-server.ts:828` hands `originalProjectPath` to a handler that needs the workflow root** (v1): → R6 AC 7 plus a rewritten Introduction.
- **Env inheritance across the spawn boundary** (v1): → R2 AC 6 (scrubs `SPEC_WORKFLOW_WORKSPACE`). Incomplete — see Unresolved.
- **`args.projectPath` override has no stated rule** (v1): → R3 AC 4. The rule chosen re-introduces a silent path — see Unresolved.
- **"Identical to prior behaviour" named no observable** (v1): → R3 AC 7 now enumerates files diffed, files typechecked, containment decisions, `tsconfigPath`.
- **`projectContext` payload should disclose both roots** (v1): → R3 AC 6. Lands on a payload the runner discards — see Unresolved.
- **Explicit-over-inferred inversion was undefended** (v1): → R1 "Design note", plus `--no-workspace-inference` (R1 AC 10) as the non-file escape hatch v1 said was missing.
- **AC 2.4 was a false factual claim about `resolveGitRoot`** (v1): → rewritten as R2 AC 4 (workflow root resolves from the *configured* path under the override).
- **Env var must be scoped away from dashboard mode** (v1): → R2 AC 5, with the `project-manager.ts:264-265` rationale.
- **`realpath` normalization before hashing** (v1): → R1 AC 7/8. Not extended to the dashboard manual-add path — see Unresolved.
- **NFR undercounted git invocations** (v1: "at most two"): → now five invocations / ~25s worst case.
- **Borrowing `tsc` from the workflow root** (v1): → removed entirely; R7 AC 1 forbids it.
- **Version skew from a borrowed compiler** (v1): moot once borrowing was dropped.
- **Cache-in-worktree contradicts the shared-write rule** (v1): → R7 AC 6 plus the "Enumerated exceptions" NFR.
- **Missing-tsconfig-in-worktree case** (v1): → R7 AC 5.
- **`writeRegistry` fixed temp path, unlocked read-modify-write** (v1): → R9 AC 1–4.
- **Approval workspace-first resolution already exists** (v1: "say already true, don't pad"): → R9 AC 8 marked exactly that way.
- **"Adversarial route is the correct precedent" framing** (v1): → Introduction reframes both routes as independently wrong.
- **Ownership exclusion rested on a false rationale** (v1): → Requirement 8 brought into scope, with the registry-deletion and bare-filename citations.
- **Diff base never decided** (v1): → Requirement 5. New problems introduced — see Unresolved.
- **Relative-path asymmetry across workspaces** (v1): → R4 AC 5 + R8.
- **`.mcp.json = .` recommendation** (v1): → reversed; Usability NFR now explicitly forbids it and states the cwd-`/` failure.
- **Migration note absent** (v1): → Migration NFR added.
- **No test strategy / worktree fixture** (v1): → Requirement 10. Coverage gaps remain — see Unresolved.

### Partially Accepted
- **Typecheck false-positive flood** (v1 → v2): v2 removed the borrowed compiler and added R7 AC 3 forbidding presentation of an un-runnable typecheck — but supplied no detector. A worktree's own stale `node_modules` reproduces the flood via `status: 'success'`.
- **`.gitignore` root for the cache** (v1 → v2): v2 chose the workflow root (R7 AC 7). Correct that the workspace was wrong; wrong that this ignores anything, since `.gitignore` is tracked per-worktree.
- **`tasks.md` concurrency** (v1 → v2): v2 added R9 AC 5/6, aimed at the only in-repo writer, which is single-process. The racing writer is the agent's own editor.

### Rejected
- None known. No user response to v1 is recorded in the spec directory; all classifications above are inferred from document changes.

### Unresolved
Raised in v2, no response yet.

- **Dashboard duplication (v2, top risk):** N worktrees → N `ProjectContext`s all built on one `workflowRootPath` (`project-manager.ts:146-152`). Every spec/approval/task appears N times; `JobScheduler` runs N recursive deletes over one dir; R4 AC 5 mismatches on N−1 of N rows. Directly contradicts the "repo grouping is out of scope, naming suffices" exclusion.
- **R9's `tasks.md` ACs govern the wrong writer (v2):** no MCP tool sets task status; the guide instructs direct editing (`spec-workflow-guide.ts:281`).
- **R5 AC 6's parity claim is false (v2):** `merge-base(HEAD, origin/main)` ≠ `HEAD` with unpushed commits on the default branch.
- **R5 widens a per-task diff to a per-branch diff (v2)** and changes behaviour for all non-worktree users on a feature branch, with no opt-out.
- **R5 AC 2 mixes remote refs, a config *name*, and local refs (v2);** no fetch, so a stale `origin/main` pulls in unrelated upstream work.
- **R3 AC 6 / R5 AC 3 / R5 AC 5 disclosures never reach the dashboard-spawned reviewer (v2):** `task-review-runner.ts:110` destructures five fields and drops `projectContext`.
- **R4 AC 3/AC 4 silently drop `.spec-workflow` paths in a worktree (v2):** `validateAllFiles` `continue`s with no warning when realpath fails (`review-task.ts:63-67`).
- **R3 AC 4 restores the defect for any caller passing `args.projectPath` (v2),** silently — the shape R3 AC 1 rejected one criterion earlier.
- **`--no-workspace-inference` will be consumed as the project path (v2)** unless added to the arg filter at `index.ts:166-175`.
- **`SPEC_WORKFLOW_SHARED_ROOT` is not scrubbed at the spawn boundary (v2);** it relocates the child's workflow root the way the scrubbed var relocates its workspace.
- **"Single source of truth" NFR contradicted by `addProjectByPath` (v2)** (`project-manager.ts:264-265`), which R1 AC 9 / R2 AC 5 also exempt from `realpath` normalization.
- **R8 AC 3 "unknown workspace" has no defined outcome (v2)** — the state of every pre-upgrade log entry.
- **R8 AC 1 records a value derivable from `args.projectPath` (v2),** so the mismatch detector's source of truth is corruptible by the override it checks.
- **`cleanupStaleProjects` is a second unlocked registry writer (v2)** (`project-registry.ts:297-320`), not covered by R9 AC 1/2.
- **R9 retry exhaustion undefined for the registry (v2)** — start unregistered, or abort?
- **R10 covers none of the newly introduced behaviour (v2):** R2 AC 6, R3 AC 4, R4 AC 5, R6, R8, Reliability NFR.

## Patterns & Themes
- **The document fixes findings precisely and then under-plumbs them.** Three separate ACs (R3 AC 6, R5 AC 3, R5 AC 5) require a disclosure without naming the channel that carries it to the agent that reads it. Fixes land on the direct-MCP path and miss the dashboard-runner path — the same asymmetry as the original defect.
- **Silent-fallback whack-a-mole.** v1 killed the optional `workspacePath` fallback; v2 reintroduced an equivalent one through R3 AC 4's `args.projectPath` rule. Every "derive X from Y" clause in this spec should be checked for whether it can silently reproduce the shared-root behaviour.
- **ACs that describe a protection the architecture cannot deliver.** R9 AC 5/6 (`tasks.md`) and R7 AC 3 (honest degradation) both specify an outcome with no mechanism. These are the most dangerous kind of criterion here: implementable, testable against the wrong subject, and marked done.
- **Scope keeps absorbing adjacent problems.** v1's "decide the diff base" and "cover the concurrency" became full requirements (R5, R9) that change behaviour for users who have no worktrees. Each round of review has grown the spec; the next round should push back on breadth rather than add to it.
- **The repo's own configuration hides two defects.** `.gitignore:148` already contains `.spec-workflow`, so the cache-ignore bug is invisible here; and this repo is single-developer-on-`main`, which is exactly where R5 AC 6's parity claim breaks. Test fixtures must construct the *unlike-this-repo* case.
- **Citation quality is high.** Every file:line reference in the target document verified correct in both v1 and v2. Do not spend future review budget re-checking them; spend it on whether the cited code does what the AC assumes.

## Guidance for Next Review

**Focus areas**
- Whether the dashboard-duplication question (§1 of v2) got an answer, and whether that answer stayed inside the stated scope.
- Whether R5 was split out, gated, or kept — and if kept, whether AC 6's parity claim and the per-task/per-branch diff boundary were repaired.
- Whether R9 AC 5/6 were retracted or backed by a real status-setting tool.
- Whether R7 AC 3 gained a detector and R7 AC 6/7 gained a working ignore mechanism.
- Whether disclosures now name `buildPrompt` as the channel.
- R10's coverage of the *new* criteria, not just the parity ones.
- If the document moves to design phase: the two-field runner contract and the `ToolContext` construction-site enumeration are where the ambiguity will resurface as implementation drift.

**Well covered — do not re-examine**
- Line-citation accuracy throughout the document.
- The precedence order in R1/R2 and the design-note defence of inference-over-argument; it has been argued twice and the escape hatches are adequate.
- The removal of the `.mcp.json = .` recommendation.
- R9 AC 8 (approval resolution already implemented) and R6 AC 10 (cleanup stays on the workflow root); both are correct and settled.
- The `writeRegistry` temp-filename and atomic-rename mechanics (R9 AC 1/4); the remaining registry issues are about *which writers* are covered, not the write itself.
