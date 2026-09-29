# Adversarial Review Memory — design
Last updated: 2026-09-28 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — log watch re-points on a new launch (re-derive path, reset
  offset, reset batch, client keys on `launchedAt`). Accepted in v2; but the v2 fix
  over-triggered — see R2-2 below.
- **R1-2 (SHOULD_FIX, v1)** — sdd-providers.sh merge validates the union in one post-merge
  pass, drops the `none()` short-circuits with a RUN_FILE. Accepted; verified correct in v2
  (lines 35/41/54-64/66 all resolve).
- **R1-3 (SHOULD_FIX, v1)** — Testing Strategy now lists the harness/ plugin-sync + assets
  check + strict validate. Accepted.
- **R1-4 (MINOR, v1)** — subscribe handler (not reconcile) sends snapshot to the one socket.
  Accepted.
- **R1-5 (MINOR, v1)** — buildSetupView/OverviewWatch.snapshot() prose completed. Accepted.

### Partially Accepted
- **R1-6 (MINOR, v1)** — supervisor Opus-5.5/Fable-5.1 floor not pre-validated; recorded as a
  child-refusal-only path in Error Handling #3 rather than adding a second validation site.

### Rejected
- (none through v2)

### Unresolved (this round — R2)
- **R2-1 (SHOULD_FIX, Novel, carried)** — launch admission is not atomic with the in-flight
  mark. Route sequences admit → (await writeRunFile) → launch()'s in-flight set, so two
  concurrent launches double-spawn (two supervisors, one worktree/ledger; one becomes an
  untracked orphan). No recovery stated. Fix: check-and-set in-flight synchronously inside
  launch() before any await. Word-neutral.
- **R2-2 (SHOULD_FIX, Compounds R1-1, fix-induced)** — the log re-point fires on every
  `launch-update` (spawn, stopping, stopped, exit), not only on a new launch. Within a run
  `logPath` is unchanged and `launchedAt` matches, so each Stop/exit/finalise resets every
  client's log view and re-reads the whole unpruned log from offset 0. Fix: condition the
  re-point on a `logPath` change. Word-neutral.
- **R2-3 (MINOR, Novel, carried)** — LaunchRecord written only on the 'spawn' event; a
  dashboard crash in the spawn→record window leaves an orphan child restore() cannot see
  (self-heals; brief double-launch window). Untraced. One scope note or pre-spawn intent record.

### Flag rulings (closed by reviewer authority — do NOT re-open)
- Req 1 AC 4 (D3 deepseek pre-fill): refinement.
- Req 3 AC 13 (retry, residual append race): refinement (exceeds deregister.mjs bar).
- Req 3 AC 14 (re-run setup on unmarked reuse): refinement.
- Req 2 AC 6 (malformed file deleted): refinement.

## Patterns & Themes
- The recurring seam is the **launcher ↔ watch ↔ client** lifecycle: R1-1 fixed the second-run
  path but R2-2 shows the fix's trigger is too broad. Wire *shapes* are sound; *when-to-fire*
  and *atomicity* are the soft spots.
- **Concurrency/atomicity** now bites the launcher itself (R2-1 admission race), not only the
  shared pointer file. The single-live-run invariant needs an in-process atomic guard, separate
  from the cross-checkout pointer concurrency the parent decomposition owns.
- **Partial-failure durability** (R2-3): the record write is deferred to the 'spawn' event, so
  crash recovery via restore() has a blind window.
- Citations remain accurate through v2. No MUST_FIX, no false codebase claims in the delta.

## Guidance for Next Review
- Re-check R2-1 and R2-2 first; they are the loop-keeping SHOULD_FIX items. Confirm any fix makes
  launch() the atomic guard owner and conditions the log re-point on a `logPath` change.
- Do NOT re-litigate the four flag rulings, the 73 citation-identifier false positives, or the
  R1-1..R1-6 dispositions (verified applied).
- Watch that a fix for R2-2 does not re-open R1-1 (the second run must still stream).
- Data Models completeness and library-capability probes passed again; re-verify only if the
  relevant lines change.
- Word cap: body at ~4,000 ceiling; all three R2 fixes are word-neutral or need a net cut.
