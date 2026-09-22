# Reviser brief — provider-per-role tasks v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v2 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md` in
place from the findings below, then report in 150 words or fewer: files touched; each
finding as `<id>: accepted | partially accepted | rejected`; citations verified (count);
the document's word count; flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md`
  (v1). Cap: 150 words per task block excluding its prompt. Do not grow a block past it;
  a fix that adds a paragraph removes one.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md`.
- Design:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/design.md`.
- Findings:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-analysis-tasks.md`
  (round 1). The two SHOULD_FIX (R1-1, R1-2) and two MINOR (R1-3, R1-4).
- Memory:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-memory-tasks.md`
  (read; do not write it). Read `## Guidance for Next Review`.
- You may call the spec-workflow `adversarial-response` tool (`specName:
  provider-per-role`, `phase: tasks`) for the response methodology. Ignore its
  instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one
   line of reasoning. Never accept to be agreeable; never reject to save work. When a
   finding says a rationale clause is false, delete the clause unless you can prove the
   replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under
   /home/mcf/repo/spec-workflow-mcp. Read both ends of a line range. A misstated artifact
   is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Write v2 in place. Add the Revision History line `- **v2** (2026-09-22) — Round-1
   adversarial response (adversarial-analysis-tasks.md, verdict iterate 0/2/2).` followed
   by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted |
   Rejected> (<severity>).** <what changed, or why not>`. Set the `Document version:`
   header to v2. A Revision-History or decision-log bullet cites findings by id and prose
   only; it carries no backticked path or identifier token. State what the fix did, not
   what it did not, and cite the exact post-fix line the changed text now reads.
5. Closed by ruling, leave as is: Req 2 crit 5 (`--agents` JSON `model` key carries the
   request alias, not the profile's declared model); Req 2 crit 7 (`--add-dir` passed when
   the spec store repo is outside the code root); R2-1 (MINOR, compare-mode provider-pair
   placement left to implementation).
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's
   task shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file
   belong to others. You may replace a context-file line that an accepted finding
   refutes: same line, corrected text, the probe that proves it. When an accepted finding
   changes a call signature that `design.md` states, apply the same text to that design
   component and add to `design.md` a Revision History line `- **v2 amended**
   (2026-09-22) — tasks R1-n: <what>`; list it under the finding's bullet as `also applied
   to design.md`.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same rule table, command, fixture shape or union member) and fix each;
   list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. A finding marked `Compounds: R…` lands in text a previous delta wrote: do not reword
    the clause again; write one plain sentence of what it must claim, delete the old text,
    and probe the new claim. A claim you cannot probe is deleted, not kept.
11. A MUST_FIX that names a cross-artifact wire or an acceptance-criterion contradiction
    is a seam: edit and cite both ends under the finding's bullet.
12. Gate-B tags (tasks phase): round 1 raised no `[gate-b:T…]` or `[gate-c:T…]` finding,
    so no gate tag applies this round.
