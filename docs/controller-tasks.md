# Step (b): task breakdown

Written 2026-10-11 from `docs/controller-design.md`. Each task is one PR on a branch
`feat/controller-<task>`, built in a worktree, tested without tokens against the stub
`claude`, merged with a merge commit once CI is green. Order: T1, T2, T3 in parallel; then
T4 and T5a; then T5b, T6; then T7, T8, T9; then T10, T11. Nothing here changes the harness
skills until T11. The controller lives under `src/controller/` and is wired into the
dashboard server (`src/dashboard/multi-server.ts`) through one `Controller` class.

Conventions: TypeScript ESM like the rest of `src/`; vitest tests beside the module in
`__tests__/`; no new runtime dependencies without a reason in the PR; every file the
controller writes carries `v: 1`; one writer per file; atomic writes (temp file + rename);
no model call in any controller code path; prose only in briefs and in what the model
returns. Terms from `GLOSSARY.md`.

## T1 `step`: run one model step

`src/controller/step.ts`. `runStep(spec: StepSpec): Promise<StepResult>` spawns one
`claude -p "Read and execute the instructions in <brief>"` with: `--model`, `--effort`,
`--append-system-prompt-file <role body>` (the agent file under `harness/agents/` with its
frontmatter stripped), `--allowedTools <from the agent frontmatter>`, `--permission-mode
default --permission-prompts none`, `--mcp-config <json>` and `--strict-mcp-config` (the
spec-workflow server for the project, as `.mcp.json` would), `--json-schema <role schema>`,
`--output-format stream-json --verbose`, `--max-turns <cap>`, `--session-id <uuid>` or
`--resume <id>`, `--no-session-persistence` only when the caller says so, `cwd` = the run's
worktree, env = process env minus `ANTHROPIC_API_KEY` and `ANTHROPIC_AUTH_TOKEN` plus
`SDD_RUN_ID`, `SDD_STEP_ID`, `SDD_HEADLESS=1`, `SPEC_WORKFLOW_WORKSPACE`,
`SPEC_WORKFLOW_SHARED_ROOT`. It parses the stream: `system/init` (session id, model),
`assistant` content `tool_use` blocks (name, input summary) to an `onActivity` callback,
`rate_limit_event` to an `onRateLimit` callback with the two windows, and the final
`result` (structured_output, usage with cache fields, num_turns, is_error, subtype, result
text). It writes the raw stream to a log file the caller names. Exit classification:
`ok`, `turn-cap`, `usage-limit` (from a `rate_limit_event` with a rejecting status or a
result subtype naming the limit), `schema-invalid`, `error`. The binary name comes from
`CONTROLLER_CLAUDE_BIN` (default `claude`), which is how tests swap in the stub.

`scripts/stub-claude.mjs`: a stand-in `claude` for tests. It reads `STUB_CLAUDE_SCRIPT`,
a JSON file listing canned runs in order (each: stream events to emit, result object,
exit code, optional delay, optional file edits to perform in cwd), consumes one entry per
invocation (a counter file next to the script), and prints the stream exactly as Claude Code
would. Tests cover: a clean run with a tool_use and a result; a schema result; a turn-cap
exit; a usage-limit rate_limit_event; a resume (`--resume` seen in argv); env scrubbing
(the stub prints its env in `system/init` extras); the cwd.

## T2 `state`: the harness home records

`src/controller/state.ts`. Resolves the home with the same rule as `state-files.ts`
(`SDD_HOME` or `~/.local/state/sdd`). Layout: `runs/<run-id>/run.json`,
`runs/<run-id>/steps/<step-id>.jsonl` (the raw stream logs), `waits/<wait-id>.json`,
`queue.json`, `rate-limit.json` (latest windows), `controller.lock` (pid, start time).
Types: `RunRecord` (v, id, project id, code root, spec store, spec, worktree path, branch,
status: queued | running | paused | waiting | done | abandoned | error, pause reason and
resume-at, phase, step cursor (phase, round or task, step kind, attempt), in-flight step
(id, pid, process start time, session id), created, updated, token totals), `WaitRecord`
(design §7), `QueueFile` (ordered run ids). Functions: read, list, write (atomic), a
`withLock(path, fn)` per spec store (flock-style via `proper-lockfile` if already a
dependency, else an O_EXCL lock file with a stale check), and `isProcessAlive(pid,
startTime)` reading `/proc/<pid>/stat` field 22 so a reused pid is not mistaken for the
step. Tests cover each record's round trip, atomicity (a crash mid-write leaves the old
file), the lock, and the liveness check against a spawned `sleep`.

## T3 `ledger`: controller-written run events

