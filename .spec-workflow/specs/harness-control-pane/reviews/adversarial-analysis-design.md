# Adversarial Analysis — harness-control-pane/design (v1)

Round 1 (first design review). Primary surface: feasibility, consistency, edge cases.
Fresh lens: the websocket subscribe/message wire contract across project-watch → hub →
frontend. Plus the assigned lenses: library-capability probes, Data Models completeness,
and rulings on four re-decided requirement literals.

## What I verified in the code (both ends of every citation)

- **CLI capability probes (all confirmed at the installed version).** `claude --version`
  = 2.1.284, matching the doc. `claude --help` lists `--effort` (choices low/medium/high/
  xhigh/max), `--model` (help text names the aliases `fable`, `opus`, `sonnet` or a full
  name), and `--permission-mode` (choices include `auto`). So `MODEL_ALIASES =
  ['opus','sonnet','fable']` (D4) and the launch flag set in C4 step 4 are grounded.
  The node detached-spawn probe (pgid==pid, fd stdio, `process.kill(-pid,0)`/ESRCH,
  ENOENT, exit after unref) is standard node behaviour stated as probed on v24.13.0; the
  live re-probe was sandbox-blocked but the claims are correct for node 20/24.
- **buildModel / RunModel.** `buildModel(input: { spec; ledger: LedgerEvent[]; activity:
  ActivityEvent[]; tasksMd?; handoffMd? })` (src/watch/ledger.ts:243-249) — C6's call
  `buildModel({ spec, ledger, activity: [] })` is valid. `RunModel.livePhase` is
  `{ phase; mode?; budget?; state?; startedAt }` (ledger.ts:168) — C6's `livePhase?.phase`
  is correct. `AGENT_PROFILES` (ledger.ts:84) and `AgentProfile` (ledger.ts:38-44) match.
- **projectPath semantics (checked both ends — no defect).** `project.projectPath =
  translatedWorkflowRootPath` (project-manager.ts:181); `SpecParser`/`PathUtils` treat
  that arg as the **repo root** (parser.ts:13 → `getSpecPath` appends `.spec-workflow`;
  registry comment "Path where .spec-workflow is stored"). So the design's repeated
  `<projectPath>/.spec-workflow/...` composition and `resolveSpec(<projectPath>/.spec-workflow)`
  are correct, and the admission prefix `<projectPath>/.spec-workflow/specs/` matches the
  pointer line's spec-dir field (sdd-activity.sh:8). No finding.
- **deregister.mjs (formats.md:266-281).** Temp-file + rename, filter on the 3rd tab
  field, delete at zero lines — and it *does* carry the read→rename append-race the design
  names. removePointerLine's added retry is strictly stronger than the blessed helper.
- **sdd-providers.sh (23,29,42,54-71,72-74), agent-profiles.json (13 agents),
  formats.md (75-76,178,194,236), SKILL.md worktree/gate ranges, phase-skill spawn
  rules, index-generator 44-72 / 133-157, spec-routing-deriver 20-30, git-utils 5-6/45-51,
  global-dir 40-51, task-review summary route 1965-1988, stop() 2247-2289, broadcast/
  cleanup 2125-2166.** All resolve to the cited behaviour.
- **Deltas (the lint pass).** Every directory-prefixed citation the v1 lint commit added
  (skill, reference and providers-script paths) points at the correct range. No MUST_FIX in
  the delta.

## Rulings on the four re-decided requirement literals

- **Req 1 AC 4 — deepseek-mapped role pre-fills the map's model (D3): refinement (closed).**
  AC 4 says "pre-filled with the declared model," but a role the `## Providers` map routes
  to deepseek must (AC 1.6/1.8) hold a deepseek model, so pre-filling its declared Claude
  model makes the form invalid on load. Pre-filling the map's model serves AC 1's intent (a
  valid, usable form) and crosses no human-owned decision. Carried to the next drafter.
- **Req 3 AC 13 — retry leaves a residual append race: refinement (closed).** AC 13 accepts
  "the supervisor's `deregister.mjs` helper **or an equivalent**." deregister.mjs itself
  carries the identical read→rename window (verified). The design ports it and *adds* a
  compare-and-retry, so it exceeds the named bar. The residual window is inherent to the
  approach the requirement blessed; closing it fully needs the supervisor's appender to take
  a lock, which the decomposition pins out of scope. Honestly disclosed in Scope notes.
