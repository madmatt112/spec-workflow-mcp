# Adversarial Analysis — harness-control-pane/requirements (v1)

Round 1. Primary attack surface: completeness, ambiguity, scope. Fresh lens: wire
contracts across a boundary (router, query params, response shapes, client state).

No prior version exists; the diff since the `docs(sdd): harness-control-pane requirements v1`
checkpoint is empty, so there are no deltas to attack first. This is a first review against
the decomposition entry (spec 9, decomposition.md:649-726) and the code the document cites.

## What I checked and how

- Read the target document in full and the decomposition entry (decomposition.md:649-726,
  build order 736, boundary notes 748-770).
- Read every code range the document and the context file cite, both ends:
  index-generator.ts:40-89, spec-routing-deriver.ts:20-139, agent-profiles.json (all 13
  agents, 1-81), sdd-providers.sh:1-60, SKILL.md:80-129/220-295/336-370/484-500,
  sdd-document-phase/SKILL.md:18-39, formats.md:25-51/185-224, adversarial-runner.ts:156-234,
  watch/index.ts:95-109, ledger.ts:157-197, multi-server.ts:203-295/1925-1989/2125-2151,
  WebSocketProvider.tsx:20-69, sdd-activity.sh:1-14, SDD-HARNESS.md:240-251/302-308,
  App.tsx:239-251.
- Verified live-state grounding: `.spec-workflow/steering` is empty (Alignment claim holds);
  `~/.local/state/sdd/overwatch-hud.json` has a `todos` array whose items carry id, title,
  owner, blocks, note, since, done, priority (D1 and AC 5.5 hold).
- Confirmed `setup`/`overrides` keys and `harness-run.json` do not exist in the code today
  (greenfield); the feature adds them.

Citations spot-checked are accurate: 13 agents at agent-profiles.json; provider-validator
eligible roles `sdd-reviewer sdd-checker sdd-reviser` (sdd-providers.sh:23); orchestrators
spawned with no `model` param (SKILL.md:226-228); provider preflight refuses before any
ledger row (SKILL.md:85-96); model preflight expects `claude-opus-4-8` (SKILL.md:287-295);
worktree rule and headless driver note (SKILL.md:336-345); deregister rule (SKILL.md:488-500);
child-process env/cwd pattern (adversarial-runner.ts:156-220); task-review summary route
returns `tdd` (multi-server.ts:1965-1989); chokidar options (watch/index.ts:101-104);
headless command (SDD-HARNESS.md:244-248). No misstated artifact found.

## Findings

### R1-1 — AC 2.9 adds ledger fields the scope authority and the document's own D14 forbid — MUST_FIX

AC 2.9: "the `run.start` row SHALL carry an `overrides` key ... and SHALL carry
`setup=harness-run`." These are two new keys on the `run.start` row (formats.md:194 lists a
fixed key set; `grep` confirms neither `setup` nor `overrides` exists anywhere in the code
today).

This contradicts the decomposition boundary note (decomposition.md:754): "Spec 9 renders
`RunModel`; **it adds no ledger field**." It also contradicts the document itself: D14's
rationale is "the boundary notes forbid a new ledger field" — the document invokes that
exact prohibition to justify reading the `tdd` block from a route instead of adding a run-model
field, then breaks it in AC 2.9 by writing two new ledger fields on `run.start`.

Failure scenario: the design/adjudication phase inherits an unresolved conflict — either
`overrides`/`setup` are legal ledger fields (and D14's stated constraint is false, so the
tdd decision rests on a wrong premise), or they are illegal (and AC 2.9 is out of scope).
Req 6 AC 3 only guards the *no-file* terminal run's shape, tacitly conceding the file case
changes `run.start`. Resolve it: either amend the boundary reading and state that a
provenance key on `run.start` is in scope, or carry override provenance somewhere other than
the ledger row. Do not leave both statements standing.

### R1-2 — Overview stream and Harness-watcher lifecycle assume a websocket contract that does not exist — SHOULD_FIX (fresh lens: wire contracts / client state)

