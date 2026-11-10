# Narrow check — dashboard-ruling-view/tasks v2

This is not a review. v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/tasks.md` was reviewed in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/reviews/adversarial-analysis-tasks.md`; a corrective pass produced v2 and addressed the items below. Verify only that each item was addressed in v2: fixed, or ruled out with a stated reason under the v2 Revision History line. Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/codebase-context.md` first, then the document, then the code the items cite under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/dashboard-ruling-view` as needed.

## Items
S-1 — [drafting] R1-1 — Task 7 Success lost its only riskFromLedger prefix-boundary sub-case: the lint pass changed the illustrative ledger id from `gate: task 12` to `gate: task 2`, which never prefix-collides with `task 1`, so the design C5 regex boundary (`^gate: task <id> \S+ risk …`) is no longer exercised. Per retro P7 the test author writes to Success, so the boundary test is silently dropped and a greedy/space-dropping implementation (riskFromLedger('1') returning task 12's risk) passes green. Restore a colliding example (task 1 vs gate: task 12) and fix the citation-identifier lint skip-regex rather than weakening the test.

## Output
Write to `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/dashboard-ruling-view/reviews/adversarial-analysis-tasks-r2.md`:
- One line per item: `<id>: addressed | not addressed — <one line>`.
- The line `VERIFIED: <k>/<n>` where k is the number addressed.
- Any new observation under a `## Deferred findings` heading, one line each. Do not write a verdict block. Do not update the memory file. Do not edit the document.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verified:
- deferred:
- analysis:
