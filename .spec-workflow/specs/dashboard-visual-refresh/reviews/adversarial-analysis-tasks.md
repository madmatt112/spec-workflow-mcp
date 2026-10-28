# Adversarial Review — dashboard-visual-refresh/tasks (v1, round 1)

Attack surface this round: **atomicity, ordering, coverage**. First review. Deltas since
`ee601036` attacked first, then a fresh coverage lens over the whole document.

## Deltas since checkpoint — verified clean

The lint-pass diff is three edits, all re-verified against the code:

- Task 5 Notes: `UsageTrend.tsx:13` → full path, `RunPage.tsx:223` → full path. Both land on
  the right artifact: `UsageTrend.tsx:13` is `const SERIES = ['#2563eb', …]` (six literal hex);
  `RunPage.tsx:223` is `className={`min-w-[7rem] flex-1 rounded border …`}` (the arbitrary
  width + a bare `rounded`). Correct.
- Reference section: `scan.cjs` de-ranged and marked scratch. The file exists
  (`/tmp/scratchpad/.../probe/scan/scan.cjs`, 1.6 K) and its seven `rules` entries are
  byte-identical to the Reference block, so the inline copy task 5 ports is faithful. The
  de-range is the safer citation (scratch path, authoritative copy inline). Correct.

No MUST_FIX in the delta.

## Coverage probes run (and cleared)

- **Bridge (D1) completeness.** Every legacy `var(--name)` still referenced in FE outside
  `theme/` — `--status-error`, `--interactive-primary`, `--accent-primary`, `--accent-danger`,
  `--status-warning/-success/-pending`, `--interactive-primary-hover`, `--border-focus` — is
  aliased by task 2's bridge list. No referenced legacy name is left undefined between task 2
  and task 5. Clean.
- **Bare-radius sweep (D2).** `grep -rnE "\brounded\b[^-]|shadow-lg"` returns 14 bare
  `rounded` + 1 `shadow-lg`, in DeferralsPage, primitives, RunPage, RunsPage, Sidebar,
  SpecsPage, LoginPanel — every one of those files is in task 2's `File:` list. Nothing in
  NowPage/UsagePage, so nothing is silently voided by the radius clear. Clean.
- **Scan-hit file coverage.** Every FE `.tsx/.ts` carrying a hex/colour-fn/palette/`dark:`
  literal (LoginPanel, DeferralsPage, NowPage, pause.ts, primitives, RunPage, RunsPage,
  Sidebar, SpecsPage, UsageTrend) is edited by some task 2–5 before T1 lands in task 5. The
  "Launch" chip `text-white` at RunsPage:127 is a `<button>`, caught by task 4's button grep.
  No orphan hit that would hold T1 red. Clean.
- **Test seams / success-clause (retro P7).** Every `Test:` line's test is created in that
  task's or task 1's prompt, and every test named in a `Task:` body also appears in that
  task's `Success:` clause (T2/T3/T4.4/T4.5 in task 2; T4.2/T4.3/T4.6/T4.7 in task 3; T4.1 in
  task 4; T1 in task 5). No silently-dropped test. Clean.
