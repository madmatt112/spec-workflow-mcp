# Adversarial Analysis — dashboard-visual-refresh/requirements (v4, round 4)

Attack surface: completeness, ambiguity, scope. Deltas attacked first (the two v4
accepts: R3-1 R4.1 tone/variant constraint, R3-2 R6.2 nested-brace regex). Fresh lens:
scope-creep (R4.1 component list) and the R1.5 dead-class removal — both flagged open/unused
in the memory. Result: clean round.

## What I checked and how

- **R3-1 (R4.1 cross-view test) — RESOLVED.** The v4 delta rewrote the general clause to
  "Two instances of one kind **in the same state, tone and variant** SHALL compute the same
  background, text colour, border, radius, height, padding and font size," and the test clause
  to "compares those seven computed properties in the resting state, **matching tone for the
  pill and variant for the button**." This is exactly the constraint R3-1 demanded: the
  by-design background/text colour is now compared only within one tone (pill) and one variant
  (button); the shared list row, which has neither, is unchanged. The R4.1↔R4.2 contradiction
  is gone.
  - Implementability confirmed on real code: a shared tone exists across ≥2 views
    (`error`→danger at `RunsPage.tsx:194` and `RunPage.tsx:453-457`; `running`/`merging`→the
    interactive-primary tone at `RunsPage.tsx:189-190`), and a primary-variant button exists on
    ≥2 views (`NowPage.tsx:193,522`, `RunsPage.tsx:412`). The red-first test can be written.
  - Internal citations the fix leans on are accurate: R4.2 does mandate six tones; R4.1 does
    enumerate "button (primary, secondary, danger, ghost)" — "the four button variants" is
    correct.

- **R3-2 (R6.2 grep nested braces) — RESOLVED.** New branch `\{([^{}]|\{[^}]*\})*\}` consumes
  one level of nested braces. Ran the v4 command on real code:
  `grep -rhoE '(data-testid|role|aria-[a-z-]+)=("[^"]*"|\{([^{}]|\{[^}]*\})*\})' src/dashboard_frontend/src`
  → **102 matches against a 102 `name=` baseline, 86/86 data-testid.** All 29 interpolated
  templates now emit whole (`data-testid={`pr-row-${read.repo}-${read.number}`}` captures the
  full value; the old v3 regex truncated it at `…${read.repo`). No two-level-nested attribute
  exists, so nothing still truncates. The "matches … forms alike / no attribute invisible"
  claim is now accurate. Revision-History figure "102/102 with every interpolated template
  captured" verified.

- **R1.5 dead-class removal (fresh probe) — NOT a defect.** R1.5 removes `theme.css:511-612`
  (`.hljs`) and the markdown classes. `highlight.js ^11.9.0` and `markdown-it ^14.1.0` are in
  `package.json`, so I checked whether they add `.hljs` at runtime — but neither is imported
  anywhere under `src` (`grep` for the imports is empty; no `markdown-content`/`hljs` in any
  tsx). The classes are genuinely dead CSS. Removal is safe; R6.6 keeps the (unused) deps.

- **Scope-creep lens on R4.1's ~18-kind list — NOT a defect.** Styling every component kind
  from shared definitions is the spec's purpose (one visual system), not creep beyond
  "look only." Every kind named exists in the cited code.

## Findings

### R4-1 — MINOR — Novel — v4 Revision History omits the D1–D12 "options were" removal

The v4 delta stripped the "options were …" clause from all twelve decisions (D1–D12) in
"Decisions taken in this document," but the v4 Revision History entry records only R3-1, R3-2
and the lint pass — not this edit. The lint pass reports "0 fixed," so it was a deliberate
reviser edit left untraced. No requirement is made wrong: each decision keeps its choice and
its "Chosen because …" rationale. The only loss is the record of rejected alternatives, which
the design/tasks phases sometimes consult. Non-loop-keeping; fix is a one-line Revision-History
note if the editor wants traceability.

## Top 3 conclusions to challenge

1. **"R3-1 is resolved."** Upheld, not reversed: the tone/variant constraint removes the
   R4.1↔R4.2 contradiction and the test is implementable on real code. The only residual (does
   a shared tone/variant exist across two views) is answered yes, so it is not even a
   design-phase blocker this time.
2. **"R6.2 now matches template forms alike."** Upheld: verified 102/102 with full-template
   capture; the R3-2 truncation is gone. The claim is now accurate rather than overclaiming.
3. **"The before/after capture opens a detail panel on every view (R7.1)."** Still a
   design-phase thread, not a requirements finding — the design must confirm the seeding opens
   a panel on Now and Deferrals. Carried, not escalated.

## What's missing before acting

- Nothing blocking. Optional: a one-line Revision-History note for the D-options removal (R4-1).
- Design-phase (not requirements): confirm which same tone the pill test uses and that the
  seeding yields an openable detail panel on every view that has one.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
