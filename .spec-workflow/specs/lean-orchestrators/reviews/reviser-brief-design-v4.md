# Reviser brief — lean-orchestrators design v4 (SHOULD_FIX-only corrective pass)

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v4 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/design.md` in place from the two SHOULD_FIX findings below, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count (body only, H1 down to the line before `## Revision History`); flags. No file contents. This is a SHOULD_FIX-only corrective pass: there is no further review round, only a narrow check that each listed item was addressed.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/design.md` (v3). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one. The body is at 3,998 words, so trim elsewhere to make room for any addition.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/requirements.md`.
- Findings: the round-3 analysis `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-design-r3.md` (R3-1, R3-2 below).
- Memory: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-design.md` (read; do not write it — the reviewer maintains it). Read `## Guidance for Next Review`. When it names another place where an accepted finding's defect occurs, fix that place under the same finding's bullet as `also applied to <where>`. This is not widening scope.
- You may call the spec-workflow `adversarial-response` tool (`specName: lean-orchestrators`, `phase: design`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what requirements pinned. The five RE-DECIDED flags are closed refinements; leave them.
4. Write v4 in place. Add the Revision History line `- **v4** (2026-10-03) — Round-3 adversarial response (adversarial-analysis-design-r3.md, verdict iterate 0/2/0), SHOULD_FIX-only corrective pass.` followed by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted | Rejected> (SHOULD_FIX).** <what changed, or why not>`. A Revision-History or decision-log bullet cites findings by id and prose only; it carries no backticked path or identifier token. State what the fix did, not what it did not, and cite the exact post-fix line the changed text now reads.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same snapshot-coverage claim, the same passthrough/report-key list, the same seam) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. Both R3-1 and R3-2 are marked Compounding R2-1: they land in text the v3 delta wrote. Do not reword the clause again; write one plain sentence of what the clause must claim, delete the old text, and probe the new claim.
11. Both findings name a cross-artifact seam. R3-1: the Testing Strategy snapshot-coverage claim against the real variant/phase/D conditionals the templates carry (confirm against `harness/skills/sdd-document-phase/references/briefs.md`). R3-2: the implementer-brief `authorFiles`/`authorReport` producer against the C9 passthrough list and the test-author report keys. For each, edit and cite both ends under the finding's bullet, never the symptom on one side.
12. Gate-B tags are a tasks-phase concern; not applicable here.
13. Before you report, re-scan only the lines you changed in this pass for the finding classes you just fixed (a citation missing its directory prefix, a bare `:<line>`, an unproven rationale clause, a half-fixed cross-artifact seam). Fix any regression your own delta introduced now.
14. After any re-anchor or agreed-wording fix, before you hand back, self-verify that every new producer the delta introduced has a named consumer, and every acceptance criterion the delta touched stays consistent with the rest of the document.
15. Post-trim citation check. After any trim to stay under the cap, re-verify that every surviving accepted criterion still carries its original citation, anchored to the exact phrase it supports. A trim that drops a citation, or moves one off the phrase it cited, is a MUST_FIX next round.

## Findings
Disposition both SHOULD_FIX findings in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-design-r3.md` (round 3). Verdict iterate 0/2/0.
- R3-1 (SHOULD_FIX, Compounding R2-1): The Testing Strategy still plans "one render() snapshot per brief kind", but the templates carry phase/D/variant conditionals (reviser variant round/should-fix-only/revision/lint-fix; verifier and fix five variants each; the round section's D=1 vs D>1 branches). One snapshot per kind exercises exactly one side of every conditional, so untested variants can render the wrong block with no test to catch it. Resolve: state that the snapshot set covers each kind's variant and phase/D branches (one per distinct rendered output), not one per kind. Confirm the real branching against `harness/skills/sdd-document-phase/references/briefs.md` before you write.
- R3-2 (SHOULD_FIX, Compounding R2-1): The implementer brief's `authorFiles`/`authorReport` values (which build the red-tests section) have no producer wired across the C6/C9 seam — C9's passthrough list names findings/folds/notes/re-decided only, and the test-author's report key block names commit/tests/folds/flag/retro, neither of which emits them. Resolve: name the producer for each (map them to test-author report keys, e.g. folds/tests, and add them to the C9 passthrough), or state they are derived server-side from a path the orchestrator already passes. Edit and cite both seam ends (the C6/implementer-brief side and the C9 passthrough side).

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at 30d12da01289e80fc9ab47a821b5eb37c4a8bc8a, 0 commits behind HEAD.
