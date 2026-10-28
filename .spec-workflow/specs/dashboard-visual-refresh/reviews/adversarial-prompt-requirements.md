# Adversarial Review — dashboard-visual-refresh/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-visual-refresh
- Workflow root: /home/mcf/repo/spec-workflow-mcp

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v1.
- Changes: the diff from the `docs(sdd): dashboard-visual-refresh requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `dashboard-visual-refresh` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-visual-refresh/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-visual-refresh`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since c16560fc

````diff
diff --git a/.spec-workflow/specs/dashboard-visual-refresh/requirements.md b/.spec-workflow/specs/dashboard-visual-refresh/requirements.md
index 6aa39543..b9ff71e4 100644
--- a/.spec-workflow/specs/dashboard-visual-refresh/requirements.md
+++ b/.spec-workflow/specs/dashboard-visual-refresh/requirements.md
@@ -30,7 +30,7 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 
 #### Acceptance Criteria
 
-1. WHEN `npm test` runs THEN a vitest test under `src/dashboard/__tests__/` SHALL scan every `.ts`, `.tsx` and `.css` file under FE except the token file and `src/dashboard_frontend/src/assets/fonts/fonts.css`, and SHALL fail on any of: a hex colour literal; a colour function (`rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`, `color-mix(` with a literal colour argument); a Tailwind palette colour class (`white`, `black` or a named palette such as `amber-600`, with any colour utility prefix and any `dark:` or state variant, including opacity forms such as `bg-black/50`); a `var()` fallback that is a literal colour; an arbitrary-value length class (`w-[13px]`); a pixel or rem literal in an inline `style`. The keywords `transparent`, `currentColor` and `inherit` are allowed. The vitest include pattern already covers that directory (`vitest.config.ts:8`).
+1. WHEN `npm test` runs THEN a vitest test under `src/dashboard/__tests__/` SHALL scan every `.ts`, `.tsx` and `.css` file under FE except the token file and `src/dashboard_frontend/src/assets/fonts/fonts.css`, and SHALL fail on any of: a hex colour literal; a colour function (`rgb(`, `rgba(`, `hsl(`, `hsla(`, `oklch(`, `color-mix(` with a literal colour argument); a Tailwind palette colour class (`white`, `black` or a named palette such as `amber-600`, with any colour utility prefix and any `dark:` or state variant, including opacity forms such as `bg-black/50`); a `var()` fallback that is a literal colour; an arbitrary-value length class (`w-[13px]`); a pixel or rem literal in an inline `style`. The keywords `transparent`, `currentColor` and `inherit` are allowed. The vitest include pattern already covers that directory (`./vitest.config.ts:8`).
 2. WHEN the test fails THEN its message SHALL name each offending file, line and matched text.
 3. WHEN the refresh lands THEN the test SHALL pass. At base it fails on, at least, `src/dashboard_frontend/src/modules/shell/UsageTrend.tsx:13`, `src/dashboard_frontend/src/modules/shell/RunsPage.tsx:192-193`, `src/dashboard_frontend/src/modules/shell/RunPage.tsx:454`, `src/dashboard_frontend/src/modules/shell/primitives.tsx:91`, `src/dashboard_frontend/src/modules/shell/Sidebar.tsx:136` and `src/dashboard_frontend/src/modules/auth/LoginPanel.tsx:65` (red-first).
 4. WHEN the Usage trend draws its series THEN the series colours SHALL come from chart tokens defined for both themes (today six literal hex values at `src/dashboard_frontend/src/modules/shell/UsageTrend.tsx:13`), and the cycle order by project name SHALL stay as it is.
