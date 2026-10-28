# Requirements Document

## Introduction

This spec gives the dashboard one visual system — one token file for colour, type, space, radius, border, shadow and motion — and restyles every page and component from it. It is for the operator, who reads it all day in light or dark, from phone to wide monitor. It changes how the dashboard looks, not what it does: routes, rows, panels, data, WebSocket updates and server stay as they are.

## Alignment with Product Vision

No `product.md` exists in this store, so this section aligns with decomposition entry 22 and the redesign memo `docs/dashboard-redesign.md`. The redesign set the Linear idiom (dense grouped rows, narrow sidebar, detail panel on the right) and listed "no colour or shading to show hierarchy" as a defect (`docs/dashboard-redesign.md:53-55`). This spec keeps that idiom and fixes the look inside it, so the operator finds every control where it was.

## Requirements

Terms: **token file** is the one CSS file defining every design token; **FE** is `src/dashboard_frontend/src`; **the six views** are Now, Runs, Run (`/runs/:projectId`), Specs, Usage and Deferrals (`src/dashboard_frontend/src/modules/app/App.tsx:22-27`).

### Requirement 1 — One set of design tokens in one file

**User Story:** As the operator, I want every colour and size defined once, so that the whole dashboard looks like one product and a change in one place changes it everywhere.

#### Acceptance Criteria

1. WHEN the refresh lands THEN exactly one file under FE SHALL declare token values: colour (light and dark), font family, font size, font weight, line height, spacing steps, radii, border widths, shadows, motion durations and easings, the two row heights, the sidebar width, the panel width and the content maximum width. Today the values sit in `src/dashboard_frontend/src/modules/theme/theme.css:7-221` and the row heights in `src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:140-143`.
2. WHEN the density changes THEN the value written to `--row-h` SHALL be a reference to a token in the token file, not a pixel literal (today `'32px'` and `'36px'` at `src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:142`). The density e2e (`e2e/worktree-shell.spec.ts:242-256`) still proves the row renders 36 and 32 px, so the token resolves.
3. WHEN the dashboard is built THEN each token name SHALL carry one value per theme in the built stylesheet. Today the build carries Tailwind's `--text-sm:.875rem` and the token file's `--text-sm: 12px`, and the same split for `--radius-md` (vite build probe, recorded in `codebase-context.md`, Theme and tokens). Tailwind utilities the pages use (`text-*`, `rounded-*`, `shadow-*`, `font-sans`, `font-mono`) SHALL resolve to the token file's values.
4. WHEN the refresh lands THEN every `var(--name)` reference under FE SHALL name a token the token file defines, and a test SHALL assert this. Today `--accent-danger` is referenced with a `#dc2626` fallback and defined nowhere (`src/dashboard_frontend/src/modules/shell/NowPage.tsx:142`).
5. WHEN the refresh lands THEN the CSS classes that no file under FE references SHALL be removed: the old-page classes at `src/dashboard_frontend/src/modules/theme/theme.css:246-505` and `:511-612`, and the component classes at `src/dashboard_frontend/src/modules/theme/tailwind.css:15-464`. Unlayered classes that share a name with a Tailwind utility (`.gap-N`, `.p-N` at `src/dashboard_frontend/src/modules/theme/tailwind.css:297-308`; `.font-mono`, `.tabular-nums` at `src/dashboard_frontend/src/modules/theme/theme.css:440-446`) SHALL be removed, so the Tailwind utility is the only rule for that name.

### Requirement 2 — No hard-coded colour or size outside the token file

**User Story:** As the operator, I want a check that fails when a component carries its own colour or size, so that the system does not drift page by page again.

#### Acceptance Criteria

