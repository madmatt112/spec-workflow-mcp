# Adversarial Analysis — dashboard-visual-refresh/requirements (v1, round 1)

First review. Attack surface: completeness, ambiguity, scope. Fresh lens: wire
contracts across a boundary (router, query params, response shapes, client state).

## What I checked and how

Deltas since `c16560fc` first (the lint pass): the only changes are `./`-prefixed
citations and a Revision-History note. I re-verified each touched citation —
`./vitest.config.ts:8` (include `src/**/*.{test,spec}.{js,ts}`, excludes only
`src/dashboard_frontend/**`, so `src/dashboard/__tests__/` is covered), `./package.json:56-108`
(dependencies 56-90, devDependencies 91-108), `./playwright.worktree.config.ts:18-71`,
`./tsconfig.json:20` (`exclude` includes `src/dashboard_frontend/**`). All accurate.
L-2 is a closed ruling in the Revision History; not reopened.

Citations verified against code (all accurate): the six routes and six views
(`App.tsx:21-29`, `:22-27`); `main` gutters `px-4 sm:px-6`, no cap (`App.tsx:20`);
row-height writes `'32px'`/`'36px'` (`ShellProvider.tsx:142`); theme key + default dark
(`ThemeProvider.tsx:14-22`); `--accent-danger` with `#dc2626` fallback is defined nowhere
(confirmed against `theme.css:7-221`); red-first sites `UsageTrend.tsx:13` (six hex),
`RunPage.tsx:454` (`#22c55e`/`green-*`/`dark:`), `RunsPage.tsx:192-193`
(`#f59e0b`/`amber-*`/`dark:`), `primitives.tsx:91` (`var(--accent-primary,#2563eb)` +
`text-white`), `Sidebar.tsx:136` (`bg-black/50`), `LoginPanel.tsx:65` (`text-white`);
`color-scheme: light dark` on both themes (`tailwind.css:6-8`); layout citations
(`PageLayout.tsx:17-22`, `Sidebar.tsx:113`, `primitives.tsx:190-199`); e2e ranges
(`:242-256`, `:296-308`, `:391-410`).

Re-probed drafter claims:
- **Unused classes (R1.5 / D9).** Grepped FE `.tsx` for every bespoke class name
  (`app-header`, `status-badge`, `btn-*`, `card`, `modal-*`, `kanban`, `markdown-content`,
  `nav`, `panel`, `task`, `table`, `input`): the only hits are `--surface-panel` substrings.
  None are referenced. Removal is safe. **But note:** `.hljs` and `.markdown-content` are
  normally applied at runtime by a highlighter, which a `.tsx`-className probe cannot see.
  `highlight.js` and `markdown-it` are live deps (`package.json:76,78`). I grepped the whole
  FE for `markdown-it`/`highlight.js`/`hljs`/`markdown-content`/`dangerouslySetInnerHTML`:
  no FE code renders markdown. Those classes are genuinely dead; removal is safe. The
  method the drafter described was blind to this risk and got the right answer by luck.
- **R5.1 invariant** (`no @media / min-[ / max-[` in FE): grep confirms zero matches.

## Findings

### R1-1 — SHOULD_FIX — R6.2 asserts a role/aria/label invariant but only checks `data-testid`

Requirement 6.2 claims four things are identical before and after: `data-testid` values,
`role` values, `aria-*` attributes, and visible label text. The `Check:` clause supplies a
command for exactly one of them (`grep -rhoE 'data-testid=[^ >]+' ...`). Nothing verifies
`role`, `aria-*`, or label text.

These are precisely the attributes most at risk under Requirement 4.1, which rebuilds every
component "from one shared definition" — tabs, chips, inputs, the drawer, the dialog.

Failure scenario: the tab component (`RunPage.tsx:640-653`, `role="tablist"`/`role="tab"`)
or the chip (`primitives.tsx:88`, `aria-pressed`) is rebuilt from the shared definition and
drops its role/aria-pressed. The `log-tab-*`/`chip-*` testids survive, so the data-testid
grep stays identical, every suite passes, and the accessibility regression merges green —
the exact "no functional change" the requirement promises, unverified.

Fix: give the invariant a check (extend the grep to `role=`/`aria-`, and an assertion for
label text), or state the test that enforces it.

