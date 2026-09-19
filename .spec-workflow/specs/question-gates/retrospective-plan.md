# Retrospective plan — question-gates

Status: CLOSED — 2026-09-17

Decided in the retrospective conversation (run run-20260916-194812). The close-out phase
implements every APPROVED proposal below. Every `harness/` change is a prose edit that
needs `sync-plugin-assets` + a plugin re-install before it takes effect; all of these ride
the question-gates release (the same release `d-1880d115` already waits on).

## Approved

- **P1 (F1) — Mark a compounding finding and fix its seam, not its symptom.** Add a rule
  to the document-phase review/reviser step: a MUST_FIX that names a cross-artifact wire or
  an AC contradiction must edit and cite *both* ends (the AC and the component, or producer
  and consumer); a reviewer that re-flags a prior round's seam labels the finding
  `compounds R<k>-<n>`. (spec-lint P21, third occurrence, still unbuilt.)
  Target: harness skills or agents (`sdd-document-phase` review + reviser rules).
  Decision: APPROVED — implement in close-out. Graduates candidate 4.

- **P2 (F2) — Allowlist the `harness` tool on the four SDD orchestrators.** Add
  `mcp__spec-workflow__harness` and its two plugin variants
  (`mcp__plugin_spec-workflow-mcp_spec-workflow__harness`,
  `mcp__plugin_spec-workflow-mcp-with-dashboard_spec-workflow__harness`) to the `tools:`
  lists of sdd-document/implementation/closeout/retro-orchestrator (the drafter already
  grants them). Closes `d-473aa261` and removes F3's cause.
  Target: harness skills or agents (four orchestrator agent `tools:` lists).
  Decision: APPROVED — implement in close-out. Verification (orchestrator reaches the tool;
  `lint-brief-<PHASE>-v<D>.md` persists; round-1 prompt carries `## Changes since`) is
  deferred to the release + re-install and tracked by `d-473aa261`. Graduates candidate 1.

- **P3 (F3) — One run id per run; an orchestrator reuses EVENT_SCRIPT and never
  re-inits.** Add one line to the orchestrator contract: reuse the `EVENT_SCRIPT` the
  supervisor exported; never write a new run id. (The concurrent-peer variant is
  harness-bookkeeping P6(a), a separate hook change.)
  Target: harness skills or agents (orchestrator contract in
  `sdd-continue/references/formats.md`).
  Decision: APPROVED — implement in close-out. Depends on P2. Graduates candidate 2.

- **P4 (F4) — Keep path and identifier tokens out of decision-log bullets.** Codify the
  proven convergence rule (a Revision-History / decision-log bullet cites findings by id and
  prose only; no backticked path or identifier token) in the standing lint-reviser /
  Revision-History output rule. Option (a) chosen; the server-side `lint-citations.ts` fix
  (option b) stays on the lint backlog (harness-bookkeeping P11).
  Target: harness skills or agents (lint-reviser brief).
  Decision: APPROVED — option (a). Implement in close-out. Graduates candidate 3.

- **P6 (F6) — A Revision-History bullet cites the post-fix line and describes the fix
  truthfully.** Fold one clause into the reviser output rule: cite the exact post-fix line;
  state what the fix did, not what it did not.
  Target: harness skills or agents (reviser output rule).
  Decision: APPROVED — implement in close-out.

## Rejected / no change

- **P5 (F5) — No change.** The payload plan-source doc gap was self-resolved by a permitted
  task-header grep at no spawn cost; a "name every payload field's source" design rule would
  not pay for itself.
- **P7 (F7) — No change.** L-7 (bridge-missing) was a correct false-positive ruling and the
  two SHOULD_FIX-only exits were normal routing. No rule makes a correct rejection cheaper.
- **P8 (F8) — No new change.** Already codified: spec-lint P11(a) put the
  `deferrals list tag=verification` release step into CLAUDE.md; the autonomous deferral
  `d-1880d115` matches that rule and carries the exact command.

## Decisions made

- **P4: option (a)** — codify the lint convergence rule in the reviser brief now; the
  server-side `lint-citations.ts` fix stays on the lint backlog.
- **P2/P3 folded into this close-out** rather than a separate patch: question-gates already
  requires a release + re-install (`d-1880d115`), so one release fixes the allowlist gap
  (F2) and the run-id split (F3) at the same time. The close-out edits the agent files in
  the worktree; the re-install remains a future release step, so the Opus substitute and
  this session are not disturbed.

## Graduation candidates

Approved for promotion, each landing with its proposal:

1. **An orchestrator that calls the harness tool must allowlist it.** → `agent-rules.md`
   (or the harness agent-authoring note). Lands with P2.
2. **One run-state id per run; nothing rewrites it mid-run.** → orchestrator contract in
   `sdd-continue/references/formats.md`. Lands with P3 (the concurrent-store half stays
   harness-bookkeeping P6(a)).
3. **Decision-log bullets carry no path or identifier tokens.** → lint-reviser /
   Revision-History output rule. Lands with P4.
4. **Mark a compounding finding; fix the seam once.** → `sdd-document-phase` review step.
   Lands with P1.

## Close-out

One line per proposal, written by the close-out phase.

- P1: done — a26f246
- P2: done — 82064d8
- P3: done — 478bf4f
- P4: done — 0542178
- P6: done — 8156c82
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/47
