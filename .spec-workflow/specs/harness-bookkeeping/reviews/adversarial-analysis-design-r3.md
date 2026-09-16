# Adversarial Analysis — harness-bookkeeping/design (v3)

Round 3. Primary surface: feasibility, consistency, edge cases. Fresh lens: the cost of
touching an existing component — its tests, fixtures, tool-list assertions, `--watch`
output pins. Attacked the v3 delta (the R2-1 fold rewrite and M-R2-1 Component 5 list)
first, then read every installed test the change would touch.

## What I checked and how

- Read the v3 delta (`## Changes since f871e5d`) and the v3 lint commit (`## Lint commit
  e3edb46`), plus the whole design v3, the r2 analysis and the rolling memory.
- Re-derived the R2-1 fold by hand against `src/watch/ledger.ts` (spawn-pairing loop
  `226-248`, the `!s.endedAt` one-time pairing at `241`, `tokensTotal` reduce `273`, the
  ticker `spawn.start`/`spawn.end` branch `300-301`, `SpawnNode` `63-78`, `parseJsonl`
  `129-142`) and `src/watch/render.ts` (worker filter `121`, `agentLines` `180-208`).
- Verified both ends of every citation the v3 delta wrote or kept in the reworked clauses:
  `sdd-implementation-phase/SKILL.md:85-88` (implementer brief), `:114-118` (high-risk
  verifier brief), `:126-128` (adjudicator brief), `:174-177` (e2e verifier, prompt),
  `sdd-document-phase/SKILL.md:191-195` (document adjudicator brief),
  `sdd-closeout-phase/SKILL.md:24` (one worker at a time), `:136`/`:141`/`:145`
  (close-out verify/fix/adjudication files), `formats.md:169-181` (event script) and
  `:178` (every value written as a string). All accurate, both ends.
- Fresh lens: read `src/watch/__tests__/ledger.test.ts`, `src/watch/__tests__/render.test.ts`,
  `src/tools/index.ts:17-96` (registration array + dispatch switch), the tool-router e2e
  test `src/tools/__tests__/spec-lint.e2e.test.ts`, and `src/__tests__/parity-baseline.test.ts`.

## The v3 delta — R2-1 fold rewrite

The delta is correct. Traced both guaranteed reuse cases through the new rule ("each
`spawn.usage`, in `ts` order, onto the nearest earlier same-agent `SpawnNode` no earlier
`spawn.usage` has claimed; synthesize when none is unconsumed"):

- **`sdd-verifier` (e2e after per-task).** Pairing loop makes one node for the brief
  per-task verifier (`spawn.start`+`spawn.end`, ended). The e2e verifier's unmatched
  `spawn.end` is dropped (no open same-agent node, `ledger.ts:241`). Fold in ts order:
  the per-task usage claims the brief node; the later e2e usage finds it already claimed
  → synthesizes its own level-2 node. e2e verifier keeps its tokens; the per-task node
  keeps its role. Correct.
- **`sdd-implementer` (close-out fix after batch).** Same shape: batch usage claims the
  `closeout-brief-*` node, the `closeout-fix-*` usage synthesizes. Correct.

The unguarded-`role`-overwrite risk from r2 is closed structurally: because each usage
claims exactly one (its own) node, no foreign usage reaches a correct node to relabel it.
The `!s.endedAt` citation at `ledger.ts:241` is accurate as grounding for the "one-time
pairing" pattern; the operative consumption predicate the design states ("no earlier
`spawn.usage` has claimed") is distinct and correct — a brief node already has `endedAt`
set by fold time, so the fold necessarily uses a separate claim marker, which the design's
wording requires. **R2-1 is resolved.**

M-R2-1's added Component 5 citations (`:85-88`, `:114-118`, `:126-128`, `:191-195`) are all
accurate and all name brief-launched (`*-brief*`) files. No citation error in the delta;
no MUST_FIX from the delta's artifacts.

## Fresh lens — cost of touching the existing components

The verdict of the fresh lens is that the change is **additive and inert** on every
installed fixture, and the Testing Strategy names the two files it extends. Concretely:

- `ledger.test.ts` and `render.test.ts` fixtures carry `spawn.start`/`spawn.end` only
  (tokens on `spawn.end` at `ledger.test.ts:116`,`:127`; the tokens-from-`agent.stop`
  case `:114-124`). The new fold pass iterates `spawn.usage`, of which these fixtures have
  none, so it runs zero iterations and leaves every node untouched — the old-ledger path
  the design pins in 4.1. The new ticker branch is likewise inert without a `spawn.usage`
  event. So **no installed watch test moves**; the design's "extend ... for the
  `spawn.usage` join and for an old ledger rendering unchanged (4.1)" is the right call.
- No `*.snap` snapshot pins `--watch`; `render.test.ts` uses `toContain`/`toMatch` on
  lines the delta does not alter. Green.
- No installed test enumerates or counts `registerTools()`; the only handler that goes
  through `handleToolCall` (`spec-lint.e2e.test.ts`) calls it for `spec-lint` alone, so a
  new `harness` case is additive. `src/__tests__/parity-baseline.test.ts` is the review-task
  / project-registry roots baseline (R3 AC 11 / R7 AC 8) and never touches `buildModel` or
  the tool list — out of scope for this change.

So the prompt's trap ("a design that adds a join rule but never states which installed
test the new event class breaks") does not land here: the new event class breaks no
installed test, and the design says so.

## Findings

### R3-1 — `docs/TOOLS-REFERENCE.md` states "13 tools"; the `harness` tool makes 14 (MINOR) — Novel

`docs/TOOLS-REFERENCE.md:5` reads "The server registers **13 tools** (see
`src/tools/index.ts`)". `registerTools()` (`src/tools/index.ts:18-32`) has exactly 13
entries today; Component 1 adds `harnessTool`, making 14. The design's Component 7 lists
the doc/skill edits it plans (`formats.md`, the three phase skills, `sdd-continue`) but
does not name `docs/TOOLS-REFERENCE.md`, whose count word and per-tool section both go
stale. `agent-rules.md` (§Documents) is explicit that a text stating a count must be
updated with the command that finds every member. This is a documentation-sync note, not
a wrong implementation; it does not keep the loop alive.

