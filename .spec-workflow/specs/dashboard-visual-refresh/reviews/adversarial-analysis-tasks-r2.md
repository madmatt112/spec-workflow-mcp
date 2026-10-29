# Adversarial Review — dashboard-visual-refresh/tasks (v2, round 2)

Attack surface: **atomicity, ordering, coverage**. Fresh lens this round: none mandated;
applied the memory's unprobed lenses (Success-clause completion precision; task-4 cross-view
pair guarantee; T1 utility-name assertability). Deltas since `d6efd66a` attacked first.

## Delta since v1 — verified clean (fix-induced re-check of R1-1)

The v2 diff is the R1-1 fix only: task 6 gained `3.4` in its `_Requirements` line, and its prompt
gained one gate clause inside the existing "against the merge base" check list:
> "ThemeProvider.tsx is unchanged so the default theme stays dark and the choice stays stored
> under the theme key and the theme control and its labels are present in Gear.tsx (Requirement 3.4)".

Scoped the re-check to that clause against Requirement 3.4 and the code it cites:

- **Requirement 3.4** (`requirements.md:47`) has three prongs: control+labels stay in the popover
  (`Gear.tsx:67-72`), default stays dark, choice stays under the `theme` key
  (`ThemeProvider.tsx:14-22`). **`design.md:214`** lists 3.4 among invariants "checked at the
  verification gate." The fix now checks it at the gate — realigned, which is exactly R1-1's ask.
- **Code verified directly (delta artifacts):** `ThemeProvider.tsx:16` returns `'dark'` as the
  default and `:15,:21` read/write `localStorage` key `'theme'`; so a byte-unchanged
  ThemeProvider.tsx does guarantee default-dark and the storage key — the stated inference is
  sound. `Gear.tsx:68` renders the "Theme" label and `:69-71` the toggle button
  ("Dark"/"Light"), so "theme control and its labels are present in Gear.tsx" is true.
- **No contradiction introduced.** No task lists `ThemeProvider.tsx` in a `File:` line; it carries
  no T1 scan hit (no hex, palette class, `var()` fallback, arbitrary length, or `dark:` variant —
  `classList.toggle('dark', …)` is a JS string, not a `dark:` utility), so the task-5 sweep never
  needs to touch it. The "unchanged" gate check is satisfiable and consistent with the sweep.
- **Success-clause coverage holds.** Task 6's new check is an invariant, not a `Test:`; its
  success clause ("every invariant check above is recorded with its output") already subsumes it.

No MUST_FIX in the delta. R1-1 is resolved (was the only open item).

## Fresh-lens probes run (and cleared)

- **Success-clause completion precision.** Task 6's gate list and its success clause match; the
  3.4 check is captured by "every invariant check above." No silently-dropped gate item.
- **Task-4 cross-view pair guarantee (T4.1).** The seed (D9) adds one resolved deferral so a
  success pill shows on two views, and the task carries its own fallback — "if the seed lacks a
  pair for a kind, add the fixture to e2e/helpers/shell-seed.ts" with the test naming the kind
  when no pair exists. Self-correcting completion criterion, not a gap.
- **T1 utility-name rule assertability.** The rules beyond the seven prototype regexes are
  documented as implementer-authored from design C7 (Scope notes), and task 5's `Success:` clause
  asserts T1 fails on an added "undeclared utility" — an assertable criterion. Not a gap.
- **Gate B/C.** No task adds an external dependency (Requirement 6.6 bars it); adding 3.4 to task
  6 tracks an approved, design-mandated gate invariant, so no over-scope. Nothing to escalate.

## Findings

None. The one open item from round 1 (R1-1, SHOULD_FIX) is resolved by the v2 delta, verified
against `requirements.md:47`, `design.md:214`, `ThemeProvider.tsx` and `Gear.tsx`.

## Top risks/gaps

- None at MUST_FIX or SHOULD_FIX. The dependency chain, bridge, bare-radius sweep, scan-hit
  coverage and test seams were cleared in round 1 and the delta does not disturb them.

## Top 3 conclusions to challenge

1. **"Task 6 realises the design's full gate checklist."** Round 1 reversed this (3.4 dropped);
   v2 restores it. Verified — no longer reversible.
2. **"ThemeProvider.tsx unchanged ⇒ 3.4 holds."** Challenged and upheld against the code.
3. **"Planned verifier spend: four / no agent-rules sensitive path."** Unchanged by the delta;
   still true. Do not reverse.

## What's missing before acting

Nothing. The chain, bridge, sweep, test seams and the 3.4 gate check are all complete.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: yes
ESCALATE: none
```
