# Questions — worktree-review-signals

## Gate A

Ranked decisions from requirements v1, most direction-setting first. `options[0]` is the recorded choice.

### D1 — Diff base recording site
question: Record the per-task diff base at the dashboard status route only
options:
1. the dashboard status route only
2. an explicit `baseRef` argument on `prepare`
3. a computed merge-base with the default branch
answer:

### D3 — Where base and attribution live
question: One per-task record under the shared `.spec-workflow/specs/<spec>/` holds base and attribution with one owner per field
options:
1. one per-task record on the shared root, one owner per field
2. attribution in the implementation-log markdown entry
3. two separate stores
answer:

### D6 — All-drop honesty without touching pinned text
question: Make the all-drop review honest via a new diff-state kind with new preamble and header constants
options:
1. a new diff-state kind with new preamble and header constants
2. editing `R4_2A_DIFF_EMPTY` and the header with a fixture regeneration
3. leaving the residual
answer:

### D5 — New typecheck reasons bypass the pinned constant
question: New `unavailable` reasons surface through `executionContext.typecheck`; `R4_6B_TYPECHECK_UNAVAILABLE` is not edited
options:
1. surface through `executionContext.typecheck`, constant untouched
2. editing the constant with the fixtures and `tighter-reviews` R4.6b in one change
answer:

### D7 — Diff delivery on the dashboard path
question: The diff body travels by a file beside the output path; the diff state travels inline in the prompt
options:
1. diff body by file beside the output path, state inline
2. inlining the body in the prompt
3. omitting it
answer:
