# Adversarial Review — lean-orchestrators/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Feasibility, consistency, edge cases

**Example attack angles to consider:** Conflicts with steering docs, unaddressed failure modes, scaling bottlenecks, missing error paths, alternatives not considered

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Standing directives

- Ground every claim in the real codebase. Read the files the document cites before you judge them. A misstated artifact (wrong path, wrong line range, wrong signature, wrong behaviour) is an automatic MUST_FIX.
- Attack the deltas since the previous version first, then apply one fresh lens the prior rounds did not use.
- Rulings recorded in the document's Revision History are closed. Do not re-open them.
- Do not pad. MINOR-only findings do not keep the loop alive. A clean round is a valid result: show your work (what you checked and how) and say converged.
- Severity: MUST_FIX = contradiction, false claim about the codebase, unimplementable requirement, data or security hole. SHOULD_FIX = a real gap that causes rework or a wrong implementation. MINOR = wording, a value safely left to a later phase, nice-to-have.
- ESCALATE only when a human should look now: security, secrets, auth bypass, data loss, destructive migrations, money, billing, pricing, legal or compliance. Otherwise write `ESCALATE: none`.

## Verdict block

End the analysis file with exactly this block, values filled in:

```
VERDICT: converged | iterate
MUST_FIX: <n>
SHOULD_FIX: <n>
MINOR: <n>
DESIGN_READY: yes | no
ESCALATE: none | <one-line reason a human should look now>
```

`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid and doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note) — all citation-identifier warnings, rejected in the v1 lint pass because each names a design-introduced identifier (a new type, field, report key, or `orient` datum), a data value matched against behaviour code, or a cross-file token the rule mis-associated with a correct behavioural citation. Verify that each cited range anchors its adjacent claim; the flagged identifier need not appear literally in the range:
  - line 40: `UsageCell`, `wUnknown` (src/watch/usage.ts:259-275)
  - line 42: `round`, `implementation` (src/watch/usage.ts:116-124)
  - line 44: `perUnit` (src/watch/usage.ts:365-367)
  - line 81: `sources`, `listSpawns`, `resolveSession`, `findTranscript`, `readFile`, `breakdownTranscript`, `perUnit`, `compareSources` (src/tools/harness.ts:1215-1244)
  - line 95: `nextStep`, `Repair`, `safeJoin` (.spec-workflow/spec-decomposition/decomposition.md:771)
  - line 123: `brief` (harness/skills/sdd-continue/references/formats.md:164-183)
  - line 159: `nextStep` (harness/skills/sdd-document-phase/SKILL.md:224-273)
  - line 167: `nextTask` (src/tools/review-task.ts:263-267)
  - lines 176–183: worker report keys on each agent file's replaced report bullet (harness/agents/*.md)
  - line 190: `total`, `harness`, `orient` (harness/skills/sdd-continue/SKILL.md:379-380)
  - line 215: `testFiles`, `integration` (src/core/task-parser.ts:8-11)
- Changes: the diff from the `docs(sdd): lean-orchestrators design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for lean-orchestrators (entry 14) in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any probe line the document relies on (the C3 filesystem probe, the C4 source-base probe, the C11 baseline probe).
- The drafter re-decided these requirement literals; rule on each as `refinement` (closed) or `widening` (a MUST_FIX). You may close a flag as a `refinement` on your own authority when the change stays within the governing requirement's intent, stating the closure and its reason in your analysis; rule `widening` (a MUST_FIX) only when the flag reverses a requirement or crosses a decision the human owns:
  - Req 1.5 — per-call usage comes from the last line of each `message.id`, not the probe's first line.
  - Req 3.3 — lint rules are inline in the Lint step, not a template.
  - Req 4.2 — `orient` returns the whole open-task queue with files and test files.
  - Req 6.4 — one generic `book.sh`, written by a `harness brief` template.
  - Req 7.3 — the runaway guard uses the task total.
- Fresh lens for this round: wire contracts across a boundary — the ledger rows C7 writes and C1/C4 fold; the worker report blocks C9 emits and the orchestrator consumes; the brief-template values C6 renders and the skills pass. Trace each producer to its named consumer and check the shapes agree end to end.
- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `/home/mcf/repo/spec-workflow-mcp` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.
- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.
- Error-branch shape — every named error branch (a race loser included) pins both its error-type discriminant and its response status or exit behaviour in the design, not only its message. A named error branch that leaves its discriminant or its status/exit unstated is a MUST_FIX.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring. (This is round 1; there are none.)
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/lean-orchestrators/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
Freshness: built at 30d12da01289e80fc9ab47a821b5eb37c4a8bc8a, 0 commits behind HEAD.
A `file:line` from the graph is a hint to confirm, not a citation.

