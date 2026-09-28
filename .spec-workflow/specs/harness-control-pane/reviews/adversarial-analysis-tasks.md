# Adversarial Analysis — harness-control-pane/tasks (v1)

Round 1. Primary attack surface: atomicity, ordering, coverage. Fresh lens: the
sub-agent that receives only the `_Prompt` block. Deltas attacked first (the v1 lint
commit `4b03be5`, whole `## Changes since 327b4bb` diff), then the fresh lens over
all 20 tasks.

## Findings

### R1-1 — Task 19 `_Prompt` cites the wrong `briefs.md` — MUST_FIX

The lint pass expanded the bare `briefs.md:12-15` in task 19's `_Prompt` to
`harness/skills/sdd-document-phase/references/briefs.md:12-15`. That range is the
drafter's `## Job` section:

> Write v1 of `<document path>` in place, write or extend `<spec dir>/codebase-context.md`,
> then report in 150 words or fewer …

It says nothing about a commit script. The claim the citation is attached to —
"commit it in the spec store repo with a script … that changes into that repo" — is
supported only by **`harness/skills/sdd-implementation-phase/references/briefs.md:12-15`**:

> A `cd` inside a script file run with `bash` is fine; that is how commits into the
> spec store are made.

That is exactly the file the same task's `_Leverage` line (unchanged) already cites
(`harness/skills/sdd-implementation-phase/references/briefs.md:12-15`), so the lint
edit made the `_Prompt` contradict the `_Leverage` and point an implementer at
unsupportive content. Wrong path → automatic MUST_FIX. Fix: change the `_Prompt`
citation to `harness/skills/sdd-implementation-phase/references/briefs.md:12-15`.

This is the only defect the delta introduced.

## Delta verification (Changes since 327b4bb)

Every other citation the lint commit changed was re-read at both ends and is correct:

- Task 2 `_Prompt` `harness/skills/sdd-continue/references/formats.md:266-281` — the
  `deregister.mjs` body: filter on field `[2]` (273), `rmSync` at zero (275), pid temp
  file (277), `renameSync` (279). Correct.
- Task 3 `_Prompt` `…/formats.md:76` — `> Live phase **<stage>**, state **<state>**,
  last result **<PHASE value>**.` Correct.
- Task 4 `_Prompt` `…/sdd-providers.sh:29` (`["deepseek-v4-pro","deepseek-flash"]`),
  `:23` (`ELIGIBLE="sdd-reviewer sdd-checker sdd-reviser"`), `:42`
  (`grammar = /^- ([^:\s]+): (\S+)(?: (\S+))?$/`). All correct.
- Task 6 `_Prompt` `…/formats.md:178` — the base event object `{ ts, run, spec, type }`
  in `event.sh`; combined with the `run.start`/`run.end` key row at :195 this is the
  right row shape. Correct.
- Task 11 `_Prompt`/`_Leverage` `./tsconfig.json:20` (`"exclude": [… "src/dashboard_frontend/**"]`)
  and `./vitest.config.ts:7-8` (include `src/**`, exclude frontend). Correct.
- Task 12 `_Prompt` `src/dashboard_frontend/src/modules/api/api.tsx:139-142` (`putJson`
  returns `data: res.ok ? await res.json() : null` — drops non-ok body),
  `…/app/App.tsx:239-251` (`<Routes>…</Routes>`), `…/PageNavigationSidebar.tsx:44-59`
  (first `navigationItems` entry). All correct.