1. WHEN `npm test` runs THEN a vitest test under `src/dashboard/__tests__/` SHALL scan every `.ts`, `.tsx` and `.css` file under FE except the token file and `src/dashboard_frontend/src/assets/fonts/fonts.css`, and SHALL fail on any of: a hex colour literal; a colour function (`rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`, `color-mix(` with a literal colour argument); a Tailwind palette colour class (`white`, `black` or a named palette such as `amber-600`, with any colour utility prefix and any `dark:` or state variant, including opacity forms such as `bg-black/50`); a `var()` fallback that is a literal colour; an arbitrary-value length class (`w-[13px]`); a pixel or rem literal in an inline `style`. The keywords `transparent`, `currentColor` and `inherit` are allowed. The vitest include pattern already covers that directory (`./vitest.config.ts:8`).
2. WHEN the test fails THEN its message SHALL name each offending file, line and matched text.
3. WHEN the refresh lands THEN the test SHALL pass. At base it fails on, at least, `src/dashboard_frontend/src/modules/shell/UsageTrend.tsx:13`, `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:192-193`, `src/dashboard_frontend/src/modules/shell/RunPage.tsx:454`, `src/dashboard_frontend/src/modules/shell/primitives.tsx:91`, `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:136` and `src/dashboard_frontend/src/modules/auth/LoginPanel.tsx:65` (red-first).
4. WHEN the Usage trend draws its series THEN the series colours SHALL come from chart tokens defined for both themes (today six literal hex values at `src/dashboard_frontend/src/modules/shell/UsageTrend.tsx:13`), and the cycle order by project name SHALL stay as it is.

### Requirement 3 — Both themes from the same tokens

**User Story:** As the operator, I want light and dark to be two values of the same tokens, so that each theme is complete and the two never disagree on structure.

#### Acceptance Criteria

1. WHEN the token file declares theme-varying tokens (colours and shadows) THEN it SHALL put them in two dedicated blocks — the light set under `:root`, the dark set under `.dark` — that hold only theme-varying tokens, and SHALL keep theme-independent tokens (spacing, type, radius, motion) in a third block under a selector that is neither `:root` nor `.dark`, so the three blocks are distinguishable by selector. A test SHALL assert the `:root` and `.dark` blocks declare the same set of custom-property names. This isolates the per-theme set so the comparison is well-defined; structural tokens are never duplicated into `.dark`.
2. WHEN the refresh lands THEN no `className` under FE SHALL use the `dark:` variant; a theme difference SHALL live only in token values. Today `dark:text-amber-400` and `dark:text-green-400` appear at `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:192-193` and `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:33` (red-first, covered by the Requirement 2 test or its own assertion).
3. WHEN the operator switches theme THEN native controls (checkbox, radio, switch, search field, scrollbars) SHALL follow the selected theme. Today `color-scheme: light dark` applies to both themes (`src/dashboard_frontend/src/modules/theme/tailwind.css:6-8`), so native controls follow the operating system instead (red-first, browser check).
4. The theme switch SHALL stay in the settings popover with the same control and labels (`src/dashboard_frontend/src/modules/shell/Gear.tsx:67-72`), the default theme SHALL stay dark, and the choice SHALL stay stored under the `theme` key (`src/dashboard_frontend/src/modules/theme/ThemeProvider.tsx:14-22`). Invariant (verified, not red-first).

### Requirement 4 — Restyled components with consistent states and visible focus

**User Story:** As the operator, I want every control of one kind to look and react the same on every page, and I want to see where the keyboard focus is, so that I can scan and operate the dashboard without guessing.

#### Acceptance Criteria

1. WHEN the refresh lands THEN each component kind SHALL be styled from one shared definition: sidebar nav row, group header, list row, detail panel, filter chip, button (primary, secondary, danger, ghost), text and search input, checkbox, radio and switch, tab, status pill, table, log view, pager, settings popover, mobile drawer and the sign-in dialog. Two instances of one kind on different views SHALL compute the same background, text colour, border, radius, height, padding and font size in the same state. A test SHALL assert this cross-view sameness for at least the list row, status pill and button kinds: it renders one instance of the kind on two different views and compares those seven computed properties in the resting state (red-first; the design names the harness).
2. WHEN a status is shown as a pill THEN it SHALL use one pill with a fixed tone set (success, warning, danger, info, accent, neutral). The status maps at `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:192-193`, `src/dashboard_frontend/src/modules/shell/RunPage.tsx:453-457`, `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:32-33`, `src/dashboard_frontend/src/modules/shell/SpecsPage.tsx:233-234` and `src/dashboard_frontend/src/modules/shell/DeferralsPage.tsx:49-50` SHALL each map a status to a tone; the status-to-meaning mapping (which status is a warning, which is done) SHALL not change.
3. WHEN a control is hovered, selected, disabled or busy THEN its look SHALL come from state tokens shared by its kind. Disabled controls SHALL share one treatment (today `disabled:opacity-40` and `disabled:opacity-50` both occur). A busy action button (the sign-in button at `src/dashboard_frontend/src/modules/auth/LoginPanel.tsx:64-67`) SHALL use the disabled treatment and keep its label text.
4. WHEN any focusable element receives keyboard focus THEN it SHALL show a focus ring from the focus token, at least 2 px wide, with at least 3:1 contrast against its surface, in both themes. This covers the focusable list rows (`src/dashboard_frontend/src/modules/shell/primitives.tsx:190-199`), nav links, chips, tabs, inputs, buttons, the drawer toggle and the dialog fields (red-first).
5. WHEN focus comes from a mouse click THEN the ring SHALL not show (`:focus-visible` semantics), so pointer use looks as it does today.
6. WHEN a style transitions THEN its duration and easing SHALL come from the motion tokens, and WHEN the system requests reduced motion THEN transition and animation durations SHALL be zero.
7. The log view (`src/dashboard_frontend/src/modules/shell/RunPage.tsx:660-698`) SHALL keep its filter, follow switch, scroll-to-bottom on follow and the monospace face; only its colours, borders, spacing and type change.

