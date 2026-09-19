# Questions — worktree-review-signals

## Gate A

Ranked decisions from requirements v1, most direction-setting first. `options[0]` is the recorded choice.

Gate resolution (2026-09-17, block mode): the human answered D1, D3, D6 and D5 with "you choose" — the decisions were implementation mechanics they could not judge. The supervisor kept the recorded choice on every decision and did not ask D7. All five are approved unchanged.

### D1 — Diff base recording site
question: Record the per-task diff base at the dashboard status route only
options:
1. the dashboard status route only
2. an explicit `baseRef` argument on `prepare`
3. a computed merge-base with the default branch
answer: the dashboard status route only — human delegated the choice to the supervisor ("I don't know man this is too in the weeds. You choose."); recorded choice kept

### D3 — Where base and attribution live
question: One per-task record under the shared `.spec-workflow/specs/<spec>/` holds base and attribution with one owner per field
options:
1. one per-task record on the shared root, one owner per field
2. attribution in the implementation-log markdown entry
3. two separate stores
answer: one per-task record on the shared root, one owner per field — human delegated ("You choose."); recorded choice kept

### D6 — All-drop honesty without touching pinned text
question: Make the all-drop review honest via a new diff-state kind with new preamble and header constants
options:
1. a new diff-state kind with new preamble and header constants
2. editing `R4_2A_DIFF_EMPTY` and the header with a fixture regeneration
3. leaving the residual
answer: a new diff-state kind with new preamble and header constants — human delegated ("no idea what you're even talking about ... You pick"); recorded choice kept

### D5 — New typecheck reasons bypass the pinned constant
question: New `unavailable` reasons surface through `executionContext.typecheck`; `R4_6B_TYPECHECK_UNAVAILABLE` is not edited
options:
1. surface through `executionContext.typecheck`, constant untouched
2. editing the constant with the fixtures and `tighter-reviews` R4.6b in one change
answer: surface through `executionContext.typecheck`, constant untouched — human delegated ("Same, you pick"); recorded choice kept

### D7 — Diff delivery on the dashboard path
question: The diff body travels by a file beside the output path; the diff state travels inline in the prompt
options:
1. diff body by file beside the output path, state inline
2. inlining the body in the prompt
3. omitting it
answer: diff body by file beside the output path, state inline — not asked; the human had delegated the first four, so the supervisor kept the recorded choice
