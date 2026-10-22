# Narrow check — verification-loop/tasks v3

This is not a review. v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/tasks.md` was reviewed in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-analysis-tasks-r2.md`; a corrective pass produced v3 and addressed the items below. Verify only that each item was addressed in v3: fixed, or ruled out with a stated reason under the v3 Revision History line. Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/codebase-context.md` first, then the document, then the code the items cite under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/verification-loop` as needed.

## Items
S-1 — R2-1 (Compounds R1-1, fix-induced): T8's new fifth routeForTask case reads 'an item whose taskId is another task' with no kind in both Task body and Success. A keyword item satisfies the Success clause but is ignored by kind not taskId, so it fails to catch a routeForTask that ignores taskId — which routes every non-sensitive task to Opus on a spec with one sensitive task, defeating R2, with a green suite. Fix: pin the item to 'sensitive-path' in both the Task body and Success clause, as round 1 proposed verbatim.

## Output
Write to `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-analysis-tasks-r3.md`:
- One line per item: `<id>: addressed | not addressed — <one line>`.
- The line `VERIFIED: <k>/<n>` where k is the number addressed.
- Any new observation under a `## Deferred findings` heading, one line each. Do not write a verdict block. Do not update the memory file. Do not edit the document.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verified:
- deferred:
- analysis:
