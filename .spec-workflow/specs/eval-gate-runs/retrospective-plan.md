# Retrospective plan — eval-gate-runs

Status: APPROVED
Date: 2026-11-05

## Approved proposals

- **P1 (F1) — Symlinked `dist/evals/cli.js` never runs `main()`.** `resolveEntrypoint`
  uses `resolve()` (`src/evals/cli.ts:216-222`), so when `process.argv[1]` is a symlink it
  stays the symlink path while `import.meta.url` is realpath'd — they never match and the
  entry prints nothing, exits 0. Fix: `realpathSync` the `argv[1]` side too (fall back to
  `resolve` when the path does not exist, to preserve the test-wrapper path).
  Target: product code (`src/evals/cli.ts`).
  Effort: S. Risk: low: one-line resolver change, guarded by the existing equality check;
  the task-5 dynamic-import wrapper still exercises the symlink path.
  Prerequisites: none.
  Eval case: none — the eval harness scores agent prompts, not the CLI entry guard; cover
  it with a vitest next to `cli.ts` that symlinks a built entry and asserts `main` runs.
  DECISION NEEDED: no.

- **P2 (F2) — Drafter put a `Test:` seam on an all-regression-guard task.** The tasks
  reviewer caught it (R1-1 SHOULD_FIX) before any test-author spawn was wasted;
  agent-rules.md:176-178 is exactly the rule that governs it and it worked. No change: the
  rule plus the review gate did their job. This is a repeat construct — see Graduation
  candidates, where the question is whether to move prevention upstream of the reviewer.
  Target: none (process worked).
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  Eval case: none — process finding, no agent-prompt behaviour to grade.
  DECISION NEEDED: no.

- **P3 (F3) — Requirements drafter rotated a grouped citation triplet.** R1 AC1's
  `(:131, :153, :200)` did not line up with the reasons they followed; fixed in v2 at
  review round 1. Caught by the gate, cost only part of the round-1 iterate. This recurs
  (graph-orientation), so the smallest durable move is a drafter rule on grouped citations
  rather than a per-spec fix — see Graduation candidates. No code or template change needed
  for this spec.
  Target: none here (handled by Graduation candidate G1).
  Effort: S. Risk: low: no change this spec.
  Prerequisites: none.
  Eval case: none — covered by G1's rule, not an eval surface.
  DECISION NEEDED: no.

- **P4 (F4) — Requirements drafter wrote an unconditional exit-1 AC contradicting the
  override story.** R2 AC1/AC2 said a failed single run SHALL exit 1 with no qualifier,
  against R3 AC5's overridden-case exit 0 (`gate.ts:74`). Caught at review round 1, fixed in
  v2 with the carve-out. A one-off internal-consistency miss the adversarial review is built
  to catch. No change.
  Target: none (process worked).
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  Eval case: none — one-off drafting miss, no recurring pattern to grade.
  DECISION NEEDED: no.

- **P5 (F5) — Doc phases dominated cost on a ~180-line change.** The four doc rounds spent
  ~15 of 27 spawns against 6 implementers, ~41.5M tokens floor. This is inherent SDD
  overhead; whether a tiny, well-understood change should get a lighter track is a standing
  trade-off the human owns (determinism vs cost), not something to decide unilaterally.
  Target: project steering / decomposition conventions.
  Effort: M (if a track is added). Risk: medium: a lightweight path risks skipping the very
  reviews that caught F2/F3/F4 on this same run.
  Prerequisites: none.
  Eval case: none — a process-track decision, not an agent-prompt grader surface.
  DECISION NEEDED: yes. Should small, well-understood changes get a reduced doc-review track?
  - Option A — No change; accept full doc overhead as the price of the gate that caught
    F2/F3/F4. (recommended)
  - Option B — Add a "minor-change" track (single requirements+tasks round, no design phase)
    gated by a line/surface threshold set in decomposition conventions.
  - Option C — Keep all phases but cap doc-review to one round when the first round returns
    only MUST_FIX/SHOULD_FIX items that are all drafting (not design) defects.

