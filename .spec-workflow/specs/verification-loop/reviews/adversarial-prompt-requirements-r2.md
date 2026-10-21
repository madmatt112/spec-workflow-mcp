# Adversarial Review — verification-loop/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp/.claude/worktrees/verification-loop
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-memory-requirements.md using this format:

```markdown
# Adversarial Review Memory — requirements
Last updated: <today's date> (after v2 review)

## Cumulative Findings Summary
### Accepted
- <finding>: <brief description, which version identified it>

### Partially Accepted
- <finding>: <brief description, user's stance>

### Rejected
- <finding>: <brief description, reason for rejection>

### Unresolved
- <finding>: <not yet responded to>

## Patterns & Themes
- <high-level observations about recurring issues>

## Guidance for Next Review
- Focus areas based on what's been found
- Areas that have been well-covered and don't need re-examination
```

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Completeness, ambiguity, scope

**Example attack angles to consider:** Missing user stories, unstated assumptions, scope creep risk, contradictions between stories, acceptance criteria that can't be tested

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Standing directives

- Ground every claim in the real codebase. Read the files the document cites before you judge them. A misstated artifact (wrong path, wrong line range, wrong signature, wrong behaviour) is an automatic MUST_FIX.
- Attack the deltas since the previous version first, then apply one fresh lens the prior rounds did not use.
- Rulings recorded in the document's Revision History are closed. Do not re-open them.
- Do not pad. MINOR-only findings do not keep the loop alive. A clean round is a valid result: show your work (what you checked and how) and say converged.
- Severity: MUST_FIX = contradiction, false claim about the codebase, unimplementable requirement, data or security hole. SHOULD_FIX = a real gap that causes rework or a wrong implementation. MINOR = wording, a value safely left to a later phase, nice-to-have.
- ESCALATE only when a human should look now: security, secrets, auth bypass, data loss, destructive migrations, money, billing, pricing, legal or compliance. Otherwise write `ESCALATE: none`.

## Verdict block

End the analysis file with exactly this block, values filled in:

```
VERDICT: converged | iterate
MUST_FIX: <n>
SHOULD_FIX: <n>
MINOR: <n>
DESIGN_READY: yes | no
ESCALATE: none | <one-line reason a human should look now>
```

`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/codebase-context.md` first; it maps the code this document cites.
  Start your code reads from it.
- Version under review: v2.
- Changes: the diff from the newest commit whose subject holds `docs(sdd): verification-loop requirements v1` to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.
- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Fresh lens for this round: none
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/verification-loop/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp/.claude/worktrees/verification-loop`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.

## Report

End with this block, at most 8 lines; the whole report is at most 80 words; put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.

- verdict:
- escalate:
- analysis:

## Changes since d606690

````diff
diff --git a/.spec-workflow/specs/verification-loop/requirements.md b/.spec-workflow/specs/verification-loop/requirements.md
index f8e07d8..d91b9a1 100644
--- a/.spec-workflow/specs/verification-loop/requirements.md
+++ b/.spec-workflow/specs/verification-loop/requirements.md
@@ -6,7 +6,7 @@ This spec makes a controller run fix its own red or conflicted pull request, run
 
 ## Alignment with Product Vision
 
-The steering directory holds no `product.md`, so this section aligns with the 2026-10-20 grill instead (`docs/ai-resources-catalogue.md:125-163`). Grill decision 1 puts verification first and allows token items only where they are nearly free; R1 and R3 add verification, R2 is the nearly free token item. ADR 0003 stays true: the merge rule is code and a model never merges (`docs/adr/0003-merge-by-rule.md:12-14`).
+The steering directory holds no `product.md`, so this section aligns with the 2026-10-20 grill instead (`docs/ai-resources-catalogue.md:125-163`). Grill decision 1 puts verification first and allows token items only where they are nearly free; R1 and R3 add verification, R4 adds verification visibility, and R2 is the nearly free token item. ADR 0003 stays true: the merge rule is code and a model never merges (`docs/adr/0003-merge-by-rule.md:12-14`).
 
 ## Requirements
 
@@ -18,14 +18,14 @@ Today a PR that fails the rule with nothing in flight is `blocked` (`src/control
 
 #### Acceptance Criteria
 
