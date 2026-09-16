# Reviser brief — question-gates design v3 (SHOULD_FIX-only corrective pass)

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v3 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/design.md` in place
from the three SHOULD_FIX findings below, then report in 150 words or fewer: files
touched; each finding as `<id>: accepted | partially accepted | rejected`; citations
verified (count); the document's word count; flags. No file contents.

This is a SHOULD_FIX-only corrective pass: the round-2 review carried no MUST_FIX. Address
**only** the three SHOULD_FIX items (R2-1, R2-2, R2-3). Do **not** address the MINOR items
R2-4 and R2-5 — leave them as they are.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/design.md` (v2).
  Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes
  one.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md`.
- Findings:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-design-r2.md`
  — the SHOULD_FIX items R2-1, R2-2, R2-3 only (full text under `## Findings`, and
  restated below).
- Memory:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-design.md`
  (read; do not write it). Read `## Guidance for Next Review`.
- You may call the spec-workflow `adversarial-response` tool (`specName: question-gates`,
  `phase: design`) for the response methodology. Ignore its instructions to present to a
  user, wait, or delete approvals.

## The SHOULD_FIX findings
- **R2-1 (SHOULD_FIX, Compounds R1-3)** — `gate put slot=a` is a full-file overwrite
  (reuses `briefAction`'s `writeFile`, no merge), so the R1-3 narrow re-spawn that puts
  one triple drops the other decisions. Make the fix internally consistent: either the
  re-spawned drafter reads the current `gate-a.json` and re-puts all items with the one
  triple changed, or re-extracts and re-puts the full set — and remove the contradicting
  "naming just that decision" wording.
- **R2-2 (SHOULD_FIX, Compounds R1-3)** — the R1-3 re-spawn trigger requires the
  orchestrator to read document body it is barred from reading (`SKILL.md:20`). Pin a
  trigger the orchestrator is allowed to observe (a reviser report flag, or the
  lint-finding-line-number-in-Decisions-section check against the `grep -n '^#'`
  structure) and state it.
- **R2-3 (SHOULD_FIX, Novel)** — gate-B classes (b)/(c) tell the tasks orchestrator to
  judge new external dependencies and out-of-scope work from `tasks.md` / `requirements.md`,
  which violates `SKILL.md:20` and contradicts Component 4's own Purpose. Route the (b)/(c)
  inputs through a worker or a server op (as gate A / class-(a) do), or reword the source
  to the worker reports and `class-a` data the orchestrator already holds, and reconcile
  the Purpose line.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one
   line of reasoning. Never accept to be agreeable; never reject to save work. When a
   finding says a rationale clause is false, delete the clause unless you can prove the
   replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated
   artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what the requirements pinned.
4. Write v3 in place. Add the Revision History line
   `- **v3** (2026-09-16) — Round-2 adversarial response (adversarial-analysis-design-r2.md,
   verdict iterate 0/3/2); SHOULD_FIX-only corrective pass.` followed by one nested bullet
   per SHOULD_FIX finding:
   `- **<id> — <Accepted | Partially accepted | Rejected> (SHOULD_FIX).** <what changed,
   or why not>`. If the document carries a `Document version:` header, set it to v3.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file
   belong to others. You may replace a context-file line that an accepted finding refutes:
   same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct and fix each; list them under the finding's bullet. A sibling left unchanged
   is next round's finding.
10. R2-1 and R2-2 are marked `Compounds: R1-3` — they land in text the v2 delta wrote: do
    not reword the clause again cosmetically. Write one plain sentence of what the clause
    must claim, delete the old text, and probe the new claim as round 1 would. A claim you
    cannot probe is deleted, not kept.
