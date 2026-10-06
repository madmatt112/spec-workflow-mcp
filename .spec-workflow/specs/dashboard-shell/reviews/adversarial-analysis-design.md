# Adversarial Analysis — dashboard-shell/design (v1), Round 1

Primary attack surface: feasibility, consistency, edge cases.
Fresh lens applied: reuse-boundary and data-contract integrity.

## What I checked and how

Read the target design, requirements v3, the decomposition entry (lines 784-855),
agent-rules, and the drafter-written codebase-context. Then read both ends of every
cited range the v1 lint commit touched, plus every reuse boundary and library probe the
design carries toward implementation.

### Deltas re-verified (the whole `## Changes since` lint pass) — all accurate
- `vitest.config.ts` include/exclude (lines 7-8) — the dropped line suffix was a bare
  root-file citation; the file does exclude the frontend. OK.
- `tsconfig.json` `exclude` holds `src/dashboard_frontend/**` (line 20). OK.
- `HarnessMessage` src/dashboard/harness/types.ts:77-83 — the union spans exactly
  77-83 (overview-todos at 83). Adding `harness-run-detail` is additive. OK.
- frontend harness types src/dashboard_frontend/src/modules/harness/types.ts:1-7 — the
  hand-copy pattern and its reason (root tsc excludes the frontend) are stated in the
  file header. OK.
- `LedgerEvent`/`ActivityEvent` ledger.ts:18-36; `PhaseRow` ledger.ts:89-95. OK.
- `parseHandoffRouting` 27-40, `parseGateSections` 62-65, `WATCHED_FILES` 79-81
  (project-watch.ts); `handoffPath` index.ts:34-39. OK.
- `getAllSpecs` parser.ts:27-45 (one entry per spec directory); `DeferralStorage.list`
  deferral-storage.ts:266 (async, `{status, originSpec, tag}`); rebuild
  project-watch.ts:242-278 and snapshot 170-188. OK — the bare `HANDOFF.md` sample is
  real: `PR #NN` appears in phase-log notes (HANDOFF.md:17,20,26,...).

### Fresh lens — reuse-boundary and data-contract integrity
- ProjectManager emits `spec-change` and `deferral-change` (project-manager.ts:160,172);
  the hub holds the ProjectManager, so the two new listeners (C7) are feasible.
- Hub citations all land: overview-watch start/close 82-90, `onLaunchUpdate` 126-128,
  `overviewSnapshot` 98-101; `overview-subscribe` returns `overviewSnapshot()`
  (multi-server.ts:328-339), which C7 extends with `feed.snapshot()` — the shell's
  first paint comes from the snapshot. Coherent.
- `/ws` with no `projectId` is handled: it skips `initial` and sends `projects-update`
  (multi-server.ts:243-263); `harness-subscribe` rebinds `connection.projectId`
  (314-324). C9's "one socket, no projectId" is sound.
- Deferrals: the REST route `/api/projects/:id/deferrals` and the push both return
  `buildDeferralsPayload` (multi-server.ts:491-524, 749-756) — same shape, so C9's
  "fetched ... replaced on deferrals-update" is shape-consistent. `sendToProjectOrOverview`
  (C8/D12) is the correct answer to a shell socket with no fixed project.
- RunModel/SpawnNode carry every field the run page reads: `declaredModel`, `model`,
  `lastTool`, `lastActivityAt`, `role`, `level` (ledger.ts:90-123). `task.done.rounds`
  and the `note` `gate: task N pass|fail risk low|high` text exist (formats.md:203,
  SKILL.md:80-82). `taskMeta` and `phaseStrip` are derivable.

### Data Models completeness and error branches
- Every requirement-referenced object (NowModel, Wait, SpecListRow, SpecDetail,
  RunDetail) enumerates its full fields; no object is given only through union arms.
- The one new error branch (C8 detail route) pins status (404) and both messages
  ("Project not found" / "Spec not found"); `buildSpecDetail` returns null on a failed
  `/^[A-Za-z0-9._-]+$/` or a non-directory. The launch/setup/stop routes it merely
  consumes are pre-existing: 409 `reason`, 400 `{field,value,error}`, 500 `{step,detail}`
  all match validateSetup (run-setup.ts:197-233) and LaunchError (launcher.ts:35-41).