- **Req 3 AC 14 — unmarked reused worktree gets setup re-run, not refused: refinement
  (closed).** AC 14 requires only that a worktree whose `worktree-setup` has not completed is
  never *used*. The marker (`<git dir>/sdd-setup-done`) gates use; running idempotent
  `npm ci` when the marker is absent (new or reused) satisfies the intent and is safer than a
  refusal. Within AC 3.3/3.14 intent.
- **Req 2 AC 6 — a malformed file is also refused and deleted: refinement (closed).** AC 6's
  stated purpose is that an invalid file must not "re-refuse every future run." A malformed
  (unparseable / AC-1.6-violating) file is exactly such a file; deleting it and running as
  today matches the intent. A `mismatch` (wrong spec) is *not* deleted (C9 returns
  `setup=mismatch`, exit 0), consistent with AC 2. Minor operator-surprise (a hand-edited
  file is removed on a parse error) but the file is system-owned and regenerable — not
  escalation-worthy.

## Findings

### R1-1 (SHOULD_FIX) — the harness-log producer has no launch re-point / offset reset
Fresh lens (wire contract). C5: the watch "watches … the launch log," sends "new complete
log lines, read from a byte offset," and `snapshot()` holds "the last 200 log lines with
`reset: true`." The `harness-log` payload carries `{ launchedAt, lines, reset }`. But the
log path is **per launch** — `logs/<projectId>-<launch time>.log` (C2) — and a project can
launch again in the same dashboard session after a prior run ends. The design says only that
a `launch-update` "rebuilds that project's `harness-model`"; it never says the watch
re-derives the current log path from `launcher.get(projectId)`, resets its byte offset, and
re-arms the file watch on the new file, nor that the client keys its buffer on `launchedAt`
and clears on change. As written, the second run's log lines do not stream (stale path /
stale offset). Producer field `launchedAt` and `reset` have no specified consumer behaviour.
Pin: on `launch-update`, re-point the log watch to the new `logPath`, reset offset to 0, and
send a `reset:true` batch; state that the client discards batches whose `launchedAt` differs
from the current run.

### R1-2 (SHOULD_FIX) — the sdd-providers.sh merge ignores the script's early returns and inline checks
C9: "the optional argument merges each file role over the parsed rows **before the unchanged
checks of lines 54-71**, so a non-eligible role off `anthropic` is refused there." Two
problems in the real script (harness/skills/sdd-continue/references/sdd-providers.sh):
1. The per-row checks (eligibility, provider, model, dup) run **inline in the parse loop**
   (lines 54-64), not as a separate post-parse pass. They cannot be both "unchanged" (inline)
   **and** applied to a merge that happens after parsing. If an implementer keeps them inline
   and bolts the merge on after the loop, a run-file **override** of an already-parsed row
   (e.g. flipping an anthropic role to `deepseek`) is applied *after* its inline check and
   bypasses validation.
2. The script short-circuits with `none()` before any merge could run: no `## Providers`
   heading (line 41), unreadable file (line 35), and **zero parsed rows** (line 66). A
   dashboard run that sets `sdd-checker→deepseek` on a project whose agent-rules has *no*
   Providers block would hit `none()` and never merge or validate the run-file role.
Pin: state that the checks move to a single post-merge pass over the union of agent-rules
rows and run-file roles, and that the `none()` short-circuits are replaced by "merge the run
file, then validate," so an added/overridden role is always validated.

### R1-3 (SHOULD_FIX) — Testing Strategy omits the mandatory harness/ checks
The design edits seven files under `harness/` (new `sdd-run-setup.sh`, edited
`sdd-providers.sh`, `SKILL.md`, `formats.md`, and four phase skills). agent-rules.md:27
requires for **any** change under `harness/`: `node scripts/sync-plugin-assets.cjs` (commit
the `plugins/` copies in the same commit), `npm run check:plugin-assets`, and
`claude plugin validate . --strict`. The Testing Strategy lists only tsc/vitest/build/test
(and Req 6 AC 5 the same). Without the sync + validate steps the `plugins/` mirror drifts and
`check:plugin-assets` fails in CI. Add these to the Testing Strategy / verification-evidence.

