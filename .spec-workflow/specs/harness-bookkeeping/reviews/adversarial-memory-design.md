# Adversarial Review Memory — design

Last updated: 2026-09-15 (after v3 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — Prompt-launched workers had no `spawn.start`, so their spawns
  and tokens left `--watch`. v2 fix: synthesize a level-2 node when no `spawn.start`
  matches. Superseded by R2-1 and now fully resolved (see R2-1).
- **R1-2 (SHOULD_FIX, v1)** — Dropped/timed-out hook silently removed a worker. v2 fix:
  Error Handling #6. Verified. Resolved.
- **R1-3 (SHOULD_FIX, v1)** — `orient`'s `D` rule missed the "exists, no Revision History
  ⇒ D = 1" branch. v2 fix: Component 2 states it (`sdd-document-phase/SKILL.md:56-60`).
  Resolved.
- **M1 (MINOR, v1)** — Range widening. v2 tightened to `:226-248` / `:241-242`. Resolved.
- **R2-1 (MUST_FIX, v2) — Compounded R1-1.** A prompt-launched worker whose agent was
  spawned brief-launched earlier folded onto the stale node and vanished; `role` overwrite
  relabelled it. **v3 fix (Accepted, verified in r3):** the fold now binds each
  `spawn.usage` in ts order to the nearest earlier same-agent node no earlier usage has
  claimed, and synthesizes when none is unconsumed; one-per-node binding structurally
  prevents the `role` relabel. Traced through both guaranteed cases (e2e verifier after
  per-task verifier; close-out fix implementer after batch implementer) — correct.
  Grounding `ledger.ts:241` (`!s.endedAt` one-time pairing) is accurate as an analogy; the
  operative predicate ("no earlier `spawn.usage` claimed") is a distinct, correct marker.
- **M-R2-1 (MINOR, v2)** — Component 5's brief-launched list omitted the impl implementer,
  high-risk verifier, adjudicator and document adjudicator. v3 named them; citations
  verified accurate. Resolved (list still not exhaustive — impl fix implementer
  `impl-brief-task-<N>-fix-<r>.md` and narrow verifier `verify-brief-task-<N>-narrow.md`
  are also brief-launched and unlisted, but handled correctly by the brief-path branch;
  cosmetic only).

### Partially Accepted
- **M2 (MINOR, v1)** — `byClass` shape + `HARNESS_REPO` note + `Number(tokens)` coercion
  added. Fold insertion point deferred to tasks — do not re-raise without new evidence.

### Rejected
- (none)

### Unresolved
- **R3-1 (MINOR, v3)** — `docs/TOOLS-REFERENCE.md:5` "13 tools"; `harness` makes 14. Not
  named in the design's edit plan. Doc-sync note, not loop-keeping.
- **R3-2 (MINOR, v3)** — Testing Strategy names the `spawn.usage` join but not the
  reused-agent unconsumed-match case R2-1 fixed. Nice-to-have.

## Patterns & Themes
- The R1-1 → R2-1 root cause (join keyed on `agent` + time window, no per-spawn id) is now
  closed by unconsumed-node matching. r3 stress-tested it against the two `sdd-verifier` /
  `sdd-implementer` reuse traps and the pairing loop's late-close ordering; the invariant
  holds. Residual double-fault only: a dropped `spawn.usage` leaves a brief node unconsumed
  that a later same-agent orphan could then claim — corner of a corner, not covered by
  Error Handling, not raised.
- The v3 change is additive and inert on every installed watch fixture (no `spawn.usage` in
  `ledger.test.ts`/`render.test.ts`); no snapshot pins `--watch`; no test counts
  `registerTools()`. So the "which installed test breaks" trap does not land — the design
  breaks none and says to *extend* the two watch tests.
- All v3 delta citations accurate, both ends (`:85-88`, `:114-118`, `:126-128`,
  `:191-195`, closeout `:24`/`:136`/`:141`/`:145`, `formats.md:178`, ledger `:241`/`:273`/
  `:300-301`, render `:121`/`:180-208`, index `:17-33`/`:35-96`). Risks are semantic, not
  citation errors, across all three rounds.

## Guidance for Next Review
- The design is converged (r3: 0/0/2, DESIGN_READY yes). If a v4 is cut, the only open
  items are the two MINORs (doc count, reused-agent test line) — neither blocks tasks.
- Do not re-open: R1-1/R1-2/R1-3/M1 (resolved), R2-1 (resolved and verified in r3), M2
  fold insertion point (deferred to tasks), the ~49 citation-identifier warnings (settled).
- If any future delta changes the fold or the hook brief-path detection, re-verify the
  one-per-node claim binds at most one node and a second same-agent orphan synthesizes,
  and that "one worker at a time" still forbids `spawn.end` overlap across same-agent
  workers.
