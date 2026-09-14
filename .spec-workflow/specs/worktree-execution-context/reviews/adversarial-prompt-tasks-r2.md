# Adversarial Review — worktree-execution-context/tasks (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/tasks.md

## Governing documents
- /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/requirements.md
- /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/design.md

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/reviews/adversarial-memory-tasks.md (it may not exist yet).
2. Read the latest prior analysis at /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/reviews/adversarial-analysis-tasks.md.
3. Classify each finding as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover resolved findings — but verify that findings the document claims to have closed are closed in substance rather than in prose.
5. After completing your analysis, write an UPDATED memory file to the path in step 1, using this format:

```markdown
# Adversarial Review Memory — tasks
Last updated: <today's date> (after v2 review)

## Cumulative Findings Summary
### Accepted
- <finding>: <brief description, which version identified it>

### Partially Accepted
- <finding>: <brief description, user's stance>

### Rejected
- <finding>: <brief description, reason for rejection>

### Unresolved
- <finding>: <not yet responded to>

## Patterns & Themes
- <high-level observations about recurring issues>

## Guidance for Next Review
- Focus areas based on what's been found
- Areas that have been well-covered and don't need re-examination
```

**This document was substantially restructured in response to v1.** The task count changed, several tasks were merged on the principle that "a boundary which is not a commit boundary is not a task boundary," two new tasks were inserted at the front, one was moved much earlier, and a `_Depends:_` line was added to every task. **The restructure is the primary attack surface** — it is new, unverified content, and prior rounds established that this document's fixes have repeatedly introduced defects worse than the ones they closed.

## Ground every claim in the code

Every line reference in this document should be verified against the working tree. Prior rounds found citations that did not say what was claimed, counts that were wrong, and tasks that named files whose contents made the task impossible. Flag every drifted citation and every claim about existing behaviour the code contradicts.

## Analysis approach

Attack the five dimensions below. They are priorities, not a boundary — lead with anything worse you find. For each, produce 3–5 directive bullets grounded in the document's concrete content and the actual code.

### 1. The `_Depends:_` graph

- Build the dependency graph from every `_Depends:_` line and establish whether it is acyclic, whether the stated numeric order is a valid topological order, and whether any task can actually start when its listed dependencies are complete.
- Attack every edge that is **missing**: find pairs where one task's success criteria cannot hold until another has landed, and check whether the document records it. Then attack every edge that is **wrong** — a dependency stated that is not real, which serializes work unnecessarily.
- Task 4 claims `_Depends: none_`. Establish whether that survives contact with tasks 3 and 14, and whether placing it before the change that creates the race it prevents leaves it testable at that point.
- Task 5 carries an unusual constraint — "must not land before 2 or 4" — expressed in prose rather than as a dependency. Establish whether that is a dependency, an ordering preference, or an unenforceable wish.

### 2. Task 6 — the merged mega-task

- Task 6 now covers a required `ToolContext` field, twenty construction sites, both runner option contracts, and six route wirings. Establish whether the indivisibility argument actually covers all of it, or whether only part is build-coupled and the rest was merged by association.
- Trace what a reviewer of that commit would have to hold in view, and what its failure mode looks like if one of the six route sites gets the wrong root.
- Stress-test the claim that merging the runner splits into task 6 prevents building on a placeholder. Establish whether any *other* task in the list still consumes a root that is not yet correct at the point it lands.
- Establish whether task 6 can be verified as complete. Its success criteria include behaviour ("an adversarial review and a retry both locate their target document from a worktree") that may need infrastructure no task has built yet at that point.

### 3. Coverage — every acceptance criterion against every task

- Cross-reference all seven requirements' acceptance criteria against every `_Requirements:_` line. Report every criterion with no owning task, and every task claiming a criterion it does not actually implement.
- Prior rounds found criteria orphaned in exactly this way. Verify the ones the document claims to have fixed — R5 AC 9, R5 AC 10, R7 AC 1 — are now genuinely owned rather than cited.
- Attack double-ownership: criteria claimed by more than one task, where neither task's success criteria would fail if the other did the work.
- Establish whether task 17's requirement citations are real work or bookkeeping.

### 4. Overlapping edits and merge hazards

- Tasks 9, 11 and 12 all modify `src/tools/review-task.ts`, and tasks 9 and 11 both modify `src/dashboard/task-review-runner.ts`. Establish whether they touch overlapping regions, and what happens if they are implemented out of order or in parallel.
- Task 8 moves functions out of `src/tools/review-task.ts` while task 9 edits it. Establish whether the move and the edit are compatible as separate landings.
- Establish whether any task leaves the tree in a state where the test suite fails but the build passes, and whether that state is acknowledged.

### 5. Completion criteria and the two new front tasks

- Attack task 2 — a characterization test that must pass on the unmodified tree and then, by construction, must be updated by later tasks that legitimately change behaviour. Establish which later tasks must update it, whether they say so, and how an implementer distinguishes a legitimate update from papering over a regression.
- Task 1's fixture is consumed by tasks 2, 3 and 8. Establish whether its stated capabilities actually cover what those three need, and whether anything they need is missing from it.
- Establish for each task whether its success criteria are verifiable by an implementer without reading the design, and flag any that are decisions rather than deliverables.
- Attack the two `_Prompt:_` fields that instruct the implementer to "state" or "decide" something, and establish what completion means for those.

## Closing deliverables
- **Top 5 risks/gaps**
- **Top 3 conclusions to challenge or reverse**, with reasoning
- **What's missing** — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something is actually fine, say so briefly and move on. Where a finding would cause rework during implementation rather than mere friction, say so explicitly.

## Output
Write your analysis to: /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/reviews/adversarial-analysis-tasks-r2.md
