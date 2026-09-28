# Adversarial Review Memory — requirements

Last updated: 2026-09-28 (round 1, v1)

## Cumulative Findings Summary

### Accepted
- (none yet — first round)

### Partially Accepted
- (none yet)

### Rejected
- (none yet)

### Unresolved
- **R1-1 (MUST_FIX)** — AC 2.9 adds `overrides` and `setup=harness-run` keys to the
  `run.start` ledger row, contradicting decomposition.md:754 ("Spec 9 ... adds no ledger
  field") and the document's own D14 ("the boundary notes forbid a new ledger field").
  Keys confirmed absent from code today.
- **R1-2 (SHOULD_FIX, wire contract)** — Overview cross-project stream (Req 5) and the
  Harness-watcher lifecycle (AC 4.7, 5.9) rely on a websocket contract the existing `/ws`
  lacks: one `connection.projectId` per socket (multi-server.ts:210,266-267), broadcasts
  per-project or all only. No subscribe message for "all projects," no way to distinguish a
  Harness subscriber from a Specs subscriber on the same projectId, no message types for
  run-model/log/todos/overview payloads.
- **R1-3 (SHOULD_FIX, wire contract)** — AC 2.4 ("Agent-tool spawn ... `model` parameter")
  ignores DeepSeek workers, which run via `bash <LAUNCHER>` (sdd-document-phase/SKILL.md:24-34),
  not the Agent tool. No AC defines how a DeepSeek role's overridden model reaches the worker.
- **R1-4 (SHOULD_FIX)** — AC 1.6 (model must be `claude-` id or listed alias) collides with
  AC 1.8 (deepseek role requires deepseek-v4-pro/deepseek-flash). Validation is not stated as
  provider-conditional; literal AC 1.6 rejects the models AC 1.8 mandates.
- **R1-5 (SHOULD_FIX)** — AC 1.1 sources spec order from IndexGenerator.generate()
  (index-generator.ts:44-82), which writes INDEX.md (:72) and mkdirs (:70); AC 1.2 forbids the
  page from writing. Order logic (categorize/render/deriveSpecStatus) is private, only reachable
  via generate(); no read-only API.
- **Minor** — AC 5.3/D7 "waiting" is transiently wrong for record-mode pane runs; AC 3.1/3.2
  launch flag list under-specified (`--permission-mode auto` vs `--dangerously-skip-permissions`,
  no `--effort` in runAgent); AC 3.4 log/launch-record paths unnamed.

## Patterns & Themes
- **Ledger-immutability promise vs. new provenance keys.** The document repeatedly asserts it
  changes nothing in the ledger (Intro, D14, Req 6) yet AC 2.9 adds run.start keys. Watch every
  future round for the same "no change" claim quietly violated.
- **"Over the existing websocket" hides new contract work.** The single-projectId socket does
  not fit the Overview page or per-page watcher lifecycle. Any design that keeps claiming pure
  reuse should be probed for the missing subscribe/message types.
- **Provider (DeepSeek) coupling under-modeled.** Model validation, model delivery, and the
  provider map interact; the ACs treat model and provider as independent. Re-check in design.
- Citations are accurate this round — no misstated artifacts. Spot-check remained worthwhile
  (generate() write side-effect, DeepSeek launcher path were the load-bearing surprises).

## Guidance for Next Review
- First confirm R1-1 is resolved: either the boundary reading is amended (state provenance keys
  are in scope) or override provenance moved off run.start. If unresolved, it stays MUST_FIX.
- For design phase, apply the wire-contract lens again to the actual message schemas: verify the
  Overview subscribe path, the harness watcher start/stop keying, and the run-model/log payload
  shapes are named and consistent with multi-server.ts broadcast helpers.
- Re-probe the DeepSeek override path (R1-3) and provider-conditional validation (R1-4) — these
  are the most likely to be papered over rather than fixed.
- The overwatch-hud.json todos schema was verified live this round (id/title/owner/blocks/note/
  since/done/priority present); no need to re-verify unless D1 changes.
