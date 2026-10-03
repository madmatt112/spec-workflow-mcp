# Reviser brief — lean-orchestrators design v3

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v3 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/design.md` in place from the findings below, then report in 150 words or fewer: files touched; each finding as `<id>: accepted | partially accepted | rejected`; citations verified (count); the document's word count (body only, H1 down to the line before `## Revision History`); flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/design.md` (v2). Cap: 4,000 words. Do not grow the document past it; a fix that adds a paragraph removes one. The body is currently near the cap (3,987 words), so trim elsewhere to make room.
- Requirements: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/requirements.md`.
- Findings: the round-2 analysis named below.
- Memory: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-design.md` (read; do not write it — the reviewer maintains it). Read `## Guidance for Next Review`. When it names another place where an accepted finding's defect occurs, fix that place under the same finding's bullet as `also applied to <where>`. This is not widening scope.
- You may call the spec-workflow `adversarial-response` tool (`specName: lean-orchestrators`, `phase: design`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what requirements pinned. The five RE-DECIDED flags are closed refinements; leave them.
4. Write v3 in place. Add the Revision History line `- **v3** (2026-10-02) — Round-2 adversarial response (adversarial-analysis-design-r2.md, verdict iterate 1/1/0).` followed by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or why not>`. A Revision-History or decision-log bullet cites findings by id and prose only; it carries no backticked path or identifier token. State what the fix did, not what it did not, and cite the exact post-fix line the changed text now reads.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same union, rule table, field, or test-accounting claim) and fix each; list them under the finding's bullet. A sibling left unchanged is next round's finding.
10. A finding marked Compounds lands in text a previous delta wrote: do not reword the clause again; write one plain sentence of what the clause must claim, delete the old text, and probe the new claim. (R2-2 is carried, R2-1 is novel; neither is a Compounds finding.)
11. R2-2 is a cross-artifact seam (a producer and its consumer): edit and cite both ends under the finding's bullet — the SpawnSources union AND the Error Handling entry — never the symptom on one side.
12. Gate-B tags are a tasks-phase concern; not applicable here.
13. Before you report, re-scan only the lines you changed in this pass for the finding classes you just fixed (a citation missing its directory prefix, a bare `:<line>`, an unproven rationale clause, a half-fixed cross-artifact seam). Fix any regression your own delta introduced now.
14. After any re-anchor or agreed-wording fix, before you hand back, self-verify that every new producer the delta introduced has a named consumer, and every acceptance criterion the delta touched stays consistent with the rest of the document.
15. Post-trim citation check. After any trim to stay under the cap, re-verify that every surviving accepted criterion still carries its original citation, anchored to the exact phrase it supports. A trim that drops a citation, or moves one off the phrase it cited, is a MUST_FIX next round.

## Findings
Disposition the findings in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-design-r2.md` (round 2): one MUST_FIX (R2-2) and one SHOULD_FIX (R2-1). Verdict iterate 1/1/0.
- R2-2 (MUST_FIX, carried): Error Handling item 1's 'no usage line' branch has no discriminant in the SpawnSources union (design.md:210 lists five `ok: false` reasons; a `breakdownTranscript` null result maps to none of them). This is a cross-artifact seam: the producer (the `usage` flow calling `breakdownTranscript`) and the consumer (the SpawnSources union and the Error Handling table) must agree. Pin the discriminant for the null-breakdown case in both the union and the Error Handling entry, and cite both.
- R2-1 (SHOULD_FIX): C6's brief-template refactor under-accounts for the existing `briefAction` test suite — it names only one of the brief tests and mis-describes the drift guard, while moving `BRIEF_TEMPLATES` to a new module and changing the shape to `render()` invalidates the graph-append, redTests and missing-value tests that C6 claims to 'keep'. Correct C6 to state honestly which existing tests move, change or are replaced. Verify the actual test count and names in `src/tools/__tests__/harness.test.ts` before you write.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at 30d12da01289e80fc9ab47a821b5eb37c4a8bc8a, 0 commits behind HEAD.