### R1-2 — SHOULD_FIX — R3.1's "compare the two name sets" is undefined against the real token structure

Requirement 3.1: "WHEN the token file defines a colour **token** for one theme THEN it SHALL
define the same token name for the other theme, and a test SHALL compare the two name sets."

The token file mixes theme-independent tokens (spacing, type, radius, motion — defined once
in `:root`, `theme.css:11-66`) with theme-dependent ones (colours in `:root` **and** `.dark`;
shadows in **both**, `:56-59`/`:209-212`). "The two name sets" is only well-defined for the
colour subset, and the AC gives the test no way to identify which `--x` is a colour token.

Failure scenario: an implementer writes the mandated test as "every custom property in
`:root` also appears in `.dark`." It fails on `--space-*`, `--text-*`, `--radius-*`,
`--transition-*` (correctly absent from `.dark`). To make the test green they either need an
unstated rule for "colour token," or they wrongly duplicate every structural token into
`.dark`. The requirement neither mandates a structure that makes the comparison well-defined
nor defines "colour token."

Fix: either require a structure that isolates per-theme colour tokens (e.g. a dedicated
light/dark colour block), or define the colour-token set the test compares.

### R1-3 — SHOULD_FIX — R7.1 cites the e2e config as "fixture stores"; the fixtures are seeded at runtime, not there

Requirement 7.1: "a script SHALL capture ... against the fixture stores of the worktree e2e
harness (`./playwright.worktree.config.ts:18-71`)."

`playwright.worktree.config.ts:18-71` holds no fixtures. It sets `SPEC_WORKFLOW_HOME` and
`XDG_STATE_HOME` to **empty** temp directories (`:8`,`:12`). The fixture data (registered
projects, specs, closed-spec rows, runs) is created at runtime by the suite's helpers —
`WorktreeHarness` and `seedClosedSpec` in `e2e/worktree-shell.spec.ts` / `e2e/helpers/`.

Failure scenario: the screenshot "script" is built pointing at the cited config, as written.
It stands up a dashboard against empty temp stores and captures a blank/empty "before" set,
with no detail panels to open (R7.1 requires one open panel per view). The operator's
accept/reject gate (R7.3) then compares two empty-ish sets.

Fix: name the fixture-seeding path the script must reuse (`WorktreeHarness` /
`seedClosedSpec`), or specify the script as a Playwright spec under the worktree project so
it inherits the seeding, rather than citing the config as the fixture source.

## Minor (do not drive the verdict)

- R1.2 (write a token reference to `--row-h`, not `'32px'`) and R1.4 (every `var()` names a
  defined token) state no verification method; R1.4 is not in the R2.3 red-first list and the
  R2 lint checks colour literals, not undefined var references.
- Client-state keys beyond `theme` are unpinned: density (`DENSITY_KEY`, `ShellProvider.tsx:147`)
  and group-collapse state. Group collapse is guarded by the existing e2e
  (`worktree-shell.spec.ts:258`); density across reload is not. Style-only work should not
  touch them, but R6 pins only the `theme` key.
- The NFR baseline "54.58 kB uncompressed" is a drafter probe I did not independently rebuild
  (a full `npm run build`); the NFR holds regardless since it re-measures base at the gate.

## Top 3 conclusions to challenge or reverse

1. **"No functional change (R6) is verified."** It is verified for `data-testid` only.
   Role, aria, and label invariants — the accessibility contract — have no check. Reverse the
   "verified" claim until R1-1 is fixed.
2. **"R3.1's name-set test is implementable as stated."** Not against a file that mixes
   theme-independent and theme-dependent tokens. The AC needs either a structural mandate or a
   definition of "colour token" (R1-2).
3. **"R7.1's script can capture the real views from the cited config."** The config points at
   empty temp stores; without the suite's seeding the before/after sets are empty (R1-3).

## What's missing before acting

- A stated verification for the `role`/`aria-*`/label-text invariant in R6.2.
- A token-file structure (or a definition of "colour token") that makes R3.1's comparison
  well-defined.
- The fixture-seeding path the R7 screenshot script reuses, or its spec-ification as a
  worktree Playwright spec.
- Explicit test methods for R1.2 and R1.4 (nice-to-have; design may absorb them).

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 3
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
