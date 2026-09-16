# Retrospective proposals — harness-bookkeeping

Written 2026-09-15 by the retro analyst from retrospective.md.

Third spec in this store. Several spec-lint rules have since landed and held here:
`## Generated paths`, `## Sensitive paths`, `worktree-setup: npm ci`, the `## Git`
worktree bullet, source-lines-only counting (P14), the verification-only-task skip
(P3), and the CLAUDE.md `deferrals list tag=verification` release step. Findings below
mark where a landed rule still leaves a gap. Nothing reverts.

## Proposals

- **P1 (F1) — Mark and probe compounding findings across the design phase too.** The
  design r2 MUST_FIX was the r1 fix relocating the same fold defect (prompt-launched
  worker → wrong brief node). Reviser agent rule (`sdd-reviser.md:25`) already forbids
  rewording an unproven claim; extend it: a reviewer finding in text a previous delta
  wrote carries `Compounds: R<A-1>-<n>`, and for such a finding the reviser writes one
  plain sentence of what the code/design must do, deletes the old text, and probes the
  new claim as round 1 would. Applies to reviewer and reviser in every phase, not just
  documents. This is spec-lint P21 promoted after a third recurrence.
  Target: harness skills or agents. Effort: S. Risk: low: narrows rework, adds no round.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — No change; a win to report.** Two phases closed a SHOULD_FIX-only round
  with an `sdd-checker` narrow check instead of a 4th reviewer spawn, saving ~2 reviewer
  rounds. This is the review-gate F12/P12 route working a second time; the corrective
  pass is doing its job.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P3 (F3) — Tighten `classifyTarget`, or accept.** The `byClass` regexes match bare
  `store`, `rules`, `docs`, `code`, `repo` anywhere in `Target:`/`Decision:`, so the
  close-out breakdown can misfile an item. It does not touch `nextStep` routing (driven
  only by `byClass.none > 0`), and the task-2 verifier logged it non-blocking. Smallest
  real fix: match on the leading token of the `Target:` value, not the whole `Target +
  Decision` haystack. Given it is display-only, accept is defensible.
  Target: product code (`src/tools/harness.ts:429`). Effort: S. Risk: low: cosmetic
  field. Prerequisites: none.
  DECISION NEEDED: no.

- **P4 (F4) — The retro skill runs one shell command per line.** The worktree guard
  refuses a compound listing (and refused one again in this run). Add to
  `sdd-retrospective/SKILL.md`, next to spec-lint's `git-log.sh` rule: "Run each `ls`,
  `grep` or `cat` as its own Bash line. The worktree guard refuses a compound line
  (`&&`, `;`, or a name that could be `git`); never combine listings." This is the
  agent-rules `## Git` graduation extended to the retro session.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — Stop declaring tools the retro session does not provide.** The
  `sdd-retro-analyst` and `sdd-retro-orchestrator` frontmatter list `Grep` and `Glob`,
  but the session provides only Read, Bash, Write; a `Grep` call returns "No such tool
  available". Drop `Grep` and `Glob` from both agents' `tools:` and add one skill line:
  "Search content with `grep` in Bash; there is no Grep tool here." Keeps the declared
  toolset honest.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P6 (F6) — One run-state pointer per concurrent run.** A peer supervisor in session
  `spec-workflow-mcp-33` rewrote `event.sh`/`.runid` mid-tasks, splitting 25 events over
  two run ids. The hook still reads one global pointer (spec-lint F10, same class,
  unbuilt). This is now a second occurrence and blocks clean `--watch` grouping the moment
  two stores run at once.
  Target: harness skills or agents (`harness/hooks/`, sensitive; the ledger is a
  must-keep). Effort: M. Risk: medium: a hook change. Prerequisites: none.
  DECISION NEEDED: yes. How do concurrent runs share the pointer?
  (a) *(recommended)* `active-run` holds one line per run, `<main checkout>\t<spec
  dir>\t<run id>`; the hook picks the line whose first field is a prefix of the hook
  input's `cwd`; the supervisor appends at `run.start`, removes at `run.end`. Carries
  spec-lint P10(a) forward.
  (b) Keep one file; the supervisor rewrites it before every orchestrator spawn — cheap,
  but events still cross stores during an overlap.
  (c) A rule forbidding two harness runs at once — cheapest, loses concurrency.

