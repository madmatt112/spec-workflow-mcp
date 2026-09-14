# Retrospective plan — review-gate

Status: APPROVED
Date: 2026-09-14

All 22 proposals approved as written, with the four decisions below, plus graduation
candidate 2. Nothing rejected. First spec under harness 5.4.0; every 5.4.0 change is kept.

## Approved proposals

- **P1 (F1) — Name the CI runtime in the agent rules.** Add to `agent-rules.md`
  `## Checks`: "CI runs node 20 (`.github/workflows/ci.yml:20`); local node is 24. A test
  that asserts on `child_process`, `fs` or stream behaviour asserts only on fields the
  node 20 docs guarantee, and the design says which."
  Target: project steering (agent-rules.md). Effort: S. Risk: low: a note, no behaviour.
  Prerequisites: none.
  DECISION NEEDED: yes. Should node 20 exist locally? (a) The note only; CI stays the
  proof. **Recommended.** (b) `nvm install 20` and a rule to run `check-runner` and the
  e2e tests under `nvm exec 20`; closes the gap for the price of a runtime. (c) Raise CI
  to node 22; changes the support floor for users, not recommended.
  Decision: (a) note only. Add the CI-runtime note to `agent-rules.md`; CI stays the proof for node 20 behaviour. No local node 20.

- **P2 (F2) — Keep reviewers out of `plugins/` copies.** Extend the `agent-rules.md`
  Layout line: "`plugins/*` are generated copies; never edit them by hand and never read
  or review them: `npm run check:plugin-assets` proves they match `harness/`." Note for
  the next spec: the gate's numstat counts three copies of every `harness/` file, so a
  harness edit of about 50 changed lines crosses `RISK_LINE_THRESHOLD` (200) and always
  gets a verifier; this line keeps that verifier cheap. A generated-path exclusion in the gate is a product
  change to consider only after measurement.
  Target: project steering (agent-rules.md). Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P3 (F3) — Track the spec store in this repo.** Replace `.gitignore:148`
  (`.spec-workflow`) with ignores for `.spec-workflow/.cache/`,
  `.spec-workflow/session.json` and `.spec-workflow/specs/*/harness-activity.jsonl`
  (1.2 MB per spec), then commit the tree once as a baseline. 5.4.0 dropped per-version
  approval snapshots because "versions live in the checkpoint commits"; in this repo those
  commits never happened, so the one-approval design has no history under it.
  Target: CLAUDE.md, memory or settings (repo `.gitignore`). Effort: S. Risk: medium:
  about 150 files and the review history land in the product repo; approval JSON churns.
  Prerequisites: none.
  DECISION NEEDED: yes. What does the product repo track? (a) Everything except cache,
  session and activity files. **Recommended.** (b) Documents, deferrals, decomposition,
  HANDOFF and retrospectives only; `reviews/` and approvals stay untracked. (c) Keep it
  ignored and accept that a mangled document cannot be recovered.
  Decision: (a) track everything except `.spec-workflow/.cache/`, `.spec-workflow/session.json` and `.spec-workflow/specs/*/harness-activity.jsonl`. Lands in HARNESS_REPO (this repository): edit `.gitignore`, then copy the store from `MAIN_CHECKOUT/.spec-workflow` into the worktree (it is ignored there today, so the worktree has no copy) minus those three patterns, and commit it once as the baseline. Class: harness.

- **P4 (F4) — No product change.** The v4 ordering (`rev-parse --show-toplevel` before
  the ref resolve) shipped in PR #29 and produces both outcomes; `runGit` stays private.
  Widening `GitRun` with `code` and `stderr` has no caller today. The round it cost was a
  drafter claim error, covered by P18.
  Target: product code. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — One edit rule for the spec store.** Add to the implementation skill's
  standing rules: "Edit `tasks.md` and HANDOFF with the Edit tool. Never `sed -i` on
  the spec store from a shell line, and never put a heredoc on a shell line; write
  scripts with the Write tool." `cleanup.md:62` already says why.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P6 (F6) — Reject an empty integration object.** In
  `src/tools/log-implementation.ts:278-282`, give the `integrations` item schema
  `required: ['description', 'frontendComponent', 'backendEndpoint', 'dataFlow']`, so
  the tool refuses the object with a clear message instead of the renderer
  (`src/dashboard/implementation-log-manager.ts:420-422`) printing `undefined` four times.
  Target: server code, docs or templates. Effort: S. Risk: low: an implementer that sends
  an empty object retries once with `functions` instead. Prerequisites: none.
  DECISION NEEDED: no.

