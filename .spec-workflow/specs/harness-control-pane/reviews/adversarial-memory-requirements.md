# Adversarial Review Memory — requirements

Last updated: 2026-09-28 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — AC 2.9 ledger-field contradiction. v2 resolved: Intro + scope note
  state the file case adds two `run.start` provenance keys (`overrides`, `setup`), authorized by
  decomposition:665-667/711; D14's false "boundary notes forbid a new ledger field" clause deleted.
- **R1-2 (SHOULD_FIX, v1)** — websocket wire contract. v2 added AC 4.8/4.9/5.10 (subscribe types,
  per-payload push types, watcher lifecycle keyed on subscriber count). Substance accepted; see
  R2-2/R2-3 for residue.
- **R1-3 (SHOULD_FIX, v1)** — deepseek worker override path. v2 split AC 2.4 by provider and made
  AC 2.6 merge a deepseek role's model. Verified against sdd-document-phase/SKILL.md:24-34 and
  sdd-providers.sh:72-74 — accurate.
- **R1-4 (SHOULD_FIX, v1)** — provider-conditional model validation. v2 rewrote AC 1.6. Accurate
  against sdd-providers.sh:28-29.
- **R1-5 (SHOULD_FIX, v1)** — read-only spec listing without INDEX.md write. v2 rewrote AC 1.1.
  Substance survives; lint later trimmed the "this is new work" clarification (see R2 minor).

### Partially Accepted
- (none)

### Rejected
- **v1 minors** — AC 5.3/D7 "waiting" imprecision (self-correcting); launch flag list; log/
  launch-record paths. Rejected in v2 Revision History as design-phase / non-blocking. Do not
  re-raise without new evidence.

### Unresolved (found in v2, awaiting disposition)
- **R2-1 (MUST_FIX, fix-induced, Compounds R1-1)** — scope-note citation
  `decomposition.md:753-754` is the wrong range: 753 is an unrelated note (execution-context
  disclosure, spec 2), and the quoted phrase "it adds no ledger field" spans 754-755. Correct:
  `754-755`. Introduced by the lint pass (was `:754`).
- **R2-2 (SHOULD_FIX, fix-induced, Compounds R1-2)** — lint trim removed "distinct from `initial`
  and `projects-update`" from AC 4.9 (now the ambiguous "distinct from the AC 4.8 messages") and
  from AC 5.10 entirely; AC 5.10 also lost its "(overview rows, todos list)" enumeration.
- **R2-3 (SHOULD_FIX, fix-induced, Compounds R1-2)** — AC 4.9 pushes "only harness subscribers via
  the existing `broadcastToProject`," but that helper filters on `projectId` only (multi-server.ts:
  2143); it cannot restrict to harness subscribers, contradicting AC 4.8/4.7's subscriber-type
  distinction.
- **R2 minors** — AC 1.1 lint drop of the R1-5 "read-only function is real work" clarification;
  Intro dropped explicit `overrides`/`setup` names (AC 2.9 keeps them); AC 2.4/2.6 model-only
  deepseek trigger wording (benign under "file records a provider entry").

## Patterns & Themes
- **A lint pass is not content-neutral.** This round's only MUST_FIX and one SHOULD_FIX were
  introduced by the "13 fixed; rejected: none" lint pass — a wrong citation range and weakened
  wire-contract ACs. Always diff the lint delta against the accepted-round text, not just the code.
- **Citations that quote a phrase must contain the whole phrase.** The 753-754 error hides a
  quoted string that ends on the next line and pulls in an unrelated note. Machine citation-range
  lint passed it; the meaning check caught it. Keep re-reading both ends.
- **R1-2 wire contract half-closed.** The fix distinguishes harness vs specs subscribers for the
  *watcher lifecycle* (AC 4.7/4.8) but the *push* path (AC 4.9) still uses projectId-only
  broadcastToProject and the demux type constraint was later lint-trimmed. The transport story is
  the recurring soft spot.
- **Ledger-immutability promise vs provenance keys** (from v1) is now reconciled in substance;
  only the citation to the governing boundary note is wrong (R2-1).

## Guidance for Next Review
- First confirm R2-1 is fixed (cite `754-755`), R2-2 restored the demux-distinctness constraint and
  AC 5.10 enumeration, and R2-3 named a real harness-only push mechanism (or dropped "only").
- Code citations are all accurate at both ends as of v2 — index-generator :70-72, sdd-providers.sh
  :28-29/:72-74, sdd-document-phase/SKILL.md :24-34, sdd-continue/SKILL.md :85-96/:226-228/
  :336-345/:488-500, SDD-HARNESS.md :244-248, adversarial-runner.ts :156-220, watch/index.ts
  :101-104, ledger.ts :243-457, multi-server.ts :205-294/:1965-1989/:2139-2151. No need to
  re-verify these unless the next delta touches them.
- The only decomposition citation still worth re-checking each round is the boundary-note range
  (currently wrong) and the 665-667/711 authority (currently correct).
- Do not re-open the accepted R1-1…R1-5 substance or the rejected v1 minors.
