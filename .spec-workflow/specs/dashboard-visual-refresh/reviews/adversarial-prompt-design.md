# Adversarial Review — dashboard-visual-refresh/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-visual-refresh
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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): .
- Changes: the diff from the `docs(sdd): dashboard-visual-refresh design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-visual-refresh` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-visual-refresh` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-visual-refresh`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since 162ccb68

````diff
diff --git a/.spec-workflow/specs/dashboard-visual-refresh/design.md b/.spec-workflow/specs/dashboard-visual-refresh/design.md
index b63420bb..2029cf2c 100644
--- a/.spec-workflow/specs/dashboard-visual-refresh/design.md
+++ b/.spec-workflow/specs/dashboard-visual-refresh/design.md
@@ -10,7 +10,7 @@ This design adds one token file, `src/dashboard_frontend/src/modules/theme/token
 No `tech.md` exists (the steering directory is empty); the design follows `agent-rules.md`: vitest under `src/**/__tests__/`, worktree Playwright specs for browser checks.
 
 ### Project Structure (structure.md)
-No `structure.md` exists; frontend files go under `src/dashboard_frontend/src/modules/` (`theme/`, a new `ui/`), unit tests under `src/dashboard/__tests__/` (Requirement 2.1), browser checks under `e2e/` with a `worktree-` prefix (`playwright.worktree-pattern.ts:21`).
+No `structure.md` exists; frontend files go under `src/dashboard_frontend/src/modules/` (`theme/`, a new `ui/`), unit tests under `src/dashboard/__tests__/` (Requirement 2.1), browser checks under `e2e/` with a `worktree-` prefix (`./playwright.worktree-pattern.ts:21`).
 
 ### Design System (design-system.md) — if applicable
 N/A: no `design-system.md` exists; C1 and C3 become the dashboard's design system.
@@ -39,18 +39,18 @@ graph LR
 - **Interfaces:** three top-level blocks, in this order:
   1. `@theme static { … }` — theme-independent tokens. Inside it, each namespace clear (`--font-*: initial`, `--text-*: initial`, `--font-weight-*: initial`, `--leading-*: initial`, `--radius-*: initial`, `--shadow-*: initial`, `--color-*: initial`) comes before that namespace's names, because a clear drops names declared before it. `static` emits every name, including ones no utility uses (`--sidebar-w`). Both verified by the probe in codebase-context.
   2. `:root { … }` — the light colour and shadow tokens only.
-  3. `.dark { … }` — the dark colour and shadow tokens only, the same names as `:root`. It comes after `:root`: both selectors have the same specificity, so the later block wins when `ThemeProvider.tsx:19-22` puts `dark` on `html`.
+  3. `.dark { … }` — the dark colour and shadow tokens only, the same names as `:root`. It comes after `:root`: both selectors have the same specificity, so the later block wins when `src/dashboard_frontend/src/modules/theme/ThemeProvider.tsx:19-22` puts `dark` on `html`.
 - The names and values are in Data Models. Values are `#rrggbb` for every colour that is part of a contrast pair; the scrim and the shadows may use `rgb(… / alpha)`.
 - **Dependencies:** none. Imported only by `tailwind.css`.
-- **Reuses:** the font stacks and the effective type and radius values of `theme.css:7-51` (the unlayered values win today, so the operator sees 11/12/14 px type and a 6 px `rounded-md`).
+- **Reuses:** the font stacks and the effective type and radius values of `src/dashboard_frontend/src/modules/theme/theme.css:7-51` (the unlayered values win today, so the operator sees 11/12/14 px type and a 6 px `rounded-md`).
 
 ### C2 — Base stylesheet `src/dashboard_frontend/src/modules/theme/tailwind.css` (rewritten)
 - **Purpose:** the Tailwind entry and the few global rules that are not tokens.
 - **Interfaces:** in order:
   1. `@import "tailwindcss";` then `@import "./tokens.css";` (the order the probe built).
