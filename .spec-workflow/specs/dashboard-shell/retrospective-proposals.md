# Retrospective proposals — dashboard-shell

One proposal per finding. Prerequisites, effort, risk and `DECISION NEEDED` per the
format in `retrospective.md`.

## Gotchas

- **P1 (F1) — Verifier prepare needs CODE_ROOT.** No change. `agent-rules.md` lines 53-56
  already require every `review-task` `gate`/`prepare`/`record` call to pass
  `projectPath: <CODE_ROOT>`; this was a one-off slip the orchestrator corrected, not a
  rule gap.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — Gate frontend tsc sweeps legacy errors.** The scoped frontend typecheck has
  no root tsconfig to anchor it, so it pulls in untouched legacy `pages/` files and fails
  on code the task never changed. Give the gate a frontend typecheck that is scoped to the
  changed files (a tsconfig `include` built from the touched paths) instead of the whole
  tree.
  Target: server code (review-task gate frontend typecheck).
  Effort: M. Risk: medium: a per-file include can miss cross-file type errors.
  Prerequisites: confirm the frontend build's module resolution.
  DECISION NEEDED: yes. How should the gate type-check frontend changes with no root tsc?
  - A. Scope tsc to the changed files via a generated `include`. (recommended)
  - B. Add a root frontend tsconfig and accept legacy errors as a standing allow-list.
  - C. Keep whole-tree tsc; let the verifier re-run a scoped clean each time (status quo).

- **P3 (F3) — Gate rejects trailing-slash dir globs.** The file-outside-list check compares
  exact paths, so a directory prefix ending in `/` never matches and tasks must enumerate
  every file (16 paths on one swap). Normalise entries ending in `/` to a prefix match in
  the gate's path comparison.
  Target: server code (review-task file-outside-list).
  Effort: S. Risk: low: a prefix match could over-accept if the prefix is too broad.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P4 (F4) — Implementer named a checks-file it never wrote.** No change. Self-caught, cost
  zero, once. The gate already fails closed when the checks-file is absent, which is the
  correct behaviour.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

## Product bugs found

- **P5 (F5) — Runs-list spec/runId mismatch.** `collectProject` in `now-model.ts` builds
  `runs` from `resolveSpec` (the HANDOFF spec) but `live` from the active-run pointer's
  spec, so a pointer that names a different spec mislabels the live runId. Build the live
  run's spec label from the pointer's spec, the same source that produced the runId.
  Target: product code (`src/dashboard/shell/now-model.ts`).
  Effort: S. Risk: low: label-only change, covered by a now-model unit test.
  Prerequisites: a test fixture where pointer and HANDOFF disagree.
  DECISION NEEDED: no.

## Tool and MCP errors or deficiencies

- **P6 (F6) — log-implementation drops artifacts on large payloads.** The tool kept the
  terse entry and silently discarded `filesModified` with no error. Make the tool fail
  loudly (or persist the artifacts arg regardless of payload size) rather than drop it
  silently.
  Target: server code (log-implementation tool).
  Effort: M. Risk: medium: need to find the size limit that triggers the drop.
  Prerequisites: reproduce the large-payload case (entry 28eb8506).
  DECISION NEEDED: yes. What should happen when the artifacts payload is too large?
  - A. Persist it anyway (raise or remove the size cap). (recommended)
  - B. Return an explicit error so the caller retries smaller.
  - C. Truncate the file list but record a `truncated` marker so the loss is visible.

- **P7 (F7) — SpecWatcher misses a post-watch-created deferral dir.** Pre-existing and out
  of scope for this spec. Record as its own small fix: have the watch glob re-resolve
  project dirs created after watch start (or watch the parent). Not this spec's change.
  Target: server code (SpecWatcher deferrals glob) — separate fix.
  Effort: M. Risk: low: watch-scope widening.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — Worktree e2e frontend port missing from CORS allow-list.** No change. Already
  fixed in `vite.config.ts` this spec. The lasting lesson (worktree e2e needs its port in
  the allow-list) is a fixtures/live-verification note, not a code change.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P9 (F9) — e2e worktree suite flakes from leftover shared-server projects.** The shell
  `beforeAll waitForProjects` saw a prior race test's `wt-race-*` projects on the shared
  server. Scope `waitForProjects` to this run's own project ids instead of waiting on the
  full list. Overlaps d-84dc43e7 and d-3580c072.
  Target: product code (e2e worktree suite helper).
  Effort: M. Risk: medium: cross-test isolation on a shared server is the known cluster.
  Prerequisites: resolve or fold d-84dc43e7 / d-3580c072 first.
  DECISION NEEDED: no.

## Harness defects

