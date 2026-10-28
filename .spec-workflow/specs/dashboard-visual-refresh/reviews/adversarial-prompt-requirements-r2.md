# Adversarial Review — dashboard-visual-refresh/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-visual-refresh
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-memory-requirements.md using this format:

```markdown
# Adversarial Review Memory — requirements
Last updated: <today's date> (after v2 review)

## Cumulative Findings Summary
### Accepted
- <finding>: <brief description, which version identified it>

### Partially Accepted
- <finding>: <brief description, user's stance>

### Rejected
- <finding>: <brief description, reason for rejection>

### Unresolved
- <finding>: <not yet responded to>

## Patterns & Themes
- <high-level observations about recurring issues>

## Guidance for Next Review
- Focus areas based on what's been found
- Areas that have been well-covered and don't need re-examination
```

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Completeness, ambiguity, scope

**Example attack angles to consider:** Missing user stories, unstated assumptions, scope creep risk, contradictions between stories, acceptance criteria that can't be tested

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Standing directives

- Ground every claim in the real codebase. Read the files the document cites before you judge them. A misstated artifact (wrong path, wrong line range, wrong signature, wrong behaviour) is an automatic MUST_FIX.
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): dashboard-visual-refresh requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-visual-refresh`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 09b10a3b

````diff
diff --git a/.spec-workflow/specs/dashboard-visual-refresh/requirements.md b/.spec-workflow/specs/dashboard-visual-refresh/requirements.md
index b9ff71e4..fccce70c 100644
--- a/.spec-workflow/specs/dashboard-visual-refresh/requirements.md
+++ b/.spec-workflow/specs/dashboard-visual-refresh/requirements.md
@@ -19,9 +19,9 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 #### Acceptance Criteria
 
 1. WHEN the refresh lands THEN exactly one file under FE SHALL declare token values: colour (light and dark), font family, font size, font weight, line height, spacing steps, radii, border widths, shadows, motion durations and easings, the two row heights, the sidebar width, the panel width and the content maximum width. Today the values sit in `src/dashboard_frontend/src/modules/theme/theme.css:7-221` and the row heights in `src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:140-143`.
-2. WHEN the density changes THEN the value written to `--row-h` SHALL be a reference to a token in the token file, not a pixel literal (today `'32px'` and `'36px'` at `src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:142`).
+2. WHEN the density changes THEN the value written to `--row-h` SHALL be a reference to a token in the token file, not a pixel literal (today `'32px'` and `'36px'` at `src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:142`). The density e2e (`e2e/worktree-shell.spec.ts:242-256`) still proves the row renders 36 and 32 px, so the token resolves.
 3. WHEN the dashboard is built THEN each token name SHALL carry one value per theme in the built stylesheet. Today the build carries Tailwind's `--text-sm:.875rem` and the token file's `--text-sm: 12px`, and the same split for `--radius-md` (vite build probe, recorded in `codebase-context.md`, Theme and tokens). Tailwind utilities the pages use (`text-*`, `rounded-*`, `shadow-*`, `font-sans`, `font-mono`) SHALL resolve to the token file's values.
-4. WHEN the refresh lands THEN every `var(--name)` reference under FE SHALL name a token the token file defines. Today `--accent-danger` is referenced with a `#dc2626` fallback and defined nowhere (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:142`).
+4. WHEN the refresh lands THEN every `var(--name)` reference under FE SHALL name a token the token file defines, and a test SHALL assert this. Today `--accent-danger` is referenced with a `#dc2626` fallback and defined nowhere (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:142`).
 5. WHEN the refresh lands THEN the CSS classes that no file under FE references SHALL be removed: the old-page classes at `src/dashboard_frontend/src/modules/theme/theme.css:246-505` and `:511-612`, and the component classes at `src/dashboard_frontend/src/modules/theme/tailwind.css:15-464`. Unlayered classes that share a name with a Tailwind utility (`.gap-N`, `.p-N` at `src/dashboard_frontend/src/modules/theme/tailwind.css:297-308`; `.font-mono`, `.tabular-nums` at `src/dashboard_frontend/src/modules/theme/theme.css:440-446`) SHALL be removed, so the Tailwind utility is the only rule for that name.
 
 ### Requirement 2 — No hard-coded colour or size outside the token file
@@ -41,7 +41,7 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 
 #### Acceptance Criteria
 
-1. WHEN the token file defines a colour token for one theme THEN it SHALL define the same token name for the other theme, and a test SHALL compare the two name sets.
+1. WHEN the token file declares theme-varying tokens (colours and shadows) THEN it SHALL put them in two dedicated blocks — one light, one `.dark` — that hold only theme-varying tokens, and SHALL keep theme-independent tokens (spacing, type, radius, motion) in a separate block. A test SHALL assert the light and `.dark` blocks declare the same set of custom-property names. This isolates the per-theme set so the comparison is well-defined; structural tokens are never duplicated into `.dark`.
 2. WHEN the refresh lands THEN no `className` under FE SHALL use the `dark:` variant; a theme difference SHALL live only in token values. Today `dark:text-amber-400` and `dark:text-green-400` appear at `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:192-193` and `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:33` (red-first, covered by the Requirement 2 test or its own assertion).
 3. WHEN the operator switches theme THEN native controls (checkbox, radio, switch, search field, scrollbars) SHALL follow the selected theme. Today `color-scheme: light dark` applies to both themes (`src/dashboard_frontend/src/modules/theme/tailwind.css:6-8`), so native controls follow the operating system instead (red-first, browser check).
 4. The theme switch SHALL stay in the settings popover with the same control and labels (`src/dashboard_frontend/src/modules/shell/Gear.tsx:67-72`), the default theme SHALL stay dark, and the choice SHALL stay stored under the `theme` key (`src/dashboard_frontend/src/modules/theme/ThemeProvider.tsx:14-22`). Invariant (verified, not red-first).
@@ -81,10 +81,10 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 #### Acceptance Criteria
 
 1. The routes SHALL stay as at `src/dashboard_frontend/src/modules/app/App.tsx:21-29`. Invariant (verified, not red-first).
-2. The set of `data-testid` values, `role` values and `aria-*` attributes under FE, and the visible label text of every control, SHALL be the same before and after. Check: the sorted list of `data-testid="..."` strings found by `grep -rhoE 'data-testid=[^ >]+' src/dashboard_frontend/src` is identical on base and on the branch, with template-literal ids compared by their template text. Invariant (verified, not red-first).
+2. The set of `data-testid` values, `role` values and `aria-*` attributes under FE, and the visible label text of every control, SHALL be the same before and after. Check: the sorted list of `data-testid=`, `role=` and `aria-*=` attribute strings found by `grep -rhoE '(data-testid|role|aria-[a-z-]+)="[^"]*"' src/dashboard_frontend/src` is identical on base and on the branch, with template-literal values compared by their template text. Visible label text SHALL not change — no AC permits it and the before/after screenshots (R7) surface any that does. Invariant (verified, not red-first).
 3. No file outside `src/dashboard_frontend/`, the new tests and this spec's directory SHALL change: the server, its routes, the WebSocket feed, the controller, `src/watch/` and the harness are untouched. Invariant (verified, not red-first).
 4. No existing test SHALL be edited. The suites under `e2e/` and every vitest suite SHALL pass unchanged; the e2e suites assert no class name and no colour (only row height at `e2e/worktree-shell.spec.ts:242-256` and panel position at `:296-308`). New checks go in new test blocks or new files. Invariant (verified, not red-first).
-5. The density radio SHALL still switch a row between 36 and 32 px (`e2e/worktree-shell.spec.ts:242-256`). Invariant (verified, not red-first).
+5. The density radio SHALL still switch a row between 36 and 32 px (`e2e/worktree-shell.spec.ts:242-256`), the density choice SHALL stay stored under its key (`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:147`) and the group-collapse state under its key (`src/dashboard_frontend/src/modules/shell/primitives.tsx:25-40`, guarded by `e2e/worktree-shell.spec.ts:258`). Invariant (verified, not red-first).
 6. `package.json` `dependencies` and `devDependencies` (`./package.json:56-108`) SHALL be unchanged: no new UI library, font package or CSS tool. Invariant (verified, not red-first).
 7. The font files SHALL stay the bundled Inter and JetBrains Mono faces (`src/dashboard_frontend/src/assets/fonts/fonts.css:1-74`); no font loads from the network. Invariant (verified, not red-first).
 
@@ -94,7 +94,7 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 
 #### Acceptance Criteria
 
-1. WHEN the implementation starts THEN a script SHALL capture "before" screenshots of the six views in light and dark at 1440 by 900 px, from the base build, against the fixture stores of the worktree e2e harness (`./playwright.worktree.config.ts:18-71`), with one detail panel open on each view that has one. WHEN the refresh is done THEN the same script SHALL capture the "after" set from the branch. The 24 images go to `screenshots/before/` and `screenshots/after/` in this spec's directory, named by view and theme.
+1. WHEN the implementation starts THEN a script SHALL capture "before" screenshots of the six views in light and dark at 1440 by 900 px, from the base build, as a Playwright spec under the worktree project (`./playwright.worktree.config.ts:18-71`) that reuses the suite's runtime seeding (`seedClosedSpec` at `e2e/worktree-shell.spec.ts:51`, `WorktreeHarness` at `e2e/helpers/worktree-harness.ts:288`), so each view renders against seeded projects, specs and runs, with one detail panel open on each view that has one. WHEN the refresh is done THEN the same script SHALL capture the "after" set from the branch. The 24 images go to `screenshots/before/` and `screenshots/after/` in this spec's directory, named by view and theme.
 2. The same script SHALL also capture each of the six views at 375 px in the after set, dark theme only, so the operator sees the stacked layout.
 3. WHEN both sets exist THEN `verification-evidence.md` in this spec's directory SHALL list one line per view, `pending` until the operator reviews the pair, then `passed`. The retrospective does not open until every line reads `passed` (agent-rules, Fixtures and live verification).
 4. WHEN the refresh is done THEN `npm run build`, `npx tsc --noEmit` and `npm test` SHALL be green, and the worktree e2e suite (`npm run test:e2e:worktree`) SHALL be green with no existing test edited.
@@ -105,7 +105,7 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 - In both themes, body and label text SHALL have at least 4.5:1 contrast on its surface, and large text, icons, borders of inputs and the focus ring at least 3:1 (WCAG 2.1 AA, 1.4.3 and 1.4.11). Where a palette value from the mock fails this, the token value is adjusted and the adjustment is listed in the design. A test SHALL compute the ratios from the token file for the text-on-surface pairs the design lists.
 
 ### Performance
-- The built dashboard stylesheet SHALL be no larger than at base (54.58 kB uncompressed in the 2026-10-28 probe build). Removing the unused classes of Requirement 1.5 should make it smaller.
+- The built dashboard stylesheet SHALL be no larger than at base; the gate re-measures base, so the 54.58 kB uncompressed from the 2026-10-28 probe build is a reference, not the bar. Removing the unused classes of Requirement 1.5 should make it smaller.
 
 ## Decisions taken in this document
 
@@ -118,7 +118,7 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 - D7 — The Run page counts as a view for every check and screenshot, so there are six views, not five; options were six views; the five nav pages only. Chosen because it is a routed page the refresh restyles.
 - D8 — The hard-coded value check is a vitest test that runs in the normal test command; options were a vitest test; a one-off search at the verification gate. Chosen because it keeps later pages from drifting.
 - D9 — Unused CSS classes and the duplicate unlayered utility classes are removed; options were remove them; keep them and restyle them. Chosen because no component uses them, they carry literal colours, and the duplicates override Tailwind utilities by name.
-- D10 — Screenshots use the e2e harness fixture stores at 1440 by 900 px, plus 375 px for the after set; options were fixture stores; the operator's live stores. Chosen because fixtures are reproducible and show no real project data.
+- D10 — Screenshots run as a worktree Playwright spec that reuses the e2e suite's runtime seeding, at 1440 by 900 px, plus 375 px for the after set; options were the e2e seeding; the operator's live stores. Chosen because the seeded fixtures are reproducible and show no real project data.
 - D11 — Status pills use six tones: success, warning, danger, info, accent and neutral; options were six tones; one tone per status value. Chosen because every status map today already falls into these groups.
 - D12 — Native controls follow the selected theme, not the operating system; options were follow the selected theme; keep following the operating system. Chosen because a dark page with light checkboxes is the inconsistency this spec removes.
 
@@ -133,5 +133,13 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 
 ## Revision History
 
+- **v2** (2026-10-28) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/3).
+  - **R1-1 — Accepted (SHOULD_FIX).** Requirement 6.2's check now matches the role and aria attribute families, not only the test ids, and visible label text is pinned to the before/after screenshots, so the check covers all four classes it claims.
+  - **R1-2 — Accepted (SHOULD_FIX).** Requirement 3.1 now mandates two dedicated theme-varying blocks, one light and one dark, holding colours and shadows only, with structural tokens kept in a separate block, so the name-set comparison is well-defined and structural tokens are never duplicated into the dark block.
+  - **R1-3 — Accepted (SHOULD_FIX).** Requirement 7.1 now specifies the capture as a Playwright spec under the worktree project that reuses the suite's runtime seeding helpers, not the empty temporary stores the cited config sets up; also applied to decision D10.
+  - **MINOR (methods for 1.2 and 1.4) — Partially accepted.** Added a test that every custom-property reference under the frontend names a token the file defines, and tied the row-height token to the density end-to-end test that proves the row renders 36 and 32 px.
+  - **MINOR (client-state keys) — Partially accepted.** Requirement 6.5 now pins the density and group-collapse persistence keys as invariants; no new test, since style-only work does not touch them.
+  - **MINOR (stylesheet-size baseline) — Partially accepted.** Marked the size figure a reference the gate re-measures, not the bar itself.
+  - **Lint pass.** 0 fixed; rejected: L-1..L-7 — those are the AC's check-rule vocabulary, not what `./vitest.config.ts:8` locates (verified: the include pattern only). L-8 — rule 11: `className` unchanged since v1.
 - **v1** (2026-10-28) — Initial draft.
   - **Lint pass.** 4 fixed; rejected: L-2 — `className` is the AC's subject term (the JSX attribute), not a token the citation locates; the identifiers those ranges support, `dark:text-amber-400` and `dark:text-green-400`, are present and verified at RunsPage.tsx:192-193 and SpecsPage.tsx:33.

````
