# Adversarial Analysis — dashboard-visual-refresh/design (v1, round 1)

First review. Primary surface: feasibility, consistency, edge cases. Deltas since
`162ccb68` were a lint pass (31 citation paths prefixed, the "All pass with the values
above" → "All pass" wording, one Revision-History line); no substantive content changed, so
the attack is the whole document against its scope (decomposition entry 22) and the code it
cites.

## Topics attacked

### 1. C6 — Usage chart SVG colour move (`UsageTrend.tsx`)
- Challenge the claim that the SVG colour attributes are "at lines 92, 98, 109, 116": line 92
  is `key={`base-${s.projectId}`}` and 93 is `data-testid`; the axis-colour attribute
  `stroke="var(--border-default)"` is at **line 88**.
- Stress-test the silent dependency: D13 moves colours to `style` because "the style
  attribute certainly resolves custom properties" — i.e. an SVG presentation attribute does
  not. If the axis at 88 is overlooked, `stroke="var(--border-default)"` stays a presentation
  attribute, the axis renders with no resolved stroke, and nothing catches it (T1 passes a
  declared `var()`; T4 asserts nothing about the axis).

### 2. C7 T4.1 — cross-view sameness test
- Challenge the assertion that two instances of one `data-variant` compute the same height,
  padding and font size: `Button` carries an independent `size?: 'sm' | 'md'` prop that drives
  exactly those three properties. Variant does not determine size.
- Stress-test "resting state (mouse parked off the element)": selection is a resting state
  too. Runs/Specs/Deferrals open the first row's panel (`--surface-selected`), so a selected
  row compared to an unselected row on another view differs in background.
- Challenge the row locator: only `Button`, `Pill`, `TextInput`, `Tab` get `data-ui`; the row
  has no documented locator, yet T4.1 must "find a row on two views."

### 3. Library-capability and contrast claims (verified)
- Playwright `emulateMedia({colorScheme, reducedMotion})` (`types.d.ts:2571-2602`) and
  `addInitScript(function)` (`:307`) exist in the installed 1.58.0.
- vite 7.3.0 `build --help` carries `--outDir` and `--emptyOutDir`.
- `@theme static` namespace-clear, name-emission, var-shorthand-compile and
  silent-drop-of-cleared-utility behaviour match the probe NOTES.
- Every Data Models contrast pair passes (ran `pal.cjs`); the two stated minima (light
  `--accent`/base 4.58, light `--tone-danger-fg`/bg 4.61) reproduce by hand.

## Findings

### R1-1 — C6 cites the wrong line for the axis SVG colour attribute — MUST_FIX
`design.md:106`: "The series colour and the axis colour move from SVG attributes (`stroke=`,
`fill=` at lines 92, 98, 109, 116)". In `UsageTrend.tsx`, line 92 is `key=` / line 93 is
`data-testid`; the four colour attributes are at **88** (axis `stroke="var(--border-default)"`),
98, 109, 116. A wrong line is an automatic MUST_FIX, and it has teeth: steered to line 92 the
implementer may leave line 88 as a presentation attribute, which does not substitute `var()`,
so the axis draws with an unresolved stroke — invisible to T1 (a declared `var()` passes the
scan) and to T4 (no axis check). (`codebase-context.md:91` carries the same slip; it is
drafter-written and unreviewed.) Fix: cite line 88, not 92, and keep the sentence's intent
that the axis colour moves to `style`.

### R1-2 — T4.1 pair-selection ignores the props the compared values depend on — SHOULD_FIX
`design.md:126` picks a pair by `data-tone`/`data-variant` and compares seven computed
properties "in the resting state". Three gaps make the equality assertion fail by design, not
by drift:
- **Button size.** `size?: 'sm' | 'md'` (`design.md:62`) drives height, padding and font size;
  two same-variant buttons at different sizes are a legal use of the API and will not match.
  Requirement 4.1 says "same state, tone and variant" — it never pins size.
- **Row selection.** T5 opens the first row's panel on Runs/Specs/Deferrals; a selected row
  (`--surface-selected`) compared to an unselected row elsewhere differs in background. The
  design guards hover ("mouse parked off") but not selection.
- **Row locator.** Only `Button`/`Pill`/`TextInput`/`Tab` get `data-ui`; the row has no stated
  selector, so "find a row on two views" cannot be written as described.
Fix: pin a shared size (e.g. a `data-size` attribute or restrict the picker to one size) and a
shared selection state, and give the row a locator. Left as-is, T4.1 false-fails or cannot be
authored → rework.

## Top 3 conclusions to challenge or reverse

1. "The colour attributes are at 92, 98, 109, 116." Reverse to 88, 98, 109, 116, and confirm
   the axis `stroke` moves to `style` — otherwise the axis line silently loses its colour.
2. "Same tone/variant ⇒ same seven computed properties." False while a variant is used at two
   sizes; the invariant must be stated per (variant, size), or the test must fix size.
3. "Resting state = mouse parked off." Selection is also a resting state; the picker must hold
   it constant or the cross-view comparison is not well-defined.

## What's missing before acting

- The C6 line fix (88) and an explicit "axis stroke moves to `style`" so the var() resolves.
- T4.1 pair-selection pinned on size and selection, plus a row locator.
- MINOR (not blocking): the active nav-row token is unnamed (`ui.navRow(active)` cites no tone);
  all needed tokens exist, so this is safely a later-phase value.

## Checked and clean (work shown)

Installed versions (playwright-core 1.58.0, vite 7.3.0, tailwindcss 4.1.18) match the document.
Citations resolve for ThemeProvider.tsx:2/15/19-22, main.tsx:7, RunsPage.tsx:188-196 and
301-319, RunPage.tsx:453-457, SpecsPage.tsx:30-35, pause.ts:48, App.tsx:20, PageLayout.tsx:22,
LoginPanel.tsx:37/44/65/67, ShellProvider.tsx:142, Sidebar.tsx:113/136/138. D18 (Discard→danger)
and the C5 status→tone maps preserve each status's meaning. Data Models declares every token the
components reference; the three-block/`@theme static` structure and D2's "selector" departure are
a recorded ruling (not re-opened). No server/API changes exist, so the error-branch-shape rule
(discriminant + status code) is N/A; "Error Handling" lists test-failure modes only, which is
appropriate for a style-only spec. Build-size and red-first sequencing are sound.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