The existing `/ws` (multi-server.ts:205-294) binds one connection to a single
`connection.projectId` (query param at :210, or a `{type:'subscribe', projectId}` message at
:266-267). Server pushes are either `broadcastToProject` (2139-2151, filters on that single
`projectId`) or `broadcastToAll` (2125-2137). The frontend opens one socket per selected
project (WebSocketProvider.tsx:35-57; `targetProjectId` may be null → `/ws` with no param).

The document says the new data flows go "over the existing websocket" (AC 4.2, 5.6) but never
defines the contract that makes that possible:

- **Overview (Req 5) needs all projects at once.** There is no way to express "subscribe to
  every project." AC 5.9 requires "one watcher set shared by all Overview clients ... close it
  when the last Overview client leaves" — the server must track *which* connections are
  Overview subscribers, a piece of client state and a subscribe message the protocol has no
  concept of.
- **AC 4.7** ("no Harness page open → stop the harness watcher") is *underivable* from
  `connection.projectId`: a Specs-page client and a Harness-page client for the same project
  both set `projectId=X` and are indistinguishable. Without a Harness-specific subscription
  signal the server cannot tell a Harness page is closed while a Specs page stays open.
- No message `type` is defined for the run-model push, the log-line stream (AC 3.5), the todos
  list (AC 5.5-5.6), or the overview rows — the page cannot demultiplex them from the existing
  `initial` / `projects-update` messages.

Failure scenario: the implementer reuses `connection.projectId` + `broadcastToProject`, the
Overview page gets nothing (no project selected), and AC 4.7 leaks watchers because a closed
Harness tab looks identical to an open Specs tab. Name the new subscribe messages and payload
types, and the client-state the server keys watcher lifecycle on.

### R1-3 — AC 2.4 worker-model override path ignores DeepSeek-routed workers — SHOULD_FIX (wire contract)

AC 2.4: "each orchestrator SHALL pass the matching `model` parameter on each Agent-tool spawn
of that role." That is correct only for Anthropic workers. sdd-document-phase/SKILL.md:24-34
shows DeepSeek workers are *not* spawned through the Agent tool — they run as
`bash <LAUNCHER> <agent> "<launch message>"`, and the model comes from the merged provider map
carried by `launch.sh`, not from an Agent-tool `model` parameter. AC 1.8 lets the setup file
set a DeepSeek model per role, and AC 1.11 writes that model to `harness-run.json`, but no AC
states how a DeepSeek role's overridden model reaches the worker. AC 2.6 merges the provider
map but says nothing about the model reaching the launcher.

Failure scenario: operator sets reviewer → deepseek / deepseek-v4-pro; the orchestrator, per
AC 2.4, tries to pass `deepseek-v4-pro` as an Agent-tool `model` (invalid), or the override is
silently dropped because the DeepSeek path bypasses AC 2.4 entirely. Split AC 2.4 by provider:
Agent-tool `model` for Anthropic roles, merged-map + launcher for DeepSeek roles.

### R1-4 — AC 1.6 and AC 1.8 model validation collide for DeepSeek roles — SHOULD_FIX

AC 1.6 refuses any model value that is "neither a model alias the design lists nor a full
model id that starts with `claude-`." AC 1.8 requires `deepseek-v4-pro` or `deepseek-flash`
for a role whose provider is `deepseek`. DeepSeek model ids do not start with `claude-`, so
they pass AC 1.6 only if the design's alias list happens to include them — and validity is
provider-conditional (a DeepSeek model must be accepted with provider=deepseek and rejected
with provider=anthropic; the reverse for a claude id on a deepseek role). The document never
states that AC 1.6 validation is provider-aware.

Failure scenario: a literal AC 1.6 implementation rejects the exact values AC 1.8 mandates, so
no DeepSeek run can ever be saved. State the provider-conditional validation rule explicitly.

### R1-5 — AC 1.1 cites a write-coupled function for a read-only listing that AC 1.2 forbids from writing — SHOULD_FIX

AC 1.1 sources the spec order and routing from "the categorization and routing of
src/core/index-generator.ts:44-82" — `IndexGenerator.generate()`. That function is not
read-only: it `mkdir`s the decomposition path (index-generator.ts:70) and `fs.writeFile`s
INDEX.md (:72). AC 1.2 forbids the page from writing INDEX.md "or any other file in the spec
store." The order-producing logic (`categorize` + `render` ordering + `deriveSpecStatus`) is
private to the class and only reachable through `generate()`; only `deriveRouting` is exported.

