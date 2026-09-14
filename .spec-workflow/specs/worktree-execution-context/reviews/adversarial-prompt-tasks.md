# Adversarial Review — worktree-execution-context/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/tasks.md

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Atomicity, ordering, coverage

**Example attack angles to consider:** Tasks too large or too small, missing dependency edges, gaps between tasks and design, unclear completion criteria, tasks that don't map to any requirement

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Output
Write your analysis to: /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/reviews/adversarial-analysis-tasks.md