### R3-2 — Testing Strategy names the `spawn.usage` join but not the reused-agent unconsumed case it just fixed (MINOR) — Novel

The Testing Strategy says only "Extend `src/watch/__tests__/ledger.test.ts` for the
`spawn.usage` join and for an old ledger rendering unchanged." The exact failure R2-1
closed — a second same-agent worker (prompt-launched) synthesizing rather than folding
onto its agent's already-claimed brief node, plus the assertion that the earlier node's
`role` is not relabelled — is the one case most worth pinning, given the r2 MUST_FIX and
that every past post-round-1 MUST_FIX was a delta regression. "the `spawn.usage` join"
arguably covers it and a competent implementer reading the R2-1 Revision-History entry
would write it, so this is a nice-to-have, not a real gap.

## Top 3 risks/gaps

1. None at MUST_FIX/SHOULD_FIX. The one prior MUST_FIX (R2-1) is resolved and its fix is
   correct for both guaranteed reuse cases.
2. Doc count drift: `docs/TOOLS-REFERENCE.md` "13 tools" unaddressed by the design (R3-1).
3. The reused-agent unconsumed-match case is not explicitly named as a required test (R3-2).

## Top 3 conclusions to challenge or reverse

1. **"because each `spawn.usage` claims exactly one node ... the Overview invariant holds
   on the new path" (Component 6).** Stress-tested against `sdd-verifier` and
   `sdd-implementer` reuse and against the pairing loop's late-close ordering; it holds.
   Token total and spawn-node presence match the old-ledger path for the e2e verifier and
   the close-out fix implementer. No reversal.
2. **"the spawn-pairing loop is unchanged (`ledger.ts:226-248`)" while the hook now writes
   `spawn.end` for prompt-launched workers too.** Checked whether a prompt worker's
   unmatched `spawn.end` could close an open same-agent brief node early: it cannot,
   because "one worker at a time" (`sdd-closeout-phase/SKILL.md:24`) forbids the overlap,
   so the brief node is already closed by its own `spawn.end` first. Holds.
3. **"An old ledger ... is unchanged (4.1)."** Confirmed against the installed
   `ledger.test.ts`/`render.test.ts` fixtures: the new pass and ticker branch are inert
   without `spawn.usage`. Holds.

## What's missing before acting on this document

- A one-word count update to `docs/TOOLS-REFERENCE.md` when the `harness` tool lands
  (R3-1), best carried as a task note, not a design change.
- Optionally, an explicit test line for the reused-agent unconsumed-match synthesis and
  the non-relabel guarantee (R3-2).

Nothing here is a contradiction, a false codebase claim, an unimplementable requirement,
or a data/security hole. Converged.

VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 2
DESIGN_READY: yes
ESCALATE: none
