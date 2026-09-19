# Adversarial Review Memory — design
Last updated: 2026-09-18 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — Whole prepare response failed its round trip when
  any optional field held `undefined` (`projectContext.dashboardUrl` with no
  dashboard). Fixed in v2 by a recursive `undefined`-key strip in `toMCPResponse`
  plus a with/without-dashboardUrl test. **Verified closed in v2** (`toEqual`
  ignores `undefined`; single encode site covers both dashboardUrl responses).
- **R1-2 (MINOR, v1)** — `PrepareData` named non-existent `TaskContext`/
  `ImplementationSummary`. Fixed in v2 with inline shapes. **Verified closed in
  v2** — shapes match the `:420-434` literals; `task` is `ParsedTask`, `latestLog`
  is `ImplementationLogEntry`.

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved (raised in v2, awaiting reviser response)
- **R2-1 (SHOULD_FIX, Novel)** — `runGit` (`task-diff.ts:50-62`) has no `timeout`;
  a hung git spawn (new on the status route via `readHeadCommit`, and in prepare)
  has no degraded outcome. Component 6's "response identical on every arm" is
  false for a hang (try/catch does not catch a pending promise). Error Handling
  omits the hang path. Fix: bounded timeout + state await/fire-and-forget.
- **R2-2 (SHOULD_FIX, Novel)** — the gitignore entry (line 196 / D19) covers only
  `task-state.json` and `.lock`, not the `uniqueTempPath` `.tmp` or `breakStaleLock`
  `.stale` files the same machinery emits into the **git-tracked**
  `.spec-workflow/specs/<spec>/`. Crash-between-write-and-rename orphans get swept
  into commits. Error Handling also omits the store-write-throws path (fn throw
  re-propagates from `withRegistryLock`). Fix: glob `task-state.json*`.
- **R2-3 (MINOR, Novel)** — `read`'s "malformed → null" is JSON+version only; a
  shape-valid wrong-typed `attribution.workspacePath` reaches step 4 where
  `normalizeIdentityPath` throws → whole prepare `success:false`, contradicting
  EH #3. Tampering-only trigger. Fix: validate record shape or tolerate non-string.
- **R2-4 (MINOR, Novel)** — `isAncestorOfHead` returns false on a git-run error
  (ENOENT), so a broken git yields `head-degraded` with the false note "base … is
  not an ancestor … and was rejected" (Data Models line 213). Distinguish "git
  did not run" from exit 1/128.

## Patterns & Themes
- **Correctness stays exact.** Every delta citation and both mechanical claims
  (the Vitest `toEqual`/undefined behaviour; the inline-shape/literal match)
  reproduced. Two rounds, zero MUST_FIX; the design's weakness is never a false
  claim, it is completeness of the *failure* surface.
- **The recurring class is optional/degraded completeness.** v1: an optional
  field missed by the encode fix. v2: failure paths the components can take that
  the Error Handling section does not enumerate (git hang, store-write-throws,
  temp/stale debris, shape-malformed record, git-run error vs exit code). The fix
  for one instance (diffStats) was reasoned locally; the sibling/edge cases were
  not swept.
- Reused-primitive risk: the design leans on `runGit`/`uniqueTempPath`/
  `withRegistryLock` and inherits their gaps (no git timeout; temp files not
  ignored) into a new, more-exposed location (interactive route, tracked dir).

## Guidance for Next Review
- First re-check R2-1/R2-2 closure: does `runGit` (or the new spawns) get a
  timeout, is the status-route await/fire-and-forget stated, is the gitignore a
  glob, and does Error Handling now list the git-hang and store-write-throws
  paths? Confirm R2-3/R2-4 wording if the reviser touched them.
- Well-covered, do not re-litigate without new evidence: R1-1 encode strip (sound);
  R1-2 inline shapes (sound); `observed`-required sites and `any`-typed test
  overrides; `diffStats → null`; task-state key normalization; DiffMethodologyState
  `no-files` switch safety; the `unavailable`-reason `observed` table; the atomic
  read side (no torn read); lock serialization of the two writers.
- Closed by ruling, do not re-open: D3 (`diffBase.commit = 'HEAD'` for HEAD
  provenances), D11 (`feature-disabled` no note) — both refinements.
- If the loop continues past a clean failure-path pass, a genuinely fresh lens:
  the runner/dashboard prompt-assembly path under a partially-written diff file
  (Component 8 diff-file write/unlink lifecycle at `:204`/`:272`), or the
  cross-process ordering of recordBase (dashboard proc) vs recordAttribution (MCP
  proc) when they interleave with a concurrent prepare `read`.
