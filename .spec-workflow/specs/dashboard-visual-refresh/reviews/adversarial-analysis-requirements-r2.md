# Adversarial Analysis — dashboard-visual-refresh/requirements (v2, round 2)

Attack surface: completeness, ambiguity, scope. Deltas attacked first (the three
accepted R1 fixes and three partial accepts in the v2 Revision History). Fresh lens
this round: **acceptance-criteria testability / falsifiability** (prior round used
wire contracts).

## What I checked and how

Verified every new or changed citation the v2 delta introduced:

- **R6.5** — `ShellProvider.tsx:147` (`localStorage.setItem(DENSITY_KEY, d)`) ✓;
  `primitives.tsx:25-40` (group `useState` + `toggle`, key `shell.groups.${name}`) ✓;
  `e2e/worktree-shell.spec.ts:258` (test "a collapsed group stays collapsed after a
  reload") ✓.
- **R7.1 / D10** — `seedClosedSpec` declared at `e2e/worktree-shell.spec.ts:51` ✓;
  `WorktreeHarness` class at `e2e/helpers/worktree-harness.ts:288` ✓. The R1-3 fix now
  points the capture at the suite's runtime seeding, not the empty temp stores — the
  direction is correct and the citations are accurate.
- **R1.2** — `e2e/worktree-shell.spec.ts:242-256` proves the row renders 36/32 px ✓.
- **R3.1** — restructure into light/`.dark`/structural blocks; it explicitly forbids
  duplicating structural tokens into `.dark`, which is the correct fix for R1-2.

All accurate except the R6.2 check command, which is broken (R2-1 below).

## Findings

### R2-1 — MUST_FIX — Recurring / Compounding (fix-induced) — Compounds: R1-1 — R6.2's new grep silently drops 36% of test-ids and most role/aria attributes

The R1-1 fix rewrote R6.2's check to:

```
grep -rhoE '(data-testid|role|aria-[a-z-]+)="[^"]*"' src/dashboard_frontend/src
```

The `="[^"]*"` anchor matches **only double-quoted string-literal attribute values**.
In this frontend most of the attributes the AC pins are **JSX-expression valued**, so
the command cannot see them. Measured against the real code:

- **data-testid: 55 of 86 matched; 31 missed.** Every brace/template form is dropped,
  including `data-testid={\`log-tab-${tb.id}\`}` (`RunPage.tsx:648`) and
  `data-testid={\`chip-${chip.value}\`}` (`primitives.tsx:87`) — the log tabs and
  filter chips, the exact components R1-1 named as the a11y-regression risk — plus
  `data-testid={testId}` on the shared `Row` (`primitives.tsx:194`).
- **role: `role={onClick ? 'button' : undefined}` on the shared `Row`
  (`primitives.tsx:191`) is missed.** Only the five string-literal roles (`dialog`,
  `img`, `switch`, `tab`, `tablist`) are matched.
- **aria: 4 of ~10 matched.** Missed: `aria-pressed={on}` (chip, `primitives.tsx:88`),
  `aria-expanded={!collapsed}` (group, `primitives.tsx:47`), a second `aria-expanded`,
  `aria-pressed={launchOpen}`, `aria-selected={tab…}` (tabs), and the template-literal
  `aria-label={\`Approve…\`}`.

This also **self-contradicts**: the AC says "with template-literal values compared by
their template text," but the cited grep emits nothing for any template literal, so
there is nothing to compare. The old v1 grep (`data-testid=[^ >]+`) matched all 86
test-ids including brace/template forms; the v2 rewrite **regressed** that to 64% while
adding role/aria families that are themselves ~45% covered.

Failure scenario: Requirement 4.1 rebuilds the chip, the `Row` and the tabs "from one
shared definition." The rebuild drops `aria-pressed` from the chip (or `role=button`
from `Row`, or `aria-selected` from a tab). Those attributes never appear in the grep
output on base or branch, so the two sorted lists stay byte-identical, every suite
passes, and the accessibility regression merges green — the precise "no functional
change" the requirement promises, left unverified for the majority of role/aria
attributes and a third of the test-ids.

Fix: match expression-valued and template-literal forms too (drop the `"` anchor, e.g.
`(data-testid|role|aria-[a-z-]+)=("[^"]*"|\{[^}]*\})`, then normalise), or state the
actual test/normalisation rule; do not claim the current command lists role, aria, or
template-literal values.

### R2-2 — SHOULD_FIX — Novel (fresh lens: testability) — R4.1's "compute the same" is the spec's central claim and has no mandated verification

Requirement 4.1: "Two instances of one kind on different views SHALL compute the same
background, text colour, border, radius, height, padding and font size in the same
state." This is the core promise of the whole refresh, yet it is the only major claim
with **no test method**, while R1.4 (var-ref test), R2.1 (hard-coded-value test), R3.1
(name-set test) and Accessibility (ratio test) each name one. R2.1 only forbids
*literal* colours/sizes; two components can both use tokens yet pick *different* tokens
and still pass R2 — exactly the per-page drift the spec exists to stop.

As written the clause is unfalsifiable: nothing renders two instances and compares
`getComputedStyle`. Failure scenario: the Specs list row and the Runs list row are each
styled from "shared" helpers that resolve to different padding tokens; R2 is green, the
screenshots (desktop + 375 px) are reviewed per-view not cross-view, and the divergence
ships. Fix: mandate a computed-style equality check for at least the pill, list row and
button kinds, or state that the design must define it.

### R2-3 — MINOR — Compounding — Compounds: R1-2 — R3.1 names the `.dark` block but not the light block's selector

The R1-2 fix mandates "two dedicated blocks — one light, one `.dark`" and "a test SHALL
assert the light and `.dark` blocks declare the same set of custom-property names." The
`.dark` block is identifiable by its selector; the **light block's selector is
unnamed**, and structural tokens now move to "a separate block" whose selector is also
unstated. If both the light-colour block and the structural block use `:root`, the test
cannot tell which `:root` is "the light block." Resolvable in design by giving each
block a distinct selector; worth pinning so the mandated test is well-defined.

## Top 3 conclusions to challenge

1. **"R1-1 is resolved — R6.2 now covers role/aria/label."** It is not. The new grep
   covers the string-literal subset only; the chip `aria-pressed`, the tab
   `aria-selected`, the `Row` `role=button` and 31 brace/template test-ids are invisible
   to it. Reverse the "Accepted (resolved)" status until R2-1 is fixed.
2. **"The refresh's one-system guarantee is enforced."** R4.1's cross-view sameness —
   the whole point — has no check (R2-2); R2's literal scan does not catch two valid
   tokens disagreeing.
3. **"The before/after capture is fully specified (R7.1)."** Direction and citations are
   now correct, but whether the suite's seeding opens a detail panel on *every* view
   (Deferrals, Now) is unproven; the design must confirm the seeded fixtures satisfy
   "one detail panel open on each view that has one."

## What's missing before acting

- A R6.2 check that actually emits role, aria-*, and template-literal/expression
  test-ids (R2-1 — blocking).
- A verification method for R4.1's cross-view computed-style sameness (R2-2).
- A named selector for R3.1's light and structural blocks so the name-set test is
  well-defined (R2-3).

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
