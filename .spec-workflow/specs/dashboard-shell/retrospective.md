# Retrospective — dashboard-shell

Compiled 2026-10-08 by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas

- **F1 — Verifier prepare needed CODE_ROOT, not the main checkout.** Task 1's verifier
  `review-task prepare` had to be given `projectPath = CODE_ROOT` (the worktree), not the
  main checkout, or the prepare read the wrong tree. Evidence: retro-log 2026-10-06T20:28:15Z.
  Frequency: once. Cost: no extra round.
- **F2 — Gate's temp frontend tsc config sweeps pre-existing legacy errors.** The gate's
  scoped frontend typecheck pulled in legacy `pages/` files (TS18046 in TasksPage) that the
  task never touched and task 13 later deletes, so the gate failed on unrelated code; the
  verifier re-ran a scoped tsc clean. The frontend has no root tsc coverage by design, so
  the gate cannot type-check only the changed files. Evidence: retro-log 2026-10-07T01:18:23Z
  (task 8), 2026-10-07T02:56:45Z (task 11). Frequency: 2 times in this spec. Cost: 1 gate
  re-run plus a checks-narrowing each.
- **F3 — Gate file-outside-list rejects trailing-slash dir globs.** The gate wants the exact
  touched paths; a directory prefix with a trailing slash did not match, so tasks had to pass
  explicit file lists. Hit on a page swap (16 explicit paths) and a large deletion. Evidence:
  retro-log 2026-10-07T01:18:23Z (task 8 P11), 2026-10-07T05:18:09Z (task 13). Frequency: 2
  times in this spec. Cost: manual path enumeration.
- **F4 — Implementer named a checks-file it never wrote.** Task 3's implementer reported a
  checks-file path that did not exist, so the gate could not read the vitest command from the
  report. Evidence: retro-log 2026-10-06T21:13:55Z. Frequency: once. Cost: none (self-caught).

## Product bugs found

- **F5 — Runs-list spec/runId mismatch when HANDOFF and pointer disagree.** `now-model.ts`
  `collectProject` builds `runs` from `resolveSpec` (the HANDOFF spec) but `live` from the
  active-run pointer's spec, so a project whose pointer names a different spec showed the wrong
  spec label against the live runId on the Runs list (tradr pointer `trading-rules` shown as
  `self-host-experience`). Evidence: retro-log 2026-10-07T20:23:20Z (live-check product-bug);
  `src/dashboard/shell/now-model.ts` collectProject. Frequency: once (live check). Cost: wrong
  run label whenever HANDOFF and pointer disagree.

## Tool and MCP errors or deficiencies

- **F6 — log-implementation silently drops the artifacts arg on large payloads.** Task 14's
  log call kept only the terse entry; `filesModified` is empty in entry 28eb8506 with no error.
  Evidence: retro-log 2026-10-07T05:36:16Z. Frequency: once this spec; noted in review-gate too.
  Cost: lost file list in one implementation log.
- **F7 — SpecWatcher deferrals glob misses a post-watch-created directory.** The first deferral
  in a project whose dir was created after the watch started does not push live. Pre-existing,
  out of scope for this spec. Evidence: retro-log 2026-10-07T00:46:26Z (task 7). Frequency: once
  observed. Cost: author test amended to work around it.
- **F8 — Worktree e2e frontend port missing from the dashboard CORS allow-list.** Live WS data
  silently never worked in the worktree e2e until a test required it; fixed in vite.config.ts.
  Evidence: retro-log 2026-10-07T03:15:44Z (task 12). Frequency: once. Cost: 1 spawn to diagnose.
- **F9 — e2e worktree suite flakes on cold start from leftover shared-server projects.** The
  shell `beforeAll waitForProjects` timed out because the shared dashboard server still listed a
  prior race test's `wt-race-*` projects; a rerun passed 17/17. Evidence: retro-log
  2026-10-07T06:08:38Z; HANDOFF gotcha; overlaps d-84dc43e7, d-3580c072. Frequency: once this
  spec, part of a known cluster. Cost: 1 verifier re-run.

## Harness defects

- **F10 — Batch-end phase.end rows carry a wrong or missing result=.** Twice this run the
  implementation orchestrator's batch-end `phase.end` was malformed: spawn 1's row had no
  `result=` (tasks 5/16); spawn 5's row had `result=implementation` (the stage name) instead of
  `complete` (tasks 16/16). The supervisor patched both so phase-log could read the ledger.
  Evidence: retro-log 2026-10-06T23:51:32Z, 2026-10-07T06:11:07Z; harness-events.jsonl phase.end
  rows ts 21:54:21.396Z and 06:10:14.513Z. Frequency: 2 times in this spec; tradr's run hit the
  same defect. Cost: 2 supervisor patches.