-1. WHEN the merge stage of the run's own PR returns `blocked` AND every blocking reason is a failed workflow run, a failed commit status, or a merge conflict (`mergeable` is `CONFLICTING`) AND the run has used fewer than 2 merge fix rounds THEN the controller SHALL run one `sdd-implementer` fix round instead of opening the `error` wait.
+1. WHEN the merge stage of the run's own PR returns `blocked` AND the run has used fewer than 2 merge fix rounds AND every blocking reason is a failed workflow run, a failed commit status, or a merge conflict (`mergeable` is `CONFLICTING`) THEN the controller SHALL run one `sdd-implementer` fix round instead of opening the `error` wait. The merge evaluation SHALL tag each blocking reason with a structured kind (`check`, `conflict`, `trailer`, `head` or `other`) from the signals it already computes (`src/controller/merge.ts:361-405`); criteria 1 and 8 classify from that kind, not by matching the reason's text.
 2. WHEN a merge fix round runs THEN it SHALL run in the run's worktree on the PR branch, and its brief SHALL name each failing check with the saved log tail of its workflow run (as `prChecksGate` saves them, `src/controller/phases/implementation.ts:1069-1126`) and, for a conflict, say that the branch conflicts with the default branch.
 3. WHEN a merge fix round resolves a conflict THEN the implementer SHALL merge the default branch into the PR branch; the controller SHALL NOT rewrite pushed history and SHALL NOT force-push.
 4. WHEN a merge fix round ends with a new commit on the PR branch THEN the controller SHALL push the branch and set the run to `merging` with a re-check time, so the next merge pass reads the new CI state (`src/controller/runs.ts:666-668`).
-5. WHEN the implementer of a merge fix round reports `INFRA:` THEN the controller SHALL re-run the failed workflow runs (as `src/controller/phases/implementation.ts:1143-1148` does) and the round SHALL count toward the cap.
+5. WHEN the implementer of a merge fix round reports `INFRA:` THEN the controller SHALL re-run the failed workflow runs (as `src/controller/phases/implementation.ts:1143-1148` does) and set the run to `merging` with a re-check time so the next merge pass reads the re-run CI state; the round SHALL count toward the cap.
 6. WHEN the implementer of a merge fix round reports `DESIGN-DEFECT:` or `ESCALATE:`, or ends with no new commit and no `INFRA:` THEN the round SHALL count toward the cap and the next merge pass SHALL apply criteria 1 and 7 again.
 7. WHEN the merge stage of the run's own PR returns `blocked` AND the run has used 2 merge fix rounds THEN the controller SHALL open the `error` wait as today, and its text SHALL add that 2 fix rounds ran and the reason each ended.
-8. WHEN the merge stage returns `blocked` AND any blocking reason is an attribution trailer or a wrong head branch THEN the controller SHALL open the `error` wait as today with no fix round.
+8. WHEN the merge stage returns `blocked` AND any blocking reason's kind (AC 1) is `trailer`, `head` or `other` THEN the controller SHALL open the `error` wait as today with no fix round.
 9. The merge fix round count SHALL be read from this run's ledger, so a controller restart, a re-entry or an operator "retry" on the `error` wait does not reset it. A "retry" re-runs the merge pass only.
 10. WHEN a merge fix round starts THEN the ledger SHALL get the spawn rows of the step and one `note` row that names the round number and the blocking reasons.
 11. The merge rule itself SHALL stay model-free: `evaluate` and `mergeByRule` (`src/controller/merge.ts:295-297`, `:568-642`) SHALL run no model step; the fix round is a separate step the run loop starts.
@@ -46,10 +46,10 @@ Today every `sdd-implementer` step runs on the profile model, `claude-opus-4-8`
 4. The flag SHALL be computed by code with the same rule as `harness gate class-a` (`src/tools/harness.ts:1162-1220`) on the `tasks.md` and `## Sensitive paths` list current when the step starts; no model judges it.
 5. IF the project's `agent-rules.md` has no `## Sensitive paths` list THEN no task SHALL be flagged and every task step SHALL take the Sonnet route.
 6. The model SHALL be chosen once per step, at the spawn; a step SHALL NOT change model while it runs, and a resumed step SHALL keep the model it started on.
-7. The Sonnet route's model and effort SHALL be read from `harness/agent-profiles.json`, not written in code; their first values SHALL be `claude-sonnet-5` and `high`. The ten-key, frontmatter-equality and byte-for-byte assertions of `src/__tests__/agent-profiles.test.ts:23-47` SHALL stay green.
-8. WHEN a routed step starts and ends THEN its `spawn.start` and `spawn.end` rows SHALL carry the model and effort the step ran on, not the profile's (`src/controller/phases/implementation.ts:371-381` reads the profile today).
+7. The Sonnet route SHALL read its model and effort from the `sdd-test-author` profile entry of `harness/agent-profiles.json` (`harness/agent-profiles.json:50-55`), not a new key and not values written in code; their first values are therefore `claude-sonnet-5` and `high`. No new key is added, so the ten-key, frontmatter-equality and byte-for-byte assertions of `src/__tests__/agent-profiles.test.ts:23-47` SHALL stay green. A later spec that re-tiers `sdd-test-author` re-routes every non-sensitive implementer step; this coupling is intended.
+8. WHEN a routed step starts THEN its `spawn.start` row SHALL carry the model and effort the step ran on, and its `spawn.end` row SHALL carry that model; neither SHALL carry the profile's (`src/controller/phases/implementation.ts:371-381` reads the profile today). `spawnEnd` has no effort field and SHALL NOT gain one for this (`src/controller/ledger.ts:130-143`).
 9. WHEN a task is picked THEN the ledger SHALL get one `note` row naming the task's route and its reason (the matching sensitive path, or "no sensitive-path flag").
