# Retrospective log — agent-cache-ttl

## 2026-09-24T16:02:46Z · requirements · phase · cleanup
requirements approved at v4 after 3 rounds (2 adversarial + 1 narrow check); verdict trajectory 1/2/3 → 0/2/1 → VERIFIED 3/3 (SHOULD_FIX-only corrective pass at v4); rulings 0; cap not hit; prune removed 0 records and 0 snapshots (2 snapshots kept). Gate A revision (MODE revision): RI-1 made the live verification scenarios (1),(2),(3),(5) non-deferrable and block-until-restart; R1-1 reconciled the pre/post-merge deadlock the literal wording created; R2-1/R2-2 fixed two truth-table contradictions in the unknown-cache rule (all-DeepSeek total, gap-only-unknown cell) introduced by the R1-3 fix; R2-3 named the verification-evidence.md artifact.
Evidence: approval_1790265698477_k4x8xi0qt; .spec-workflow/specs/agent-cache-ttl/reviews/adversarial-analysis-requirements-r2.md
Cost: 2 reviewer + 1 checker + 6 reviser spawns

## 2026-09-24T16:45:35Z · design · round 1 · gotcha
Round 1 converged on v1 (after lint): MUST_FIX 0 / SHOULD_FIX 0 / MINOR 3, DESIGN_READY yes. All four drafter RE-DECIDED literals (Req 1.5, 5.2.5, 6.2, 6.7) ruled refinement/closed by the reviewer. Pre-merge live-verification (C8) confirmed to exercise the branch's cacheTtl frontmatter.
Evidence: .spec-workflow/specs/agent-cache-ttl/reviews/adversarial-analysis-design.md
Cost: 1 reviewer spawn

## 2026-09-24T16:46:50Z · design · phase · cleanup
design approved at v1 after 1 round; verdict trajectory converged 0/0/3; rulings 0; cap not hit; prune removed 0 records and 0 snapshots.
Evidence: approval_1790268343061_7gv3iwvqs; .spec-workflow/specs/agent-cache-ttl/reviews/adversarial-analysis-design.md
Cost: 1 reviewer + 1 reviser (lint) spawns

## 2026-09-24T17:20:11Z · tasks · v1 · gotcha
Round 1 converged 0/0/2 (MINOR only). Three drafter RE-DECIDED design literals all ruled refinement/closed by the reviewer: C3/D5 render pad Math.max(23,len+1) vs fixed 24; Testing Strategy keyless-profile case moved to the loader test; C8 recompute.mjs falls back to ~/.claude/projects, missing transcript fails the row. Gate B and Gate C empty.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer spawn

## 2026-09-24T17:20:51Z · tasks · phase · cleanup
tasks approved at v1 after 1 round; verdict trajectory converged 0/0/2 (MINOR only); rulings 0 (three drafter RE-DECIDED design literals ruled refinement/closed by the reviewer); cap not hit; prune removed 0 records and 0 snapshots (2 kept).
Evidence: approval_1790270412051_s3dxtizxo; /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/reviews/adversarial-analysis-tasks.md
Cost: 1 reviewer + 1 reviser spawns

## 2026-09-24T19:05:03Z · implementation · task 1 · gotcha
Profile builder cacheTtl key: gate pass risk low, 1 implementer spawn, 0 fix rounds. harness/agent-profiles.json is not mirrored into plugins/, so no plugin copies changed.
Evidence: task 1; commit 6723ffe; reviewId b3f495a9
Cost: 1 implementer spawn

## 2026-09-24T19:08:22Z · implementation · task 2 · gotcha
One-hour cacheTtl in three orchestrator frontmatters: gate pass risk low, 1 spawn, 0 fix rounds.
Evidence: task 2; commit 7064099; reviewId fa8a5fc2
Cost: 1 implementer spawn

## 2026-09-24T19:11:54Z · implementation · task 3 · gotcha
Watch view declared lifetime: gate pass risk low, 1 spawn, 0 fix rounds. Pad Math.max(23,len+1) keeps default lines at 23.
Evidence: task 3; commit 129f350; reviewId d672df5f
Cost: 1 implementer spawn