### Requirement 5 — Layout rules

**User Story:** As the operator, I want the same frame, widths and gutters on every page at every screen size, so that nothing jumps between pages and nothing scrolls sideways.

#### Acceptance Criteria

1. The breakpoints SHALL be Tailwind's default set (sm 640, md 768, lg 1024, xl 1280, 2xl 1536 px; `node_modules/tailwindcss/theme.css:279-283`). No file under FE SHALL use an arbitrary breakpoint variant or an `@media` width query outside that set. Invariant at base: a search of FE finds no `min-[`, `max-[` or `@media` (verified, not red-first).
2. The sidebar SHALL show as a column from lg and as a top bar with a drawer below lg, as it does at `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:113-131`. Invariant (verified, not red-first).
3. The detail panel SHALL sit beside the list from xl and stack under the list below xl, as at `src/dashboard_frontend/src/modules/shell/PageLayout.tsx:17-22`. Invariant: `e2e/worktree-shell.spec.ts:296-308` already proves the stack at 1000 px (verified, not red-first).
4. WHEN the viewport is wider than the sidebar plus the content maximum width THEN the main content (list plus panel) SHALL be no wider than 1600 px and SHALL be centred in the space right of the sidebar. At base `main` has no cap (`src/dashboard_frontend/src/modules/app/App.tsx:20`), so at 1920 px the content is wider than 1600 px (red-first).
5. The shell gutter SHALL be 16 px below sm and 24 px from sm on every view, from the shell (`src/dashboard_frontend/src/modules/app/App.tsx:20`), and no view SHALL add its own outer horizontal padding. Regression guard if it holds at base; the tasks author checks base first.
6. WHEN any of the six views is shown at 360, 768, 1000, 1440 or 1920 px wide, in either theme THEN `document.documentElement.scrollWidth - clientWidth` SHALL be 0 or less. The existing check covers five views at 1000 and 375 px (`e2e/worktree-shell.spec.ts:391-410`); the new widths and the Run view go in a new test. Regression guard if the base run is green; the tasks author runs it on base first.
7. The sidebar width (256 px, `lg:w-64` at `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:113`) and the panel width (384 px, `xl:w-96` at `src/dashboard_frontend/src/modules/shell/PageLayout.tsx:22`) SHALL keep their values and move into the token file.

### Requirement 6 — No functional change

**User Story:** As the operator, I want the refresh to change only the look, so that every habit and every test I rely on keeps working.

#### Acceptance Criteria