-10. Implementer steps that belong to no task (repair rounds, PR checks reconcile rounds, merge fix rounds of R1) SHALL run on the `sdd-implementer` profile's model and effort.
+10. Implementer steps that belong to no task (repair rounds, PR checks reconcile rounds, merge fix rounds of R1, and R3's security fix rounds) SHALL run on the `sdd-implementer` profile's model and effort.
 11. Invariant (verified, not red-first): the `sdd-test-author`, `sdd-verifier` and `sdd-adjudicator` steps SHALL keep their profile models.
 
 ### Requirement 3 — security pass for sensitive specs (C4)
@@ -66,7 +66,7 @@ Today every `sdd-implementer` step runs on the profile model, `claude-opus-4-8`
 6. WHEN the pass reports one or more findings THEN the controller SHALL run a security fix round on the `sdd-implementer` role whose brief lists the findings, then a narrowed security pass that re-runs only those findings' reproductions; at most 2 such rounds SHALL run.
 7. WHEN findings still reproduce after 2 security fix rounds THEN the controller SHALL run the `sdd-adjudicator` on the open findings, then one narrowed re-check.
 8. WHEN a finding still reproduces after the adjudicator's re-check THEN the controller SHALL open an `escalation` wait that lists each open finding with its reproduce command, with the options `accept`, `retry` and `abandon`.
-9. WHEN the operator answers `accept` THEN the completion gate SHALL continue to the HANDOFF write and the push without running the pass again, and each accepted finding SHALL appear in the HANDOFF Gotchas row, as an unchecked line in the PR body's Test plan, and as a retro-log entry. WHEN the operator answers `retry` THEN the pass and its rounds SHALL run again from round 1.
+9. WHEN the operator answers `accept` THEN the completion gate SHALL continue to the HANDOFF write and the push without running the pass again, and each accepted finding SHALL appear in the HANDOFF Gotchas row, as an unchecked line in the PR body's Test plan, and as a retro-log entry. WHEN the operator answers `retry` THEN the pass and its rounds SHALL run again from round 1. WHEN the operator answers `abandon` THEN the controller SHALL leave the run stopped at the wait with the open findings unresolved and SHALL NOT continue to the HANDOFF write or the push.
 10. WHEN the pass reports a suspicion THEN the controller SHALL create one deferral per suspicion with owner `matthew`, tag `security`, origin spec and phase `implementation`, and a body that holds the suspicion's file and why; a re-entry SHALL NOT create the same deferral twice.
 11. A suspicion SHALL NOT start a fix round, open a wait, or stop the run.
 12. WHEN the pass, a fix round, the adjudicator or the re-check runs THEN the ledger SHALL get its spawn rows and one `note` row with the counts of findings and suspicions.
@@ -78,7 +78,7 @@ Today every `sdd-implementer` step runs on the profile model, `claude-opus-4-8`
 
 #### Acceptance Criteria
 
-1. WHEN the merge pass reads a PR (the run's own or a close-out PR, `src/controller/merge.ts:568-583`) THEN code SHALL list the package names added between the PR's base and head under `dependencies`, `devDependencies`, `peerDependencies` or `optionalDependencies` of any `package.json` in the diff.
+1. WHEN the merge pass reads a PR (the run's own or a close-out PR, `src/controller/merge.ts:568-583`) THEN code SHALL list the package names the head adds, against the merge base of the head and the PR's base branch (the merge-base basis of R3 AC 3), under `dependencies`, `devDependencies`, `peerDependencies` or `optionalDependencies` of any `package.json` in the diff.
 2. A name that is only moved between those four sections, a version change of an existing name, and a lockfile-only change SHALL NOT count as new.
 3. WHEN the list is not empty THEN the `PrRead` the pass saves (`src/controller/state.ts:109-126`) SHALL carry it, and both hand copies (`src/dashboard/shell/types.ts:161-172`, `src/dashboard_frontend/src/modules/shell/types.ts:184-195`) SHALL carry the same field.
 4. WHEN a PR read carries new dependencies THEN its row in the Run page's PR panel (`src/dashboard_frontend/src/modules/shell/RunPage.tsx:345-394`) SHALL show a "new dependency" chip and the package names.
@@ -118,7 +118,7 @@ Today every `sdd-implementer` step runs on the profile model, `claude-opus-4-8`
 - D6 — The source of the sensitive-path flag for model routing: options were recomputing gate B class (a) from the current tasks document, reading the gate-b wait's proposals, or the Check's per-commit risk tier; chosen recomputing because it is deterministic, survives an annotation revision, and works when no gate-b wait exists.
 - D7 — No sensitive-path list means no flag: options were the Sonnet route for all tasks or the Opus tier for all tasks; chosen Sonnet because gate B flags nothing without a list and the Check still raises such commits to high risk.
 - D8 — Implementer steps outside a task keep the Opus tier: options were the role profile, the Sonnet route, or the Opus tier only when the spec has any flag; chosen the profile because repair, reconcile and merge fixes chase integration failures across tasks.
-- D9 — The Sonnet route's model and effort live in the agent profile file with first values Sonnet 5 at high: options were the profile file, hard-coded values, or an agent-rules key; chosen the profile file because it is the designated model source and that pair already runs the test author.
+- D9 — The Sonnet route reads the test author's profile entry, with first values Sonnet 5 at high: options were a dedicated profile key, hard-coded values, or reusing an existing entry; chosen the test author's entry because a new key would break the profile file's ten-key pinning test, that entry already runs the Sonnet 5/high pair, and reusing it keeps the profile file the single model source. Re-tiering the test author deliberately re-tiers these implementers.
 - D10 — The security pass is its own verifier step after the end-to-end verification passes: options were a separate step, a section inside the end-to-end brief, or a step that also fires on sensitive files in the diff; chosen a separate step on gate B flags only because it has its own report shape and the entry scopes it to flagged specs.
 - D11 — Security findings get 2 fix rounds, then the adjudicator, then an escalation wait with accept, retry and abandon: options for the cap were 2 or 3 rounds; chosen 2 to match the completion gate's repair cap.
 - D12 — One deferral per unreproduced suspicion: options were one per suspicion or one per pass; chosen one per suspicion because the deferral loop triages and resolves records one at a time.
@@ -133,9 +133,18 @@ Today every `sdd-implementer` step runs on the profile model, `claude-opus-4-8`
 - Deferred to design: the brief template text for the merge fix and security variants, the ledger row shapes, and the field names in the run record and the profile file.
 - Out of scope by the entry: fix rounds on close-out PRs (R1 AC 12), keyword routing (R2 AC 3).
 - Not in this spec: grill items C2 (parked), C6 and C9 (rejected), C7 and C8 (landed as separate PRs).
-- The steering `product.md` does not exist; the alignment section cites the grill instead.
 
 ## Revision History
 
+- **v2** (2026-10-21) — Round-1 adversarial response (adversarial-analysis-requirements.md, verdict iterate 0/5/3).
+  - **R1-1 — Accepted (SHOULD_FIX).** R2 AC 7 (line 49) now names the test author profile entry as the Sonnet route's source, states no new key is added so the pinning test stays green, and records the intended re-tier coupling; decision D9 updated to match.
+  - **R1-2 — Accepted (SHOULD_FIX).** R1 AC 1 (line 21) now requires the merge evaluation to tag each blocking reason with a structured kind from the signals it already computes, and AC 1 / AC 8 classify from that kind, not the reason text; AC 8 (line 28) widened to kinds trailer, head and other.
+  - **R1-3 — Accepted (SHOULD_FIX).** R2 AC 10 (line 52) adds R3's security fix rounds to the non-task implementer steps that keep the Opus profile.
+  - **R1-4 — Accepted (SHOULD_FIX).** R1 AC 5 (line 25) now sets the run to merging with a re-check time after an INFRA round, so the re-run CI state is read.
+  - **R1-5 — Partially accepted (SHOULD_FIX).** R2 AC 8 (line 50) scopes effort to the spawn.start row and model to both rows rather than add an effort field to the end row, which has none.
+  - **R1-6 — Accepted (MINOR).** R3 AC 9 (line 69) states that abandon leaves the run stopped at the wait with findings unresolved and does not continue to the HANDOFF write or the push.
+  - **R1-7 — Accepted (MINOR).** R4 AC 1 (line 81) now states the merge-base basis, matching R3 AC 3.
+  - **R1-8 — Accepted (MINOR).** The Alignment section (line 9) now maps R4 to grill decision 1 as verification visibility.
+  - **Lint pass.** 0 fixed; rejected: L-1–L-7 (AC-named or newly-introduced terms, none a symbol in the anchored range), L-8–L-11 (package.json keys, suppressed per rule 11, unchanged since v1).
 - **v1** (2026-10-21) — Initial draft.
   - **Lint pass.** 5 fixed; rejected: L-6/L-7/L-8/L-9 (package.json section keys named by the AC, not merge.ts symbols; the citation anchors "the merge pass reads a PR").

````