-  2. `@layer base` rules: `html, body, #root { height: 100% }`; `body` background, colour, font family, size and line height from tokens (replacing `theme.css:227-240`); `:root { color-scheme: light }` then `.dark { color-scheme: dark }` (Requirement 3.3, replacing `tailwind.css:6-8`); `:focus-visible { outline: var(--focus-ring-width) solid var(--focus-ring); outline-offset: var(--focus-ring-offset) }` (Requirement 4.4, 4.5); `input[type="checkbox"], input[type="radio"] { accent-color: var(--accent) }`; and `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { transition-duration: 0s !important; animation-duration: 0s !important } }` (Requirement 4.6; an important declaration in an earlier layer beats later layers).
-- **Removed:** `@plugin "@tailwindcss/typography"` (no `prose` class exists under FE; the package stays in `package.json`, Requirement 6.6), `@variant dark` (Requirement 3.2 bans the variant), and every component class at `tailwind.css:15-464`.
-- **Also:** `theme.css` is deleted and its import line goes from `main.tsx:7` (Requirement 1.5 removes `theme.css:246-612`; its tokens move to C1, its base rules to this file). `ThemeProvider.tsx:2` keeps its import of `./tailwind.css`.
+  2. `@layer base` rules: `html, body, #root { height: 100% }`; `body` background, colour, font family, size and line height from tokens (replacing `src/dashboard_frontend/src/modules/theme/theme.css:227-240`); `:root { color-scheme: light }` then `.dark { color-scheme: dark }` (Requirement 3.3, replacing `src/dashboard_frontend/src/modules/theme/tailwind.css:6-8`); `:focus-visible { outline: var(--focus-ring-width) solid var(--focus-ring); outline-offset: var(--focus-ring-offset) }` (Requirement 4.4, 4.5); `input[type="checkbox"], input[type="radio"] { accent-color: var(--accent) }`; and `@media (prefers-reduced-motion: reduce) { *, ::before, ::after { transition-duration: 0s !important; animation-duration: 0s !important } }` (Requirement 4.6; an important declaration in an earlier layer beats later layers).
+- **Removed:** `@plugin "@tailwindcss/typography"` (no `prose` class exists under FE; the package stays in `package.json`, Requirement 6.6), `@variant dark` (Requirement 3.2 bans the variant), and every component class at `src/dashboard_frontend/src/modules/theme/tailwind.css:15-464`.
+- **Also:** `theme.css` is deleted and its import line goes from `src/dashboard_frontend/src/main.tsx:7` (Requirement 1.5 removes `src/dashboard_frontend/src/modules/theme/theme.css:246-612`; its tokens move to C1, its base rules to this file). `src/dashboard_frontend/src/modules/theme/ThemeProvider.tsx:2` keeps its import of `./tailwind.css`.
 - **Dependencies:** C1.
 
 ### C3 — Shared UI module `src/dashboard_frontend/src/modules/ui/ui.tsx` (new)
@@ -72,39 +72,39 @@ graph LR
   - `Button`, `Pill`, `TextInput` and `Tab` add `data-ui` (the kind), and `Button` and `Pill` add `data-variant` or `data-tone`. These attributes are outside the Requirement 6.2 attribute set and give the e2e check (C7) a stable locator.
   - Every variant and tone is a full literal class string in a lookup object, because Tailwind finds classes by scanning literal text.
   - Colours come from token `var()` references; lengths from spacing steps or the var shorthand (`w-(--sidebar-w)`, `shadow-(--shadow-overlay)`), which the probe compiled.
