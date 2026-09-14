---
id: "d-ae7cc6cf"
status: "resolved"
title: "Typecheck inScope tagging never fires — tsc emits relative diagnostic paths"
createdAt: "2026-08-04T18:19:16.749Z"
updatedAt: "2026-08-04T19:55:39.221Z"
resolvedAt: "2026-08-04T19:55:39.221Z"
originSpec: "tighter-reviews"
originPhase: "implementation"
revisitTrigger: "Immediately — this blocks marking tighter-reviews complete. Re-open via the document loop's needs-revision branch, or fix task 5.3 directly."
tags: ["typecheck", "tighter-reviews", "blocking", "fictitious-coverage"]
resolution: "Fixed in task 5.3 (re-opened). Parsed diagnostic paths are now anchored to workspacePath — the tsc spawn cwd — immediately after parseTscOutput, making diagnostics[].file genuinely absolute and satisfying R2.3 as written. Verified end to end through the real handlePrepare from a server cwd that is not the workspace, in both single-root and two-root worktree configurations: the task-modified file's TS2322 returns inScope:true while a non-task file stays false, and R4.4 emits its promote-to-a-finding clause. The fictitious coverage that hid this was replaced: mocks now emit the relative-path form real tsc produces, and two tests spawn the repo's actual typescript compiler from a cwd asserted not equal to the workspace. Reverting the one-line anchor fails 6 tests including both real-tsc ones. The 100-diagnostic cap's in-scope-first ordering, dead code while every diagnostic was inScope:false, is now live and verified against 130 out-of-scope plus 20 in-scope diagnostics."
resolvedInSpec: "tighter-reviews"
supersededBy: null
supersedes: null
---

## Context
Found at the tighter-reviews end-to-end verification gate and confirmed by an independent adjudicator against a real tsc 5.9.3 run. Requirement 2.3 states diagnostics[].file is an absolute path. It is not: tsc prints diagnostic paths relative to its spawn cwd, so file is e.g. "src/bad.ts". postProcess in src/core/typecheck.ts then realpaths that relative string against the SERVER process cwd, so inScope is true only when the server's cwd happens to equal the workspace being typechecked. Under worktree-execution-context, selectRoots sets workspacePath to the worktree, making that coincidence structurally impossible. --listFiles output IS absolute, so coverage.compiled is unaffected — only inScope is broken. Confirmed PRE-EXISTING: the adjudicator extracted typecheck.ts at commit 047d20b and reproduced inScope:false identically. worktree-execution-context removed the coincidence that hid it; it did not introduce the bug. Existing coverage is fictitious: src/core/__tests__/typecheck.test.ts:509 mocks execFile and hand-builds diagnostic headers with absolute paths, a line real tsc never emits. Severity is degradation, not blackout — diagnostics still carry usable workspace-relative paths and R4.4's text still fires, but every entry is tagged inScope:false, so R4.4 instructs the reviewer to treat task-introduced type errors as upstream context not to be filed, and in-scope-first ordering under the 100-diagnostic cap is lost.

## Decision Deferred
Not decided: how to resolve tsc's relative diagnostic paths to absolute before computing inScope. Task 5.3 shipped the tagging, but it is inert. The spec was NOT marked complete because of this.

## Revisit Criteria
Task 5.3 is re-opened, or requirement 2.3 is amended to describe the path form tsc actually emits.
