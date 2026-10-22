# Adversarial Analysis — harness-evals/tasks (v1, round 1)

Attack surface: **atomicity, ordering, coverage**. Fresh lens: none. First review.

## What I verified (so the next round need not repeat it)

Every artifact the document cites was read at both ends of its range and is accurate:

- Schemas task 1 exports and maps — `AUTHOR_SCHEMA` (`implementation.ts:144`), `IMPLEMENTER_SCHEMA` exported (`:159`), `VERIFIER_SCHEMA` (`:175`), `DRAFTER_SCHEMA` (`document.ts:199-220`), `BATCH_SCHEMA` (`closeout.ts:82-104`, `items[].status` enum `['done','to-do','skipped']`). The `(phase,role)` keying is correct: `(implementation,sdd-implementer)→IMPLEMENTER_SCHEMA` vs `(closeout,sdd-implementer)→BATCH_SCHEMA`.
- Turn caps: drafter 80 (`document.ts:44`), test-author 100 (`implementation.ts:67-72`), close-out implementer 150 (`closeout.ts:37`) — match Component 13.
- `COMMIT_SCRIPT` (`closeout.ts:196-206`), close-out `git` helper via `scrubbedGitEnv` (`:242-248`), `brief` helper call shape (`implementation.ts:501-505`), `renderCloseoutStanding` cannot-do rule (`brief-templates.ts:1487-1489`), `renderCloseoutBatch` read-only-root rule (`:1509`), `standing` wiring (`:1505`), proposal format `Prerequisites:` (`:1389`), required keys for `closeout-standing`/`closeout-batch`/`drafter`/`test-author` (`:1585-1618,1672`).
- `SERVER_BRIEF_KEYS` (`harness.ts:585`), test-author `- Test:` check (`:707-712`), absolute-path honouring (`:805-807`), `validateTasksMarkdown` + near-miss error (`task-validator.ts:42,146-162`), `ATTRIBUTION_PATTERNS` (`merge.ts:252-256`), `runStep` (`step.ts:343`), `StepUsage`/`StepClassification` (`:62-76`), `classify` (`:303-327`), env spread (`:381-387` — confirms the CLI must delete inherited `SDD_RUN_ID` because it is **not** scrubbed), `controllerHome` (`state.ts:239-243`), `create`/`update` + owner gate (`deferral-storage.ts:229,321-342,62-66`), stub-claude env/commands seams (`:1-40`), `--` flag rejection (`index.ts:239-241`).
- Self-update ranges task 14 cites — arg loop `:26-32`, `write_error_wait` `:45-60`, move checks `:123-158`, move `:159-173`, `wait_no_step` `:228`; service-scripts ranges — `makeDivergedCheckout` `:49-70`, dry-run `:244-265`, rebase `:267-317`, refusals `:319-364`. All exact.
- Scope claim verified: **no `plugins/` tree and no `sync-plugin-assets` script exist at base**, so tasks 11–13 under `harness/` correctly skip plugin sync/validate.
- Coverage sweep: every requirement AC (R1–R7) maps to at least one task; every task's `_Requirements` IDs exist and match its `_Prompt`. Every `- Test:` call resolves to a design interface or an earlier/this task. Success-clause coverage holds — each test a `Task:` body names reappears in its `Success:` clause (spot-checked T6, T7, T9, T13, T14).

## Deltas since checkpoint 01c3c1d8 (lint pass) — clean

- T11/T12 `_Prompt`: "recorded by task 16" → "recorded by the pending verification record". Same artifact (task 16 *is* the pending record); removes a brittle by-number cross-reference. No meaning change.
- T13 `- Test:` line: `harnessHandler(...)` wrapped in backticks (citation-bare fix). Cosmetic.

No defect in the deltas.

## Topics attacked

### 1. The eval CLI (task 10, Component 9, D4)
- Challenge the test plan: task 10 tests the default run and `select` argument handling but **omits the `gate` subcommand entirely** — no test, no Success clause.
- Stress-test D4's own rationale ("an in-process call is the only way to test the argument handling without a build"): the one subcommand the production deploy invokes (`dist/evals/cli.js gate`, Component 10 change 4) is the one left untested.
- Trace the real gate-dispatch path to a test and find none: task 9 tests `runGate(opts)`; task 14 **stubs the whole CLI** (`SDD_STAGE_BUILD` writes a stub `cli.js`). So the CLI's translation of `--repo/--base/--target/--base-dist/--summary-file` and repeated `--override` into `runGate` opts, and its exit-code propagation, is exercised by no automated test.