`src/controller/ledger.ts`. Appends rows to `<spec dir>/harness-events.jsonl` in exactly
the formats of `harness/skills/sdd-continue/references/formats.md` ("Run ledger"), so
`--watch` and the shell render a controller run as they render today's: `run.start`
(with `headless=yes`, `setup=controller`), `phase.start`, `phase.end` (with `result`),
`round`, `spawn.start`, `spawn.end` (tokens from the step result: input, output,
cacheWrite, cacheRead, cacheWrite5m, cacheWrite1h, model, agent), `spawn.usage`, `task.pick`,
`task.done`, `note`, `run.end`. Run ids as today (`run-<YYYYMMDD>-<HHMMSS>` UTC). Also a
`checkpoint(specStoreRoot, message)` helper that commits the spec store the way the skills
do (`docs(sdd): <SPEC> <PHASE> v<N>`), serialised through the T2 lock. Tests: a ledger
written by this module renders in `src/watch` (`render.ts`) with the same phase, spawn and
token lines as a fixture ledger from a real run; `now-model.ts` sees the run as live.

## T4 `waits`: wait records, answers, the Now page

`src/controller/waits.ts` plus routes in `multi-server.ts` and the shell. Create a wait
(kinds `gate-a`, `gate-b`, `retro-plan`, `merge`, `escalation`, `error`, `question`), list
open waits, answer one (writes the record, renders `questions.md` in the spec dir in the
format the gates reference describes, appends a `note` ledger row), attach advice. Routes:
`GET /api/controller/waits`, `POST /api/controller/waits/:id/answer`, `POST
/api/controller/waits/:id/advice`; WS topic `controller-waits` pushed on change. Now page:
controller waits appear in "Waiting on you" above the derived ones, with an answer sheet per
kind in the detail panel (gate: one radio group or free-text per question, recommended
pre-selected, "Answer and continue"; retro-plan: the DECISION NEEDED questions and the
proposals as a ticked list, "Approve plan and continue"; merge: "Merge" or "Hold"; error:
"Retry" or "Abandon"). One desktop notification per new wait from the open tab (the
Notification API), nothing else. Tests: record round trip, `questions.md` output equals a
fixture, routes with supertest or the existing route test pattern.

## T5a `document-loop`: drafter, lint, rounds, approval, cleanup

`src/controller/phases/document.ts`. `runDocumentPhase(run, phase)` for requirements,
design, tasks, following `harness/skills/sdd-document-phase/SKILL.md` and its references
(`convergence.md`, `cleanup.md`) as the rule source, with every mechanical step in code:
build the drafter brief with the `brief-templates` drafter template (same inputs the
orchestrator passes today); drafter step (schema: `{ wordCount, decisions: [{ id, text,
options?, recommended? }], contextFileWritten }`); checkpoint commit; `spec-lint`
in-process; on findings a reviser step with the lint-fix brief and a commit; rounds: build
the adversarial prompt with the `adversarial-review` tool's generator (call its function,
not the tool handler) with `verdictBlock`, the machine-verified bullet and the diff since
the last checkpoint; reviewer step (schema: `{ verdict: converged | iterate, mustFix[],
shouldFix[], recurring[], escalate?: string, analysisPath }`); `round` row; converged or
MINOR-only ⇒ approve (approvals storage: request then approve, as `approvals.ts` does),
prune, delete per-round prompts and briefs, keep analyses and memory, write the HANDOFF
section, commit; iterate ⇒ reviser step (brief from the reviser template with the analysis
path), checkpoint, lint, next round; the SHOULD_FIX-only rule (reviser corrective version
then checker step, then approve); `escalate` ⇒ an `escalation` wait and stop. Round cap and
budgets as the skill states. Tests with the stub: converge at round 1; iterate twice then
converge; SHOULD_FIX-only path; a lint finding fixed; an escalate. Assert the files, the
ledger rows and the approval record after each.

## T5b `document-gates`: gate A, gate B, the cap, adjudication

Extends T5a. Gate A after requirements v1: the drafter's `decisions` become a `gate-a` wait
(questions ranked as `gates.md` says, at most five, the rest recorded); the phase returns
`waiting`; on answer, changed answers go to a reviser step as revision comments, then
round 1. Gate B after tasks approval: the veto list built in-process (sensitive paths via
`gate-rules.ts`, the action keywords and new-dependency checks from `gates.md`, the task
parser) into a `gate-b` wait; an annotation runs one reviser step; approve proceeds. The v4
cap: adjudicator step (schema: `{ fixed[], ruledOut[], carried[] }`), checker step
(schema: `{ verified: boolean, items[] }`), approve, carry ruled-out SHOULD_FIX into the
next phase's drafter brief. Standoff rule (a Recurring MUST_FIX rejected twice) as a `note`.
Tests: gate A with two changed answers; gate B with an annotation; cap at v4.

