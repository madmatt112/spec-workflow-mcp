# Adversarial Analysis — tdd-task-loop/requirements (v3), Round 3

Primary attack surface: completeness, ambiguity, scope. Fresh lens: read each acceptance
criterion as a sub-agent that receives only the task prompt (its brief) and the cited
artifacts — is every trigger, threshold and channel resolvable without out-of-band
knowledge, and does any AC assume state the prompt never carries.

## What I checked and how

- Read the target, the memory file, the round-2 analysis, `codebase-context.md`,
  `agent-rules.md`, and the `## Changes since c6467e6` diff (the v3 delta).
- Attacked the v3 delta first. It touches exactly six spots, each a round-2 disposition:
  R1 AC1 (R2-1), R1 AC3 (R2-1), R3 AC4 (R2-2), R3 AC8 (R2-2), R4 AC13 (R2-3), R8 AC3
  (R2-4). The four Revision-History lines match the delta.
- Grounded every delta claim in code:
  - **R2-1 fix (AC1 gains "a test path by the gate's test-path rule").** `isTestPath` is a
    pure exported function taking a path string (`src/core/gate-rules.ts:193-198`, backed by
    `TEST_FILE_BASENAME_RE`/`TEST_DIR_SEGMENTS` at 37-40), so the parser can import it at
    parse time — the coupling R2-1 flagged as hidden is now stated and is implementable. AC1
    and AC3 now partition the input cleanly: AC1 = (test path ∧ em dash ∧ call text); AC3 =
    (¬em dash ∨ empty call ∨ ¬test path) = ¬(AC1) by De Morgan. The line
    `- Test: src/foo.ts — createWidget()` fires AC3 alone (non-test path → lint warning,
    stays in `implementationDetails`). The contradiction is closed. Grounded against the
    bullet fallthrough at `src/core/task-parser.ts:289-296` (today routes every non-Files/
    non-Purpose bullet to `implementationDetails`) and the `ParsedTask` spread at 314-332
    (a new `tests` field is a clean addition). No new defect.
  - **R2-2 fix (AC4 slot "filled for every task and empty when unmarked"; AC8 drops "write
    no red section").** Confirmed the empty-string route works: `src/tools/harness.ts:666`
    marks a placeholder missing only when `values[key] === undefined || null`, so an empty
    string passes the required check and `String("")` fills the slot (677-678). The
    unmarked/kill-switch brief now writes. AC8 and AC4 are consistent (AC8 speaks to the
    author and the `tdd` gate argument, not the slot). No new defect.
  - **R2-3 fix (AC13 "none for a path without an entry").** Contains the superset case.
    Minor residue below (R3-2).
  - **R2-4 fix (R8 AC3 "the implementer red-tests slot is internal").** Resolves the doc-
    surface question. No new defect.
- Verdict on the delta: the v3 fixes closed R2-1..R2-4 without re-opening a seam. This is the
  first round where the previous delta introduced **no** fix-induced MUST_FIX/SHOULD_FIX.
- Applied the fresh lens to every worker-facing AC. The implementer and verifier reach their
  spec context through a standing brief that names the roots (`harness/skills/
  sdd-implementation-phase/references/briefs.md:117`: "Code root: `<CODE_ROOT>`. Spec store:
  `<SPEC_STORE_ROOT>`. … Read `<spec dir>/codebase-context.md` first"). The **test author** is
  the one worker built purely through `harness brief` and it is required to read spec
  documents directly — that is where the lens bites (R3-1).

## Findings

### R3-1 — SHOULD_FIX — Recurring (carried) — the test author's brief carries no channel to the spec dir or the code root, yet R2 AC4/AC10 require both

R2 AC4 (line 41): the author "SHALL read the task block, the requirement criteria its
`_Requirements:` ids name, the design sections it cites, `codebase-context.md`, and one
existing test file near the target." R2 AC10 (line 47): the author "SHALL commit only its
test files, on the current branch." So the author must locate `requirements.md`,
`design.md` and `codebase-context.md` (all under `<spec dir>`) and must run/commit tests in
the **code root**.

But R2 AC2 (line 39) enumerates the brief's required values as `path`, `title` and `job`,
and says the brief fills "its read-and-obey line and task block as it does for `implementer`."
Trace that channel in code:

- The shipped `implementer` template's read-and-obey line is `Read and obey {{agentRules}}
  first.` (`src/tools/harness.ts:525-534`), and `agentRules` is the **spec-store root's**
  `agent-rules.md` (`harness.ts:627,636`) — not the spec dir and not the code root.
- The task block (`{{taskBlock}}`) is the raw task text; its `_Requirements:` field is bare
  ids (e.g. `1.2`), never a path to `requirements.md`.
- On tradr the spec store and the code root are different roots (`SPEC_WORKFLOW_SHARED_ROOT`,
  project CLAUDE.md), so `agent-rules.md`'s directory does not even locate the code root.

So the author's brief provably carries neither `<spec dir>` (needed for the three documents)
nor `<CODE_ROOT>` (needed to run and commit tests). The only free channel is `job`, and **no
AC states that `job` carries them.** "As it does for `implementer`" does not rescue this: the
implementer works from the task block plus its red tests and never has to open
`requirements.md`/`design.md`; the author (D11, line 192: "the author reads criteria and
design itself") is a new pattern the requirement never wires up. The verifier — the existing
worker that must read spec docs — only works because its standing brief names the roots and
the spec dir (`briefs.md:117-119`); the author is given no equivalent.

Failure scenario: an implementer building this from the task text alone codes R2 AC2 to
require `path`/`title`/`job`, writes the brief, and the author cannot find `requirements.md`
to take expected values from (R2 AC6), cannot find `codebase-context.md` (R2 AC4), and has no
code root to commit in (R2 AC10). The role is unusable as specified.

This is the carried, previously-unnumbered "test-author has no standing brief; path/git
context must reach it via `job`" note (memory, Unresolved). It survived the v3 delta
untouched, so it is **Recurring** and escalates from a design-phase note to SHOULD_FIX.
Resolve one of: (a) add a required brief value (or a standing-brief pointer) that carries
`<spec dir>` and `<CODE_ROOT>`; or (b) state in R2 AC2/AC4 that `job` carries them, the way
R3 AC4 and R3 AC7 already state what the implementer and verifier briefs carry.

### R3-2 — MINOR — Compounding: R2-3 — AC13 "none for a path without an entry" leaves the `seams` datatype undefined

The R2-3 fix (line 88) reads: "`seams` the `seam` its `tests[]` entry holds for each
`testFiles` path, none for a path without an entry." The Revision-History and memory
disposition describe the same fix as **omitting** the path from `seams`. "none" (a null slot
that keeps `seams` positional over `testFiles`) and "omit" (a shorter list / a map without
the key) are different shapes, and R5 AC6 requires `data.tdd` — `seams` included — to round-
trip through the review markdown "unchanged." State whether `seams` is an array parallel to
`testFiles` with `null` holes or a map keyed by path, so the round-trip and any consumer are
total. MINOR — a value safely pinned in design, does not keep the loop alive on its own.

## Checked and fine (no finding)

- **AC1/AC3 partition** (R2-1 fix): total and mutually exclusive; `isTestPath` importable and
  pure. Closed.
- **Empty implementer slot** (R2-2 fix): `harness.ts:666` accepts `""`; kill-switch brief
  writes. Closed.
- **R8 AC3** (R2-4 fix): internal-slot statement resolves the doc-surface question. Closed.
- **Delta citations**: R1's Anchors already list `gate-rules.ts:192-198`, so the new
  `isTestPath` coupling is covered; no anchor moved in the v3 commit; no misstated artifact.
- Base/head enumerations, risk-tier truth table, AC9-vs-AC12 timeout split: re-confirmed
  clean in round 2; the v3 delta did not touch them.

## Top 3 risks / gaps

1. **The test author cannot locate its inputs (R3-1).** The one worker required to read
   `requirements.md`/`design.md`/`codebase-context.md` and to commit in the code root is the
   one worker with no standing brief and no root-carrying value. SHOULD_FIX before design.
2. **Carried design-phase gap (not numbered):** R5 AC7 + D10 require a review recorded by
   `review-task record` to carry "the `tdd` block of that task's latest gate run" without the
   caller passing it, and no store/key is named. Implementable via the gate's own review
   record (`review-gate.ts:328-344`), so it is a design WHERE, not a requirements defect —
   but still open going into design.
3. **`seams` shape (R3-2):** minor, but pin it so R5 AC6's round-trip is total.

## Top 3 conclusions to challenge or reverse

1. **"The author reads criteria and design itself (D11) needs no brief plumbing."** Reverse:
   reading them itself is exactly what forces the brief to carry `<spec dir>` and
   `<CODE_ROOT>`; D11 chose the read-it-yourself option without wiring the channel (R3-1).
2. **"R2 AC2's required values (path, title, job) are complete."** Reverse: they are complete
   for writing a file, not for a usable author brief; the doc specifies implementer and
   verifier brief contents (R3 AC4/AC7) but not the author's (R3-1).
3. **"The v3 delta might have re-opened a seam like v2 did."** Confirmed false — the delta is
   clean. The active gap is carried, not fix-induced.

## What's missing (before design)

- The channel that carries `<spec dir>` and `<CODE_ROOT>` into the `test-author` brief
  (R3-1) — a required value, a standing-brief pointer, or an explicit statement that `job`
  carries them.
- The `seams` datatype for the no-entry case (R3-2).
- The persistence store/key for "the latest proof" between the gate and `review-task record`
  (carried; R5 AC7 / D10).

## Verdict

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 1
DESIGN_READY: no
ESCALATE: none
```