- **P7 (F7) — `tests-not-touched` fires only when the task touched code.** Task 8 was a
  docs + HANDOFF change; its block held the word "test" and no test path changed, so the
  gate scored `high` and drew an empty verifier. The verification-only skip (P3) missed it
  because `docs/` is under `CODE_ROOT`. In `scoreRisk` (`gate-rules.ts:260`) require, in
  addition to `taskNamesTests(block)` and no touched test path, that some touched path is a
  source file (non-test, non-generated, under `src/`). A docs-only task then cannot trip
  the rule. Spec-lint F3 → F7, second occurrence.
  Target: server code (`src/core/gate-rules.ts`), plus a test. Effort: S. Risk: low: a
  docs task carries no test obligation. Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — The gate `files` list is individual paths, never a directory.** The task-7
  orchestrator passed `plugins` (a directory) to `files` and drew a spurious `fail`; a
  clean re-run followed. In the review-gate call rule (`sdd-implementation-phase/SKILL.md`
  and the orchestrator brief), state: "`files` is the exact per-file paths the task
  changed, from the diff — never a directory." Optionally the gate rejects a directory
  path with a clear message rather than mis-scoring.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P9 (F9) — No new change; the gate is working, the residual is F10.** Tasks 1, 3, 6
  correctly went gate-only; the 5 verifier spawns are the high-line-count harness tasks.
  Source-lines-only (P14) and generated-paths (P2) already landed. The remaining lever is
  P10; nothing else makes these cheaper without dropping coverage on genuinely large
  edits.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: P10.
  DECISION NEEDED: no.

- **P10 (F10) — Harness prose is large but unverifiable; decide whether it counts.** With
  `plugins/` already excluded (P2), a harness task's line count is still dominated by
  `harness/` skill and agent Markdown — prose a verifier cannot typecheck or test. Task 7's
  ~160 net lines still scored `high`. review-gate F2, spec-lint F2 → F10.
  Target: server code (`gate-rules.ts`) and `agent-rules.md`. Effort: S. Risk: medium:
  fewer verifier reads on doc-heavy harness edits. Prerequisites: none.
  DECISION NEEDED: yes. Should `harness/**/*.md` count toward the line rule?
  (a) *(recommended)* Add `harness/skills/`, `harness/agents/` and `references/` `*.md` to
  a "prose paths" set the line rule drops (like generated/test paths); a verifier still
  runs when a sensitive path or real source exceeds the threshold. Cuts F9's empty spawns.
  (b) Keep counting; accept 5/8 as the floor for a harness spec — a reviewer still reads
  the prose in the document phase, not the verifier.
  (c) Raise the threshold for tasks whose only source is `harness/` prose.

- **P11 (F11) — No harness change; this is a lint-rule tuning already scoped.** The
  citation-identifier rule flagged backticked plain words and design-coined field names as
  absent artifacts (~26–49/version) and re-flagged bare `render.ts`. The fix is in the
  lint citation rules (allow backticked words that are not path-like or that the design
  defines), not the harness. Log it against the lint spec's backlog.
  Target: server code (lint citation rules). Effort: M. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P12 (F12) — No change; resolve in the D2 briefs port.** Close-out and fix-round briefs
  carry no `taskId`, so the server `implementer` template (needs taskId/taskBlock) does not
  fit them; the task-7 implementer mapped them to `reviser`/`adjudicator`, which is correct.
  Fold the mapping note into the deferred D2 `briefs.md`-port follow-up.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: D2.
  DECISION NEEDED: no.