- **F11 — spawn.end-per-yield is read as liveness and spawns a duplicate orchestrator.** After an
  accidental /exit the supervisor saw a `spawn.end` row at 02:25Z, judged spawn 3 dead and
  launched spawn 4; spawn 3 was alive (the hook writes a `spawn.end` on every orchestrator yield).
  Two orchestrators then ran the same run id until spawn 4 detected the collision and yielded, and
  both hit the API 429 session limit at 12/16. Evidence: retro-log 2026-10-07T04:51:37Z;
  harness-events.jsonl note CONCURRENCY 03:21:42Z; spawn.end rows 02:25:18Z..03:20:12Z. Frequency:
  once this spec. Cost: ~10 min of duplicate tokens, no corrupt commits.
- **F12 — A finished orchestrator's hand-back never reached the supervisor.** Implementation spawn
  2 wrote its contract report in its last message at 01:40Z, but the hand-back never arrived; the
  task notification said it was still waiting on background work, so the run sat idle ~40 min until
  the human asked. The supervisor recovered the report from the subagent transcript. Evidence:
  retro-log 2026-10-07T02:21:43Z; subagents/agent-a1d35193b51a20bc8.jsonl last assistant text.
  Frequency: once this spec. Cost: ~40 min idle.

## Prompt misunderstandings

- **F13 — Task prompts cite decision ids that govern unrelated behaviour.** Five task `_Prompt`
  blocks cited `D` ids whose actual design/requirements text governs something else: task 2
  (D9/D7/D6), task 3 (D8), task 5 (D1), task 8 (D5). In each case the governing authority was the
  inline AC, not the cited decision. The implementer caught each and the brief carried a
  governing-ref note. Evidence: retro-log 2026-10-06T20:41:54Z, 21:02:31Z, 21:34:50Z,
  2026-10-07T00:53:05Z. Frequency: 4 doc-gap entries in this spec. Cost: 0 extra spawns; per-brief
  notes. The cross-spec doc-gap category recurs (many prior retros carry doc-gap entries).

## Inefficiencies

- **F14 — Shell-feed flush recomputes every spec of every project on every trigger.** The gate-A
  wait arrived in 4.1-4.2 s against the 5 s bound in a live check; `shell-feed.ts` flush rebuilds
  all spec rows for all projects on each trigger (flush -> spec-rows.ts), so a larger registry may
  exceed the bound. Evidence: retro-log 2026-10-07T20:23:20Z (live-check); verification-evidence.md
  (1). Frequency: once (near-miss). Cost: latency risk, no failure yet.

## Documentation gaps

None found.

## Model behaviour

- **F15 — Implementer checks-files carry human prose and inverted-exit greps.** A verification-task
  implementer wrote human-readable annotations and greps whose no-match returned exit 1 as "pass";
  the orchestrator had to normalise to gate-valid shell (`!` and `-q`, exit 0 = pass). Evidence:
  retro-log 2026-10-07T05:44:13Z (task 15). Frequency: once. Cost: 1 orchestrator normalisation.

## Process deviations and rulings

- **F16 — Verification check 3 accepted as partial.** The enabled Launch on the Runs page was not
  pressed; only the disabled reason was verified. Matthew accepted the partial result so the
  retrospective could run, and the Launch press is carried as deferral d-40df3cdb. Evidence:
  retro-log 2026-10-08T21:10:32Z; verification-evidence.md (3); d-40df3cdb. Frequency: once. Cost:
  one blocked run (run-20261008-022312).

## Decisions the harness made for the human

None found. The one judgement call (accept check 3 partial) was the human's.

## Repeat patterns

- **F11 repeats agent-cache-ttl F5.** Reading a single `spawn.end` as orchestrator liveness is the
  same class as agent-cache-ttl's first-yield `spawn.end` undercount; both stem from the hook
  writing a `spawn.end` on every yield. Evidence: this spec retro-log 2026-10-07T04:51:37Z;
  agent-cache-ttl/retrospective.md F5 (lines 44-48).
- **F10 repeats a cross-session defect.** Malformed batch-end `phase.end` result values appear in
  this spec twice and in tradr's run (noted at retro-log 2026-10-06T23:51:32Z); worktree-review-
  signals records the malformed-result→null gap too. Evidence: worktree-review-signals/
  retrospective.md:150.

## Summary numbers

| Metric | Value |
| --- | --- |
| Phases | 4 (requirements, design, tasks, implementation) |
| Versions per phase | requirements v3, design v1, tasks v1 |
| Review rounds | requirements 2, design 1, tasks 1 |
| Fix rounds (implementation) | 0 across all 16 tasks |
| Adjudications | 0 |
| Escalations | 0 |
| Rulings | 1 (check 3 accepted partial) |
| Deferrals added | 2 (d-fd0d4f60 resolved, d-40df3cdb open) |
| Orchestrator spawns | document phases 1 each; implementation 5 re-entries + 1 duplicate (F11) |
| PR | #86 |

## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs'
findings, each proposed for promotion into a steering document or agent-rules.md,
with the rule text as it would be written.
