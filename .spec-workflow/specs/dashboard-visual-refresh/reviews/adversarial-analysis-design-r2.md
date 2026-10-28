# Adversarial Analysis — dashboard-visual-refresh/design (v2, round 2)

Primary surface: feasibility, consistency, edge cases. Attack order: the v2 delta
(round-1 response + lint L-16) first, then one fresh lens (library-capability scope of
the `@theme static` type scale). Fresh lens named by prompt: none.

## Delta attacked (v2 since ce4eda68)

The v2 diff is the round-1 response (R1-1, R1-2, R1-MINOR) plus lint L-16 and the D1–D18
reword. Each substantive change re-checked against the code, scoped to the fix diff.

### R1-1 fix — C6 axis line (fix-induced re-check)
`design.md:106` now reads "`stroke=`, `fill=` at lines 88, 98, 109, 116". Verified against
`UsageTrend.tsx`: line 88 `<line … stroke="var(--border-default)" …/>` (axis), 98 baseline
`stroke={s.colour}`, 109 polyline `stroke={s.colour}`, 116 circle `fill={s.colour}`. The
axis-colour sentence still says the colour moves to `style`, so the `var()` resolves. Correct;
the former line-92 slip is gone. Clean.

### R1-2 fix — T4.1 locator + UI attributes (fix-induced re-check)
The three gaps raised in R1-2 are closed and no new claim error is introduced:
- Button size: post-conditions (`:72`) and Button variants (`:78`) now stamp `data-size`, and
  T4.1 (`:126`) matches the button on `data-variant` **and** `data-size`. Two buttons of equal
  variant+size share height/padding/font-size. Sound.
- Row selection: T4.1 pins `data-selected="false"`; an unselected, un-hovered `Row` has no
  resting background on either view (base `Row` at `primitives.tsx:198` only paints on `selected`
  or `:hover`), so the compared background is equal. Sound.
- Row locator: C4 (`:82`) and post-conditions (`:72`) give `Row` `data-ui="row"`; T4.1 keys on it.
  The row is now addressable. Sound.

### R1-MINOR fix — active nav-row tokens
`:83` names the active nav row `--surface-selected` background, `--text-primary` text. Both are
declared in Data Models, and `--text-primary` on `--surface-selected` is already in the 4.5:1
contrast set (`:199`). No unverified token. Clean.

### Lint L-16 — App.tsx:20→20-21
`design.md:87` cites `App.tsx:20-21`. Line 20 is `<main … px-4 … sm:px-6>`, line 21 is
`<Routes>`; the range now reaches the `Routes` the sentence wraps. Accurate.

## Fresh lens — library-capability scope of the `@theme static` type scale

The one carried claim not spelled out in prior rounds is the `--text-*--line-height` companion
tokens (`Data Models`, `:142-145`): a Tailwind-v4 capability the design leans on for the type
scale's line heights under a namespace clear. Checked the probe NOTES: note 1 built
`.text-sm{font-size:var(--text-sm);line-height:var(--tw-leading,var(--text-sm--line-height))}`,
so the companion survives the `--text-*: initial` clear and feeds the utility. Probe-backed; not
an unproven capability. Every other API claim (var-shorthand compile, transition tokens,
`color-scheme` ordering, Playwright `emulateMedia`/`addInitScript` 1.58.0, vite 7.3.0 flags) was
confirmed in round 1 and in NOTES.

## Findings

### R2-1 — Button `data-size` value when `size` is omitted is unstated — MINOR — Novel
`:62` types `size?: 'sm' | 'md'` (optional); `:72` says `Button` "adds `data-size`"; T4.1 (`:126`)
keys the button pair on `data-size`. The design never pins the default, so if a call site omits
`size`, `data-size` could be absent and the `[data-variant][data-size]` locator would not match
a default-size button. Safely a tasks-phase value: the implementer sets a default (e.g. `md`) and
stamps `data-size` unconditionally. Non-blocking; does not keep the loop alive.

## Top risks/gaps (3)
1. None blocking. The delta is internally consistent and code-grounded.
2. R2-1 (MINOR): default `size` / `data-size`-when-omitted left to tasks.
3. Watch item for tasks (not a design defect): the T1 red-on-base hits the scan already names
   (`min-w-[7rem]` at `RunPage.tsx:223`; the `dark:` sites) have no named target token in the
   design; T1's red forces a token fix, but the specific replacement is a tasks decision.

## Top 3 conclusions to challenge — none reversed
The three round-1 conclusions were accepted and their fixes verified here. No v2 conclusion
survives challenge as wrong: the axis line (88), the T4.1 locator set, and the nav-row tokens all
hold against the code and the probe.

## What's missing before acting
Nothing blocking. Optional: state Button's default `size` so T4.1's `data-size` key is always
present (R2-1).

## Checked and clean (work shown)
`UsageTrend.tsx:88/98/109/116` resolve to axis/baseline/polyline/circle colour attributes.
`primitives.tsx:178-203` Row matches C4. `App.tsx:20-21` reaches `main`+`Routes`. Probe NOTES 1–10
back the type-scale companion, var-shorthand, transition and `color-scheme` claims. No server/API
change, so the error-branch-shape rule (discriminant + status) and the Data-Models response-object
rule are N/A (style-only spec; `ui` object and component signatures are fully shaped at `:60-69`).
C5 tone maps and D2's "selector" ruling were verified/closed in round 1 and are not re-opened.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 1
DESIGN_READY: yes
ESCALATE: none
```