1. The routes SHALL stay as at `src/dashboard_frontend/src/modules/app/App.tsx:21-29`. Invariant (verified, not red-first).
2. The set of `data-testid`, `role` and `aria-*` attributes under FE, and the visible label text of every control, SHALL be the same before and after. Check: the sorted list of attribute-and-value strings found by `grep -rhoE '(data-testid|role|aria-[a-z-]+)=("[^"]*"|\{[^}]*\})' src/dashboard_frontend/src` is identical on base and branch; the pattern matches string-literal, brace-expression and template-literal value forms alike, so no attribute is invisible to it. Visible label text SHALL not change — no AC permits it and the before/after screenshots (R7) surface any that does. Invariant (verified, not red-first).
3. No file outside `src/dashboard_frontend/`, the new tests and this spec's directory SHALL change: the server, its routes, the WebSocket feed, the controller, `src/watch/` and the harness are untouched. Invariant (verified, not red-first).
4. No existing test SHALL be edited. The suites under `e2e/` and every vitest suite SHALL pass unchanged; the e2e suites assert no class name and no colour (only row height at `e2e/worktree-shell.spec.ts:242-256` and panel position at `:296-308`). New checks go in new blocks or files. Invariant (verified, not red-first).
5. The density radio SHALL still switch a row between 36 and 32 px (`e2e/worktree-shell.spec.ts:242-256`), the density choice SHALL stay stored under its key (`src/dashboard_frontend/src/modules/shell/ShellProvider.tsx:147`) and the group-collapse state under its key (`src/dashboard_frontend/src/modules/shell/primitives.tsx:25-40`, guarded by `e2e/worktree-shell.spec.ts:258`). Invariant (verified, not red-first).
6. `package.json` `dependencies` and `devDependencies` (`./package.json:56-108`) SHALL be unchanged: no new UI library, font package or CSS tool. Invariant (verified, not red-first).
7. The font files SHALL stay the bundled Inter and JetBrains Mono faces (`src/dashboard_frontend/src/assets/fonts/fonts.css:1-74`); no font loads from the network. Invariant (verified, not red-first).

### Requirement 7 — Before-and-after evidence and operator acceptance

**User Story:** As the operator, I want to see the before and after side by side, so that I can accept the new look before it merges.

#### Acceptance Criteria

1. WHEN the implementation starts THEN a script SHALL capture "before" screenshots of the six views in light and dark at 1440 by 900 px, from the base build, as a Playwright spec under the worktree project (`./playwright.worktree.config.ts:18-71`) that reuses the suite's runtime seeding (`seedClosedSpec` at `e2e/worktree-shell.spec.ts:51`, `WorktreeHarness` at `e2e/helpers/worktree-harness.ts:288`), so each view renders against seeded data, with one detail panel open where a view has one. WHEN the refresh is done THEN the same script SHALL capture the "after" set from the branch. The 24 images go to `screenshots/before/` and `screenshots/after/` in this spec's directory, named by view and theme.
2. The same script SHALL also capture each of the six views at 375 px in the after set, dark theme only, so the operator sees the stacked layout.
3. WHEN both sets exist THEN `verification-evidence.md` in this spec's directory SHALL list one line per view, `pending` until the operator reviews the pair, then `passed`. The retrospective does not open until every line reads `passed` (agent-rules, Fixtures and live verification).
4. WHEN the refresh is done THEN `npm run build`, `npx tsc --noEmit` and `npm test` SHALL be green, and the worktree e2e suite (`npm run test:e2e:worktree`) SHALL be green with no existing test edited.

## Non-Functional Requirements

### Accessibility
- In both themes, body and label text SHALL have at least 4.5:1 contrast on its surface, and large text, icons, borders of inputs and the focus ring at least 3:1 (WCAG 2.1 AA, 1.4.3 and 1.4.11). Where a palette value from the mock fails this, the token value is adjusted and the adjustment is listed in the design. A test SHALL compute the ratios from the token file for the text-on-surface pairs the design lists.

### Performance
- The built dashboard stylesheet SHALL be no larger than at base; the gate re-measures base, so the 54.58 kB uncompressed from the 2026-10-28 probe is a reference, not the bar.

## Decisions taken in this document

