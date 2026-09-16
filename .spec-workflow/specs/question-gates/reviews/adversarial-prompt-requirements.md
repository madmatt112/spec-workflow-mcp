# Adversarial Review — question-gates/requirements (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Completeness, ambiguity, scope

**Example attack angles to consider:** Missing user stories, unstated assumptions, scope creep risk, contradictions between stories, acceptance criteria that can't be tested

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-requirements.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): none.
- Changes: the diff from the `docs(sdd): question-gates requirements v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `question-gates` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.
- Over cap: not over cap (1,780 words against a cap of 3,500).
- Fresh lens for this round: wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-requirements.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — requirements`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since 5a8495b

````diff
diff --git a/.spec-workflow/specs/question-gates/requirements.md b/.spec-workflow/specs/question-gates/requirements.md
index c2355db..c224f2f 100644
--- a/.spec-workflow/specs/question-gates/requirements.md
+++ b/.spec-workflow/specs/question-gates/requirements.md
@@ -19,7 +19,7 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 1. WHEN a gate runs THEN the supervisor SHALL read `gates: block | record` from `agent-rules.md` when the key is present.
 2. IF `agent-rules.md` has no `gates:` key THEN the supervisor SHALL default to `block` when AskUserQuestion is available and `record` when it is not.
 3. IF AskUserQuestion is unavailable, returns an error, or returns denied THEN the supervisor SHALL treat the gate as `record` mode and SHALL NOT stall the run.
-4. WHEN the supervisor treats a denied AskUserQuestion call as `record` THEN it SHALL NOT change the run ledger's `headless` flag, because a denial is not evidence of a headless run (`docs/step-0-answers.md:96-107`).
+4. WHEN the supervisor treats a denied AskUserQuestion call as `record` THEN it SHALL NOT change the run ledger's `headless` flag. AskUserQuestion can be denied by a `dontAsk` permission rule even when an allow rule matches (`docs/step-0-answers.md:105`), so a denied call alone does not prove the run is unattended.
 5. WHEN a gate runs in `record` mode THEN the supervisor SHALL write the gate's items to `specs/<spec>/questions.md`, write a HANDOFF `## Phase log` row, and proceed.
 
 ### Requirement 2 — Gate A: requirements direction confirmation (interactive)
@@ -109,3 +109,4 @@ No `steering/product.md` exists, so the decomposition entry (`spec-decomposition
 
 ## Revision History
 - **v1** (2026-09-16) — Initial draft.
+  - **Lint pass.** 2 fixed; rejected: none.
````
