# Retrospective proposals — question-gates

One proposal per finding, in the format at the tail of `retrospective.md`. Every
`harness/` change is a prose edit that needs `sync-plugin-assets` + a plugin re-install
before it takes effect.

- **P1 (F1) — Mark a compounding finding and fix its seam, not its symptom.** R1-1's AC
  contradiction and the R1-2/R1-4 drafter→orchestrator wire gap re-surfaced across three
  rounds because each round patched one end. Add a reviser rule to the document-phase
  review step: a MUST_FIX that names a cross-artifact wire or an AC contradiction must
  edit and cite *both* ends (the AC and the component, or the producer and consumer), and
  a reviewer that re-flags a prior round's seam labels the finding `compounds R<k>-<n>` so
  the shallow-patch loop is visible. This is spec-lint's P21 (mark compounding, stop
  rewording), third occurrence, still unbuilt in the reviewer rules (grep found no
  compounding clause).
  Target: harness skills or agents (`sdd-document-phase` review + reviser rules).
  Effort: S. Risk: low: a brief clause, no routing change. Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — Allowlist the `harness` tool on the four SDD orchestrators.** The
  drafter already grants `mcp__spec-workflow__harness` and its two plugin variants
  (`sdd-drafter.md:14-16`); the four orchestrators grant spec-status, approvals,
  adversarial-review, deferrals, spec-index and spec-lint but not `harness`, so
  `harness orient` and `harness brief` fell back to manual every phase and no
  `lint-brief-<PHASE>-v<D>.md` persisted. Add the same three lines to
  sdd-document/implementation/closeout/retro-orchestrator. This closes d-473aa261 and
  removes F3's cause.
  Target: harness skills or agents (four orchestrator agent `tools:` lists).
  Effort: S. Risk: low: an allowlist add; verified by re-install + a document phase.
  Prerequisites: re-install the plugin and restart the session for it to take effect.
  DECISION NEEDED: no.

- **P3 (F3) — One run id per run; an orchestrator reuses EVENT_SCRIPT and never
  re-inits.** The tasks orchestrator overwrote `event.sh` with a fresh run id because,
  with `harness orient` unavailable (F2), it improvised ledger setup. P2 removes that
  cause. Add one line to the orchestrator contract: "reuse the `EVENT_SCRIPT` the
  supervisor exported; never write a new run id." The concurrent-peer variant (a second
  store overwriting the pointer) is harness-bookkeeping P6(a), a separate hook change.
  Target: harness skills or agents (orchestrator ledger-setup step).
  Effort: S. Risk: low: cosmetic for `--watch`. Prerequisites: P2.
  DECISION NEEDED: no.

- **P4 (F4) — Keep path and identifier tokens out of decision-log bullets.** The
  citation-identifier rule flags a document's own backticked terms (`record`, `question`)
  and bare paths in Revision-History bullets; requirements and tasks lint passes carried
  5-9 such warnings per version. The tasks v2 lint brief added a convergence rule (no
  path/identifier tokens in the decision log) and lint dropped from 20 findings to 1.
  Codify that proven rule in the standing lint-reviser / Revision-History output rule so
  every phase gets it. The deeper server-side fix (lint-citations.ts stops flagging
  backticked non-path words and design-defined terms) is harness-bookkeeping P11, already
  on the lint backlog.
  Target: harness skills or agents (lint-reviser brief) — with a server-code option below.
  Effort: S (brief) / M (server). Risk: low: warnings never block.
  Prerequisites: none.
  DECISION NEEDED: yes. Which fix for the recurring citation-identifier warnings?
  (a) *(recommended)* Codify the convergence brief rule now — cheap, proven 20→1, and the
  root fix (b) stays backlogged.
  (b) Fix `src/core/lint-citations.ts` so backticked non-path words and design-defined
  terms are not treated as absent artifacts — removes the cause everywhere, larger.
  (c) Both: (a) now, (b) when the lint spec is next opened.