- **P7 (F7) — Call the ledger the same way everywhere.** The retrospective skill says
  `EVENT_SCRIPT` records the run and "skip it if the script is missing"; make it say
  `bash <EVENT_SCRIPT> <type> key=value ...` like the document and implementation skills,
  and "missing or not readable: skip and say so". No `chmod`.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — Timestamps come from the clock.** In `cleanup.md:29` and the retro-log
  entry format in `sdd-continue/references/formats.md:90`, state: "the timestamp is the
  output of `date -u +%Y-%m-%dT%H:%M:%SZ`, run when you append; never typed from
  memory". Until then the ledger's `round` events are the timing source.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P9 (F9) — Budget matches the cap (tune 5.4.0).** The supervisor sends `BUDGET: 4
  review rounds` for document phases (`sdd-continue/SKILL.md:171`; document-phase
  `## Budget`). Four rounds is the cap; adjudication and the narrow check are not review
  rounds, so one orchestrator spawn covers the whole path. Spawn 1 held three rounds in
  about 100k tokens, so a fourth fits. Saves about 200k tokens, six HANDOFF commits and
  about 35 minutes per spec. The cap stays at v4.
  Target: harness skills or agents. Effort: S. Risk: low: the orchestrator reads only
  verdict blocks, so context growth is small. Prerequisites: none.
  DECISION NEEDED: no.

- **P10 (F10) — The reviser reads the memory's guidance as scope.** In the reviser
  brief Inputs (`briefs.md:166`): "Memory: read `## Guidance for Next Review`. When it
  names another place where an accepted finding's defect occurs, fix that place under
  the same finding's bullet as `also applied to <where>`. This is not widening scope."
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P11 (F11) — Report paths under the code root.** In the implementer standing brief
  report rule (`briefs.md:44`): "files touched one per line, as absolute paths under
  `<CODE_ROOT>`".
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P12 (F12) — A SHOULD_FIX-only round ends with a narrow check (tune 5.4.0).** When a
  round on D ≥ 2 returns `MUST_FIX: 0` and `SHOULD_FIX > 0`, the reviser writes v(D+1),
  then `sdd-checker` (Sonnet) verifies the listed SHOULD_FIX items (Step 4b applied
  early), then Step 5 approves. Round 4 found only MINORs in all three phases, so this
  spec lost nothing; it saves three Opus reviewer spawns (about 357k tokens) per spec.
  Touches Step 0 item 4, Step 2 item 9 and the approval response.
  Target: harness skills or agents. Effort: M. Risk: medium: a SHOULD_FIX fix can
  introduce a claim error that no full review reads; the checker only confirms each
  item was addressed. Prerequisites: none.
  DECISION NEEDED: yes. What closes a phase when only SHOULD_FIX items remain? (a) Keep
  the rule: `SHOULD_FIX: 0` before approval. (b) Reviser plus narrow check, as above.
  **Recommended.** (c) Treat `MUST_FIX: 0` as converged and carry the SHOULD_FIX items
  into the next phase's drafter brief, the Step 4a mechanism, with no revision. (d)
  Lower the cap to v3 and adjudicate at v4.
  Decision: (b) reviser plus narrow check. When a round on D ≥ 2 returns MUST_FIX 0 and SHOULD_FIX > 0, the reviser writes v(D+1), `sdd-checker` verifies the listed items, then Step 5 approves. Update Step 0 item 4, Step 2 item 9, the approval response and `docs/SDD-HARNESS.md`.

- **P13 (F13) — No change; measure.** PR #29 ships the gate and the skill routing
  (`pass` and `risk: low` skip the verifier). Plan step 4 measures it: verifier spawns
  under half of task count. Expect a floor in this repo: every `harness/` task scores
  high through the line rule (P2) and `src/tools/review-task.ts` and `harness/hooks/`
  are on the sensitive list.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: PR #29
  merged and the plugin refreshed.
  DECISION NEEDED: no.

- **P14 (F14) — Keep the Sonnet reviser (5.4.0).** Its volume equals the reviewer's
  because the brief makes it re-verify every citation it touches and probe every
  replacement claim; that work is the point. The saving is against the per-family Max
  plan limits (step-0 answer 4: separate Opus and Sonnet limits), which is what the
  efficiency decisions optimise. Add one line to plan step 4: compare reviser tokens per
  round against the tradr Opus-reviser ledgers, since this store has no baseline.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P15 (F15) — Keep the document-phase shape; take P9 and P12.** Those two cut about
  560k of the 3.86M document tokens and about 35 minutes per spec without touching the
  drafter or rounds 1-3, which produced the tasks precision that gave 10/10 first-pass
  implementation. Judge the trade at plan step 4, not now.
  Target: harness skills or agents. Effort: none beyond P9 and P12. Risk: low.
  Prerequisites: P9, P12.
  DECISION NEEDED: yes. Where should the token weight sit? (a) Keep four-round
  documents, take the P9 and P12 savings, measure. **Recommended.** (b) Cap at v3 and
  rely on the gate and verifier to catch what tasks rounds 3-4 would have. (c) Skip the
  tasks review loop after a design that converged with `SHOULD_FIX: 0`; one round only.
  Decision: (a) keep four-round documents, take P9 and P12, measure at plan step 4. No change beyond P9 and P12.