- **T3 build test vs. the bridge.** Leaving `--color-*` uncleared until task 5 does not give
  any C1 name a second declaration (C1 colour names are `--surface-*`/`--text-*`/`--tone-*`/…,
  disjoint from Tailwind's `--color-*` palette), so T3 passes in task 2 and again in task 5.
  Clean.
- Citations `tsconfig.json:20`, `vitest.config.ts:8` verified correct.

## Topics attacked

### 1. Requirement 3.4 — coverage and the gate checklist
- Challenge the omission: 3.4 (theme switch stays in the popover, **default stays dark**,
  **choice stays under the `theme` key**) appears in **no task's `_Requirements` line** — the
  only acceptance criterion absent from every task.
- Stress-test task 6 against the design: `design.md:214` lists "Requirement 3.4" among the
  invariants "checked at the verification gate." Task 6 is the gate and neither lists 3.4 nor
  performs any check of the default theme or the storage key.
- Trace the real hole: the after-screenshots set the theme explicitly via
  `addInitScript`/`localStorage.theme`, so a flipped default would not show; no vitest or e2e
  asserts default-dark; the 6.2 grep only pins labels/roles/testids. The invariant is unverified.
- Weigh the mitigation honestly: `ThemeProvider.tsx` is in no task's `File:` list and tasks 2–3
  say "keep ThemeProvider unchanged" / "keep the theme control and labels," so a verifier would
  flag an out-of-scope edit. Protection exists, but the design's promised gate check is gone.

### 2. Dependency chain 1 → 2 → 3 → 4 → 5 → 6 and "every suite green per task"
- Stress-test the preamble claim that each task leaves every existing vitest and worktree e2e
  suite green: task 2 adds T4.4/T4.5 and fixes them in the same task; task 3 adds four more;
  the bridge keeps pages rendering between task 2 and task 5. The chain holds — no missing edge.
- Challenge whether the `dark:` variants and palette classes persisting through tasks 2–4 break
  a suite: they do not, because T1 (the only check that bans them) lands in task 5 (D3), and
  the color namespace stays uncleared until then. Consistent.

### 3. Atomicity of task 2
- Task 2 swaps the token file, deletes `theme.css`, rewrites `tailwind.css`, edits nine
  page/shell files, stands up the bridge, and writes T2+T3+two e2e tests. It is large but is a
  single indivisible swap (the clears void bare `rounded`/`shadow-lg` the moment `tokens.css`
  lands, so the nine-file touch cannot be deferred), and it is routed to a verifier as a
  new-module task. Acceptable, not splittable without leaving a broken intermediate tree.

### 4. Verification-only classification of tasks 1 and 6
- Task 1 builds the seed helper + spec scaffold that tasks 2–5 extend, yet has no verifier.
  A wrong seed surfaces only as a downstream failure (e.g. task 4's cross-view pair). This is
  within agent-rules ("verification-only … still reviewed"), and the forced fixture copy (6.4
  bars editing the shell suite) is a decided tradeoff (D12). No finding.

## Findings

### R1-1 — Requirement 3.4 is in no task and dropped from the gate checklist — SHOULD_FIX (Novel)
`design.md:214` names Requirement 3.4 an invariant "checked at the verification gate," but
task 6's `_Requirements` (7.1–7.4, 5.1–5.3, 6.1–6.7, NFR Performance) omits 3.4 and its prompt
runs no check of the default-dark or `theme`-key invariant; 3.4 appears in no other task's
`_Requirements` line either. **Failure scenario:** a task edits `ThemeProvider.tsx` so the
default theme is `light` or the storage key changes; `npm run build`, `npm test`, the e2e suite
(which sets the theme explicitly) and the 6.2 attribute grep all stay green, and task 6 passes —
the regression ships unseen. Mitigation present (ThemeProvider is in no `File:` list; tasks 2–3
forbid touching it), so the risk is a verification/traceability hole, not a certain break.
**Fix:** add 3.4 to task 6's `_Requirements` and one gate line asserting `ThemeProvider.tsx`'s
default and `theme` key are unchanged and the theme control is present — or add 3.4 to tasks 2/3
where the restrictions already pin it.

## Top risks/gaps (short doc → 3)
1. **R1-1** — 3.4 unverified / untracked (above).
2. Task 1's un-verified seed helper is the single foundation for five downstream tests; a subtle
   seeding error (e.g. the extra resolved deferral not yielding a success pill) only shows at
   task 4. Watched, not a finding — agent-rules permits it.
3. T1's red proof is deferred to the task-5 tree (RE-DECIDED, D3); if tasks 2–4 miss a literal in
   a file they already edit, T1 blocks task 5 rather than the task that introduced the miss.
   Accepted by the document; noted so the orchestrator schedules the task-5 verifier accordingly.

## Top 3 conclusions to challenge or reverse
1. **"no task touches an agent-rules sensitive path" / "Planned verifier spend: four."** Verified
   true — tasks 2–3 are new modules, 4–5 exceed the line rule, 1 and 6 are implementer-only.
   Do not reverse.
2. **"the fourteen bare radius sites and the one large-shadow site move in task 2" (D2).** Verified
   — all 15 sites are in task 2's `File:` list. Do not reverse.
3. **Task 6 realises the design's full gate checklist.** Reverse: it drops 3.4 (R1-1). Realign
   task 6 with `design.md:214` or amend the design's claim.

## What's missing before acting
- One line of coverage/verification for Requirement 3.4 (R1-1). Nothing else blocks
  implementation; the chain, the bridge, the sweep and the test seams are complete.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