- **P10 (F10) — Batch-end phase.end carries a wrong or missing result=.** The implementation
  orchestrator's batch-end `phase.end` row twice had no `result=` or `result=implementation`
  (the stage name) instead of `complete`, forcing supervisor patches. Fix the orchestrator's
  phase.end emission to always write `result=complete` (or the real outcome) at batch end.
  Repeats cross-session — see Graduation candidates.
  Target: harness skills (implementation orchestrator phase.end step).
  Effort: S. Risk: low: a single required field value.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P11 (F11) — spawn.end-per-yield read as liveness spawns a duplicate.** The hook writes a
  `spawn.end` on every orchestrator yield, so a lone `spawn.end` is not death; the supervisor
  judged a live spawn dead and launched a duplicate. The supervisor's liveness check must not
  treat `spawn.end` as death — confirm death another way (active-run pointer / explicit
  hand-back) before re-launching. Repeats agent-cache-ttl F5 — see Graduation candidates.
  Target: harness skills (supervisor liveness/re-entry step).
  Effort: M. Risk: medium: liveness misjudgement is the exact failure to avoid.
  Prerequisites: none.
  DECISION NEEDED: yes. How should the supervisor confirm an orchestrator is dead?
  - A. Require an explicit yield/hand-back row or a stale active-run pointer, never a bare
    `spawn.end`. (recommended)
  - B. Make the hook distinguish a yield row from a terminal row, and key liveness on that.
  - C. Both A and B.

- **P12 (F12) — A finished orchestrator's hand-back never reached the supervisor.** Spawn 2
  wrote its contract report in its last message but the hand-back never arrived, so the run
  sat idle ~40 min. Have the supervisor, when a spawn's task notification still reads
  "waiting on background work" past a bound, read the subagent transcript's last assistant
  message before assuming the spawn is stuck.
  Target: harness skills (supervisor wait/recovery step).
  Effort: M. Risk: medium: transcript-reading heuristic could misfire on a genuinely busy spawn.
  Prerequisites: none.
  DECISION NEEDED: no.

## Prompt misunderstandings

- **P13 (F13) — Task prompts cite decision ids that govern unrelated behaviour.** Five
  `_Prompt` blocks cited `D` ids whose text governs something else; the inline AC was the
  real authority each time. In the tasks phase, verify each cited `D` id actually governs the
  task's behaviour, or cite the inline AC as the governing authority. Cross-spec doc-gap
  recurs — see Graduation candidates.
  Target: harness skills (tasks-phase decomposition / its review check).
  Effort: S. Risk: low: a citation-check step, no behaviour change.
  Prerequisites: none.
  DECISION NEEDED: no.

## Inefficiencies

- **P14 (F14) — Shell-feed flush recomputes every spec of every project per trigger.**
  `shell-feed.ts` flush rebuilds all spec rows for all projects on each trigger, landing
  4.1-4.2 s against a 5 s bound; a larger registry may exceed it. Make the flush incremental
  — recompute only the project/spec that changed.
  Target: product code (`src/dashboard/shell/shell-feed.ts`, `spec-rows.ts`).
  Effort: M. Risk: medium: incremental invalidation can drift from full recompute.
  Prerequisites: a registry-size benchmark to confirm the bound is the real risk.
  DECISION NEEDED: yes. Fix now or defer the latency risk?
  - A. Defer behind a tracked deferral; revisit when a registry nears the 5 s bound.
    (recommended)
  - B. Fix now with incremental flush.

## Model behaviour

- **P15 (F15) — Implementer checks-files carry prose and inverted-exit greps.** A
  verification-task implementer wrote human annotations and greps whose no-match returned
  exit 1 as "pass", forcing orchestrator normalisation. Add a line to the implementer agent:
  a checks-file holds only gate-valid shell, exit 0 = pass, no prose, use `!` and `grep -q`.
  Target: harness agents (implementer).
  Effort: S. Risk: low: a prompt constraint.
  Prerequisites: none.
  DECISION NEEDED: no.

## Process deviations and rulings

- **P16 (F16) — Verification check 3 accepted as partial.** No change. The partial accept
  was the human's ruling and the Launch press is tracked as deferral d-40df3cdb. The gating
  rule in `agent-rules.md` (every verification-evidence line reads `passed` before the retro
  opens) worked as designed; the human chose to accept a partial so the retro could run.
  Target: none.
  Effort: S. Risk: low: no change.
  Prerequisites: none.
  DECISION NEEDED: no.

## Graduation candidates

Patterns seen in two or more specs, proposed for promotion.

- **spawn.end is never proof of death** (seen in dashboard-shell F11 and agent-cache-ttl F5;
  both stem from the hook writing a `spawn.end` on every yield). Target: `agent-rules.md`,
  Run ledger section.
  Rule text: "A `spawn.end` row is written on every orchestrator yield, not only at death.
  Never treat a single `spawn.end` as liveness proof: before re-launching a spawn, confirm
  it is gone from another source (the active-run pointer or an explicit hand-back). Reading
  one `spawn.end` as death risks a duplicate orchestrator on the same run id."

- **Batch-end phase.end must carry result=complete** (seen in dashboard-shell F10 twice, in
  tradr's run, and in worktree-review-signals' malformed-result→null gap). Target:
  `agent-rules.md`, Run ledger section.
  Rule text: "An orchestrator's batch-end `phase.end` row always sets `result=` to the
  outcome (`complete`), never to the stage name and never empty. phase-log reads the ledger
  from this field; a missing or stage-named result voids the batch's reconciliation and the
  supervisor must patch it."

- **Cite the governing authority, not a loosely related D id** (doc-gap entries recur across
  many retros; dashboard-shell F13 carried four). Target: `agent-rules.md`, Citations or
  Documents section.
  Rule text: "A task `_Prompt` cites the authority that actually governs the task's
  behaviour. When the governing text is the inline acceptance criterion, cite the AC, not a
  `D` id whose design/requirements text governs something else. The tasks-phase review
  verifies each cited `D` id governs the behaviour the task changes."