@@ -85,7 +85,7 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 3. No file outside `src/dashboard_frontend/`, the new tests and this spec's directory SHALL change: the server, its routes, the WebSocket feed, the controller, `src/watch/` and the harness are untouched. Invariant (verified, not red-first).
 4. No existing test SHALL be edited. The suites under `e2e/` and every vitest suite SHALL pass unchanged; the e2e suites assert no class name and no colour (only row height at `e2e/worktree-shell.spec.ts:242-256` and panel position at `:296-308`). New checks go in new test blocks or new files. Invariant (verified, not red-first).
 5. The density radio SHALL still switch a row between 36 and 32 px (`e2e/worktree-shell.spec.ts:242-256`). Invariant (verified, not red-first).
-6. `package.json` `dependencies` and `devDependencies` (`package.json:56-108`) SHALL be unchanged: no new UI library, font package or CSS tool. Invariant (verified, not red-first).
+6. `package.json` `dependencies` and `devDependencies` (`./package.json:56-108`) SHALL be unchanged: no new UI library, font package or CSS tool. Invariant (verified, not red-first).
 7. The font files SHALL stay the bundled Inter and JetBrains Mono faces (`src/dashboard_frontend/src/assets/fonts/fonts.css:1-74`); no font loads from the network. Invariant (verified, not red-first).
 
 ### Requirement 7 — Before-and-after evidence and operator acceptance
@@ -94,7 +94,7 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 
 #### Acceptance Criteria
 
-1. WHEN the implementation starts THEN a script SHALL capture "before" screenshots of the six views in light and dark at 1440 by 900 px, from the base build, against the fixture stores of the worktree e2e harness (`playwright.worktree.config.ts:18-71`), with one detail panel open on each view that has one. WHEN the refresh is done THEN the same script SHALL capture the "after" set from the branch. The 24 images go to `screenshots/before/` and `screenshots/after/` in this spec's directory, named by view and theme.
+1. WHEN the implementation starts THEN a script SHALL capture "before" screenshots of the six views in light and dark at 1440 by 900 px, from the base build, against the fixture stores of the worktree e2e harness (`./playwright.worktree.config.ts:18-71`), with one detail panel open on each view that has one. WHEN the refresh is done THEN the same script SHALL capture the "after" set from the branch. The 24 images go to `screenshots/before/` and `screenshots/after/` in this spec's directory, named by view and theme.
 2. The same script SHALL also capture each of the six views at 375 px in the after set, dark theme only, so the operator sees the stacked layout.
 3. WHEN both sets exist THEN `verification-evidence.md` in this spec's directory SHALL list one line per view, `pending` until the operator reviews the pair, then `passed`. The retrospective does not open until every line reads `passed` (agent-rules, Fixtures and live verification).
 4. WHEN the refresh is done THEN `npm run build`, `npx tsc --noEmit` and `npm test` SHALL be green, and the worktree e2e suite (`npm run test:e2e:worktree`) SHALL be green with no existing test edited.
@@ -128,9 +128,10 @@ Terms: **token file** is the one CSS file that defines every design token; **FE*
 - Toasts: the entry lists toasts, but the frontend has none (browser notifications only, from the shell provider). Nothing is restyled or added for them.
 - Translations: the entry says translations are untouched. This frontend has no i18n layer (no locale files, no translation hook), so there is nothing to touch.
 - Terminal HUD: cut by D4. The watch view's colours stay as they are.
-- Frontend type checking: `npx tsc --noEmit` excludes the frontend (`tsconfig.json:20`) and the Vite build does not type-check. This spec does not add a frontend type check; it is a flag for the operator.
+- Frontend type checking: `npx tsc --noEmit` excludes the frontend (`./tsconfig.json:20`) and the Vite build does not type-check. This spec does not add a frontend type check; it is a flag for the operator.
 - Carried items from the decomposition: none.
 
 ## Revision History
 
 - **v1** (2026-10-28) — Initial draft.
+  - **Lint pass.** 4 fixed; rejected: L-2 — `className` is the AC's subject term (the JSX attribute), not a token the citation locates; the identifiers those ranges support, `dark:text-amber-400` and `dark:text-green-400`, are present and verified at RunsPage.tsx:192-193 and SpecsPage.tsx:33.

````