### 2. Module build order (dependency paragraph)
- Challenge "5 (fixture builder) and 6 (brief renderer) need 4": `renderCaseBriefs(c, f: Fixture, …)` and `render.test.ts` reference the `Fixture` type that task 5 defines in `fixture.ts`, so task 6 also depends on task 5.
- Confirm it is harmless in practice (numeric order 5<6), but the stated edge is incomplete on the review's own primary surface.

### 3. Seed-case text edits (task 13, Component 11)
- Stress-test the completion instruction "add the `Eval case:` line after `Prerequisites:` … in the role file": `harness/agents/sdd-retro-analyst.md` has **no literal `Prerequisites:` line** (line 18 lists proposal fields in prose). The anchor exists only in the proposal-format block (`brief-templates.ts:1389`).
- Confirm the proposal-format half is sound and the intent for the role file (extend the line-18 enumeration) is recoverable.

### 4. Coverage/atomicity of the grader split (tasks 2–3) — fine
- Checked: 4 graders (task 2) + 6 graders (task 3) = the 10 of Component 5; task 3 keeps task 2's graders/tests and reaches "ten graders"; splitting the contract from graders would leave a non-compiling registry, so co-locating is correct. No finding.

## Findings

**R1-1 — SHOULD_FIX. The eval CLI's `gate` subcommand argument handling is untested.**
Task 10 (`cli.test.ts`) covers the default run and `select`, but not `gate`. The deploy (task 14 / Component 10 change 4) runs `dist/evals/cli.js gate …`, yet task 14's tests stub the CLI, and task 9 tests `runGate` directly — so no automated test exercises the CLI's gate dispatch (flag parsing, repeated `--override` forwarding, `--base-dist`/`--summary-file`, exit-code return). *Failure scenario:* an implementer wires `--override` to a single string instead of an array, or drops the gate exit code; every unit suite stays green and the bug ships, surfacing only on the manual landing deploy (task 16) — exactly the "untested harness change goes live" failure this spec exists to stop. This also contradicts D4's stated purpose (export `main` *to test argument handling*). *Fix:* add a `gate`-subcommand case to task 10 (stub-claude on a temp repo: a named failing case → exit 0 + one override line; a bad override → exit 2) and a matching Success clause.

**R1-2 — MINOR. Missing dependency edge 6→5.** The dependency paragraph says "6 (brief renderer) need[s] 4" but `render.ts` imports the `Fixture` type from task 5's `fixture.ts`. Harmless under numeric ordering; state the edge as "5 and 6 need 4; 6 also needs 5" for accuracy.

**R1-3 — MINOR. Un-anchored edit instruction in task 13.** "add the `Eval case:` line after `Prerequisites:` … in the role file" has no `Prerequisites:` anchor in `sdd-retro-analyst.md`; it exists only in the proposal-format block. Reword the role-file half (e.g., "extend the proposal-fields sentence at `sdd-retro-analyst.md:18`").

## Top risks/gaps

1. **(R1-1)** CLI `gate` dispatch untested — the one path the deploy uses, left to the manual live run.
2. Model-dependent 3/3 bar on `drafter-test-seam-label` (R5 AC3): not a tasks defect (requirements-approved), but the only non-deterministic required pass; worth the operator's eye on the landing deploy.
3. **(R1-2)** Incomplete build-order edge 6→5 — no breakage, but on the primary surface.
4. Selector exact-mode happy path (reason 5, two differing `harness.js` builds) is asserted in task 8's Success but is awkward to unit-test without two dists; design-level, not a tasks gap, but flag for the implementer.
5. **(R1-3)** Un-anchored role-file edit instruction.

## Top 3 conclusions to challenge

1. **"a CLI test file (D4)" closes the argument-handling gap.** It does not — it closes it for `run`/`select` only and leaves `gate`, the production path, open. Reverse by adding the gate test.
2. **Dependency prose "5 and 6 need 4" is complete.** It is not; 6 needs 5. Minor, but correct it.
3. **Component 11's "after `Prerequisites:`" applies uniformly to both edit targets.** It applies cleanly only to the proposal format; the role file needs a different anchor.

## What's missing before acting

- A `gate`-subcommand test and Success clause in task 10 (close R1-1).
- One-line corrections for R1-2 and R1-3.
- Nothing else: coverage of ACs→tasks and tasks→ACs is complete, all citations are accurate, atomicity is sound, and Gate B (no new external dependency) and Gate C (no task exceeds the approved requirements) are clean.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
