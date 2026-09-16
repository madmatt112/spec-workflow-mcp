# Adversarial Review Memory — requirements

Last updated: 2026-09-16 (round 1)

## Cumulative Findings Summary

### Accepted
- (none yet — first round)

### Partially Accepted
- (none)

### Rejected
- (none)

### Unresolved
- **R1-1 (MUST_FIX)** — Gate B has no fire-once guard. Req 4 AC 1 + Req 5 AC 1
  (unconditional on tasks `approved`) re-run gate B after the annotation-driven
  tasks-revision round and after a `design-defect` tasks revalidation, contradicting
  Req 5 AC 3 "then proceed to implementation." Gate A is guarded (Req 2 AC 2); gate B is not.
- **R1-2 (SHOULD_FIX)** — No defined, in-budget channel for the gate-A decisions and the
  gate-B veto list to cross orchestrator → supervisor. Report contract is 150 words, no
  file contents (`formats.md:26`, `sdd-document-orchestrator.md:49,51`); Agent tool has no
  schema (`harness-efficiency-plan.md:36,156`). D11 defers the surface, not this limit.
- **R1-3 (MINOR)** — No stated owner/step for turning a recorded decision statement into an
  askable `{header, question, options}` for AskUserQuestion.
- **R1-4 (SHOULD_FIX)** — Req 2 AC 1 / D2 assign extract+rank to the document orchestrator,
  whose standing rule forbids reading the document body (`sdd-document-phase/SKILL.md:20`);
  bodies are read by workers. D2's "where the document is read" rationale is wrong.
- **R1-5 (SHOULD_FIX)** — Class (a) "no-list behaviour" (Req 4 AC 5, Security NFR) is
  undefined; the only precedent (`review-gate.ts:177-179`, null ⇒ every path sensitive)
  would flood the veto list with every task. Pin: no path match, keywords still fire.
- **R1-6 (SHOULD_FIX)** — Gate-A annotation (Req 2 AC 6) is advisory but unrouted, unlike
  gate B's one revision round (Req 5 AC 3); a non-changing annotation is silently dropped.
  Also: approve/change/annotate branch not mapped to AskUserQuestion's return shape (both gates).
- **R1-7 (MINOR)** — Req 3 AC 1 / Req 6 AC 1 omit the "returns an error" case that Req 1 AC 3
  includes; the error branch for gate A/B is not explicitly written.
- **R1-8 (MINOR)** — `questions.md` is a new artifact (no refs in `harness/` or `src/`); no
  template, no "no answer" content shape, no commit/persistence rule.
- **R1-9 (MINOR)** — Gate-A timing vs the Lint step is unspecified (`sdd-document-phase/SKILL.md:93`);
  which text the human sees (pre- or post-lint v1) is unclear.

## Patterns & Themes

- **Gate A is guarded; gate B is not.** The document reasoned carefully about gate A's
  re-fire (D3, Req 2 AC 2) and never repeated it for gate B, which fires after approval.
  Watch every later phase for gate-B / gate-A asymmetry.
- **The orchestrator→supervisor wire is unspecified.** Multiple findings (R1-2, R1-3, R1-4)
  trace to the same root: the supervisor does not read documents and the report channel is
  tight, but the spec assumes rich payloads cross it. Design must pin the surface.
- **"Reuse gate-rules.ts" hides a semantic mismatch.** The review-gate null default ("every
  path sensitive") is the wrong default for a surface-the-worst veto gate (R1-5).

## Guidance for Next Review

- Verify the design pins: (1) a gate-B fire-once guard; (2) the wire surface/budget for
  gate-a and the veto list; (3) class-(a) no-list behaviour; (4) who reads/ranks decisions;
  (5) the gate-A annotation route; (6) the AskUserQuestion return mapping.
- Citations already confirmed accurate this round: `docs/step-0-answers.md:105`,
  `gate-rules.ts:101-135`, `agent-rules.md:5-6`, `sdd-continue/SKILL.md:232-261`. Re-check
  only if their ranges move.
- Do not re-raise scope-coverage: all decomposition spec-7 items are present.
