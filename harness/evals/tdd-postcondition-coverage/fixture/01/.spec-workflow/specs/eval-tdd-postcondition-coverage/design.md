# Design — eval-tdd-postcondition-coverage

## Component 1 — splitBudget

`splitBudget(total, legs)` returns `{ legs: number[], reserve: number }`.

### Post-conditions

- **PC1** — the returned leg budgets sum to `total`.
- **PC2** — no leg budget is negative.
- **PC3** — the reserve equals 10% of `total`.

Each post-condition is a budget invariant that holds for every input; a task that
implements this component must pin each one.