## T6 `runs`: queue, routing, the supervisor for the other phases

`src/controller/runs.ts` and `src/controller/controller.ts`. Launch = enqueue
(`POST /api/controller/launch` replaces the launcher's route; the Launch button stays).
Scheduler: slots (default 2, `CONTROLLER_SLOTS`), the window thresholds from
`rate-limit.json` (default 0.95), first come first served, one run per spec store.
Starting a run: resolve roots and the worktree (reuse `launcher.ensureWorktree` and
`run-setup.ts`), `run.start`, route from the spec store state with the logic of `harness
orient` (call its function), then: a document phase ⇒ T5; implementation or close-out ⇒
spawn today's supervisor as a step (`claude -p "continue the sdd process"` with a
`harness-run.json` that sets `gates: record`, reuse `launcher.spawnRun`), wait for exit,
re-route; retrospective ⇒ the supervisor runs it and stops at a DRAFT plan ⇒ a `retro-plan`
wait; on approval write `retrospective-plan.md` as APPROVED from the answers (the format in
`sdd-retrospective`), re-route to close-out. Pause and resume on the window (design §9),
crash recovery on start (design §8), cancel and discard (design §13), `run.end`. The
pointer file is written for the supervisor steps only (the hook still needs it) and never
for controller steps. Tests with the stub: a full fixture run through requirements (with
gate A), design, tasks (with gate B), a supervisor step, a retro-plan wait, close-out,
done; a controller restart mid-phase resumes; a window above threshold parks the run.

## T7 `merge`: the merge rule

`src/controller/merge.ts`. After the supervisor's implementation phase reports complete,
read the PR number (HANDOFF section or `gh pr list --head`), poll `gh pr view` for checks,
mergeability and the body; the rule (design §10): checks green, mergeable, no attribution
trailer in commits or body, branch is the run's; `agent-rules.md` keys `merge-method`
(exists), `post-merge` (exists), `merge: auto | ask` (new, default `auto`; the harness
repo's `agent-rules.md` sets `ask`); `gh pr merge --<method>`; run the post-merge command;
`pr.merged` row; with `ask`, a `merge` wait. Tests with a stubbed `gh` (same pattern as the
stub claude).

## T8 `access`: the shared secret

Design §17. Bind 127.0.0.1 unless `--host`. Generate `secret` in the home on first start.
Every mutating route and `/api/controller/*` require `Authorization: Bearer <secret>` or
the session cookie set by `POST /api/login`; the shell shows a login box once per device
and stores the cookie. Read routes open on loopback only. Tests: 401 without, 200 with.

## T9 `service`: unit, health, watchdog, staged restart

`scripts/sdd-service.sh install|uninstall|status` writes a systemd user unit for
`spec-workflow-mcp --dashboard --port 5000` with `Restart=always`, and a user timer that
curls `/api/health` every minute and sends one desktop notification after ten minutes down
or three restarts in an hour. `scripts/sdd-self-update.sh`: pull, `npm ci`, build into
`dist-staging/`, boot it once on a scratch port with `--smoke`, swap `dist/` and
`systemctl --user restart` on success; on failure keep `dist/` and write an `error` wait.
`/api/health` returns version, uptime, slots in use, window state.

## T10 `dashboard`: queue, runs and live steps in the shell

Runs page shows the queue and controller runs (status, phase, step, pause reason) from the
controller, with Cancel and Discard; Run page shows the in-flight step's current tool from
the activity callback (WS topic `controller-activity`) and the step log tail; Usage shows
the two windows. Launch disabled reasons come from the controller (slot, window, open
spec). No new visual design: the Linear layout of spec 15 as is.

## T11 `docs-and-retire`: documentation, the document orchestrator retired

`docs/SDD-HARNESS.md` gains "The controller" (what runs where, the home, waits, the merge
rule, access, the service) and loses the document-orchestrator description;
`harness/agents/sdd-document-orchestrator.md` and `harness/skills/sdd-document-phase/`
are deleted; `sdd-continue/SKILL.md` routes a document phase to "the controller owns this;
stop" when `SDD_HEADLESS=1` is set by the controller (so a stray by-hand run cannot run
the old loop against a controller-managed spec); `docs/foundation-review.md` progress log
updated; `GLOSSARY.md` checked.

## Done-when for step (b)

Design §13 (b), run on a fixture project through the real `claude` once the stub tests are
green: launched from the dashboard, gate A answered in the dashboard, documents approved,
the supervisor's implementation phase and PR, merged by rule, the retro-plan wait, close-out,
done; the dashboard closed for part of it; the controller restarted once mid-phase; a
forced window threshold parked and resumed a run; no terminal opened.