## 2026-09-24T19:22:01Z · implementation · task 4 · gotcha
Hook spawn.end cache fields (design C4): high risk sensitive path harness/hooks/; gate pass then verifier VERDICT pass, 0 findings. 1 implementer + 1 verifier spawn.
Evidence: task 4; commit 20fe4e4
Cost: 1 implementer + 1 verifier spawn

## 2026-09-24T19:31:01Z · implementation · task 5 · gotcha
Usage fold cache columns (design C5): gate pass risk low, 1 spawn, 0 fix rounds.
Evidence: task 5; commit e6ea481; reviewId 1b7f59f1
Cost: 1 implementer spawn

## 2026-09-24T19:36:12Z · implementation · task 6 · gotcha
Override probe script sdd-cache-ttl.sh (design C6): gate pass risk low, 1 spawn, 0 fix rounds.
Evidence: task 6; commit 7fde05a; reviewId bce4762e
Cost: 1 implementer spawn

## 2026-09-24T19:44:11Z · implementation · task 7 · gotcha
Verification-only task (design C8 kit + pending evidence file): no gate, no verifier (retro P15, verifier-skipped by policy). Checks bash -n, node --check, grep -c 4 passed. Evidence committed in spec store.
Evidence: task 7; evidence commit 73c2d45; logged yes/7
Cost: 1 implementer spawn

## 2026-09-24T19:48:13Z · implementation · task 8 · gotcha
Supervisor cacheTtl record + retro block on unpassed evidence (design C7): gate pass risk low, 1 spawn, 0 fix rounds.
Evidence: task 8; commit e57d84c; reviewId 9bbf1f52
Cost: 1 implementer spawn

## 2026-09-24T20:01:41Z · implementation · task 9 · gotcha
End-to-end verification (scenarios 4+6): verifier VERIFY pass, full suite green (1464 passed/2 skipped). Verification-only, logged via a short log spawn (P9). Scenarios 1/2/3/5 stay pending for operator pre-merge C8 run, no deferral (D10). Only one spec-run transcript carries ephemeral fields, paired with a second real project transcript for scenario 4.
Evidence: task 9; verify-e2e.md; commit e57d84c
Cost: 1 verifier + 1 log spawn

## 2026-09-24T20:02:32Z · implementation · phase · cleanup
agent-cache-ttl implemented: 9/9 tasks, 0 fix rounds, 0 adjudications, 1 high-risk verifier (task 4) + 1 end-to-end verifier + 1 log spawn. 11 worker spawns total (8 implement + 1 verify + 1 e2e + 1 log). 0 deferrals added. Live scenarios 1/2/3/5 pending in evidence file (D10 blocks retro).
Evidence: 9 task.done events; commits 6723ffe..e57d84c; evidence 73c2d45
Cost: 8 implementer + 2 verifier + 1 log spawn

## 2026-09-24T20:42:08Z · implementation · phase · harness-defect
C8 live check scenario 1 failed to start: e2e-setup.sh created specs/cache-gap-probe/ in the scratch store at setup, spec-index saw an incomplete spec not in decomposition.md, routing returned ambiguous and the supervisor refused to pick a spec (scenario 5 would hit the same). Overwatch wrote deferred.json into cache-gap-probe (routing all-deferred, fallback picks cache-probe) and patched e2e-setup.sh to write the marker. Lesson: a scratch store for a live check must mark every non-roadmap spec folder deferred.
Evidence: /tmp/scratchpad/sdd/agent-cache-ttl/e2e-setup.sh; overwatch report 2026-09-24
Cost: one failed scenario-1 launch

## 2026-09-24T21:04:59Z · implementation · phase · harness-defect
Every harness/agents/sdd-*.md frontmatter has been invalid YAML since the agents were written: the unquoted description contains ': '. Claude Code 2.1.282 still reads name/model/effort/tools but silently drops the experimental mapping, so live scenario 1 wrote cw1h 0 / cw5m 49204. A/B by overwatch: same frontmatter, description double-quoted, gave cw1h 33242 / cw5m 0. Fixed on PR #64: all 12 descriptions quoted, sync-plugin-assets fails on invalid agent frontmatter (unit test), launcher unquotes the description.
Evidence: commit 91d11aa on feat/agent-cache-ttl; overwatch A/B 2026-09-24
Cost: one failed scenario-1 run; one supervisor fix commit