- D1 — Palette: adopt the Linear mock palette (neutral greys, indigo accent, the mock's success, warning and danger hues and chart series), shades adjusted where a value fails the contrast rule; options were adopt the mock palette; keep the current slate and indigo; design a new palette. Chosen because the mock is the approved redesign look.
- D2 — Breakpoints and width: keep Tailwind defaults, sidebar from 1024 px, panel beside the list from 1280 px, main content capped at 1600 px and centred; options were defaults with a 1600 px cap; a custom set at 768, 1000 and 1440 px; defaults with no cap; defaults with a 1440 px cap. Chosen because it keeps today's layout and the stack test; 1600 px only bites on wide monitors.
- D3 — Row density: keep 36 px comfortable and 32 px compact; options were keep 36 and 32 px; tighten to 32 and 28 px; one density at 32 px. Chosen because the mock uses 36 px and a behaviour test this spec may not edit asserts both.
- D4 — Terminal: not restyled; the watch view keeps its basic ANSI colours and the overwatch HUD is retired; options were leave it as is; map the palette to 24-bit colour in the watch view. Chosen because basic ANSI follows the operator's terminal theme.
- D5 — Type family: keep the bundled Inter and JetBrains Mono; options were keep them; Inter and Roboto Mono as in the mock; the system font stack. Chosen because they ship with the package and load offline.
- D6 — Widths: sidebar and panel stay at 256 and 384 px, not the mock's 208 and 360 px; options were keep today's; adopt the mock's. Chosen so the operator finds everything in place.
- D7 — The Run page counts as a view, so there are six views, not five; options were six views; the five nav pages only. Chosen because it is a routed page the refresh restyles.
- D8 — The hard-coded value check is a vitest test in the normal test command; options were a vitest test; a one-off search at the gate. Chosen because it stops later pages drifting.
- D9 — Unused and duplicate unlayered classes are removed; options were remove them; keep and restyle them. Chosen because nothing uses them, they carry literal colours, and the duplicates override Tailwind utilities.
- D10 — Screenshots run as a worktree Playwright spec reusing the e2e suite's runtime seeding, at 1440 by 900 px, plus 375 px for the after set; options were the e2e seeding; the operator's live stores. Chosen because the seeded fixtures are reproducible and show no real data.
- D11 — Status pills use six tones: success, warning, danger, info, accent and neutral; options were six tones; one tone per status value. Chosen because every status map falls into these groups.
- D12 — Native controls follow the selected theme, not the operating system; options were follow the theme; keep following the OS. Chosen because a dark page with light checkboxes is the inconsistency this removes.

## Scope notes

- Toasts: the entry lists toasts, but the frontend has none (browser notifications only); nothing is restyled or added.
- Translations: the entry says translations are untouched; this frontend has no i18n layer, so there is nothing to touch.
- Terminal HUD: cut by D4. The watch view's colours stay as they are.
- Frontend type checking: `npx tsc --noEmit` excludes the frontend (`./tsconfig.json:20`) and Vite does not type-check. This spec adds no frontend type check; it is a flag for the operator.
- Carried items from the decomposition: none.

## Revision History

- **v3** (2026-10-28) — Round-2 adversarial response (adversarial-analysis-requirements-r2.md, verdict iterate 1/1/1).
  - **R2-1 — Accepted (MUST_FIX).** Requirement 6.2's check now matches string-literal, brace-expression and template-literal attribute forms, so every test-id, role and aria attribute is compared, not only the double-quoted subset the prior pattern saw; the self-contradicting template-text clause is deleted.
  - **R2-2 — Accepted (SHOULD_FIX).** Requirement 4.1 now mandates a cross-view computed-style equality check for the list row, status pill and button kinds, so the one-system claim has a verification method; the design names the harness.
  - **R2-3 — Accepted (MINOR).** Requirement 3.1 now pins the light set to the root block, the dark set to the dark block and the structural tokens to a third block with a distinct selector, so the name-set test identifies each block unambiguously.
- **v2** (2026-10-28) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/3/3).
  - **R1-1 — Accepted (SHOULD_FIX).** Requirement 6.2's check now matches the role and aria attribute families, not only the test ids, and visible label text is pinned to the before/after screenshots, so the check covers all four classes it claims.
  - **R1-2 — Accepted (SHOULD_FIX).** Requirement 3.1 now mandates two dedicated theme-varying blocks, one light and one dark, holding colours and shadows only, with structural tokens kept in a separate block, so the name-set comparison is well-defined and structural tokens are never duplicated into the dark block.
  - **R1-3 — Accepted (SHOULD_FIX).** Requirement 7.1 now specifies the capture as a Playwright spec under the worktree project that reuses the suite's runtime seeding helpers, not the empty temporary stores the cited config sets up; also applied to decision D10.
  - **MINOR (methods for 1.2 and 1.4) — Partially accepted.** Added a test that every custom-property reference under the frontend names a token the file defines, and tied the row-height token to the density end-to-end test that proves the row renders 36 and 32 px.
  - **MINOR (client-state keys) — Partially accepted.** Requirement 6.5 now pins the density and group-collapse persistence keys as invariants; no new test, since style-only work does not touch them.
  - **MINOR (stylesheet-size baseline) — Partially accepted.** Marked the size figure a reference the gate re-measures, not the bar itself.
  - **Lint pass.** 0 fixed; L-1 through L-8 rejected as the AC's own check-rule vocabulary, not citation tokens.
- **v1** (2026-10-28) — Initial draft.
  - **Lint pass.** 4 fixed; L-2 rejected — the className term is the AC's subject, not a citation token, and the identifiers at those ranges are verified present.
