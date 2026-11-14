# Adversarial Review — dashboard-plain-pages/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-plain-pages
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Feasibility, consistency, edge cases

**Example attack angles to consider:** Conflicts with steering docs, unaddressed failure modes, scaling bottlenecks, missing error paths, alternatives not considered

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Standing directives

- Ground every claim in the real codebase. Read the files the document cites before you judge them. A misstated artifact (wrong path, wrong line range, wrong signature, wrong behaviour) is an automatic MUST_FIX.
- Label every MUST_FIX and SHOULD_FIX, in the analysis and the report arrays, with a `[drafting] ` or `[design] ` prefix. A drafting defect is one the reviser can fix with no change to a requirement, a design choice or the scope: a wrong citation, a stale count, wording, or a lint failure. Every other item is a design defect.
- Attack the deltas since the previous version first, then apply one fresh lens the prior rounds did not use.
- Rulings recorded in the document's Revision History are closed. Do not re-open them.
- Do not pad. MINOR-only findings do not keep the loop alive. A clean round is a valid result: show your work (what you checked and how) and say converged.
- Severity: MUST_FIX = contradiction, false claim about the codebase, unimplementable requirement, data or security hole. SHOULD_FIX = a real gap that causes rework or a wrong implementation. MINOR = wording, a value safely left to a later phase, nice-to-have.
- ESCALATE only when a human should look now: security, secrets, auth bypass, data loss, destructive migrations, money, billing, pricing, legal or compliance. Otherwise write `ESCALATE: none`.

## Verdict block

End the analysis file with exactly this block, values filled in:

```
VERDICT: converged | iterate
MUST_FIX: <n>
SHOULD_FIX: <n>
MINOR: <n>
DESIGN_READY: yes | no
ESCALATE: none | <one-line reason a human should look now>
```

`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): dashboard-plain-pages design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-plain-pages` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-plain-pages` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-plain-pages/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-plain-pages`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 4434e4e9

````diff
diff --git a/.spec-workflow/specs/dashboard-plain-pages/design.md b/.spec-workflow/specs/dashboard-plain-pages/design.md
index e233f4a2..5113a1b1 100644
--- a/.spec-workflow/specs/dashboard-plain-pages/design.md
+++ b/.spec-workflow/specs/dashboard-plain-pages/design.md
@@ -2,7 +2,7 @@
 
 ## Overview
 
-This design rebuilds the Specs, Usage and Deferrals pages of the dashboard shell and adds one controller writer, the usage log, plus two server routes, a usage view and a deferral resolve. The Specs page reads one block per spec store from the existing `shell-specs` push, and the Usage page reads one new route that computes the window, the burn and the per-run fits on the server. It reuses the shell feed, store grouping, deferrals push, deferral store and run-setup decomposition helpers.
+This design rebuilds the Specs, Usage and Deferrals pages of the dashboard shell and adds one controller writer, the usage log, plus two server routes, a usage view and a deferral resolve. The Specs page reads one block per spec store from the existing `shell-specs` push, and the Usage page reads one new route that computes the window, the burn and the per-run fits on the server.
 
 ## Steering Document Alignment
 