## 2026-09-24T21:04:59Z · implementation · phase · gotcha
Design lesson: live scenario (1) caught the invalid-YAML frontmatter; the unit tests passed because sync-plugin-assets.cjs used its own lenient line parser, which reads what Claude Code drops. Blocking the PR on the live checks (gate A) paid off. Skill SKILL.md descriptions carry the same unquoted ': ' pattern and are not yet checked.
Evidence: scripts/sync-plugin-assets.cjs buildProfiles; gate A decision 1
Cost: none beyond the failed run

## 2026-09-24T21:27:42Z · implementation · phase · harness-defect
Since PR #62 P17 the SubagentStop marker let only the first SubagentStop of a spawn write spawn.end. An orchestrator with background children yields, fires SubagentStop, resumes and keeps working, so its row held its usage at the first yield: scenario (3) rows matched the transcript only up to the row ts (49204/0 then 6 unrecorded calls; 0/61425 then 4), below the full recompute (53309, 62199). Every orchestrator token figure since P17 is an undercount. Fixed on PR #64: the hook writes a new spawn.end with agentId whenever usage changed, usage.ts and ledger.ts keep the latest row per agentId, recompute.mjs compares only the latest row.
Evidence: commit 59a6374 on feat/agent-cache-ttl; overwatch scenario (3) evidence 2026-09-24
Cost: two scenario runs; one supervisor fix commit

## 2026-09-25T00:20:24Z · implementation · phase · gotcha
C8 live scenario (2) failed to start: Agent type sdd-cache-probe not found. e2e-setup.sh wrote sdd-cache-probe.md and sdd-cache-probe-worker.md with no description line, and Claude Code does not register an agent without one. Overwatch added quoted descriptions to both scratch files and patched e2e-setup.sh. Lesson (third of its kind this spec): generated fixture files need the same validity checks as shipped ones — valid YAML, a description, no stray spec folders. Status at this entry: (1) and (3) pass on 59a6374 (orchestrator cw1h 124970 / cw5m 0; 3 rows equal to recompute); (2) and (5) pending.
Evidence: /tmp/scratchpad/sdd/agent-cache-ttl/e2e-setup.sh; overwatch report 2026-09-24
Cost: one failed scenario-2 launch

## 2026-09-25T00:33:28Z · implementation · phase · gotcha
C8 scenario (2) probe finished in 40 s with a 35 s gap: it spawned its worker in the foreground, but Claude Code 2.1.282 backgrounds subagent spawns, so the probe replied DONE without waiting; a Bash sleep cannot make one gap over 600 s either (tool timeout caps at 600000 ms). Overwatch changed the scratch probe body and e2e-setup.sh to the real orchestrator pattern: spawn the worker, end the turn, wait for the completion notification, then reply DONE — the yield-and-wake gap the one-hour TTL targets. Lesson: a live probe must reproduce the real wait pattern; foreground spawn and long sleeps are not available.
Evidence: /tmp/scratchpad/sdd/agent-cache-ttl/e2e-setup.sh; overwatch report 2026-09-24
Cost: one scenario-2 run with a too-short gap

## 2026-09-25T15:31:22Z · implementation · phase · ruling
Amendment, approved by Matthew: the scenario (2) pass bar changes from reading the whole previous prefix to reading the content older than the last turn. Measured: content older than the last turn read 100% after an 819 s gap, gapRewrites 0; the whole-prefix read was 80% because the last turn is re-sent on subagent resume. The scratch recompute.mjs now measures older-than-last-turn. All four live scenarios passed (evidence produced headless by overwatch after Matthew's scratch login); verification-evidence.md committed as a615375; PR #64 merged as 12cb20f.
Evidence: a615375 (verification-evidence.md); 12cb20f (PR #64 merge); overwatch report 2026-09-25
Cost: scenario (2) run three times
