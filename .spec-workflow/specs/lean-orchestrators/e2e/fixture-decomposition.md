# Spec Decomposition — lean-orchestrators end-to-end fixture

A throwaway decomposition for the lean-orchestrators end-to-end scenario
(Requirement 8). It names one spec, `lean-fixture`, whose six small, separate
string helpers give the tasks phase at least six independent tasks — enough for
scenario 2 to show a fresh worker per review round and per task, and one PR.

This file is copied into a scratch store as `spec-decomposition/decomposition.md`
by the kit's `stage.sh`. The scratch store ships no `specs/` folder, so
`sdd-continue` routes `no-specs` and takes the first slug named here —
`lean-fixture` — as the active spec, starting at requirements (sdd-continue
step 2).

## Specs

### 1. `lean-fixture` — six small string helpers (active)

**Delivers.** Six small, separate pure functions in `src/strings.js`, each its own
unit of work and independent of the rest, so the tasks phase produces at least six
tasks:

- `capitalize(s)` — upper-case the first character, leave the rest unchanged.
- `reverse(s)` — return the characters of `s` in reverse order.
- `isPalindrome(s)` — true when `s` reads the same forwards and backwards.
- `wordCount(s)` — count the whitespace-separated words in `s`.
- `truncate(s, n)` — cut `s` to at most `n` characters, adding an ellipsis when cut.
- `slugify(s)` — lower-case `s` and join its words with single hyphens.

Each function ships with its own `node --test` unit test beside the module.

**Decided.** The functions are pure and dependency-free so each task is a vertical
slice a reviewer holds in view, and the whole run stays small enough to exercise
every phase without a large code base. The base `src/strings.js` exports only a
placeholder; every function is added by the run.

**End-to-end verification.** A run on the changed harness through all four phases:
(1) the ledger shows a fresh worker `spawn.start` per review round and per task, and
one PR; (2) `harness usage` with `sources: true` shows orchestrator W per review
round and per task below `baseline-sources.md`; (3) `npm test` on the fixture
(`node --test`) is green. The kit is dry-run in the scratch store and recorded
green before this gated run (`.spec-workflow/agent-rules.md:99-110`).

**Depends on** nothing. It is the only spec in this decomposition.
