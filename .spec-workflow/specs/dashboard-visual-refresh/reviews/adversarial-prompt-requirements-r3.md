# Adversarial Review — dashboard-visual-refresh/requirements (v3)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-visual-refresh
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v3. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-analysis-requirements-r2.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-memory-requirements.md using this format:

```markdown
# Adversarial Review Memory — requirements
Last updated: <today's date> (after v3 review)

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-analysis-requirements-r3.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v3.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v3 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v3 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the newest commit whose subject holds `docs(sdd): dashboard-visual-refresh requirements v2` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v3 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
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

## Changes since 912c7048

````diff
diff --git a/.spec-workflow/specs/dashboard-visual-refresh/requirements.md b/.spec-workflow/specs/dashboard-visual-refresh/requirements.md
index fccce70c..1d0ecb67 100644
--- a/.spec-workflow/specs/dashboard-visual-refresh/requirements.md
+++ b/.spec-workflow/specs/dashboard-visual-refresh/requirements.md
@@ -2,15 +2,15 @@
 
 ## Introduction
 
-This spec gives the dashboard one visual system (one token file for colour, type, space, radius, border, shadow and motion) and restyles every page and component from it. It is for the operator, who reads the dashboard all day in light or dark theme on screens from a phone to a wide monitor. It changes how the dashboard looks and nothing it does: routes, rows, panels, data, WebSocket updates and server stay as they are.
+This spec gives the dashboard one visual system — one token file for colour, type, space, radius, border, shadow and motion — and restyles every page and component from it. It is for the operator, who reads it all day in light or dark, from phone to wide monitor. It changes how the dashboard looks, not what it does: routes, rows, panels, data, WebSocket updates and server stay as they are.
 
 ## Alignment with Product Vision
 
-The steering file `product.md` does not exist in this store, so this section aligns with the decomposition entry 22 and the redesign memo `docs/dashboard-redesign.md`. The redesign set the Linear idiom (dense grouped rows, narrow sidebar, detail panel on the right) and listed "no colour or shading to show hierarchy" as a defect (`docs/dashboard-redesign.md:53-55`). This spec keeps that idiom and fixes the look inside it, so the operator finds every control where it was the day before.
+No `product.md` exists in this store, so this section aligns with decomposition entry 22 and the redesign memo `docs/dashboard-redesign.md`. The redesign set the Linear idiom (dense grouped rows, narrow sidebar, detail panel on the right) and listed "no colour or shading to show hierarchy" as a defect (`docs/dashboard-redesign.md:53-55`). This spec keeps that idiom and fixes the look inside it, so the operator finds every control where it was.
 
 ## Requirements
 
-Terms: **token file** is the one CSS file that defines every design token; **FE** is `src/dashboard_frontend/src`; **the six views** are Now, Runs, Run (`/runs/:projectId`), Specs, Usage and Deferrals (`src/dashboard_frontend/src/modules/app/App.tsx:22-27`).
+Terms: **token file** is the one CSS file defining every design token; **FE** is `src/dashboard_frontend/src`; **the six views** are Now, Runs, Run (`/runs/:projectId`), Specs, Usage and Deferrals (`src/dashboard_frontend/src/modules/app/App.tsx:22-27`).
 
 ### Requirement 1 — One set of design tokens in one file
 
@@ -41,7 +41,7 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 
 #### Acceptance Criteria
 
-1. WHEN the token file declares theme-varying tokens (colours and shadows) THEN it SHALL put them in two dedicated blocks — one light, one `.dark` — that hold only theme-varying tokens, and SHALL keep theme-independent tokens (spacing, type, radius, motion) in a separate block. A test SHALL assert the light and `.dark` blocks declare the same set of custom-property names. This isolates the per-theme set so the comparison is well-defined; structural tokens are never duplicated into `.dark`.
+1. WHEN the token file declares theme-varying tokens (colours and shadows) THEN it SHALL put them in two dedicated blocks — the light set under `:root`, the dark set under `.dark` — that hold only theme-varying tokens, and SHALL keep theme-independent tokens (spacing, type, radius, motion) in a third block under a selector that is neither `:root` nor `.dark`, so the three blocks are distinguishable by selector. A test SHALL assert the `:root` and `.dark` blocks declare the same set of custom-property names. This isolates the per-theme set so the comparison is well-defined; structural tokens are never duplicated into `.dark`.
 2. WHEN the refresh lands THEN no `className` under FE SHALL use the `dark:` variant; a theme difference SHALL live only in token values. Today `dark:text-amber-400` and `dark:text-green-400` appear at `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:192-193` and `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:33` (red-first, covered by the Requirement 2 test or its own assertion).
 3. WHEN the operator switches theme THEN native controls (checkbox, radio, switch, search field, scrollbars) SHALL follow the selected theme. Today `color-scheme: light dark` applies to both themes (`src/dashboard_frontend/src/modules/theme/tailwind.css:6-8`), so native controls follow the operating system instead (red-first, browser check).
 4. The theme switch SHALL stay in the settings popover with the same control and labels (`src/dashboard_frontend/src/modules/shell/Gear.tsx:67-72`), the default theme SHALL stay dark, and the choice SHALL stay stored under the `theme` key (`src/dashboard_frontend/src/modules/theme/ThemeProvider.tsx:14-22`). Invariant (verified, not red-first).
@@ -52,10 +52,10 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 
 #### Acceptance Criteria
 
-1. WHEN the refresh lands THEN each component kind SHALL be styled from one shared definition: sidebar nav row, group header, list row, detail panel, filter chip, button (primary, secondary, danger, ghost), text and search input, checkbox, radio and switch, tab, status pill, table, log view, pager, settings popover, mobile drawer and the sign-in dialog. Two instances of one kind on different views SHALL compute the same background, text colour, border, radius, height, padding and font size in the same state.
+1. WHEN the refresh lands THEN each component kind SHALL be styled from one shared definition: sidebar nav row, group header, list row, detail panel, filter chip, button (primary, secondary, danger, ghost), text and search input, checkbox, radio and switch, tab, status pill, table, log view, pager, settings popover, mobile drawer and the sign-in dialog. Two instances of one kind on different views SHALL compute the same background, text colour, border, radius, height, padding and font size in the same state. A test SHALL assert this cross-view sameness for at least the list row, status pill and button kinds: it renders one instance of the kind on two different views and compares those seven computed properties in the resting state (red-first; the design names the harness).
 2. WHEN a status is shown as a pill THEN it SHALL use one pill with a fixed tone set (success, warning, danger, info, accent, neutral). The status maps at `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:192-193`, `src/dashboard_frontend/src/modules/shell/RunPage.tsx:453-457`, `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:32-33`, `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:233-234` and `src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:49-50` SHALL each map a status to a tone; the status-to-meaning mapping (which status is a warning, which is done) SHALL not change.
-3. WHEN a control is hovered, selected, disabled or busy THEN its look SHALL come from state tokens shared by its kind. Disabled controls SHALL share one treatment (today `disabled:opacity-40` and `disabled:opacity-50` both occur). A busy action button (for example the sign-in button at `src/dashboard_frontend/src/modules/auth/LoginPanel.tsx:64-67`) SHALL use the disabled treatment and keep its present label text.
-4. WHEN any focusable element receives keyboard focus THEN it SHALL show a focus ring from the focus token, at least 2 px wide, with at least 3:1 contrast against the surface behind it, in both themes. This covers the focusable list rows (`src/dashboard_frontend/src/modules/shell/primitives.tsx:190-199`), nav links, chips, tabs, inputs, buttons, the drawer toggle and the dialog fields (red-first).
+3. WHEN a control is hovered, selected, disabled or busy THEN its look SHALL come from state tokens shared by its kind. Disabled controls SHALL share one treatment (today `disabled:opacity-40` and `disabled:opacity-50` both occur). A busy action button (the sign-in button at `src/dashboard_frontend/src/modules/auth/LoginPanel.tsx:64-67`) SHALL use the disabled treatment and keep its label text.
+4. WHEN any focusable element receives keyboard focus THEN it SHALL show a focus ring from the focus token, at least 2 px wide, with at least 3:1 contrast against its surface, in both themes. This covers the focusable list rows (`src/dashboard_frontend/src/modules/shell/primitives.tsx:190-199`), nav links, chips, tabs, inputs, buttons, the drawer toggle and the dialog fields (red-first).
 5. WHEN focus comes from a mouse click THEN the ring SHALL not show (`:focus-visible` semantics), so pointer use looks as it does today.
 6. WHEN a style transitions THEN its duration and easing SHALL come from the motion tokens, and WHEN the system requests reduced motion THEN transition and animation durations SHALL be zero.
 7. The log view (`src/dashboard_frontend/src/modules/shell/RunPage.tsx:660-698`) SHALL keep its filter, follow switch, scroll-to-bottom on follow and the monospace face; only its colours, borders, spacing and type change.
@@ -66,7 +66,7 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 
 #### Acceptance Criteria
 
-1. The breakpoints SHALL be Tailwind's default set (sm 640, md 768, lg 1024, xl 1280, 2xl 1536 px; `node_modules/tailwindcss/theme.css:279-283`). No file under FE SHALL use an arbitrary breakpoint variant or an `@media` width query outside that set. Invariant at base: a search of FE finds no `min-[`, `max-[` or `@media` (verified, not red-first; the Requirement 2 test may assert it as a regression guard).
+1. The breakpoints SHALL be Tailwind's default set (sm 640, md 768, lg 1024, xl 1280, 2xl 1536 px; `node_modules/tailwindcss/theme.css:279-283`). No file under FE SHALL use an arbitrary breakpoint variant or an `@media` width query outside that set. Invariant at base: a search of FE finds no `min-[`, `max-[` or `@media` (verified, not red-first).
 2. The sidebar SHALL show as a column from lg and as a top bar with a drawer below lg, as it does at `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:113-131`. Invariant (verified, not red-first).
 3. The detail panel SHALL sit beside the list from xl and stack under the list below xl, as at `src/dashboard_frontend/src/modules/shell/PageLayout.tsx:17-22`. Invariant: `e2e/worktree-shell.spec.ts:296-308` already proves the stack at 1000 px (verified, not red-first).
 4. WHEN the viewport is wider than the sidebar plus the content maximum width THEN the main content (list plus panel) SHALL be no wider than 1600 px and SHALL be centred in the space right of the sidebar. At base `main` has no cap (`src/dashboard_frontend/src/modules/app/App.tsx:20`), so at 1920 px the content is wider than 1600 px (red-first).
@@ -81,9 +81,9 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 #### Acceptance Criteria
 
 1. The routes SHALL stay as at `src/dashboard_frontend/src/modules/app/App.tsx:21-29`. Invariant (verified, not red-first).
-2. The set of `data-testid` values, `role` values and `aria-*` attributes under FE, and the visible label text of every control, SHALL be the same before and after. Check: the sorted list of `data-testid=`, `role=` and `aria-*=` attribute strings found by `grep -rhoE '(data-testid|role|aria-[a-z-]+)="[^"]*"' src/dashboard_frontend/src` is identical on base and on the branch, with template-literal values compared by their template text. Visible label text SHALL not change — no AC permits it and the before/after screenshots (R7) surface any that does. Invariant (verified, not red-first).
+2. The set of `data-testid`, `role` and `aria-*` attributes under FE, and the visible label text of every control, SHALL be the same before and after. Check: the sorted list of attribute-and-value strings found by `grep -rhoE '(data-testid|role|aria-[a-z-]+)=("[^"]*"|\{[^}]*\})' src/dashboard_frontend/src` is identical on base and branch; the pattern matches string-literal, brace-expression and template-literal value forms alike, so no attribute is invisible to it. Visible label text SHALL not change — no AC permits it and the before/after screenshots (R7) surface any that does. Invariant (verified, not red-first).
 3. No file outside `src/dashboard_frontend/`, the new tests and this spec's directory SHALL change: the server, its routes, the WebSocket feed, the controller, `src/watch/` and the harness are untouched. Invariant (verified, not red-first).
-4. No existing test SHALL be edited. The suites under `e2e/` and every vitest suite SHALL pass unchanged; the e2e suites assert no class name and no colour (only row height at `e2e/worktree-shell.spec.ts:242-256` and panel position at `:296-308`). New checks go in new test blocks or new files. Invariant (verified, not red-first).
+4. No existing test SHALL be edited. The suites under `e2e/` and every vitest suite SHALL pass unchanged; the e2e suites assert no class name and no colour (only row height at `e2e/worktree-shell.spec.ts:242-256` and panel position at `:296-308`). New checks go in new blocks or files. Invariant (verified, not red-first).
 5. The density radio SHALL still switch a row between 36 and 32 px (`e2e/worktree-shell.spec.ts:242-256`), the density choice SHALL stay stored under its key (`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:147`) and the group-collapse state under its key (`src/dashboard_frontend/src/modules/shell/primitives.tsx:25-40`, guarded by `e2e/worktree-shell.spec.ts:258`). Invariant (verified, not red-first).
 6. `package.json` `dependencies` and `devDependencies` (`./package.json:56-108`) SHALL be unchanged: no new UI library, font package or CSS tool. Invariant (verified, not red-first).
 7. The font files SHALL stay the bundled Inter and JetBrains Mono faces (`src/dashboard_frontend/src/assets/fonts/fonts.css:1-74`); no font loads from the network. Invariant (verified, not red-first).
@@ -94,7 +94,7 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 
 #### Acceptance Criteria
 
-1. WHEN the implementation starts THEN a script SHALL capture "before" screenshots of the six views in light and dark at 1440 by 900 px, from the base build, as a Playwright spec under the worktree project (`./playwright.worktree.config.ts:18-71`) that reuses the suite's runtime seeding (`seedClosedSpec` at `e2e/worktree-shell.spec.ts:51`, `WorktreeHarness` at `e2e/helpers/worktree-harness.ts:288`), so each view renders against seeded projects, specs and runs, with one detail panel open on each view that has one. WHEN the refresh is done THEN the same script SHALL capture the "after" set from the branch. The 24 images go to `screenshots/before/` and `screenshots/after/` in this spec's directory, named by view and theme.
+1. WHEN the implementation starts THEN a script SHALL capture "before" screenshots of the six views in light and dark at 1440 by 900 px, from the base build, as a Playwright spec under the worktree project (`./playwright.worktree.config.ts:18-71`) that reuses the suite's runtime seeding (`seedClosedSpec` at `e2e/worktree-shell.spec.ts:51`, `WorktreeHarness` at `e2e/helpers/worktree-harness.ts:288`), so each view renders against seeded data, with one detail panel open where a view has one. WHEN the refresh is done THEN the same script SHALL capture the "after" set from the branch. The 24 images go to `screenshots/before/` and `screenshots/after/` in this spec's directory, named by view and theme.
 2. The same script SHALL also capture each of the six views at 375 px in the after set, dark theme only, so the operator sees the stacked layout.
 3. WHEN both sets exist THEN `verification-evidence.md` in this spec's directory SHALL list one line per view, `pending` until the operator reviews the pair, then `passed`. The retrospective does not open until every line reads `passed` (agent-rules, Fixtures and live verification).
 4. WHEN the refresh is done THEN `npm run build`, `npx tsc --noEmit` and `npm test` SHALL be green, and the worktree e2e suite (`npm run test:e2e:worktree`) SHALL be green with no existing test edited.
@@ -105,34 +105,38 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 - In both themes, body and label text SHALL have at least 4.5:1 contrast on its surface, and large text, icons, borders of inputs and the focus ring at least 3:1 (WCAG 2.1 AA, 1.4.3 and 1.4.11). Where a palette value from the mock fails this, the token value is adjusted and the adjustment is listed in the design. A test SHALL compute the ratios from the token file for the text-on-surface pairs the design lists.
 
 ### Performance
-- The built dashboard stylesheet SHALL be no larger than at base; the gate re-measures base, so the 54.58 kB uncompressed from the 2026-10-28 probe build is a reference, not the bar. Removing the unused classes of Requirement 1.5 should make it smaller.
+- The built dashboard stylesheet SHALL be no larger than at base; the gate re-measures base, so the 54.58 kB uncompressed from the 2026-10-28 probe is a reference, not the bar.
 
 ## Decisions taken in this document
 
-- D1 — Palette and accent: adopt the Linear mock palette (neutral greys, indigo accent, the mock's success, warning and danger hues and chart series), with shades adjusted where a value fails the contrast rule; options were adopt the Linear mock palette; keep the current slate and indigo palette; design a new palette. Chosen because the mock is the approved look of the redesign and the current palette is the old GitHub-style one.
-- D2 — Layout breakpoints and maximum width: keep Tailwind's default breakpoints with the sidebar from 1024 px and the panel beside the list from 1280 px, and cap the main content at 1600 px, centred; options were Tailwind defaults with a 1600 px cap; a custom breakpoint set at 768, 1000 and 1440 px; Tailwind defaults with no cap; Tailwind defaults with a 1440 px cap. Chosen because it keeps today's layout and the existing stack test, and 1600 px only bites on wide monitors.
-- D3 — Row density: keep 36 px comfortable and 32 px compact; options were keep 36 and 32 px; tighten to 32 and 28 px; one density at 32 px. Chosen because the mock uses 36 px and an existing behaviour test asserts both heights, which this spec may not edit.
-- D4 — Terminal palette: the terminal does not adopt the palette; the watch view keeps its basic ANSI colours and the overwatch HUD is retired; options were leave the terminal as it is; map the palette to 24-bit colour in the watch view. Chosen because basic ANSI colours follow the operator's terminal theme and the entry limits the change to the dashboard.
-- D5 — Type family: keep the bundled Inter and JetBrains Mono; options were keep the bundled Inter and JetBrains Mono; Inter and Roboto Mono as in the mock; the system font stack. Chosen because they ship with the package, load offline and need no new asset.
-- D6 — Sidebar and panel widths stay at 256 and 384 px rather than the mock's 208 and 360 px; options were keep today's widths; adopt the mock's widths. Chosen because the operator should find everything where it was.
-- D7 — The Run page counts as a view for every check and screenshot, so there are six views, not five; options were six views; the five nav pages only. Chosen because it is a routed page the refresh restyles.
-- D8 — The hard-coded value check is a vitest test that runs in the normal test command; options were a vitest test; a one-off search at the verification gate. Chosen because it keeps later pages from drifting.
-- D9 — Unused CSS classes and the duplicate unlayered utility classes are removed; options were remove them; keep them and restyle them. Chosen because no component uses them, they carry literal colours, and the duplicates override Tailwind utilities by name.
-- D10 — Screenshots run as a worktree Playwright spec that reuses the e2e suite's runtime seeding, at 1440 by 900 px, plus 375 px for the after set; options were the e2e seeding; the operator's live stores. Chosen because the seeded fixtures are reproducible and show no real project data.
-- D11 — Status pills use six tones: success, warning, danger, info, accent and neutral; options were six tones; one tone per status value. Chosen because every status map today already falls into these groups.
-- D12 — Native controls follow the selected theme, not the operating system; options were follow the selected theme; keep following the operating system. Chosen because a dark page with light checkboxes is the inconsistency this spec removes.
+- D1 — Palette: adopt the Linear mock palette (neutral greys, indigo accent, the mock's success, warning and danger hues and chart series), shades adjusted where a value fails the contrast rule; options were adopt the mock palette; keep the current slate and indigo; design a new palette. Chosen because the mock is the approved redesign look.
+- D2 — Breakpoints and width: keep Tailwind defaults, sidebar from 1024 px, panel beside the list from 1280 px, main content capped at 1600 px and centred; options were defaults with a 1600 px cap; a custom set at 768, 1000 and 1440 px; defaults with no cap; defaults with a 1440 px cap. Chosen because it keeps today's layout and the stack test; 1600 px only bites on wide monitors.
+- D3 — Row density: keep 36 px comfortable and 32 px compact; options were keep 36 and 32 px; tighten to 32 and 28 px; one density at 32 px. Chosen because the mock uses 36 px and a behaviour test this spec may not edit asserts both.
+- D4 — Terminal: not restyled; the watch view keeps its basic ANSI colours and the overwatch HUD is retired; options were leave it as is; map the palette to 24-bit colour in the watch view. Chosen because basic ANSI follows the operator's terminal theme.
+- D5 — Type family: keep the bundled Inter and JetBrains Mono; options were keep them; Inter and Roboto Mono as in the mock; the system font stack. Chosen because they ship with the package and load offline.
+- D6 — Widths: sidebar and panel stay at 256 and 384 px, not the mock's 208 and 360 px; options were keep today's; adopt the mock's. Chosen so the operator finds everything in place.
+- D7 — The Run page counts as a view, so there are six views, not five; options were six views; the five nav pages only. Chosen because it is a routed page the refresh restyles.
+- D8 — The hard-coded value check is a vitest test in the normal test command; options were a vitest test; a one-off search at the gate. Chosen because it stops later pages drifting.
+- D9 — Unused and duplicate unlayered classes are removed; options were remove them; keep and restyle them. Chosen because nothing uses them, they carry literal colours, and the duplicates override Tailwind utilities.
+- D10 — Screenshots run as a worktree Playwright spec reusing the e2e suite's runtime seeding, at 1440 by 900 px, plus 375 px for the after set; options were the e2e seeding; the operator's live stores. Chosen because the seeded fixtures are reproducible and show no real data.
+- D11 — Status pills use six tones: success, warning, danger, info, accent and neutral; options were six tones; one tone per status value. Chosen because every status map falls into these groups.
+- D12 — Native controls follow the selected theme, not the operating system; options were follow the theme; keep following the OS. Chosen because a dark page with light checkboxes is the inconsistency this removes.
 
 ## Scope notes
 
-- Steering: `product.md` is missing from this store's steering directory; the alignment section uses the decomposition entry and the redesign memo instead.
-- Toasts: the entry lists toasts, but the frontend has none (browser notifications only, from the shell provider). Nothing is restyled or added for them.
-- Translations: the entry says translations are untouched. This frontend has no i18n layer (no locale files, no translation hook), so there is nothing to touch.
+- Toasts: the entry lists toasts, but the frontend has none (browser notifications only); nothing is restyled or added.
+- Translations: the entry says translations are untouched; this frontend has no i18n layer, so there is nothing to touch.
 - Terminal HUD: cut by D4. The watch view's colours stay as they are.
-- Frontend type checking: `npx tsc --noEmit` excludes the frontend (`./tsconfig.json:20`) and the Vite build does not type-check. This spec does not add a frontend type check; it is a flag for the operator.
+- Frontend type checking: `npx tsc --noEmit` excludes the frontend (`./tsconfig.json:20`) and Vite does not type-check. This spec adds no frontend type check; it is a flag for the operator.
 - Carried items from the decomposition: none.
 
 ## Revision History
 
+- **v3** (2026-10-28) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 1/1/1).
+  - **R2-1 — Accepted (MUST_FIX).** Requirement 6.2's check now matches string-literal, brace-expression and template-literal attribute forms, so every attribute is compared; the self-contradicting template-text clause is deleted.
+  - **R2-2 — Accepted (SHOULD_FIX).** Requirement 4.1 now mandates a cross-view computed-style equality check for the list row, status pill and button kinds; the design names the harness.
+  - **R2-3 — Accepted (MINOR).** Requirement 3.1 now pins the light set to the root block, the dark set to the dark block and the structural tokens to a third block with a distinct selector, so the name-set test identifies each block unambiguously.
+  - **Lint pass.** 0 fixed; rejected L-1..L-8: AC rule vocabulary/subjects, not citation tokens (rule 11).
 - **v2** (2026-10-28) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/3).
   - **R1-1 — Accepted (SHOULD_FIX).** Requirement 6.2's check now matches the role and aria attribute families, not only the test ids, and visible label text is pinned to the before/after screenshots, so the check covers all four classes it claims.
   - **R1-2 — Accepted (SHOULD_FIX).** Requirement 3.1 now mandates two dedicated theme-varying blocks, one light and one dark, holding colours and shadows only, with structural tokens kept in a separate block, so the name-set comparison is well-defined and structural tokens are never duplicated into the dark block.
@@ -140,6 +144,6 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
   - **MINOR (methods for 1.2 and 1.4) — Partially accepted.** Added a test that every custom-property reference under the frontend names a token the file defines, and tied the row-height token to the density end-to-end test that proves the row renders 36 and 32 px.
   - **MINOR (client-state keys) — Partially accepted.** Requirement 6.5 now pins the density and group-collapse persistence keys as invariants; no new test, since style-only work does not touch them.
   - **MINOR (stylesheet-size baseline) — Partially accepted.** Marked the size figure a reference the gate re-measures, not the bar itself.
-  - **Lint pass.** 0 fixed; rejected: L-1..L-7 — those are the AC's check-rule vocabulary, not what `./vitest.config.ts:8` locates (verified: the include pattern only). L-8 — rule 11: `className` unchanged since v1.
+  - **Lint pass.** 0 fixed; L-1 through L-8 rejected as the AC's own check-rule vocabulary, not citation tokens.
 - **v1** (2026-10-28) — Initial draft.
-  - **Lint pass.** 4 fixed; rejected: L-2 — `className` is the AC's subject term (the JSX attribute), not a token the citation locates; the identifiers those ranges support, `dark:text-amber-400` and `dark:text-green-400`, are present and verified at RunsPage.tsx:192-193 and SpecsPage.tsx:33.
+  - **Lint pass.** 4 fixed; L-2 rejected — the className term is the AC's subject, not a citation token, and the identifiers at those ranges are verified present.

````