- **P6 (F6) — SDD-HARNESS.md stated a fixed "three times" that was already wrong.** The gate
  had stopped always running 3; the doc lagged. This spec fixed it (task 6), and it was the
  spec's reason to exist, so the finding is resolved. The prevention — update the harness
  doc in the same spec that changes gate behaviour — is a once-seen gap here; not worth a new
  rule on one occurrence. No further change.
  Target: none (fixed by this spec).
  Effort: S. Risk: low: already shipped.
  Prerequisites: none.
  Eval case: none — doc correctness, not an agent-prompt grader surface.
  DECISION NEEDED: no.

- **P7 (F7) — Clean six-task implementation run on Sonnet.** Every task passed its gate on
  the first try (implementers on claude-sonnet-5 high effort, doc roles on Opus). This is the
  good case and confirms the current routing for a small, well-understood change. No change.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  Eval case: none — positive observation, nothing to grade.
  DECISION NEEDED: no.

- **P8 (F8) — Gate A's "Posture" item was pre-answered n/a.** The money/personal-data/legal
  posture item offered only "n/a" and the harness filled it in rather than asking. Correct
  here (the surface is empty), but it is a human-facing gate item the harness decided. Whether
  a posture call should ever be auto-answered is the human's to set.
  Target: harness skills (Gate A question flow).
  Effort: S. Risk: medium: always asking adds a human gate on every spec, including the many
  with an empty surface.
  Prerequisites: none.
  Eval case: none — a gate-flow policy choice, not an agent-prompt grader surface.
  DECISION NEEDED: yes. May the harness auto-answer Gate A "Posture" as n/a when it reads the
  surface as empty?
  - Option A — Keep auto-answering n/a when no money/personal-data/legal surface is detected,
    recording the basis in gate-a.json. (recommended)
  - Option B — Always surface Posture to the human as a real question; never pre-fill it.
  - Option C — Auto-answer only when the spec touches no files under detector-named sensitive
    or data paths; otherwise ask.

- **G1 — Verify grouped/rotated citations map in order.** Seen in eval-gate-runs (F3) and
  graph-orientation (round-1 MUST_FIX "R6 AC8 wrong line"). Rule text: "When an AC or a task
  cites more than one line in a grouped list `(:a, :b, :c)`, each citation is verified
  against the specific phrase it follows; a drafter never carries a grouped citation whose
  members are rotated relative to the items they annotate. The adversarial review spot-checks
  one member of every grouped citation." Target: `.spec-workflow/agent-rules.md` (Citations
  section).

- **G2 — Regression-guard test seam (already ruled; confirm, do not re-graduate).** Seen in
  eval-gate-runs (F2), controller-liveness-and-push (F4), advisor (F12), lean-orchestrators.
  agent-rules.md:176-178 already mandates marking all-regression-guard tasks implementer-only
  up front, and on this run the reviewer caught the seam before any spawn was wasted. No new
  rule — the existing one holds; the recurrence is the drafter still emitting the seam, which
  belongs to P5's "move prevention upstream of the reviewer" decision, not a steering change.
  Target: none (existing rule confirmed effective).

## Decisions

- P5: Should small, well-understood changes get a reduced doc-review track? → Option C: keep all phases but cap doc-review to one round when the first round returns only MUST_FIX/SHOULD_FIX items that are all drafting (not design) defects.
- P8: May the harness auto-answer Gate A "Posture" as n/a when it reads the surface as empty? → Option A: keep auto-answering n/a when no money/personal-data/legal surface is detected, recording the basis in gate-a.json.

## Rejected proposals

None.

## Close-out

One line per proposal, written by the close-out phase.
- P2: skipped — no change chosen
- P3: skipped — no change chosen
- P4: skipped — no change chosen
- P6: skipped — no change chosen
- P7: skipped — no change chosen
- G2: skipped — no change chosen
- P5: to-do (human) — Open DECISION NEEDED — human owns the determinism-vs-cost process-track choice; no decision recorded, recommended option is no change
- G1: done — 5876e27b40d0b28506d4f410347a2c952e49da27
- P8: done — 833e70611cff95ce3e49695bb05dc4dcae3ff900
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/204
