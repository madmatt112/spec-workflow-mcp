# Adversarial Review — worktree-execution-context/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/design.md

## Governing requirements
/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/requirements.md

Read both. The design claims to satisfy 12 requirements; check whether each component actually does, and name any acceptance criterion the design silently drops, weakens, or cannot implement as specified.

## Ground every claim in the code

This design cites specific files and line numbers throughout. Verify them against the working tree. A design that misreads the code it plans to change is worse than one that cites nothing — flag every citation that does not say what the document claims it says, and every claim about existing behaviour that the code contradicts.

## Analysis approach

Attack the six dimensions below. They are priorities, not a boundary — if you find something worse outside them, lead with it. For each dimension, produce 3–5 directive bullets grounded in the document's concrete content and the actual code.

### 1. `SharedWorkflowResources` lifecycle (Component 6)

- Stress-test the refcount teardown against the registry watcher's sync loop (`src/dashboard/project-manager.ts:99-135`), which adds and removes projects in the same pass. Establish whether a root can be torn down and immediately reconstructed, or torn down while an in-flight operation still holds a reference.
- Challenge the claim that sharing a single `SpecWatcher` preserves current behaviour. Determine what happens to watcher startup failures, per-project error isolation (`:198-200`), and the ordering guarantees between `project-added` and the first `spec-change` event.
- Attack the `projectIds: string[]` event payload change. Trace every consumer — the SSE broadcast path, the frontend event filter, any test — and establish what breaks when a field changes from scalar to array. Determine whether the document's "one frontend touch point" claim survives contact.
- Establish what happens when two projects sharing a root have *different* Docker path translations, or when `PathUtils.translatePath` maps two distinct workflow roots onto one translated path.

### 2. `ApprovalStorage` per-project resolution (Component 6)

- The document claims `ApprovalStorage` can "keep per-project `fileResolutionPath` behaviour by resolving against the requesting project's workspace at read time rather than at construction." Read `src/dashboard/approval-storage.ts` and establish whether this is possible without changing its public interface, its caching, its watcher, or its event payloads.
- Trace every caller of the approval read path and determine which ones actually know the requesting project. If any call site cannot supply a workspace, the design's claim fails there.
- Establish whether one shared `ApprovalStorage` can serve N projects whose approval *content* resolves differently, given that its file watcher and in-memory state were built for a single resolution base.
- Determine whether Requirement 11 AC 9's "already implemented, do not regress" guarantee survives this refactor, or whether sharing the component silently regresses the very behaviour that criterion protects.

### 3. The diff-base recording hook (Component 9, Requirement 5)

- Establish how often the recording path actually fires. The design concedes direct `tasks.md` edits bypass it. Determine what fraction of real task starts reach `src/dashboard/multi-server.ts:1404`, and whether a feature that records nothing in the dominant case earns its complexity.
- Attack the interaction between a recorded base and a worktree whose branch was created *after* the task started, or a task whose base was recorded in a different worktree entirely.
- Challenge the `git rev-parse --verify` resolvability check as sufficient. Establish what happens when the commit resolves but is unrelated to the current branch's history.
- Determine whether `TaskStateStore`'s per-task files are actually contention-free given that task IDs like `3.2` and `3.2.1` sanitize into distinct names but represent nested work.

### 4. The TS2307 flood detector (Component 8)

- Attack the thresholds (≥10 diagnostics, ≥80% resolution codes) with concrete scenarios that defeat them in both directions: a broken `node_modules` that stays under the floor, and a legitimate large refactor that trips it and loses a real typecheck.
- Establish whether `TS2307` is even reachable in this codebase's `parseTscOutput`, and whether `TypecheckDiagnostic.code` holds `"TS2307"` or a bare number.
- Determine what the detector does to the `inScope` / `coverage` fields the success arm carries, and whether callers depending on those fields handle the new `unavailable` return.
- Challenge the move to `$GIT_COMMON_DIR/info/exclude`. Establish what happens for a non-git project, a bare-repo edge case, and whether the existing early-return-if-covered check translates.

### 5. Registry optimistic concurrency (Component 7)

- Attack the read-hash-write-rename loop as a correctness argument. Establish whether hashing before rename actually closes the race, or merely narrows it, given that another process can rename between the re-read and this process's rename.
- Determine whether 5 attempts with 10–50 ms jitter is sufficient for the stated scenario of N worktrees starting simultaneously, and what N makes exhaustion likely.
- Challenge the decision to throw on exhaustion. Trace what a throw does to MCP server startup and whether the client surfaces it usefully.
- Establish whether the design addresses the watcher-observes-partial-file case it claims to, given that `rename` atomicity does not prevent a reader from opening the file between two successful renames.

### 6. Traceability and the pieces with no home

- Requirement 9 AC 5 requires `AdversarialRunner` to carry the same execution context. Establish whether the design gives it one, given that adversarial review has no task, no diff base, and no attribution.
- Requirement 4 AC 6 concerns nested worktrees. Establish whether "membership test against both roots" is actually sufficient when one root is a subdirectory of the other, and what prevents a path in worktree A from passing containment during a review of worktree B.
- Requirement 12 AC 6 lists nine behaviours needing coverage. Determine which have no corresponding component or test in this design.
- Establish what upgrades existing installs: no component owns migration, yet `ToolContext.workspacePath` becoming required is a breaking change for any external caller.

## Closing deliverables

- **Top 5 risks/gaps**
- **Top 3 conclusions to challenge or reverse**, with reasoning
- **What's missing** — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something is actually fine, say so briefly and move on.

## Output
Write your analysis to: /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/reviews/adversarial-analysis-design.md