- Task 15 `_Prompt` `…/sdd-providers.sh:29`. Correct. The test-wording change
  (from "output equal to its output before task 15" to "printing the exact `providers=`
  line the pre-spec script prints (hard-code the expected line)") makes the regression
  assertion self-contained; an improvement, not a defect.
- Task 16 `_Prompt` `…/formats.md:194` (the `run.start` key row). Correct.
- Task 17 `_Prompt` `…/formats.md:236` (`export SDD_PROVIDERS="PROVIDERS_VALUE"`).
  Correct.
- Task 20 `_Leverage` `./package.json:26/31/33` (`build`, `build:dashboard`,
  `validate:i18n`). Correct. The render.ts check change to
  `/usr/bin/git diff --quiet main...HEAD -- src/watch/render.ts` uses the absolute git
  binary (agent-rules.md:37), no `-C`/glob/compound line (agent-rules.md:45), and
  `--quiet` gives an assertable exit code for Req 6.1. Sound.

## Still-open lint items (assessed, no finding)

- **L-2 / L-3 (bridge-missing, task 3 names tasks 7 and 4).** Task 3's only mentions of
  4 and 7 are the narrative purpose line ("the setup view (task 4) and the watch (task
  7)…") and the descriptor ("task 7 adds the watch class to it"). Task 3's `_Prompt`
  imports only from task 2 and `src/watch/ledger.ts`. No later artefact is used.
  Rejection sound; no bridge applies.
- **L-7 (bridge-missing, task 6 names task 10).** Task 6's `_Prompt` throws the `Error`;
  the phrase "(task 10 maps that case to 404 before it calls)" is a producer note about
  the later consumer. No artefact of task 10 is used. Rejection sound.
- **task-test-seam info (tasks 11, 12, 13, 16, 17).** 11/12/13 touch
  `src/dashboard_frontend/**`, which `tsconfig.json:20` and `vitest.config.ts:8` exclude
  from both compile and vitest, so no unit seam exists — build-only (`npm run
  build:dashboard`, `validate:i18n`). 16/17 edit `harness/**` SKILL/formats prose,
  verified by `grep` + `claude plugin validate --strict`. Every one legitimately has no
  `Test:` line. No finding.

## Carried gaps (verify close or scope)

- **In-flight-race loser `LaunchError.step` and 409-vs-500.** Closed. Task 5 adds a
  fourth `step` value `admission` (tasks D1) beyond the design C4 type's three; task 10
  maps step `admission` to 409 `{ error: 'run-live', runId: null, reason }` and every
  other step to 500. Scope note (line 229) states the same. The design flagged this as a
  carried gap, so the tasks legitimately extend the design's `LaunchError.step` enum;
  documented in D1. Adequately closed.
- **R2-3 spawn-to-record window.** Scoped, not closed: task 5 writes the record
  synchronously as the spawn handler's first statement; the residual one-turn crash
  window is accepted (Scope notes line 228) with the supervisor's pointer line blocking a
  second launch via admission and a manual stop. Consistent with the design's ruling.
  Adequate.

## Gate B / Gate C

- **Gate B (new external dependency):** none. Every task uses node built-ins
  (`fs`, `child_process`, `EventEmitter`), `chokidar` (already used by `src/watch`),
  Fastify (existing) and existing modules. No `[gate-b]` finding.
- **Gate C (task exceeds approved requirements):** none. Tasks 1-20 map to
  requirements 1-6 and design C1-C10; the additions (the `admission` step, HUD/pointer
  dir creation, `readTodos` coercion, the drift test) each serve a stated requirement
  (3.8, 5.6, 5.7, 1.6/1.7). No `[gate-c]` finding.

## Test: lines

All twelve `Test:` calls exist in the design interfaces (C1 `snapshot`, C2
`removePointerLine`, C5 `parseHandoffRouting`/`ProjectHarnessWatch`, C3 `validateSetup`,
C4 `HarnessLauncher.launch`/`stop`/`restore`, C6 `buildOverviewRow`, C7
`harness-subscribe`/`POST …/harness/launch`, C9 `sdd-providers.sh`/`sdd-run-setup.sh`)
and their success criteria are assertable with requirement values. No miss.

## Top risks / gaps

1. **R1-1** — the only real defect: task 19's `_Prompt` points at the wrong skill's
   `briefs.md`. An implementer would open the drafter `## Job` text and find no support
   for the commit-script instruction.
2. The pointer-line removal remains best-effort (compare-before-rename, 5 tries), not
   truly atomic — but that residual was ruled in design (v4 R3-2) and the tasks
   faithfully port `deregister.mjs`. Not a tasks finding.
3. The R2-3 crash window persists as accepted residual; if the field ever needs zero
   unrecorded children, a record-before-spawn ordering would have to change — out of
   scope this round.
4. Task 1's `snapshot()` must reconstruct `generate()`'s `total`/counts from the three
   buckets it returns; the "returns an identical result" restriction pins it, so it is
   implementable, but the prompt does not spell out `total = active+deferred+other`.
   Non-blocking.
5. No coverage hole found: all C1-C10 map to tasks; all `_Requirements` ids resolve
   (machine-verified pre-fix and re-checked on the deltas).

## Top conclusions to challenge

1. **"No task needs a bridge" (line 6).** Verified true for all 20 tasks — every used
   artefact is created by an earlier task; the three bridge warnings are producer→consumer
   narrative only. The claim holds; do not add bridges.
2. **The lint pass "17 fixed; rejected: L-2, L-3, L-7."** Correct on the rejections, but
   one of the 17 "fixes" (task 19 briefs.md) regressed a correct bare citation into a
   wrong absolute one. The lint's citation-path check passes because the wrong file also
   resolves; only content review catches it. R1-1.
3. **The two carried design gaps are resolved here.** One (409 loser) is genuinely
   closed; the other (R2-3) is scoped/accepted, not closed — accurate as stated, but the
   document should keep calling it a residual, not a resolution.

## What's missing before acting

Only the R1-1 citation correction. No structural, ordering, coverage, atomicity or
gate-B/gate-C gap requires work before implementation.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 0
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