### R1-4 (MINOR) — snapshot delivery target is under-specified in reconcile
C7: `reconcile(clients)` "starts a watch for each count above zero … and sends a new
subscriber the watch's `snapshot()`." reconcile takes the whole client set and keys on
counts, so it has no handle on *which* connection just subscribed. The intent ("a new
subscriber") is right, but the mechanism is unstated; a literal reading that re-sends
`snapshot()` to all subscribers on any count change would push `reset:true` log batches to
existing clients (log-view reset / loss of lines 201-500). State that the subscribe handler
sends `snapshot()` to the subscribing socket only, and reconcile handles just watch
start/stop.

### R1-5 (MINOR) — interface prose narrower than the pinned types
`buildSetupView` (C3) is described as producing specs, routing, launchable/disabledReason and
role rows, but `SetupView` also carries `handoff`, `worktree`, `gates`, `modelAliases`,
`deepseekModels`, `eligibleRoles` and `saved` — none named in the prose (all are derivable
from `readAgentRules`/constants, so this is completeness, not a contradiction).
`OverviewWatch.snapshot()` (C6) has no return annotation; it must emit both `overview-rows`
and `overview-todos`. Data Models itself is complete: every result/response object a
requirement references is fully enumerated (no object defined only through union arms), so the
Data Models completeness lens passes — this is prose tightening only.

### R1-6 (MINOR) — validateSetup does not enforce the supervisor model floor
`SetupInput.supervisorModel` is editable and `validateSetup` applies only the anthropic
alias/`claude-` rule. An operator can save/launch e.g. `claude-sonnet-5`, which the child's
supervisor preflight (SKILL.md:35-37, "Opus 5.5 or Fable 5.1") then refuses at startup. The
design catches this only as a child refusal (Error Handling #3). Acceptable, but validating
the floor in the form would fail fast; note it or accept explicitly.

## Top risks / gaps (5)

1. **Multi-launch log streaming (R1-1).** The weakest-specified consumer/producer pair; the
   second run of a session shows no live log.
2. **Provider-merge validation bypass (R1-2).** The merge grafted onto an early-returning,
   inline-checking script can let an unvalidated role reach `deepseek`.
3. **Missing harness/ plugin-sync checks (R1-3).** Guaranteed CI failure / plugin drift.
4. **Shared pointer-file concurrency.** Accepted as a refinement, but this is the exact seam
   the decomposition split around (spec 3). Watch it in implementation: two dashboards on one
   machine both finalising can still lose a concurrent append.
5. **Snapshot fan-out on subscribe (R1-4).** Mis-implementation resets other clients' logs.

## Top 3 conclusions to challenge

1. **"removePointerLine + retry is atomic enough" (Req 3 AC 13 / Scope notes).** It is
   *better* than deregister.mjs but still lossy; because the whole worktree-dashboard effort
   was decomposed over shared-file races, an implementer may be tempted to over-trust it.
   Keep the honest disclosure and add a test that a concurrent append survives a removal.
2. **"Bolt a merge argument onto sdd-providers.sh" (D10).** Given R1-2, reconsider whether a
   clean post-parse validation pass (or a small dedicated merge+validate node body) is safer
   than threading a second file through the current inline-checking loop.
3. **"Stream logs via a file watcher on a per-launch path" (C5).** The launcher already owns
   the fd and path; consider having the launcher emit log chunks (or expose the current
   logPath+offset) so the watch never has to rediscover and re-point on each new launch.

## What's missing before implementation

- The launch-log re-point / offset-reset / `launchedAt`+`reset` client contract (R1-1).
- The sdd-providers.sh restructure that accounts for the `none()` short-circuits and moves
  validation to a post-merge pass (R1-2).
- The harness/ plugin-sync + `claude plugin validate . --strict` checks in the Testing
  Strategy (R1-3).
- Snapshot-to-new-subscriber targeting (R1-4) and the `OverviewWatch.snapshot()` shape (R1-5).

## Verdict

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 3
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