- **P13 (F13) — No change; the `## Documents` count-word rule worked.** The 13→14 tool
  count was caught as design r3 MINOR R3-1 and fixed in task 8, exactly the class that rule
  (review-gate G2) covers.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P14 (F14) — Accept the opus override as the credit-exhaustion fallback.** Fable ran out
  of credits, so every SDD agent ran on opus via override and one drafter re-spawned. The
  override behaved as the designed fallback; the run finished. No harness change beyond
  keeping an eye on credits.
  Target: CLAUDE.md, memory or settings. Effort: none. Risk: low: opus token rates.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P15 (F15) — No change; an improvement to report.** The drafter misstated no code
  artifact in any v1; the review-gate F18 / spec-lint F20 "ground error in v1" pattern did
  not recur.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P16 (F16) — No change.** Zero rulings, adjudications, escalations, cap hits; both
  corrective passes were SHOULD_FIX-only routes. The two deferred narrow-check observations
  (task-7 done-condition grep skips the `resume` row; design Component 7's `:180-199`
  citation is a loose superset) are recorded and cost nothing.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P17 (F17) — No harness change; schedule the R7 spec.** Three agent-side approvals, no
  human contact start-to-PR. review-gate F21, spec-lint F24 → F17. Per project memory the
  R7 question gates are underspecified and must run as their own SDD spec, not by hand.
  Target: project steering, templates or decomposition conventions. Effort: L (own spec).
  Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P18 (F18) — No change; the PR-body mechanism worked.** Two agent scope cuts (D2, D4)
  reached HANDOFF and the PR body's "Not in this PR" bullet, exactly what spec-lint
  P22/P25 built. review-gate F22, spec-lint F25 → F18.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P19 (F19) — No change; the codified rule worked.** The live-plugin verification was
  deferred as `d-324dbe0d` (tag `verification`), and CLAUDE.md's release step already tells
  the human to run `deferrals list tag=verification` and resolve each. spec-lint F11/F23 →
  F19, now codified and holding. The owed manual run blocks step-3 of the plan, as designed.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

## Graduation candidates

Patterns in two or more specs' findings, with the rule text and its home.

1. **Mark and probe compounding findings.** review-gate F19 → spec-lint F21 → F1 (three
   specs). For the reviewer agent rules: "A finding in text a previous delta wrote carries
   `Compounds: R<A-1>-<n>`." For `sdd-reviser.md`, next to the reword rule: "For a
   `Compounds:` finding, write one plain sentence of what the artifact must do, delete the
   old text, and probe the new claim as round 1 would; a claim you cannot probe is deleted,
   not kept." Applies to documents and design. Lands with P1.

2. **Concurrent runs must not share one run-state pointer.** spec-lint F10 → F6 (two
   specs). For `harness/hooks/` and the supervisor skill: "The active-run pointer holds one
   line per run, `<main checkout>\t<spec dir>\t<run id>`; the hook picks the line whose
   first field prefixes the hook input's `cwd`; the supervisor appends its line at
   `run.start` and removes it at `run.end`." Lands with P6(a).

3. **A no-code task carries no test or verifier obligation.** spec-lint F3 → F7 (two
   specs). For `gate-rules.ts` (behaviour, mirrored in `agent-rules.md` `## Checks`): "The
   `tests-not-touched` rule fires only when the task touched a source file under `src/`; a
   docs-only or verification-only task never trips it." Lands with P7.

4. **The worktree/retro session runs one plain command per line.** review-gate F5 →
   spec-lint F7/F8 → F4 (three specs). The agent-rules `## Git` bullet already carries this
   for implementation; extend it to `sdd-retrospective/SKILL.md`: "Run each shell command
   on its own line; the guard refuses a compound line or a name that could be `git`." Lands
   with P4.

Not graduated: harness-prose line count (F10) is one spec with a landed generated-paths
rule and is P10's decision; agent-side approvals (F17) are the R7 spec, not a rule.