## Changes since a170e61

````diff
diff --git a/.spec-workflow/specs/lean-orchestrators/design.md b/.spec-workflow/specs/lean-orchestrators/design.md
index c1ade28..12a1183 100644
--- a/.spec-workflow/specs/lean-orchestrators/design.md
+++ b/.spec-workflow/specs/lean-orchestrators/design.md
@@ -50,7 +50,7 @@ graph LR
 - **Interfaces:** `breakdownTranscript(text: string): TranscriptBreakdown | null`. It returns null when the text holds no assistant line with `message.usage`.
 - **Algorithm (normative):**
   1. Parse each line as JSON; skip lines that do not parse.
-  2. A call is the assistant lines sharing a `message.id` (a line with no id is its own call). Its usage is its **last** line's, as `readUsage` keeps it (`harness/hooks/sdd-activity.sh:70-87`); its context is the blocks appended before its **first** line.
+  2. A call is the assistant lines sharing a `message.id` (a line with no id is its own call). Its usage is its **last** line's, as `readUsage` keeps it (`harness/hooks/sdd-activity.sh:68-87`); its context is the blocks appended before its **first** line.
   3. Label blocks with the table below. Size is characters; a tool result sums its text parts and takes JSON length for a non-text part.
   4. Per call, `ctx = input_tokens + cache_creation_input_tokens + cache_read_input_tokens` and `inW = input_tokens + 1.25·ephemeral_5m + 2·ephemeral_1h + 0.1·cache_read_input_tokens`; a missing field counts 0.
   5. `base = max(0, ctx₁ − C₁/3.5)`, sized once from the transcript's first call, `C₁` its preceding characters. For call k, `b = min(base, ctx_k)`: `base` gets `inW·b/ctx_k`, source s gets `inW·((ctx_k − b)/ctx_k)·(chars_s/C_k)`; when `C_k` or `ctx_k` is 0, `base` gets all of `inW`.
@@ -92,7 +92,7 @@ implementation | sdd-implementation-orchestrator | a46fec387251fb6c6 | calls 127
 - **Interfaces:** for `implementation`, `data` adds:
   - `queue: QueuedTask[]`: the `[-]` task, then the `[ ]` tasks in file order, without header tasks (the rule at `src/core/task-parser.ts:490-492`).
   - `nextTask`: `queue[0]` or null.
-  - `decomposition: { title: string | null; scenario: string | null }`, only when `nextStep` is `Completion gate` or `Repair`. It reads `spec-decomposition/decomposition.md` through `safeJoin`; the entry runs from the first `### ` line holding the backticked slug to the next `### ` or `## ` line; the title is the heading text after the slug; the scenario runs from the line starting `**End-to-end verification` (`.**` form, `.spec-workflow/spec-decomposition/decomposition.md:771`; `**:` form, `/home/mcf/repo/tradr-hosted/.spec-workflow/spec-decomposition/decomposition.md:72`) to before the next line starting `**` or `#`. Anything missing gives null.
+  - `decomposition: { title: string | null; scenario: string | null }`, only when `nextStep` is `Completion gate` or `Repair`. It reads `spec-decomposition/decomposition.md` through `safeJoin`; the entry runs from the first `### ` line holding the backticked slug to the next `### ` or `## ` line; the title is the heading text after the slug; the scenario runs from the line starting `**End-to-end verification` (`.**` form, `.spec-workflow/spec-decomposition/decomposition.md:771`; the parser also accepts the `**:` form) to before the next line starting `**` or `#`. Anything missing gives null.
 
 ### C6 — Server brief templates (`src/tools/brief-templates.ts`)
 - **Purpose:** Requirement 3 criteria 3 and 4.
@@ -270,3 +270,4 @@ interface QueuedTask { id: string; title: string; status: 'pending' | 'in-progre
 ## Revision History
 
 - **v1** (2026-10-02) — Initial draft.
+  - **Lint pass.** 2 fixed (readUsage citation tightened to the line the symbol starts on; cross-repo absolute path dropped from the C5 scenario-form note, keeping the in-repo citation); rejected: the 45 remaining citation-identifier warnings — all name design-introduced identifiers (new types and fields such as the W and unknown-W cells, per-unit fields, the orient queue and next-task, and the new worker report keys), data values matched against behaviour code, or cross-file tokens the rule mis-associated with a correct behavioural citation; each cited range was re-verified to anchor its adjacent claim.
````
