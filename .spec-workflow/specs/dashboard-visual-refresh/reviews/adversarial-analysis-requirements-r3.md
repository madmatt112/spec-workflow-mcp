# Adversarial Analysis — dashboard-visual-refresh/requirements (v3, round 3)

Attack surface: completeness, ambiguity, scope. Deltas attacked first (the three v3
accepts: R2-1 grep, R2-2 cross-view test, R2-3 block selectors). Fresh lens this round:
**cross-requirement contradiction sweep** (prior rounds used wire contracts, then
testability/falsifiability).

## What I checked and how

- **R2-1 (R6.2 grep) — verified on real code.** Ran the new command
  `grep -rhoE '(data-testid|role|aria-[a-z-]+)=("[^"]*"|\{[^}]*\})' src/dashboard_frontend/src`.
  It emits **102** matches against a broad `name=` baseline of **102**, and **86/86**
  `data-testid`. Every form the v2 grep dropped now emits: `role={onClick ? 'button' :
  undefined}` (primitives.tsx:191), `aria-pressed={on}` (primitives.tsx:88),
  `aria-expanded={!collapsed}` (primitives.tsx:47), `data-testid={testId}`
  (primitives.tsx:194). **R2-1's drop-entire-attribute defect is resolved.** One narrow
  residue (R3-2 below): interpolated template literals truncate.
- **R2-3 (R3.1 block selectors)** — the AC now pins light→`:root`, dark→`.dark`,
  structural→a third selector that is neither; the name-set test compares `:root` vs
  `.dark`. `html` (0,0,1) for structural and `:root`/`.dark` (0,1,0) for colour are
  distinct selectors over disjoint token sets, both ancestors of the tree, no cascade
  clash. **Resolved.**
- **R2-2 (R4.1 cross-view test)** — direction accepted, but the added test is
  mis-specified for two of its three named kinds (R3-1 below).
- Grounded the pill/button colour-by-tone facts at RunsPage.tsx:188-197,
  RunPage.tsx:453-457, RunsPage.tsx:306, LoginPanel.tsx:65.

## Findings

### R3-1 — MUST_FIX — Novel (cross-requirement lens) — fix-induced — Compounds: R2-2 — R4.1's new cross-view computed-style test fails on a correct implementation for the pill and button kinds

The R2-2 fix added to Requirement 4.1: "A test SHALL assert this cross-view sameness for
at least the list row, **status pill and button** kinds: it renders one instance of the
kind on two different views and compares those seven computed properties
[background, text colour, border, radius, height, padding, font size] in the resting
state."

But two of the three named kinds carry a background and text colour that **varies by
sub-type, by design**, and the test fixes only the *state* (resting), not the sub-type:

- **Status pill** — Requirement 4.2 mandates six tones (success, warning, danger, info,
  accent, neutral). A `paused`/`waiting` pill is warning (amber: `#f59e0b` bg,
  amber-600/400 text, `RunsPage.tsx:192-193`); a `done` task pill is success (green:
  `#22c55e` bg, green-600/400 text, `RunPage.tsx:454`); `error` is danger
  (`--status-error`); `queued`/`done`/`abandoned` are neutral (`RunsPage.tsx:191-196`).
  Different views render different-tone pills in the resting state.
- **Button** — R4.1 itself enumerates four variants "button (primary, secondary, danger,
  ghost)". Danger is `bg-[var(--status-error)] text-white` (`RunsPage.tsx:306`); primary
  (sign-in) is `bg-[var(--interactive-primary)] text-white` (`LoginPanel.tsx:65`); ghost
  is transparent. Different background by design.

The test as specified — "one instance of the kind on two different views" — does not
constrain tone or variant. The natural implementation grabs whatever pill/button each
view renders, so it compares a warning pill to a success pill (or a danger button to a
primary button), their background and text colour legitimately differ, and the mandated
equality check **fails on a correct implementation**. Only the list row (shared `Row`,
one visual style, `primitives.tsx:178-203`) satisfies the seven-property comparison
cleanly. This is a direct contradiction between R4.1 and R4.2, introduced by the v3
delta.

Failure scenario: the implementer writes the test exactly as the AC states, picking any
pill on Runs and any pill on Specs. On a perfectly refreshed build the two pills are
different tones, background and text colour differ, the test is red, and the gate blocks
a correct refresh — or the implementer silently narrows the check (drops colour, or
hand-picks same-tone instances) without the AC saying so, and the drift the test was
added to catch goes unchecked for colour.

Fix: constrain the comparison to same-tone pills and same-variant buttons, or restrict
the seven-property equality for the pill and button kinds to the tone/variant-invariant
properties (border, radius, height, padding, font size) and compare background/text
colour only within a fixed tone and variant. The list row needs no change.

### R3-2 — MINOR — Compounding (fix-induced) — Compounds: R2-1 — R6.2's grep truncates interpolated template literals at the first inner `}`

The `\{[^}]*\}` branch stops at the first `}`, which for an interpolated template literal
is the `}` of the first `${…}`. Measured on real code: `data-testid={`pr-row-${read.repo}-${read.number}`}`
(`RunPage.tsx:357`) emits only `data-testid={`pr-row-${read.repo`; all 28 interpolated
templates truncate the same way, dropping any template text after the first
interpolation (`log-tab-${tb.id}` emits `…${tb.id`, etc.).

So the AC's claim that the pattern matches "template-literal value forms **alike**" (i.e.
as fully as string-literals) overclaims: template values are matched only up to their
first interpolation. The practical risk is small — the before/after set still catches a
dropped attribute (the truncated string vanishes), a changed static prefix, and the
unchanged e2e suite (R6.4) plus the screenshots (R7) backstop any change to a testid's
tail or a label. Not loop-keeping on its own; worth a one-line honesty fix to the claim
or a regex that consumes nested braces.

## Top 3 conclusions to challenge

1. **"R2-2 is resolved — R4.1 now has a cross-view test."** The test is well-defined only
   for the list row. For the pill and button kinds it compares background and text colour
   across sub-types that differ by design (six tones, four variants), so it fails on a
   correct implementation (R3-1). Reverse "Accepted (resolved)" until the comparison fixes
   tone/variant.
2. **"R6.2 now matches template-literal forms alike."** It matches them truncated at the
   first interpolation, not alike (R3-2). The core R2-1 defect (whole attributes invisible)
   is fixed; the "alike" wording is not accurate.
3. **"The before/after capture opens a detail panel on every view (R7.1)."** Still carried
   from R2 as a design-phase thread, not a requirements finding: the AC says "one detail
   panel open where a view has one" — the design must confirm the suite's seeding produces
   an openable panel on Now and Deferrals, not only on Runs/Run/Specs.

## What's missing before acting

- A tone/variant constraint on R4.1's cross-view equality for the pill and button kinds
  (R3-1 — blocking).
- An honest statement of the R6.2 grep's template-literal behaviour, or a nested-brace
  regex (R3-2).

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
