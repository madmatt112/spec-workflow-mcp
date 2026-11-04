# Design — eval-drafter-success-includes-eslint

## Component 1 — the position formatter

`src/features/positions/format.ts` exports `formatPosition(position)` and
`src/features/positions/format.test.ts` is its unit test (Requirement 1 AC1). `format.ts` is a
`.ts` source file, so the project's ESLint rules (including `import-x/order`) apply to it.

The task that edits `format.ts` lists the worktree-root ESLint binary over the edited files —
`./node_modules/.bin/eslint src/features/positions/format.ts` — in its Success checks, alongside
the vitest run (Requirement 1 AC2). A lint error then reds at the task gate, not later at the
phase-completion gate.