-  - Disabled and busy: one treatment, `disabled:opacity-(--disabled-opacity) disabled:cursor-not-allowed`, on every `Button` (Requirement 4.3). A busy button is passed `disabled` and keeps whatever label the page renders; the sign-in button keeps its two labels (`LoginPanel.tsx:67`, D17).
+  - Disabled and busy: one treatment, `disabled:opacity-(--disabled-opacity) disabled:cursor-not-allowed`, on every `Button` (Requirement 4.3). A busy button is passed `disabled` and keeps whatever label the page renders; the sign-in button keeps its two labels (`src/dashboard_frontend/src/modules/auth/LoginPanel.tsx:67`, D17).
   - Hover, selected and disabled looks use the state tokens (`--surface-hover`, `--surface-selected`, `--accent-solid-hover`, `--danger-solid-hover`, `--disabled-opacity`); transitions use `transition-colors`, which reads `--default-transition-duration` and `--default-transition-timing-function` (Requirement 4.6).
   - No component sets `outline-none` or a `focus:` ring; C2 draws the ring.
-- **Button variants:** primary = `--accent-solid` background, `--text-on-accent` text; secondary = `--border-strong` border, `--text-secondary` text, hover `--surface-hover`; danger = `--danger-solid` background, `--text-on-accent` text; ghost = no border, `--text-muted` text, hover `--surface-hover`. The outlined Discard button at `RunsPage.tsx:311-319` maps to `danger`, like its confirm step at `RunsPage.tsx:301-309` (D18). A call site never adds colour classes to a `Button`; it may add layout classes only (margin, width, flex).
+- **Button variants:** primary = `--accent-solid` background, `--text-on-accent` text; secondary = `--border-strong` border, `--text-secondary` text, hover `--surface-hover`; danger = `--danger-solid` background, `--text-on-accent` text; ghost = no border, `--text-muted` text, hover `--surface-hover`. The outlined Discard button at `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:311-319` maps to `danger`, like its confirm step at `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:301-309` (D18). A call site never adds colour classes to a `Button`; it may add layout classes only (margin, width, flex).
 - **Dependencies:** C1 names; React.
 
 ### C4 — Restyled shell and primitives
-- `primitives.tsx` `Group` header uses `ui.groupHeader`; `Chips` uses the `Pill`-like chip recipe with active state `--accent-solid` and `--text-on-accent` (replacing `primitives.tsx:89-93`); `SearchBox` renders `TextInput` (drops `focus:outline-none focus:ring-2` at `primitives.tsx:131`); `Pager` buttons render `Button variant="secondary" size="sm"`; `Row` keeps `style={{ height: 'var(--row-h)' }}` and uses `--surface-selected` when selected, `--surface-hover` on hover, `rounded-sm` instead of bare `rounded`.
+- `primitives.tsx` `Group` header uses `ui.groupHeader`; `Chips` uses the `Pill`-like chip recipe with active state `--accent-solid` and `--text-on-accent` (replacing `src/dashboard_frontend/src/modules/shell/primitives.tsx:89-93`); `SearchBox` renders `TextInput` (drops `focus:outline-none focus:ring-2` at `src/dashboard_frontend/src/modules/shell/primitives.tsx:131`); `Pager` buttons render `Button variant="secondary" size="sm"`; `Row` keeps `style={{ height: 'var(--row-h)' }}` and uses `--surface-selected` when selected, `--surface-hover` on hover, `rounded-sm` instead of bare `rounded`.
 - `Sidebar.tsx`: nav rows use `ui.navRow(active)`; desktop aside `lg:w-(--sidebar-w)` (was `lg:w-64` at line 113); drawer panel `w-(--sidebar-w)` with `ui.drawer` (line 138); scrim `ui.scrim`, background `--scrim` (line 136).
-- `Gear.tsx:63` popover uses `ui.popover`; the theme button keeps its labels and control (Requirement 3.4) and becomes `Button variant="secondary" size="sm"`.
+- `src/dashboard_frontend/src/modules/shell/Gear.tsx:63` popover uses `ui.popover`; the theme button keeps its labels and control (Requirement 3.4) and becomes `Button variant="secondary" size="sm"`.
 - `LoginPanel.tsx`: overlay `ui.scrim`, form `ui.dialog` (drops bare `shadow-lg` at line 44), input `TextInput`, submit `Button variant="primary"`.
