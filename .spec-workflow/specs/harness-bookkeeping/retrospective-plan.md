# Retrospective plan — harness-bookkeeping

Status: CLOSED

Decided 2026-09-15 by Matthew Field in the retrospective conversation. The close-out
phase implements every APPROVED proposal below, grouped by target repository and landed
by each repository's rules, then marks this plan CLOSED.

## Decisions made

- **P6/F6 — concurrent run-state pointer → option (a), per-run line.** `active-run` holds
  one line per run (`<main checkout>\t<spec dir>\t<run id>`); the hook picks the line whose
  first field prefixes the hook input's `cwd`; the supervisor appends its line at
  `run.start` and removes it at `run.end`. Carries spec-lint P10(a) forward and lands
  graduation rule 2.
- **P10/F10 — harness prose in the gate line rule → option (a), drop it.** Add
  `harness/skills/`, `harness/agents/` and `references/` `*.md` to a "prose paths" set the
  line-count rule ignores, like the generated and test paths. A verifier still runs when a
  sensitive path or a real source file exceeds the threshold.

## Approved proposals (close-out implements these)

- **P1 (F1) — Mark and probe compounding findings across the design phase too.** Extend the
  reviser rule (`sdd-reviser.md:25`): a reviewer finding in text a previous delta wrote
  carries `Compounds: R<A-1>-<n>`; for such a finding the reviser writes one plain sentence
  of what the code/design must do, deletes the old text, and probes the new claim as round 1
  would. Applies to reviewer and reviser in every phase.
  Target: harness skills or agents. Effort: S. Risk: low. Lands graduation rule 1.

- **P3 (F3) — Tighten `classifyTarget`.** Match the `byClass` breakdown on the leading token
  of the `Target:` value, not the whole `Target + Decision` haystack, so the close-out
  breakdown cannot misfile an item.
  Target: product code (`src/tools/harness.ts:429`), plus a test. Effort: S. Risk: low.

- **P4 (F4) — The retro skill runs one shell command per line.** Add to
  `sdd-retrospective/SKILL.md`, next to spec-lint's `git-log.sh` rule: "Run each `ls`,
  `grep` or `cat` as its own Bash line. The worktree guard refuses a compound line (`&&`,
  `;`, or a name that could be `git`); never combine listings."
  Target: harness skills or agents. Effort: S. Risk: low. Lands graduation rule 4.

- **P5 (F5) — Stop declaring tools the retro session does not provide.** Drop `Grep` and
  `Glob` from the `sdd-retro-analyst` and `sdd-retro-orchestrator` `tools:` frontmatter and
  add one skill line: "Search content with `grep` in Bash; there is no Grep tool here."
  Target: harness skills or agents. Effort: S. Risk: low.

- **P6 (F6) — One run-state pointer per concurrent run.** Implement decision P6(a) above in
  `harness/hooks/` and the supervisor skill.
  Target: harness skills or agents (`harness/hooks/`, sensitive; the ledger is a must-keep).
  Effort: M. Risk: medium (a hook change). Lands graduation rule 2.

- **P7 (F7) — `tests-not-touched` fires only when the task touched a source file.** In
  `scoreRisk` (`gate-rules.ts:260`) require, in addition to `taskNamesTests(block)` and no
  touched test path, that some touched path is a non-test, non-generated source file under
  `src/`. A docs-only task then cannot trip the rule.
  Target: server code (`src/core/gate-rules.ts`), plus a test. Effort: S. Risk: low. Lands
  graduation rule 3.

- **P8 (F8) — The gate `files` list is individual paths, never a directory.** State in the
  review-gate call rule (`sdd-implementation-phase/SKILL.md` and the orchestrator brief):
  "`files` is the exact per-file paths the task changed, from the diff — never a directory."
  Optionally the gate rejects a directory path with a clear message.
  Target: harness skills or agents. Effort: S. Risk: low.

- **P10 (F10) — Harness prose dropped from the line rule.** Implement decision P10(a) above.
  Target: server code (`gate-rules.ts`) and `agent-rules.md`. Effort: S. Risk: medium.

## Graduation candidates that land with this plan

1. Mark and probe compounding findings — with P1.
2. Concurrent runs must not share one run-state pointer (per-run line) — with P6(a).
3. A no-code task carries no test or verifier obligation — with P7.
4. The worktree/retro session runs one plain command per line — with P4.

## Not approved this round

- **P11 (F11) — spec-lint citation false-positive tuning.** Not approved now. Reason:
  the fix is in the lint citation rules, not this harness; deferred to the spec-lint
  backlog rather than implemented in this close-out. Effort M.
- **P17 (F17) — schedule the R7 human question-gates spec.** Not approved as a close-out
  action. Reason: it is a whole new SDD spec (project memory already records that R7 must
  run as its own spec), not a change the close-out phase should land. Tracked separately.

## No change (wins and already-scoped items, no action)

P2 (SHOULD_FIX-only checker route worked), P9 (gate working; residual was P10),
P12 (resolve in the deferred D2 briefs port), P13 (count-word rule worked),
P14 (opus override is the credit-exhaustion fallback), P15 (no drafter v1 ground errors),
P16 (zero rulings/adjudications; two recorded observations), P18 (PR-body cut-scope worked),
P19 (codified verification-deferral rule worked).

## Human verification owed after the next release (not close-out work)

- `d-324dbe0d` (this spec): run a live `harness orient` MCP call and confirm the hooks write
  `spawn.start`/`spawn.end` on a real spawn, after the release republishes and the plugin is
  re-installed.
- `d-473aa261` (spec-lint): run the document-phase Lint step on the spec-lint fixture after
  the plugin re-install.

## Close-out

One line per proposal, written by the close-out phase.

- P1: done — 347e771
- P3: to-do (human) — target `src/tools/harness.ts` is created by open PR #41
  (`feat/harness-bookkeeping`) and is absent from main; land after #41 merges.
- P4: done — ef5fc45
- P5: done — fa86052
- P6: to-do (human) — targets `harness/hooks/sdd-activity.sh` and
  `harness/skills/sdd-continue/SKILL.md`, both rewritten by open PR #41; land after #41 merges.
- P7: done — 39cbf92
- P8: to-do (human) — the gate `files` rule lives in
  `harness/skills/sdd-implementation-phase/SKILL.md`, rewritten by open PR #41; land after
  #41 merges.
- P10: done — 136fdc8 (`gate-rules.ts` prose-paths rule) + f60c6aa (`agent-rules.md`
  `## Prose paths`). Runtime wiring in `review-gate.ts` is deferred: d-4c9198e3.
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/42
