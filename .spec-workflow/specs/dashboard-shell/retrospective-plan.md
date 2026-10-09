# Retrospective plan — dashboard-shell

Status: CLOSED

Approved by Matthew on 2026-10-08 in the retrospective conversation. Proposal text is
from `retrospective-proposals.md`.

## Decisions made

- P2: option A — scope the gate's frontend tsc to the changed files with a generated
  `include` (analyst recommendation, taken by the supervisor as an implementation call).
- P6: option A — persist the artifacts arg regardless of payload size (analyst
  recommendation, taken by the supervisor as an implementation call).
- P11: option A — require an explicit hand-back row or a stale active-run pointer before
  treating an orchestrator as dead, never a bare `spawn.end` (analyst recommendation,
  taken by the supervisor as an implementation call).
- P14: option A — defer. Record a deferral; no code change in this close-out (Matthew).
- All four proposal groups approved: gate and tool fixes, dashboard fixes, harness fixes,
  and the three graduation rules (Matthew).

## Approved proposals

- **P2 (F2) — Gate frontend tsc sweeps legacy errors.** The scoped frontend typecheck has
  no root tsconfig to anchor it, so it pulls in untouched legacy `pages/` files and fails
  on code the task never changed. Give the gate a frontend typecheck that is scoped to the
  changed files (a tsconfig `include` built from the touched paths) instead of the whole
  tree.
  Target: server code (review-task gate frontend typecheck).
  Effort: M. Risk: medium: a per-file include can miss cross-file type errors.
  Prerequisites: confirm the frontend build's module resolution.
  Decision: approved, option A.

- **P3 (F3) — Gate rejects trailing-slash dir globs.** The file-outside-list check compares
  exact paths, so a directory prefix ending in `/` never matches and tasks must enumerate
  every file (16 paths on one swap). Normalise entries ending in `/` to a prefix match in
  the gate's path comparison.
  Target: server code (review-task file-outside-list).
  Effort: S. Risk: low: a prefix match could over-accept if the prefix is too broad.
  Prerequisites: none.
  Decision: approved.

- **P5 (F5) — Runs-list spec/runId mismatch.** `collectProject` in `now-model.ts` builds
  `runs` from `resolveSpec` (the HANDOFF spec) but `live` from the active-run pointer's
  spec, so a pointer that names a different spec mislabels the live runId. Build the live
  run's spec label from the pointer's spec, the same source that produced the runId.
  Target: product code (`src/dashboard/shell/now-model.ts`).
  Effort: S. Risk: low: label-only change, covered by a now-model unit test.
  Prerequisites: a test fixture where pointer and HANDOFF disagree.
  Decision: approved.

- **P6 (F6) — log-implementation drops artifacts on large payloads.** The tool kept the
  terse entry and silently discarded `filesModified` with no error. Persist the artifacts
  arg regardless of payload size rather than drop it silently.
  Target: server code (log-implementation tool).
  Effort: M. Risk: medium: need to find the size limit that triggers the drop.
  Prerequisites: reproduce the large-payload case (entry 28eb8506).
  Decision: approved, option A.

- **P7 (F7) — SpecWatcher misses a post-watch-created deferral dir.** Have the watch glob
  re-resolve project dirs created after watch start (or watch the parent).
  Target: server code (SpecWatcher deferrals glob) — separate fix.
  Effort: M. Risk: low: watch-scope widening.
  Prerequisites: none.
  Decision: approved.

- **P9 (F9) — e2e worktree suite flakes from leftover shared-server projects.** The shell
  `beforeAll waitForProjects` saw a prior race test's `wt-race-*` projects on the shared
  server. Scope `waitForProjects` to this run's own project ids instead of waiting on the
  full list. Overlaps d-84dc43e7 and d-3580c072.
  Target: product code (e2e worktree suite helper).
  Effort: M. Risk: medium: cross-test isolation on a shared server is the known cluster.
  Prerequisites: resolve or fold d-84dc43e7 / d-3580c072 first.
  Decision: approved.

- **P10 (F10) — Batch-end phase.end carries a wrong or missing result=.** Fix the
  implementation orchestrator's phase.end emission to always write `result=complete` (or
  the real outcome) at batch end, never the stage name and never empty.
  Target: harness skills (implementation orchestrator phase.end step).
  Effort: S. Risk: low: a single required field value.
  Prerequisites: none.
  Decision: approved.

- **P11 (F11) — spawn.end-per-yield read as liveness spawns a duplicate.** The hook writes a
  `spawn.end` on every orchestrator yield, so a lone `spawn.end` is not death. The
  supervisor's liveness check must require an explicit hand-back row or a stale active-run
  pointer before re-launching, never a bare `spawn.end`.
  Target: harness skills (supervisor liveness/re-entry step).
  Effort: M. Risk: medium: liveness misjudgement is the exact failure to avoid.
  Prerequisites: none.
  Decision: approved, option A.