-- `PageLayout.tsx:22` panel `xl:w-(--panel-w)` (was `xl:w-96`).
-- `App.tsx:20`: `main` keeps `px-4 sm:px-6` (16 and 24 px from `--spacing: 4px`, Requirement 5.5) and wraps `Routes` in `div.mx-auto.w-full.max-w-(--content-max)`, so content is at most 1600 px and centred right of the sidebar (Requirement 5.4).
-- `ShellProvider.tsx:142` writes `var(--row-h-compact)` or `var(--row-h-comfortable)` to `--row-h` (Requirement 1.2); C1 declares `--row-h: var(--row-h-comfortable)` as the default before the effect runs.
+- `src/dashboard_frontend/src/modules/shell/PageLayout.tsx:22` panel `xl:w-(--panel-w)` (was `xl:w-96`).
+- `src/dashboard_frontend/src/modules/app/App.tsx:20`: `main` keeps `px-4 sm:px-6` (16 and 24 px from `--spacing: 4px`, Requirement 5.5) and wraps `Routes` in `div.mx-auto.w-full.max-w-(--content-max)`, so content is at most 1600 px and centred right of the sidebar (Requirement 5.4).
+- `src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:142` writes `var(--row-h-compact)` or `var(--row-h-comfortable)` to `--row-h` (Requirement 1.2); C1 declares `--row-h: var(--row-h-comfortable)` as the default before the effect runs.
 
 ### C5 — Status tone maps
 Each map keeps its keys and meaning and maps to a `Tone`; the page renders `Pill tone={…}` (D14).
 
 | Map | Statuses → tone |
 | --- | --- |
-| `RunsPage.tsx:188-196` | running, merging → accent; paused, waiting → warning; error → danger; queued, done, abandoned → neutral |
-| `RunPage.tsx:305` wait pill | warning |
-| `RunPage.tsx:453-457` | done → success; in-progress → accent; open → neutral |
-| `SpecsPage.tsx:30-35` | live, in-progress → accent; closed → success; deferred, not-started → neutral |
-| `SpecsPage.tsx:232-235`, `DeferralsPage.tsx:48-51` | deferred → accent; resolved → success; superseded → neutral |
-| `NowPage.tsx:88` phase chip | accent |
+| `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:188-196` | running, merging → accent; paused, waiting → warning; error → danger; queued, done, abandoned → neutral |
+| `src/dashboard_frontend/src/modules/shell/RunPage.tsx:305` wait pill | warning |
+| `src/dashboard_frontend/src/modules/shell/RunPage.tsx:453-457` | done → success; in-progress → accent; open → neutral |
+| `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:30-35` | live, in-progress → accent; closed → success; deferred, not-started → neutral |
+| `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:232-235`, `src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:48-51` | deferred → accent; resolved → success; superseded → neutral |
+| `src/dashboard_frontend/src/modules/shell/NowPage.tsx:88` phase chip | accent |
 
