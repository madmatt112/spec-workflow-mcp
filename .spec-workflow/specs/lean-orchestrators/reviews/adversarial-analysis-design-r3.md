# Adversarial Analysis — lean-orchestrators/design (v3), round 3

Primary surface: feasibility, consistency, edge cases.
Fresh lens: a cold read for internal contradictions and a truth table of every
enumerated case (the spawn-sources failure union against the Error Handling table,
the orient `nextStep` routing, each error branch's discriminant and status code).

## Topics attacked

1. **The `no-usage` discriminant seam (R2-2 fix).** Verify it is produced where
   `breakdownTranscript` returns null and consumed at the block/header, and that the
   union and the Error Handling table now balance.
2. **The brief-template test-accounting (R2-1 fix).** Check the named existing tests
   against the real `briefAction` suite, and the drift-guard description/citation.
3. **`render()` per-kind conditional coverage.** Stress-test "one `render()` snapshot
   per brief kind" against templates that branch on phase, D and variant.
4. **The `authorFiles`/`authorReport` producer wire.** Trace the implementer brief's
   two new values back to a producer across the C6/C9 seam.
5. **Truth table of the error branches and orient routing.**

## Deltas re-verified first (required)

The v3 delta changed exactly two things; both re-check clean on the points they fixed.

**R2-2 — `no-usage` discriminant. Clean.** The union (design.md:210) now carries
`no-usage` as a sixth `ok:false` reason. Error Handling item 1 (design.md:219) maps six
conditions to six reasons: no `agentId`→`no-agent-id`, no session→`no-session`, id-check
fail→`invalid-id`, no transcript / no projects dir→`missing` (from `findTranscript`),
unreadable→`unreadable`, readable-but-`breakdownTranscript`-null→`no-usage`. Truth table
balances 6↔6, no condition unmapped, no reason unused. Producer: C2 (design.md:50)
`breakdownTranscript` "returns null when the text holds no assistant line with
`message.usage`", matching the C4 flow `readFile`→`breakdownTranscript` (design.md:81).
Consumer: the block prints `sources unknown (<reason>)`, the header counts it, the action
returns `success: true` (status code pinned). `findTranscript`'s return type
`{ ok:false; reason:'invalid-id'|'missing' }` (design.md:207) supports the folded
no-projects-directory→`missing` mapping. Both ends wired. No finding.

**R2-1 — brief test-accounting. Partially clean; two residuals below.** The five named
"existing `briefAction` tests" are real in `src/tools/__tests__/harness.test.ts`:
all-missing message (227), agent-rules drop (243), `taskBlock` (205/284), `redTests`
gating (335/355/373/388), graph append/none/behind-0 (417-437/439/454/477). The
drift-guard citation is now correct: the test spans `harness.test.ts:491-504` (was the
partial 491-495 in the context file) and does assert the `briefs.md` `## Code graph
block` equals `codeGraphSection('<GRAPH>','<GRAPH_BUILT_AT>','<GRAPH_BEHIND>')` (503), so
"deleted with the reference files" is accurate. The tests the design omits from the list
(unknown-template 38/271, relative-path 255, the three test-author tests 284/303/318) are
genuinely unaffected — test-author is "as today" (design.md:112) and the unknown/path
behaviours do not touch the value contract — so their omission is correct, not a gap.
Two residuals the fix did not close follow as R3-1 and R3-2.

## Findings

### R3-1 — "One `render()` snapshot per brief kind" does not cover the phase/D/variant conditionals the templates carry (SHOULD_FIX, Compounding R2-1, fix-induced)

C6 states the server renders "phase and D conditionals" (design.md:100) and the reviser
and verifier/fix kinds carry explicit variant sets — reviser `variant (round,
should-fix-only, revision, lint-fix)` (design.md:107), verifier five variants
(design.md:114), fix five variants (design.md:113). These are not notional: the real
`references/briefs.md` the templates must reproduce verbatim branches heavily — 13
conditional markers across the round section and reviser brief
(`harness/skills/sdd-document-phase/references/briefs.md`), including `<D = 1: …>` vs
`<D > 1: …>` (briefs.md:180-202), `<## Revision input …>` present only for the
`revision` variant (briefs.md:294-296), and `<- Requirements:>`/`<- Design:>` phase
branches (briefs.md:283-284).

The v3 Testing Strategy still plans only "one `render()` snapshot per brief kind"
(design.md:235). One snapshot fixes one (phase, D, variant) tuple per kind and exercises
exactly one side of every conditional. The reviser's `should-fix-only`, `revision` and
`lint-fix` branches, and the round section's `D = 1` first-review block versus the
`D > 1` attack-the-delta block, all ship untested. This is the exact sub-concern r2's
R2-1 raised ("Testing Strategy's 'one snapshot per kind' doesn't cover the
conditionals"); the v3 fix closed the test-accounting half of R2-1 and the drift-guard
half but left this half, so it compounds. Failure mode: the tasks phase decomposes C6 as
"one snapshot per kind," the `render()` for an untested variant renders the wrong
conditional block (e.g. a `should-fix-only` reviser brief carries the full-round
instructions), and a worker acts on the wrong brief with no test to catch it. Resolve:
state that the snapshot set covers each kind's variant and phase/D branches (one per
distinct rendered output), not one per kind.

### R3-2 — The implementer brief's `authorFiles`/`authorReport` values have no producer wired across the C6/C9 seam (SHOULD_FIX, Compounding R2-1)

C6 makes `authorFiles` and `authorReport` caller-supplied values of the implementer
brief that "build the red-tests section" (design.md:99,111). The caller is the
orchestrator. But C9 pins what the orchestrator may feed a downstream brief: "The
orchestrator passes the `findings`, `folds`, `notes` and `re-decided` paths into the next
brief as values, unread; it reads only the few-line `checks-file`" (design.md:185).
`authorFiles`/`authorReport` are in neither set. The producer — the test-author — reports
the key block `commit`, `tests`, `folds (path or none)`, `flag`, `retro` (design.md:182);
it emits no `authorFiles` and no `authorReport`.

So the two values the implementer `render()` needs for a TDD task have no named source,
and the lean-orchestrator constraint (pass listed paths unread, read only `checks-file`)
is precisely what forbids the orchestrator from fabricating them by reading the
test-author's report. r2's R2-1 already flagged this change ("the design changes the
implementer kind to build the red-tests section from `authorFiles`/`authorReport`
(design.md:113), so this gate's fate is unstated"); the v3 fix re-pointed the gating
tests to the new build (design.md:235) but still did not wire where the build's inputs
come from, so it compounds. Mitigating: today's `redTests` is also passed by the
orchestrator without an explicit design wire, so a reviser may read this as "same source,
split in two." But the C9 report-block redesign newly constrains the test-author's output
to a fixed key set that names neither value, and the passthrough list is explicit and
excludes them, so the seam is now genuinely open. Failure mode: the tasks phase wires
`tests`→`authorFiles` and guesses `authorReport`, or leaves the red-tests section empty,
and the implementer briefs without the red tests on a TDD task. Resolve: name the
producer for each (map them to test-author report keys, e.g. `folds`/`tests`) and add
them to the C9 passthrough, or state they are derived server-side from a path the
orchestrator already passes.

## Top risks/gaps

1. Variant/phase/D render branches ship untested under "one snapshot per kind" (R3-1).
2. The implementer brief consumes two values with no producer and no passthrough (R3-2).
3. (Checked, fine) The `no-usage` seam is wired at both ends; the union and Error
   Handling table balance 6↔6 (R2-2 fix).
4. (Checked, fine) The named existing brief tests are real and the drift-guard
   citation/description (491-504) is now accurate (R2-1 fix, test-accounting half).
5. (Checked, fine) orient `nextStep` values (`Completion gate`, `Repair`, `Per-task
   loop[: resume task]`, `error: tasks.md not approved`) match the C5 decomposition
   trigger and the C8 routers; `data.tasks.total` exists (`src/tools/harness.ts:325,362`)
   for the C10 runaway guard. No contradiction found.

## Top 3 conclusions to challenge or reverse

1. **"new tests add one `render()` snapshot per brief kind" (design.md:235) is adequate
   coverage.** Reverse: with per-kind variant sets and D/phase conditionals in the
   source templates, one snapshot tests one branch per kind; the plan must cover each
   distinct rendered output (R3-1).
2. **"`redTests` moves … to the `authorFiles`/`authorReport` build" (design.md:99) is a
   self-contained refactor.** Challenge: the build's inputs have no producer in the C9
   report keys and no slot in the orchestrator passthrough; the clause describes a
   consumer with no wire (R3-2).
3. **The R2-1 acceptance closed the finding.** Challenge: the acceptance closed the
   test-accounting and drift-guard halves; the conditional-coverage half (R3-1) and the
   authorFiles/authorReport producer (R3-2) remain, both landing in text the v3 delta
   wrote.

## What's missing before acting

- A snapshot/test plan that names coverage per rendered variant and phase/D branch for
  the reviser, verifier, fix and round-section templates, not one per kind (R3-1).
- An explicit producer and passthrough wire for `authorFiles`/`authorReport` across the
  test-author → orchestrator → implementer seam (R3-2).

VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 0
DESIGN_READY: no
ESCALATE: none
