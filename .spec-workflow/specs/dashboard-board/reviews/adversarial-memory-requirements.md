# Adversarial Review Memory — requirements

Last updated: 2026-11-06 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — R12 AC 1 single "Discard allowed" field couldn't encode R7 AC 6/AC 7's three stopped-run outcomes. v2 added a second signal ("branch present" + "Discard allowed"). Verified resolved against code (round 2).
- **R1-3 (SHOULD_FIX, v1)** — R4 AC 1 tile text undefined for gate-a/gate-b/retro-plan. v2 made it `ctrlSummary`. Verified matches `NowPage.tsx:66-78` (round 2).
- **R1-4 (SHOULD_FIX, v1)** — R6 AC 6 waiting-run pending-pause note unspecified. v2 split running vs waiting and cited `pause.ts:42-45`. Verified (round 2).
- **R1-5 (MINOR, v1)** — Intro undersold controller surface. v2 names R7 and R12. Resolved.
- **R2-1 (MUST_FIX, v2) — Compounds R1-2, fix-induced.** R12 AC 2 v2 wording "converted from the numeric spawn value" directed the wrong source (the `/proc` field-22 tick count carries no wall-clock time). v3 replaced it with "the wall-clock stamp taken at spawn from `deps.now()` … not the `/proc` `startTime`". **Verified resolved (round 3):** `deps.now()` is in scope at `onStepSpawn` (used at `runs.ts:431`, `:444`); the new ISO field stays distinct from the `/proc` `startTime` (Security NFR); R6 AC 1/AC 2 step age no longer cascades to 1970.
- **O3 (MINOR, v2)** — R4 AC 1 said "first line of `questions[0].text`"; v3 changed it to "the whole of `questions[0].text`", matching what `ctrlSummary` returns. Resolved (round 3).

### Partially Accepted
- (none)

### Rejected
- **O1 (v2)** — Reliability NFR failed-branch-read → no-tile hides an un-Discardable stopped run for one 60 s cycle. Rejected v3: deliberate fail-safe, already stated.
- **O2 (v2)** — R7 AC 6 tile predicate is branch-presence only; orphan worktree with no branch can't be Discarded. Rejected v3: predicate deliberate; worktree-presence out of scope (spec 34). **Closed by ruling — do not re-open.**

### Unresolved
- (none)

### Observations carried (MINOR, not loop-keepers)
- O4 (v3) — R12 AC 2 anchors the `deps.now()` stamp to `runs.ts:455` (the `onStepSpawn` signature line); `deps.now()` is actually at `:431`/`:444`. Location anchor works; precision nit only.
- O5 (v3) — Scope notes "Added" bullet: "Its 'Design MUST enumerate' list" — "Its" attaches to R12, means the decomposition entry. One-word fix.

## Patterns & Themes
- **Fix-induced claim errors were the round-2 risk and are now closed.** R1-2 → R2-1 → v3: the "unstated conversion" was fixed wrong in v2, then fixed right in v3. The round-3 check confirmed the fix states the source *correctly* (deps.now() wall-clock, not a /proc conversion) and keeps it distinct from the `/proc` value the row must not carry.
- Citations remain accurate every round; the only round-3 nits are citation *precision* (O4) and an antecedent (O5), both harmless.
- Three clean rounds on the two-signal row model, ctrlSummary mapping, pause branches and all artifact citations — the document is stable.

## Guidance for Next Review
- **Converged this round (0/0).** No MUST_FIX or SHOULD_FIX open. If a v4 is spawned at all, there are no live defects to chase; do not pad with MINOR.
- Do not re-examine: R1-1 two-signal row model, R4 AC 1 ctrlSummary, R6 AC 6 pause branches, R12 AC 2 start-time source (resolved), all artifact citations (verified three rounds), O1/O2 (rejected by ruling — closed).
- If forced to find a fresh lens: testability of the "within N s with no reload" ACs (R8 AC 5, R4 AC 2 "no reload"), and socket-down project-filter selection — both untouched by any round and low-yield.