Failure scenario: an implementer following AC 1.1's citation calls `generate()` and violates
AC 1.2 (rewrites INDEX.md on every page open, racing terminal runs). The document should state
that the page reuses the ordering/categorization/current-phase logic *without* the write side
effect, which requires exposing a pure function or reimplementing the order — a real task the
document currently hides.

### Minor (do not keep the loop alive)

- **AC 5.3 / D7 "waiting" is imprecise for headless runs.** A pane-launched run is always
  record-mode (D6), so a `phase.end` result `gate-a` does not actually block — the re-spawn's
  `phase.start` clears "waiting" seconds later. The rule is self-correcting and harmless, but
  the Overview will briefly flag record-mode runs as "waiting" when no human is due.
- **AC 3.1 / 3.2 launch flag set is under-specified.** The documented headless command uses
  `--permission-mode auto` (SDD-HARNESS.md:247) while the reused `runAgent` uses
  `--dangerously-skip-permissions` and has no `--effort` support (adversarial-runner.ts:158-165).
  AC 3.2 correctly scopes the reuse to env/cwd/roots only, but the exact flag list for the
  launch child is left to inference. A design detail, but name it.
- **AC 3.4 log-file and launch-record paths "outside the repository" are unnamed.** Fine to
  settle in design.

## Closing deliverables

### Top 5 risks / gaps

1. AC 2.9 writes new `run.start` ledger fields that the decomposition boundary note and D14
   both forbid — an unresolved scope contradiction the design would inherit (R1-1).
2. The Overview cross-project stream and the Harness-watcher lifecycle (AC 4.7, 5.9) rest on a
   websocket subscription/message contract the existing single-`projectId` socket does not
   provide (R1-2).
3. The model-override path (AC 2.4) does not account for DeepSeek workers, which bypass the
   Agent tool; a DeepSeek override has no defined delivery path (R1-3).
4. AC 1.6 vs AC 1.8: model validation is not provider-aware, so a literal reading rejects every
   DeepSeek model (R1-4).
5. AC 1.1 sources the spec listing from a function that writes INDEX.md, which AC 1.2 forbids;
   no read-only order API exists (R1-5).

### Top 3 conclusions to challenge or reverse

1. **"It changes nothing in the ledger format" (Introduction) / D14 "the boundary notes forbid
   a new ledger field."** Reverse or qualify: AC 2.9 does change the ledger format for the
   file case. Pick one story and make the ACs match it.
2. **"The pane reuses the data layer the TUI already has, so the page and the TUI can never
   disagree" (Alignment) + "over the existing websocket."** Challenge: the TUI reuse is real
   for a *single* run/spec, but the Overview page (all projects) and the watcher lifecycle need
   a new transport contract the reuse claim glosses over (R1-2).
3. **"show a provider field only for the three eligible roles ... the model field ... a full
   model id that starts with `claude-`" (D9, AC 1.6).** Challenge the implicit assumption that
   model and provider validate independently; for DeepSeek roles they are coupled (R1-3, R1-4).

### What's missing — do before acting on this document

- Resolve the ledger-field contradiction (R1-1) before design; it decides whether override
  provenance lives on `run.start` at all.
- Define the websocket wire contract: subscribe messages for Overview and Harness pages,
  the message `type`s for run-model / log / todos / overview payloads, and the client-state the
  server keys each watcher's start/stop on (R1-2).
- Specify the DeepSeek override delivery path and provider-conditional model validation
  (R1-3, R1-4).
- Decide the read-only listing API for spec order/phase without writing INDEX.md (R1-5).

ESCALATE: none. The launch/stop routes spawn a permission-skipping headless `claude` that can
commit and push, but D10 deliberately reuses the same binding/rate-limit/audit hooks the
existing adversarial routes already use; this is a decided reuse, not a new hole. Worth a
human's eye at design if the localhost-only option is reconsidered, but not now.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 4
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
