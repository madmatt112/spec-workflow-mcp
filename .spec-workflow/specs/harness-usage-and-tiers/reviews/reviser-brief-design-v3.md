# Reviser brief — harness-usage-and-tiers design v3 (SHOULD_FIX-only corrective pass)

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v3 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md`
in place, addressing only the two SHOULD_FIX findings below, then report in 150 words or
fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`;
citations verified (count); the document's word count; flags. No file contents.

This is a SHOULD_FIX-only corrective pass: the round-2 review returned MUST_FIX 0,
SHOULD_FIX 2. There is no further review round — a narrow check verifies only that these
two items were addressed. Fix each, or rule it out with a stated reason that stands on
its own.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md`
  (v2). Cap: 4,000 words (body only, H1 to line before `## Revision History`). The body
  is at exactly 4,000 — do not grow it; a fix that adds words removes the same elsewhere.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/requirements.md`.
- Findings:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-analysis-design-r2.md`
  (the two SHOULD_FIX items only; ignore anything already dispositioned in prior rounds).
- Memory:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/reviews/adversarial-memory-design.md`
  (read; do not write it). Read `## Guidance for Next Review`.
- You may call the spec-workflow `adversarial-response` tool (`specName:
  harness-usage-and-tiers`, `phase: design`) for the response methodology. Ignore its
  instructions to present to a user, wait, or delete approvals.

## The two SHOULD_FIX items
- R2-1 (SHOULD_FIX, Compounds R1-1): the retrospective skill edit span `:35-39` straddles
  the `phase.start` (line 35) and `phase.end` (lines 39-40) ledger boundaries, but
  Component 7's replacement text names neither, so a literal edit at that span would drop
  the retrospective phase's ledger boundaries. Fix the seam at both ends: correct the span
  and/or the replacement text in Component 7 so the edit preserves the `phase.start` and
  `phase.end` lines. Verify the real line numbers against
  `/home/mcf/repo/spec-workflow-mcp/harness/skills/sdd-retrospective/SKILL.md` (read both
  ends of the range).
- R2-2 (SHOULD_FIX, Novel): Component 4's "never both [badge and tokens]" invariant is
  pinned only to the `spawn.usage` path (`:267-271`), but design decision D9 makes
  `agent.stop` carry `tokens`, and the activity join (`src/watch/ledger.ts:305-311`,
  `to=+Infinity`) fills an open node — so an interleaved double `spawn.start` can render a
  node that is both running and carries tokens, producing a head line of 84 columns
  (over the 80 cap) and a transient `tokensTotal` double-count. Address the design gap:
  pin the mechanism that keeps the invariant across the `agent.stop`/join path (or that
  bounds the head line to 80 columns and prevents the transient double-count), citing the
  real code both ends. Verify the join behaviour against
  `/home/mcf/repo/spec-workflow-mcp/src/watch/ledger.ts` before you write.

## Disposition rules
1. Assess each finding on its merits: accept, partially accept, or reject, each with one
   line of reasoning. A rule-out is final for this phase and its reason must stand alone.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of every range. A misstated
   artifact would fail the narrow check.
3. Do not widen scope, and do not re-decide what the requirements or a prior ruling
   pinned (the two RE-DECIDED literals ruled refinement at round 1 stay closed).
4. Write v3 in place. Add the Revision History line `- **v3** (2026-09-19) — Round-2
   adversarial response (adversarial-analysis-design-r2.md, verdict iterate 0/2/0),
   SHOULD_FIX-only corrective pass.` followed by one nested bullet per finding: `- **<id>
   — <Accepted | Partially accepted | Rejected> (SHOULD_FIX).** <what changed, or why
   not>`. Set the `Document version:` header to v3. A Revision-History bullet cites
   findings by id and prose only; no backticked path or identifier token. Cite the exact
   post-fix line the changed text now reads.
5. Closed by ruling, leave as is: the two drafter RE-DECIDED literals (Req 4.7 two-line
   agent entry; Req 5.4 / D6 non-digit `tokens` value).
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. You may replace a context-file line an accepted finding refutes:
   same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct and fix each; list them under the finding's bullet.
11. Both items name a cross-artifact seam (R2-1: the skill file and Component 7's edit;
    R2-2: the invariant and the ledger join). Edit and cite both ends under the finding's
    bullet, never the symptom on one side.
