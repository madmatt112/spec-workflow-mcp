# Adversarial Review Memory — requirements
Last updated: 2026-09-28 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — AC 2.9 ledger-field contradiction. Resolved v2 (two `run.start`
  provenance keys authorized by decomposition:665-667/711) and v3 (citation corrected).
- **R1-2 (SHOULD_FIX, v1)** — websocket wire contract. AC 4.8/4.9/5.10 added. Substance
  accepted; residue tracked as R2-2/R2-3 (now fixed) and R3-1 (open, log-push routing).
- **R1-3 (SHOULD_FIX, v1)** — deepseek worker override. AC 2.4/2.6. Verified accurate.
- **R1-4 (SHOULD_FIX, v1)** — provider-conditional model validation. AC 1.6. Accurate.
- **R1-5 (SHOULD_FIX, v1)** — read-only spec listing without INDEX.md write. AC 1.1.
- **R2-1 (MUST_FIX, v2)** — scope-note citation. v3 corrected to `decomposition.md:754-755`;
  re-verified: 754-755 carries "it adds no ledger field", 753 no longer pulled in. CLOSED.
- **R2-3 (SHOULD_FIX, v2)** — AC 4.9 run-model/gate pushes now keyed on AC 4.8 subscription
  state, not `broadcastToProject` (which filters projectId-only, multi-server.ts:2143).
  Verified accurate. CLOSED — but see R3-1: log-push left outside the same rule.

### Partially Accepted
- **R2-2 (SHOULD_FIX, v2)** — v3 restored "distinct from `initial` and `projects-update`" in
  AC 4.9 and AC 5.10; AC 5.10 still enumerates "overview rows and the todos list". Per-payload
  source-AC cross-refs (AC 4.2 / Req 3 AC 5 / AC 4.5) stay dropped for the word cap. Verified:
  no dangling reference; the three types are still named in prose. Acceptable.

### Rejected
- **v1 minors** — waiting-state imprecision (self-correcting); launch flag list; log/
  launch-record paths (design-phase). Do not re-raise without new evidence.
- **v2 minors** — AC 1.1 R1-5 wording; Intro key names; AC 2.4/2.6 deepseek trigger wording.
  Rejected in v3 Revision History. Do not re-raise.

### Unresolved (found in v3, awaiting disposition)
- **R3-1 (SHOULD_FIX, Compounding R2-3/R1-2)** — log-lines push has no routing rule; R2-3
  tightened only run-model+gate to harness-subscribers. Highest-volume channel left able to
  fan out via `broadcastToProject` to Specs tabs.
- **R3-2 (SHOULD_FIX, Novel)** — dashboard is a 2nd concurrent writer of the machine-wide
  `active-run` pointer file (SKILL.md:104-106; hook 11-25); AC 3.10/3.13 never require the
  rewrite be atomic/safe vs a concurrent append; can drop a live run's line. SKILL.md:494-500
  bans `grep -v` and mandates `deregister.mjs` for exactly this reason.
- **R3-3 (SHOULD_FIX, Novel)** — no liveness reconciliation on restart (AC 3.12) or after a
  crashed stop (AC 3.10); AC 3.8 checks pid liveness on admission but AC 3.12 omits it on
  restore → zombie "running" rows, lost exit code, stale pointer line blocks future launches.
- **R3-4 (SHOULD_FIX, Novel)** — launch (worktree create / `npm ci` / spawn, AC 3.3-3.4) has
  no failure or rollback path; "reuse it" reuses a broken worktree after a failed `npm ci`.
- **R3-5 (SHOULD_FIX, Novel)** — AC 2.6 preflight refusal writes no run.start/run.end
  (SKILL.md:87-90); AC 2.10 deletes `harness-run.json` only on run.end → orphaned poison file
  re-refuses every future run of the spec; no terminal-operator cleanup path.
- **R3-6 (SHOULD_FIX, Novel)** — "one live run per spec store" invariant has a check-to-spawn
  race: pointer line (the "lock") is written after spawn by the supervisor, so a concurrent
  terminal launch passes AC 3.7/3.8 admission and both runs start.
- **R3 minors** — AC 3.2 cites adversarial-runner.ts:156-220 whose 10-min timeout (185-188)
  and shutdown-kill (250-254) contradict D4 (state they aren't adopted); page Launch clobbers
  a saved terminal gates=block setup; AC 3.10 file/line delete idempotency unstated.

## Patterns & Themes
- **Delta verification is now the cheap part; failure paths are the soft spot.** v3 fixed all
  three v2 residues cleanly (citations accurate at both ends, no new contradiction, no dangling
  ref). Every open finding this round is a partial-failure / concurrency / rollback gap the
  spec simply does not address — the doc specifies happy paths in detail and error paths not
  at all.
- **The shared machine-wide pointer file is the recurring hazard.** R3-2/R3-3/R3-6 all trace
  to `active-run` being one file written by many processes, with the real lock (the pointer
  line) written seconds after spawn. The supervisor's own code already flags the fragility
  (bans `grep -v`, mandates `deregister.mjs`); the dashboard inherits the hazard as a new
  writer without inheriting the safeguard as a requirement.
- **A fix that narrows one push path can strand its siblings.** R2-3 tightened run-model+gate
  routing; the log push (R3-1) was left on the old fan-out path, so the fix half-closed the
  wire contract again — the same shape as the v2 lint-trim residue.
- **Lifecycle asymmetry:** admission (AC 3.7/3.8) checks liveness and the pointer; restore
  (AC 3.12), stop (AC 3.10) and refusal (AC 2.6→2.10) do not clean up what they leave behind.

## Guidance for Next Review
- If v4 responds to R3-1..R3-6, verify: (a) log push now under the AC 4.9 harness-subscriber
  rule; (b) pointer rewrite stated concurrency-safe (reuse `deregister.mjs` or atomic); (c)
  restart/stop reconcile pid liveness and finalise a dead run idempotently; (d) launch failure
  surfaces + worktree reuse validity bar; (e) refused-run file cleanup; (f) single-live-run
  invariant scoped or a real lock named.
- Do not re-open R1-1..R1-5 substance, R2-1 (citation now correct), R2-2 (partial accepted),
  R2-3 (fixed), or the v1/v2 rejected minors.
- Code citations verified accurate at both ends through v3: decomposition.md:665-667/711/
  754-755, multi-server.ts:205-294/2139-2151, adversarial-runner.ts:156-220/250-254,
  sdd-continue/SKILL.md:83-96/100-129/331-345/486-500, sdd-activity.sh:1-31. No need to
  re-verify unless a v4 delta touches them.
- Next fresh lens candidate (not yet used): security/authz of the launch+stop routes under a
  non-localhost bind (D10 was accepted in R1 but only for the "reuses existing hooks" claim);
  or performance/backpressure of the five-second push + 300ms debounce under many projects.