- **P16 (F16) — No change.** The standing brief's rule (follow the merged code, report
  `RETRO: doc-gap`) worked at zero cost. A drafter rule about count words buys nothing.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P17 (F17) — Keep the context file (5.4.0); let a finding correct it.** Reviser
  rule 7 and the reviewer round section forbid touching `codebase-context.md`, so line
  158 is still wrong and every implementer read it first. Change reviser rule 7: "You
  may replace a context-file line that an accepted finding refutes: same line, corrected
  text, the probe that proves it." Add to the round-1 section: "The context file is
  drafter-written and unreviewed; re-probe any `## Probes` line the document relies on."
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P18 (F18) — No new harness rule.** The drafter brief already requires both-ends
  reads and probes, and Fable at xhigh still misstated four artifacts. The mechanical
  half (range exists, identifier in range) is the `spec-lint` spec (decomposition entry
  5), next in the plan. The semantic half is what round 1 exists to catch.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: spec-lint.
  DECISION NEEDED: no.

- **P19 (F19) — Fix the class, not the instance.** Add reviser disposition rule 9:
  "After you accept a finding, search the document for every other place with the same
  construct (the same rule table, command, fixture shape or union member) and fix each;
  list them under the finding's bullet. A sibling left unchanged is next round's
  finding." Keep the Sonnet reviser; this rule is the cheaper lever, and no Opus baseline
  in this store blames the model.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P20 (F20) — The round-1 reviewer rules on `RE-DECIDED` flags, by rule.** Document
  skill Step 1.3: put each drafter `RE-DECIDED` flag into the round-1 section with
  "Rule on each: `refinement` (closed) or `widening` (a MUST_FIX)". The orchestrator
  copies each ruling into the retro log (`ruling`) and the HANDOFF Rulings row, and the
  next drafter brief's carried section lists them so the tasks drafter stops re-flagging.
  That is what happened this spec by accident; make it the rule.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P21 (F21) — Keep one approval per phase (5.4.0); the human gates are plan step 3.**
  The agent-side approval is a record, not a gate. Gate A (after requirements v1, on the
  `## Decisions taken` list) would have shown D17 and D21-class calls; gate B (after tasks
  approval) shows the cut-scope list. Both are headless-safe by design. No change here.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: plan step 3.
  DECISION NEEDED: no; the 2026-09-13 decisions fixed the two gates.

- **P22 (F22) — Scope cuts reach the PR body.** Implementation skill step 10: the
  `## Summary` gets one bullet "Not in this PR: …" built from the `Cut scope` rows of the
  three document-phase HANDOFF sections; `agent-rules.md` `## PR body` allows it. When
  gate B lands, the same list is what it presents.
  Target: harness skills or agents; project steering (agent-rules.md). Effort: S.
  Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

## Graduation candidates

- **G2 — Put the enumerating command in the task, not the count.** Seen in the earlier
  spec in this repo (HANDOFF "Things worth carrying forward": hand-written site lists
  short in seven places) and here as F16. Add to `agent-rules.md` a new section
  `## Documents` with the rule: "A task that edits a list, or text that states a count or
  a length, gives the command that finds every member (`grep -n …`) and says to update
  the count word."
  Target: project steering (agent-rules.md). Effort: S. Risk: low. Prerequisites: none.
  Decision: approved. Graduation candidate 1 (fix the class, not the instance) is P19 and
  is not a separate item.

## Decisions

- P1 — Should node 20 exist locally? (a) Note only; CI stays the proof.
- P3 — What does the product repo track? (a) Everything except cache, session and
  activity files, committed once as a baseline.
- P12 — What closes a phase when only SHOULD_FIX items remain? (b) Reviser plus narrow
  check by `sdd-checker`, then approve.
- P15 — Where should the token weight sit? (a) Keep four-round documents, take P9 and
  P12, measure at plan step 4.
- Approval set: all 22 proposals plus graduation candidate 2.

## Rejected proposals

None.

## Close-out
One line per proposal, written by the close-out phase.
- P1: done — no commit (`.spec-workflow/` is ignored on `sdd/review-gate`); carried by the P3 baseline commit
- P2: done — no commit (`.spec-workflow/` is ignored on `sdd/review-gate`); carried by the P3 baseline commit
- G2: done — no commit (`.spec-workflow/` is ignored on `sdd/review-gate`); carried by the P3 baseline commit
- P4: skipped — no product change; the v4 ordering shipped in PR #29 and `runGit` stays private
- P13: skipped — no change; the gate is measured at plan step 4 once PR #29 merges
- P14: to-do (human) — `docs/harness-efficiency-plan.md` (plan step 4) is untracked in the main checkout and absent from the retro worktree; add the line comparing reviser tokens per round against the tradr Opus-reviser ledgers by hand
- P15: skipped — decision (a): no change beyond P9 and P12; measure at plan step 4
- P16: skipped — no change; the standing brief's doc-gap rule stands
- P18: skipped — no new harness rule; the mechanical half is the spec-lint spec
- P21: skipped — no change; one approval per phase stays, the human gates are plan step 3