@@ -30,9 +30,9 @@ Three slices share the shell. (1) Specs: `ShellFeed.flush` (`src/dashboard/shell
   - `readUsageLog(nowMs: number): UsageLogLine[]` — reads the whole file, skips each line that does not parse or lacks a numeric `sevenDay.utilization` and a string `ts`, drops lines older than `nowMs − 8 days`, and returns the rest sorted by `ts` ascending. A missing file gives `[]`.
   - `computeBurn(lines: UsageLogLine[], nowMs: number): number | null` — D7. The anchor is the newest line with `ts` at or before `nowMs − 24 h`; `null` when there is none. The result is the sum over consecutive pairs from the anchor to the newest line of `max(0, later − earlier)` in utilisation, times 100 (percentage points).
   - `attributedUse(lines: UsageLogLine[], runId: string): number` — D8 numerator: the sum over consecutive pairs of all lines of `max(0, later − earlier)` where the later line's `run` equals `runId`, in utilisation (0..1).
-- **Post-conditions:** two calls of `appendUsageLine` give two whole lines. The controller runs in one process and the call is synchronous, so two readings never interleave (Requirement 3 AC4). Probe: on node v24.13.0, two `appendFileSync` calls on one path gave exactly two whole lines (scratch probe, not in the repository). Nothing here depends on node-20 stream timing.
-- **Dependencies:** `controllerHome` (`src/controller/state.ts:293-297`), which honours `SDD_HOME` (Requirement 3 AC5).
-- **Reuses:** the append-a-JSON-line pattern of the run ledger (`src/controller/ledger.ts:160-166` writes through `appendFileSync`).
+- **Post-conditions:** two calls of `appendUsageLine` give two whole lines. The controller runs in one process and the call is synchronous, so two readings never interleave (Requirement 3 AC4). Probe: on node v24.13.0, two `appendFileSync` calls on one path gave two whole lines (scratch, not committed). Nothing here depends on node-20 stream timing.
+- **Dependencies:** `controllerHome` (`src/controller/state.ts:292-297`), which honours `SDD_HOME` (Requirement 3 AC5).
+- **Reuses:** the append-a-JSON-line pattern of the run ledger (`src/controller/ledger.ts:107` writes through `appendFileSync`).
 
 ### C2 — Run id on the rate-limit callback (`src/controller/step.ts`, `src/controller/runs.ts`, `src/controller/controller.ts`)
 - **Purpose:** Carry the emitting run's id to the log line (Requirement 3 AC1, D13).
@@ -41,7 +41,7 @@ Three slices share the shell. (1) Specs: `ShellFeed.flush` (`src/dashboard/shell
   - The `rate_limit_event` branch (`src/controller/step.ts:499-502`) calls `spec.onRateLimit?.(lastRateLimit, spec.runId ?? null)`; `spec.runId` is the optional field at `src/controller/step.ts:127`.
   - `RunDeps.onRateLimit(windows: RateLimitWindows, run?: string | null): void` (`src/controller/runs.ts:405-406`).
   - `Controller.runDeps().onRateLimit` (`src/controller/controller.ts:732`) becomes `(w, run) => { void this.persistRateLimit(w); appendUsageLine({ v: 1, ts: this.now().toISOString(), sevenDay: { utilization: w.sevenDay.utilization }, run: run ?? null }, this.now); }`.
-- **Post-conditions:** `persistRateLimit` (`src/controller/controller.ts:790-803`) writes the same `rate-limit.json` content as at base (Requirement 3 AC2). The phase contexts that forward `ctx.onRateLimit` (`src/controller/phases/document.ts:182`, `implementation.ts:96`, `closeout.ts:62`, `retrospective.ts:41`, `src/controller/merge-fix.ts:50`) keep their one-parameter type: a function with an extra optional parameter is assignable to it, and the runtime function is the controller's, so `step.ts` passes the run id straight through. No phase file changes.
+- **Post-conditions:** `persistRateLimit` (`src/controller/controller.ts:790-803`) writes the same `rate-limit.json` content as at base (Requirement 3 AC2). The phase contexts that forward `ctx.onRateLimit` (`src/controller/phases/document.ts:182`, `src/controller/phases/implementation.ts:96`, `src/controller/phases/closeout.ts:62`, `src/controller/phases/retrospective.ts:41`, `src/controller/merge-fix.ts:50`) keep their one-parameter type: an extra optional parameter stays assignable, and the runtime function is the controller's, so `step.ts` passes the run id through. No phase file changes.
 - **Reuses:** `RateLimitFile` (`src/controller/state.ts:238-253`) stays unchanged.
 
 ### C3 — Spec block builder (`src/dashboard/shell/spec-rows.ts`, rewritten in place)
@@ -60,7 +60,7 @@ Three slices share the shell. (1) Specs: `ShellFeed.flush` (`src/dashboard/shell
      - **not started:** otherwise; no fact.
 - **Post-conditions:** an unnamed spec directory gives no line (D4); at most one line reads "next", as one launchable spec exists per store (Requirement 2 AC8); a missing file gives an empty field, never a throw.
 - **Deletions in this file:** `buildSpecRows`, `buildSpecDetail`, `parseDecomposition`, `buildRuns`, `listTopLevelFiles`, `newestRunAbandoned` and `SPEC_NAME_RE`/`VERSION_RE` go. `isSpecClosed`, `timeOf`, `newestBy` and `firstStatusValue` stay.
-- **Reuses:** `parseHandoffPhaseRows` and `handoffPath` (imported at `src/dashboard/shell/spec-rows.ts:11-13`), `FileCache` (`src/dashboard/shell/file-cache.ts:20-48`).
+- **Reuses:** `parseHandoffPhaseRows` and `handoffPath` (imported at `src/dashboard/shell/spec-rows.ts:11-13`), `FileCache` (`src/dashboard/shell/file-cache.ts:16-48`).
 
 ### C4 — Decomposition helpers (`src/dashboard/harness/run-setup.ts`)
 - **Purpose:** Share the heading list and launchable rule with C3, so "next" matches the setup view before its guards (Requirement 2 AC5).
@@ -100,19 +100,19 @@ Three slices share the shell. (1) Specs: `ShellFeed.flush` (`src/dashboard/shell
 
 ### C8 — Specs page (`src/dashboard_frontend/src/modules/shell/SpecsPage.tsx`, rewritten)
 - **Purpose:** Render the blocks (Requirement 1).
-- **Interfaces:** reads `specBlocks` from `useShell()`. It shows a block only when `storeOf(projects, block.projectId)` is the store of an enabled `storeGroups` group (`src/dashboard_frontend/src/modules/projects/stores.ts:25-49`), in the order of `storeGroups`, titled with the representative's `projectName`. Each line shows the number, the word as a `Pill` (tone `accent` for live, `success` for closed, `neutral` otherwise; the tones of `SpecsPage.tsx:32-39`), the spec and the fact. Lines are plain, unselectable and unlinked (D17).
+- **Interfaces:** reads `specBlocks` from `useShell()`. It shows a block only when `storeOf(projects, block.projectId)` is the store of an enabled `storeGroups` group (`src/dashboard_frontend/src/modules/projects/stores.ts:25-49`), in the order of `storeGroups`, titled with the representative's `projectName`. Each line shows the number, the word as a `Pill` (tone `accent` for live, `success` for closed, `neutral` otherwise; the tones of `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:32-39`), the spec and the fact. Lines are plain, unselectable and unlinked (D17).
 - **Test ids:** `specs-block-<projectId>`, `spec-line-<projectId>-<spec>`, `spec-word-<projectId>-<spec>`, `specs-no-decomposition-<projectId>`, where `projectId` is the block's representative.
 - **Deleted:** chips, search, pager, `SpecPanel`, `FileRow`, and the `PageLayout` and `primitives` imports.
 
 ### C9 — Usage page (`src/dashboard_frontend/src/modules/shell/UsagePage.tsx`, rewritten)
 - **Purpose:** Render `UsageView` (Requirements 4, 5).
-- **Interfaces:** fetch `/api/shell/usage` on mount and whenever `controllerRuns` changes, the cue of `UsagePage.tsx:95-102`. Keep the one-second tick of `UsagePage.tsx:117-120` for the time to reset. When `window` is `null`, show "No usage window seen yet". When `resetsAt` is at or before the tick, show "window reset — no reading since" (D9). Otherwise show the per cent left (`100 − round(utilization × 100)`) in large type, the reset time with `toLocaleString()`, the time to reset, and one bar filled to the utilisation. The burn shows `burn` rounded to one decimal place plus " pts in 24 h", or "not known yet". Each run line shows project, spec, phase, tokens and, in implementation, the remaining tasks and "fits before the reset", "does not fit before the reset" or "not known yet". No five-hour window, table or trend.
+- **Interfaces:** fetch `/api/shell/usage` on mount and whenever `controllerRuns` changes, the cue of `src/dashboard_frontend/src/modules/shell/UsagePage.tsx:95-102`. Keep the one-second tick of `src/dashboard_frontend/src/modules/shell/UsagePage.tsx:117-120` for the time to reset. When `window` is `null`, show "No usage window seen yet". When `resetsAt` is at or before the tick, show "window reset — no reading since" (D9). Otherwise show the per cent left (`100 − round(utilization × 100)`) in large type, the reset time with `toLocaleString()`, the time to reset, and one bar filled to the utilisation. The burn shows `burn` rounded to one decimal place plus " pts in 24 h", or "not known yet". Each run line shows project, spec, phase, tokens and, in implementation, the remaining tasks and "fits before the reset", "does not fit before the reset" or "not known yet". No five-hour window, table or trend.
 - **Test ids:** `usage-window`, `usage-left`, `usage-no-window`, `usage-burn`, `usage-run-<runId>`, `usage-fit-<runId>`.
 
 ### C10 — Deferrals page (`src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx`, rewritten)
 - **Purpose:** One open-record queue with Resolve (Requirements 6 and 7).
-- **Interfaces:** for each enabled store group, take the records of the first member with a payload (the rule of `DeferralsPage.tsx:54-57`), keep `status === 'deferred'`, and tag each with the group's representative. Sort by `createdAt` ascending, then by `id`. Columns: age (under 24 h `Nh`, else `Nd`, D22), id, project, spec (`originSpec`, else "project"), tag (`tags.join(', ')`), owner (empty when absent), summary (`title`). With no open record, show "Queue empty". Resolve opens an in-row box with a text field, a confirm and a Cancel. The confirm is disabled while the trimmed text is empty or a request is in flight. It POSTs to the representative project's route. On an error reply the box stays open with the reply's `error` text and keeps the typed text. On 200 the box closes, and the row leaves when the next `deferrals-update` replaces the payload.
-- **Test ids:** `deferral-row-<projectId>-<id>` (kept from `DeferralsPage.tsx:211`), `deferral-resolve-<id>`, `deferral-resolution-<id>`, `deferral-resolve-confirm-<id>`, `deferral-resolve-cancel-<id>`, `deferral-resolve-error-<id>`, `deferrals-empty`.
+- **Interfaces:** for each enabled store group, take the records of the first member with a payload (the rule of `src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:54-57`), keep `status === 'deferred'`, and tag each with the group's representative. Sort by `createdAt` ascending, then by `id`. Columns: age (under 24 h `Nh`, else `Nd`, D22), id, project, spec (`originSpec`, else "project"), tag (`tags.join(', ')`), owner (empty when absent), summary (`title`). With no open record, show "Queue empty". Resolve opens an in-row box with a text field, a confirm and a Cancel. The confirm is disabled while the trimmed text is empty or a request is in flight. It POSTs to the representative project's route. On an error reply the box stays open with the reply's `error` text and keeps the typed text. On 200 the box closes, and the row leaves when the next `deferrals-update` replaces the payload.
+- **Test ids:** `deferral-row-<projectId>-<id>` (kept from `src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:211`), `deferral-resolve-<id>`, `deferral-resolution-<id>`, `deferral-resolve-confirm-<id>`, `deferral-resolve-cancel-<id>`, `deferral-resolve-error-<id>`, `deferrals-empty`.
 
 ### C11 — Shell provider and wire copies
 - `ShellProvider` (`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:60`) stores `specBlocks` from `shell-specs` `data.blocks`, in place of `specRows`.
@@ -207,3 +207,4 @@ interface UsageView {
 ## Revision History
 
 - **v1** (2026-11-14) — Initial draft.
+  - **Lint pass.** 11 fixed (ranges/prefixes corrected): L-3,4,5,6,7,9,37,38,39,40,41. Rejected: L-1,10,11,12,18,30,43,44,46,47,48,49 new identifiers; L-2,15,17,19,20,21,22,23,24,25,26,29,54 filename fragment or design-local var/field; L-8,13,14,16,27,28,31,32,33,34,35,36,42,45,50,51,52,53,55,56,57 token cited elsewhere (multi-citation line match).

````