- **P12 (F12) — A finished orchestrator's hand-back never reached the supervisor.** When a
  spawn's task notification still reads "waiting on background work" past a bound, the
  supervisor reads the subagent transcript's last assistant message before assuming the
  spawn is stuck.
  Target: harness skills (supervisor wait/recovery step).
  Effort: M. Risk: medium: transcript-reading heuristic could misfire on a genuinely busy spawn.
  Prerequisites: none.
  Decision: approved.

- **P13 (F13) — Task prompts cite decision ids that govern unrelated behaviour.** In the
  tasks phase, verify each cited `D` id actually governs the task's behaviour, or cite the
  inline AC as the governing authority.
  Target: harness skills (tasks-phase decomposition / its review check).
  Effort: S. Risk: low: a citation-check step, no behaviour change.
  Prerequisites: none.
  Decision: approved.

- **P14 (F14) — Shell-feed flush recomputes every spec of every project per trigger.**
  Defer: record a deferral (tag `dashboard`, origin dashboard-shell) to make the flush
  incremental, revisit when a registry nears the 5 s live-update bound (measured 4.1-4.2 s).
  No code change in this close-out.
  Target: project steering (deferral record).
  Effort: S. Risk: low: record only.
  Prerequisites: none.
  Decision: approved, option A (defer).

- **P15 (F15) — Implementer checks-files carry prose and inverted-exit greps.** Add a line
  to the implementer agent: a checks-file holds only gate-valid shell, exit 0 = pass, no
  prose, use `!` and `grep -q`.
  Target: harness agents (implementer).
  Effort: S. Risk: low: a prompt constraint.
  Prerequisites: none.
  Decision: approved.

## Graduation candidates

- **G1 — spawn.end is never proof of death.** Target: `agent-rules.md`, Run ledger section.
  Rule text: "A `spawn.end` row is written on every orchestrator yield, not only at death.
  Never treat a single `spawn.end` as liveness proof: before re-launching a spawn, confirm
  it is gone from another source (the active-run pointer or an explicit hand-back). Reading
  one `spawn.end` as death risks a duplicate orchestrator on the same run id."
  Decision: approved.

- **G2 — Batch-end phase.end must carry result=complete.** Target: `agent-rules.md`, Run
  ledger section.
  Rule text: "An orchestrator's batch-end `phase.end` row always sets `result=` to the
  outcome (`complete`), never to the stage name and never empty. phase-log reads the ledger
  from this field; a missing or stage-named result voids the batch's reconciliation and the
  supervisor must patch it."
  Decision: approved.

- **G3 — Cite the governing authority, not a loosely related D id.** Target:
  `agent-rules.md`, Citations or Documents section.
  Rule text: "A task `_Prompt` cites the authority that actually governs the task's
  behaviour. When the governing text is the inline acceptance criterion, cite the AC, not a
  `D` id whose design/requirements text governs something else. The tasks-phase review
  verifies each cited `D` id governs the behaviour the task changes."
  Decision: approved.

## Not carried (no change)

- P1 (F1): `agent-rules.md` already requires `projectPath: <CODE_ROOT>` on review-task calls; one-off slip.
- P4 (F4): self-caught, zero cost; the gate already fails closed on a missing checks-file.
- P8 (F8): already fixed in `vite.config.ts` this spec.
- P16 (F16): the partial accept was Matthew's ruling; the Launch press is tracked as d-40df3cdb.

## Verification action items (Matthew)

- d-40df3cdb — press Launch once on a fixture project in the rebuilt dashboard; confirm
  `run.start` lands in that spec's `harness-events.jsonl` and the card shows the run live.
- d-a38fea66 — provider-per-role supervisor/orchestrator halves in a restarted session.
- d-1880d115 — question-gates live scenarios 1b, 3b, 2, 4.

## Close-out

One line per proposal, written by the close-out phase.

- G1: done — 6fb95fe
- G2: done — 6fb95fe
- G3: done — d7514ed
- P14: done — deferral d-d0e6f1e8
- P2: to-do (human) — no server-side "gate frontend tsc" exists; the root gate excludes `src/dashboard_frontend/**` and the frontend ships no tsconfig. Option A is a new subsystem, not a close-out edit; needs its own scoped spec and a human call. Ruled 2026-10-09 by overwatch: folded into spec 16 dashboard-gates (frontend tsconfig for src/dashboard_frontend in the review gate typecheck, gating only on touched files; scope line added to decomposition.md).
- P3: done — 19cb41c
- P6: to-do (human) — no server-side size cap; `addLogEntry` persists artifacts at any size. The 28eb8506 loss was a client-mangled tool call (filesModified leaked into the summary), not a drop. Option A has no target; needs its own scoped spec. Ruled 2026-10-09 by overwatch: dropped, not a bug (addLogEntry saves artifacts at any size; the 28eb8506 loss was a malformed tool call).
- P7: done — 0bd9711
- P10: done — c0c6cf0
- P11: done — f3d7ef2
- P12: done — 76ec013
- P13: done — 325fbdf
- P15: done — 56210e4
- P5: done — 9faa5fe
- P9: done — dc5c90f
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/88 (branch chore/dashboard-shell-retro)