-`pause.ts:48` returns `text-(--tone-warning-fg)`, or `text-(--tone-danger-fg)` when overdue. Error text (`NowPage.tsx:142`, 208, 248, 727 and every `--status-error` text) uses `--tone-danger-fg`.
+`src/dashboard_frontend/src/modules/shell/pause.ts:48` returns `text-(--tone-warning-fg)`, or `text-(--tone-danger-fg)` when overdue. Error text (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:142`, 208, 248, 727 and every `--status-error` text) uses `--tone-danger-fg`.
 
 ### C6 — Usage chart and bar
-- `UsageTrend.tsx:13` `SERIES` becomes `['var(--chart-1)', …, 'var(--chart-6)']`; the cycle by project-name order stays (Requirement 2.4).
+- `src/dashboard_frontend/src/modules/shell/UsageTrend.tsx:13` `SERIES` becomes `['var(--chart-1)', …, 'var(--chart-6)']`; the cycle by project-name order stays (Requirement 2.4).
 - The series colour and the axis colour move from SVG attributes (`stroke=`, `fill=` at lines 92, 98, 109, 116) to `style={{ stroke }}` and `style={{ fill }}` (D13); `strokeWidth`, `r` and the view-box numbers stay unitless SVG attributes.
-- `UsagePage.tsx:52-56` bar colour: `var(--tone-danger-fg)` when hot, else `var(--accent)`.
+- `src/dashboard_frontend/src/modules/shell/UsagePage.tsx:52-56` bar colour: `var(--tone-danger-fg)` when hot, else `var(--accent)`.
 
 ### C7 — Tests and the capture script
 - **T1 `src/dashboard/__tests__/frontend-style-scan.test.ts`** (new). Walks every `.ts`, `.tsx`, `.css` file under FE except `modules/theme/tokens.css` and `assets/fonts/fonts.css`, line by line, and collects hits for these rules (the regexes are in the prototype `/tmp/scratchpad/sdd/dashboard-visual-refresh/probe/scan/scan.cjs`; the tasks author copies them in):
@@ -130,7 +130,7 @@ Each map keeps its keys and meaning and maps to a `Tone`; the page renders `Pill
   5. Reduced motion (Requirement 4.6): with `reducedMotion: 'reduce'`, a nav link's `transition-duration` is `0s`.
   6. Width cap (Requirement 5.4): at 1920 px the routes wrapper is at most 1600 px wide and its left and right gaps inside `main` differ by at most 1 px.
   7. No sideways scroll (Requirement 5.6): six views × 360, 768, 1000, 1440, 1920 px × two themes; the Run view opens the seeded run.
-  The theme is set before load with `page.addInitScript` writing `localStorage.theme`, the same key `ThemeProvider.tsx:15` reads. `page.emulateMedia` takes `colorScheme` and `reducedMotion` and `page.addInitScript` takes a function in the installed Playwright 1.58.0 (`node_modules/playwright-core/types/types.d.ts:2571-2602`, `:307`).
+  The theme is set before load with `page.addInitScript` writing `localStorage.theme`, the same key `src/dashboard_frontend/src/modules/theme/ThemeProvider.tsx:15` reads. `page.emulateMedia` takes `colorScheme` and `reducedMotion` and `page.addInitScript` takes a function in the installed Playwright 1.58.0 (`node_modules/playwright-core/types/types.d.ts:2571-2602`, `:307`).
 - **T5 capture block in `e2e/worktree-visual.spec.ts`** (Requirement 7.1, 7.2). A `describe` that calls `test.skip` unless both `SCREENSHOT_SET` (`before` or `after`) and `SCREENSHOT_DIR` are set, so the normal e2e run captures nothing. It writes `SCREENSHOT_DIR/SCREENSHOT_SET/view-theme.png` for the six views (`now`, `runs`, `run`, `specs`, `usage`, `deferrals`) in `light` and `dark` at 1440 × 900, opening the first row's panel on Runs, Specs and Deferrals; with `SCREENSHOT_SET=after` it also writes `view-dark-375.png`. `SCREENSHOT_DIR` is the spec directory's `screenshots` path; the brief passes it and relocates the files to the main store at the merge gate (agent-rules). The before set is captured on the commit that adds this block and no frontend change.
 
 ## Data Models
@@ -198,7 +198,7 @@ Every other `theme.css` name (`--interactive-*`, `--accent-primary*`, `--status-
 ### Contrast pairs T2 checks (both themes)
 - 4.5:1 — `--text-primary`, `--text-secondary`, `--text-muted` on each of `--surface-base`, `--surface-panel`, `--surface-inset`, `--surface-hover`, `--surface-selected`, `--surface-overlay`; `--accent` on `--surface-base` and `--surface-panel`; `--text-on-accent` on `--accent-solid`, `--accent-solid-hover`, `--danger-solid`, `--danger-solid-hover`; each `--tone-X-fg` on its `--tone-X-bg` and on `--surface-panel`; `--tone-danger-fg` on `--surface-base`.
 - 3:1 — `--focus-ring` and `--border-strong` on `--surface-base`, `--surface-panel`, `--surface-inset`, `--surface-overlay`; `--focus-ring` on `--surface-hover` and `--surface-selected`; each `--chart-N` on `--surface-panel`.
-All pass with the values above (computed with `/tmp/scratchpad/sdd/dashboard-visual-refresh/probe/cx/pal.cjs`; lowest are light `--accent` on `--surface-base` 4.58 and light `--tone-danger-fg` on its bg 4.61).
+All pass (computed with `/tmp/scratchpad/sdd/dashboard-visual-refresh/probe/cx/pal.cjs`; lowest are light `--accent` on `--surface-base` 4.58 and light `--tone-danger-fg` on its bg 4.61).
 
 ## Error Handling
 
@@ -209,7 +209,7 @@ All pass with the values above (computed with `/tmp/scratchpad/sdd/dashboard-vis
 
 ## Testing Strategy
 
-- **Unit (vitest, `npm test`):** T1, T2, T3 above, all new files under `src/dashboard/__tests__/` (covered by `vitest.config.ts:8`). Red-first: T1 (Requirements 1.1, 1.4, 1.5, 2.1-2.3, 3.2), T2 (3.1, NFR Accessibility), T3 (1.3). Requirement 1.2 is proved by T1's `setProperty` rule plus the existing density e2e (`e2e/worktree-shell.spec.ts:242-256`), unedited.
+- **Unit (vitest, `npm test`):** T1, T2, T3 above, all new files under `src/dashboard/__tests__/` (covered by `./vitest.config.ts:8`). Red-first: T1 (Requirements 1.1, 1.4, 1.5, 2.1-2.3, 3.2), T2 (3.1, NFR Accessibility), T3 (1.3). Requirement 1.2 is proved by T1's `setProperty` rule plus the existing density e2e (`e2e/worktree-shell.spec.ts:242-256`), unedited.
 - **End-to-end (worktree Playwright, `npm run test:e2e:worktree`):** T4 in `e2e/worktree-visual.spec.ts`. Red-first: T4.1 (4.1), T4.2 (4.4), T4.4 (3.3), T4.5 (4.6), T4.6 (5.4). Regression guards (hold at base; the tasks author runs them on base first): T4.3 (4.5, mouse focus shows no ring today), T4.7 (5.6). The existing suites run unedited and must stay green (Requirement 6.4, 7.4).
 - **Invariants checked at the verification gate, not as red tests:** Requirement 3.4, 5.1, 5.2, 5.3, 5.5, 5.7, 6.1-6.7. The gate diffs the sorted Requirement 6.2 grep output of base and branch; `git diff --name-only` against base limited to `src/dashboard_frontend/`, the new test files and this spec's directory (6.3); `git diff` of `package.json` lines 56-108 is empty (6.6); a search of FE for `min-[`, `max-[` and width `@media` finds none (5.1); the built stylesheet from `npm run build:dashboard` is no larger than base (NFR Performance; probe 24.62 kB against 54.58 kB).
 - **Evidence (Requirement 7):** T5 `before` on the first commit, `after` at the end; `verification-evidence.md` holds one `pending` line per view until the operator marks it `passed`; then the four commands of 7.4.
@@ -240,9 +240,9 @@ All pass with the values above (computed with `/tmp/scratchpad/sdd/dashboard-vis
 - Carried items from requirements: none.
 - Toasts, translations and the terminal HUD: cut in requirements.
 - The `info` tone is defined but no status maps to it today (D14).
-- Outline clipping inside overflow boxes is not tested by computed style; it rests on the screenshot review (Error Handling 4).
 - Frontend type checking stays absent (requirements Scope notes); T1-T3 do not add one.
 
 ## Revision History
 
 - **v1** (2026-10-28) — Initial draft.
+  - **Lint pass.** 31 citations prefixed; rejected: L-30 ('theme' anchors to `ThemeProvider.tsx:15`, which L-31 resolves), L-32 ('setProperty' is T1's rule, not the cited e2e; rule 11 suppresses).

````