### Library probes
- react-router 6.30.3, `useParams` at hooks.d.ts:79 — confirmed.
- tailwindcss 4.1.18, `--breakpoint-xl: 80rem` at theme.css:281 — confirmed; `lg: 64rem`
  (= 1024px, D14's drawer breakpoint) sits one line above at 280.
- `fs.utimesSync` / `statSync().mtimeMs` are node-20 stable built-ins; parseJsonl
  torn-line skip confirmed (ledger.ts:186-199).

## Findings (all MINOR — none keeps the loop alive)

- **R1-1 (MINOR, feasibility/scaling).** The C2 FileCache is passed to `buildNowModel`
  and `buildSpecRows`, but the dominant IO on the flush path bypasses it:
  `SpecParser.getAllSpecs` (parses every spec's requirements/design/tasks for
  `taskProgress`), `DeferralStorage.list`, and `IndexGenerator.snapshot` take no cache.
  Under a steady ledger stream the OverviewWatch fires `overview-rows` repeatedly →
  `schedule()` → a ~1s flush that re-parses every spec of every project. Correct, but the
  cache's stated benefit does not cover the hot path. The throttle (D3) bounds frequency,
  not per-flush cost. Safe to resolve in implementation by routing those reads through the
  cache or memoizing per flush; flagging so the implementer does not ship per-second
  re-parsing of all specs during a live run.

- **R1-2 (MINOR, data-contract clarity).** `harness-run-detail` is described in prose
  (C1/C6) as a new `HarnessMessage` arm, but its wire envelope
  (`{type:'harness-run-detail'; projectId:string; data:RunDetail}`) is not written in Data
  Models, where only the `ShellMessage` union appears. `RunDetail` itself is fully pinned;
  the envelope is a trivial wrapper on the existing HarnessMessage pattern. Add the arm so
  the frontend hand-copy (C1) has one source.

- **R1-3 (MINOR, wording).** The Overview sentence "without changing any of them except
  two additive sends" undersells C7: the hub gains ShellFeed ownership, two listeners, a
  wrapped `sendOverview`, a widened message type and an extended `overviewSnapshot`. None
  of those is in the "unchanged" list (buildModel, the two watches, the launcher, the
  five routes), so the claim is not false — but a reader scanning the Overview will
  under-estimate the hub delta.

## Top 3 risks/gaps
1. Per-flush O(projects × specs) uncached parsing (R1-1) — the only finding with runtime
   teeth; correct but potentially churny on a busy multi-project host.
2. The `harness-run-detail` envelope is unpinned in Data Models (R1-2) — a small
   hand-copy ambiguity across the server/frontend boundary.
3. The "two additive sends" framing hides the real hub rewrite (R1-3).

## Top 3 conclusions to challenge (and why they survive)
1. "The FileCache bounds re-reads." Partly — it does not cover getAllSpecs/deferral/
   snapshot reads (R1-1). Survives as MINOR because no requirement sets a perf bound
   beyond 5s/60s freshness and the throttle caps frequency.
2. "Two additive sends." Survives (R1-3): defensible against the literal unchanged list.
3. "Error branches are pinned." Survives: the one new branch pins status + message; the
   rest are existing routes consumed read-only, and their shapes match the code.

## What's missing before acting
- Decide R1-1: either pass the FileCache down into the spec-row/now-model fs reads or
  memoize one getAllSpecs/snapshot per flush. Decide at the tasks phase, not later.
- Add the `harness-run-detail` arm to Data Models (R1-2) so the frontend copy is sourced.

All deltas and every cited artifact were read at both ends and are accurate. No
contradiction, false codebase claim, unimplementable requirement, or data/security hole
was found. Converged.

```
VERDICT: converged
MUST_FIX: 0
SHOULD_FIX: 0
MINOR: 3
DESIGN_READY: yes
ESCALATE: none
```