- **P5 (F5) — No change.** Design Component 4 did not name the source of the payload's
  compact `tasks:[{id,title}]` plan, but the task-5 implementer filled it with a permitted
  task-header grep at no spawn cost. A one-off resolved in implementation; a
  "name every payload field's source" design rule would not pay for itself.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P6 (F6) — A Revision-History bullet cites the post-fix line and describes the fix
  truthfully.** Twice the decision log drifted: the requirements v4 bullet said R3-1
  "deleted" two phrases that remain (the fix added a grounding clause) and a design v3
  bullet cited SKILL.md:102-105 when the assignment is at 104-107. Both cosmetic. Fold one
  clause into the reviser output rule: "cite the exact post-fix line; state what the fix
  did, not what it did not." This also keeps the decision log honest for P4's convergence
  rule.
  Target: harness skills or agents (reviser output rule). Effort: S. Risk: low: cosmetic.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P7 (F7) — No change.** L-7 (bridge-missing) was ruled a false positive in tasks v1
  and v2 because task 4 names no artefact task 5 creates, so the template's bridge rule
  never triggers; D1's producer-before-consumer order already covers it. The two
  SHOULD_FIX-only exits were normal routing. Zero adjudications, zero escalations, one
  correct ruling — the review gate behaved. No rule makes a correct rejection cheaper.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — No new change; already codified.** The implementation orchestrator deferred
  the four live gate scenarios (d-1880d115) and shipped the in-process tool half proven
  (build + 1260 tests + plugin validate) with a staged fixture. This is exactly spec-lint
  P11(a), which graduated into CLAUDE.md: the release step now runs
  `deferrals list tag=verification` and resolves each open record after re-install. The
  autonomous call matches the codified rule; the deferral carries the exact command.
  Target: CLAUDE.md, memory or settings. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

## Graduation candidates

Patterns in two or more specs' findings, with the rule text and its home.

1. **An orchestrator that calls the harness tool must allowlist it.** F2 (all four phases)
   ↔ spec-lint d-473aa261. The recurrence is a missing allowlist, not a stale cache, and
   it hides across specs because the fallback is silent. For `agent-rules.md`, a
   harness-authoring line (or a comment in each orchestrator agent): "Every SDD
   orchestrator that calls `harness orient` or `harness brief` grants
   `mcp__spec-workflow__harness` and both plugin variants
   (`mcp__plugin_spec-workflow-mcp_spec-workflow__harness`,
   `mcp__plugin_spec-workflow-mcp-with-dashboard_spec-workflow__harness`) in its `tools:`
   list." Lands with P2.
   Target: `.spec-workflow/agent-rules.md` (or the harness agent-authoring note).

2. **One run-state id per run; nothing rewrites it mid-run.** F3 ↔ harness-bookkeeping F6
   ↔ spec-lint F10, three occurrences (sub-orchestrator here, peer supervisor and
   pointer overwrite elsewhere). Rule text, for the orchestrator contract in
   `sdd-continue/references/formats.md`: "The supervisor sets the run id once at
   `run.start`; an orchestrator reuses the exported `EVENT_SCRIPT` and never writes a new
   run id or `.runid`." The concurrent-store half is harness-bookkeeping P6(a) (a hook
   change).
   Target: harness skills or agents (orchestrator contract), plus P6(a) for the hook.

3. **Decision-log bullets carry no path or identifier tokens.** F4 ↔ harness-bookkeeping
   F11 ↔ spec-lint retro, a lint pass wasted per version on every recent spec. Rule text,
   for the lint-reviser / Revision-History output rule: "A Revision-History or decision-log
   bullet cites findings by id and prose only; it uses no backticked path or identifier
   token, which the citation-identifier rule reads as an absent artifact." The root fix in
   `src/core/lint-citations.ts` (P4(b)) stays on the lint backlog.
   Target: harness skills or agents (lint-reviser brief).

4. **Mark a compounding finding; fix the seam once.** F1 ↔ spec-lint F19/F21 (P21). Rule
   text, for the `sdd-document-phase` review step: "A finding that re-appears against a
   seam a prior round already flagged is labelled `compounds R<k>-<n>`; its fix edits and
   cites both ends of the seam, not one." Lands with P1.
   Target: harness skills or agents (`sdd-document-phase`).

Already graduated, no new rule: F8's "a harness spec's live half waits for a
re-install" is spec-lint P11(a), now in CLAUDE.md's release step.
