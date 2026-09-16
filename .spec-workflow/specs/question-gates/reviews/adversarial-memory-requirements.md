# Adversarial Review Memory — requirements
Last updated: 2026-09-16 (after v2 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (MUST_FIX, v1)** — Gate B had no fire-once guard. Fixed by Req 5 AC 6. See R2-1:
  fix is incomplete (Req 4 AC 1 still unconditional).
- **R1-2 (SHOULD_FIX, v1)** — No in-budget orchestrator→supervisor channel for gate-A
  decisions / veto list. Fixed by Req 1 AC 6 (server surface). See R2-2: gate A's producer
  moved to the drafter, so AC 6 now names the wrong actor and the drafter hop is unspecified.
- **R1-3 (MINOR, v1)** — No owner for the decision→`{header,question,options}` transform.
  Fixed by Req 2 AC 1 (drafter owns it).
- **R1-4 (SHOULD_FIX, v1)** — Extraction/rank was assigned to the orchestrator, which cannot
  read the body. Fixed by Req 2 AC 1 / D2 (drafter). See R2-2/R2-5: the reassignment created
  a new drafter→orchestrator wire gap and a pre/post-lint staleness gap.
- **R1-5 (SHOULD_FIX, v1)** — Class (a) no-list behaviour undefined; the `gate-rules.ts` null
  convention floods the list. Fixed by Req 4 AC 5 (no path match, keywords fire). Citations
  verified accurate in v2.
- **R1-6 (SHOULD_FIX, v1)** — Gate-A annotate unrouted; approve/change/annotate unmapped.
  Fixed by Req 2 AC 7. See R2-3/R2-4: the fix left the mixed change+annotate case and the
  changed-option-with-free-text case undefined.
- **R1-7 (MINOR, v1)** — "returns an error" case missing from Req 3/6 AC 1. Fixed.
- **R1-8 (MINOR, v1)** — `questions.md` commit/persistence unstated. Fixed by Req 1 AC 5
  (commit-together). Citation `sdd-continue/SKILL.md:60` verified.
- **R1-9 (MINOR, v1)** — Gate-A timing vs Lint step unspecified. Fixed by Req 2 AC 2 (fire
  after lint). See R2-5: interacts badly with drafter's pre-lint extraction.

### Partially Accepted
- (none)

### Rejected
- Lint L-1..L-5 (v1/v2) — citation-identifier warnings for `record`, `headless`, `question`,
  `options`; rejected because they are the document's own terms/keys, not cited source text.
  Re-verified accurate in v2.

### Unresolved (raised v2, awaiting response)
- **R2-1 (MUST_FIX)** — Req 4 AC 1 (unconditional "SHALL return one ranked veto list" on
  approved) contradicts Req 5 AC 6 (revision-mode approval "SHALL NOT return a new veto
  list"). Same actor, overlapping trigger. Scope Req 4 AC 1 to first/`MODE: normal`.
- **R2-2 (SHOULD_FIX)** — Gate A's ranked list is produced by the drafter (R1-4) but Req 1
  AC 6 routes it "from an orchestrator"; no channel exists drafter→orchestrator (150-word
  report cap `sdd-drafter.md:26`; orchestrator reads "Nothing else" `document-phase:20`).
- **R2-3 (SHOULD_FIX)** — Mixed change+annotate gate-A pass double-routes: AC 5 and AC 7 both
  fire one revision round with different `REVISION_INPUT`; only AC 7 records. Undefined join.
- **R2-4 (MINOR)** — Changed-option-with-free-text is classed as change (AC 7); AC 5 drops
  the free text.
- **R2-5 (MINOR)** — Drafter extracts triples pre-lint (Req 2 AC 1); gate fires post-lint
  (Req 2 AC 2); no re-extraction, so triples can be stale vs shown text.
- **R2-6 (MINOR)** — Recording asymmetry: change (AC 5) records nothing to `questions.md`;
  unchanged (AC 6) and annotate (AC 7) do.

## Patterns & Themes

- **Incomplete fixes at boundaries.** The v2 deltas fixed one side of each seam but left the
  other: fire-once guarded the supervisor not the orchestrator trigger (R2-1); the wire fix
  named the orchestrator hop while the producer moved to the drafter (R2-2); the annotate
  route defined single outcomes not the mixed one (R2-3). Every v2 MUST/SHOULD candidate sits
  where a round-1 fix stopped short of the adjacent clause.
- **Per-decision vs whole-gate.** AC 7 classifies replies per decision; AC 5/6/7 act on the
  whole gate. The join across five decisions is the recurring undefined region.
- **Drafter is now a hidden third role in the wire.** Moving extraction to the drafter (R1-4)
  put a 150-word/no-file-contents worker between the document and the orchestrator; treat the
  drafter→orchestrator hop as a first-class channel in design.

## Guidance for Next Review

- Citations are clean through v2 — all delta citations re-verified accurate this round
  (`sdd-drafter.md:26`, `formats.md:25-26`, `sdd-document-orchestrator.md:49,51`,
  `document-phase/SKILL.md:20,93,95-97`, `gate-rules.ts:26,260-261`, `review-gate.ts:177-179`,
  `sdd-continue/SKILL.md:60,198-203`). Re-check only if ranges move.
- Verify the design/next-requirements pass reconciles: (1) Req 4 AC 1 scope vs Req 5 AC 6;
  (2) who writes gate A's server-surface payload and the drafter hop; (3) the mixed
  change+annotate outcome and `REVISION_INPUT` composition; (4) which branches record to
  `questions.md`; (5) pre/post-lint re-extraction of triples.
- Well-covered, do not re-mine: class-(a) no-list behaviour (R1-5, citations verified),
  scope coverage vs decomposition spec 7, the record-mode non-stall chain (Req 1/3/6).
