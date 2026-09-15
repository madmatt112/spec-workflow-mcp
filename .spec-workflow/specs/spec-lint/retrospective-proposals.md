# Retrospective proposals — spec-lint

Written 2026-09-14 by the retro analyst from retrospective.md.

Second spec in this store, first under the review-gate close-out (PR #30). P9 and P12
delivered (F15); rule 9 (F21), P5 (F7) and P8 (F9) did not hold. Nothing reverts.

## Proposals

- **P1 (F1) — Install dependencies when entering the worktree.** Add a machine-read line
  to `agent-rules.md` under `worktree-per-change: required`: `worktree-setup: npm ci`.
  In the supervisor's worktree rule (`sdd-continue/SKILL.md:213-217`), after the branch
  rename: "if `agent-rules.md` carries a `worktree-setup:` line, run its command once in
  the new worktree before the step 1 re-check".
  Target: harness skills or agents; project steering (agent-rules.md). Effort: S.
  Risk: low: one command, run once. Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — The gate skips generated paths in the line count.** Add a second
  machine-read heading to `agent-rules.md`, `## Generated paths`, with the bullet
  `plugins/`. `gate-rules.ts` parses it like `## Sensitive paths`; `computeRisk` drops
  matching paths from `linesAdded + linesRemoved` and the hygiene scan, and keeps them
  in `touched`. Task 9 would have scored about 70 lines and passed. Review-gate P2
  asked for measurement; two specs have measured it.
  Target: server code, docs or templates; project steering (agent-rules.md). Effort: M.
  Risk: low: an exclusion the project opts into by name. Prerequisites: none.
  DECISION NEEDED: no.

- **P3 (F3) — A verification-only task skips the gate.** Implementation skill step 3:
  "A task whose `File:` lines name no path under `CODE_ROOT` is a verification task: do
  not call `review-gate` or spawn a verifier for it; run its commands inside step 8,
  then mark it `[x]` with `outcome=gate`."
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P4 (F4) — Probe the deferral; do not resolve it yet.** The spec-lint response
  decodes (`spec-lint.e2e.test.ts:5,43`), but `d-a2233b94` names `review-task` and
  `adversarial-review`, whose `methodology` field is the stated cause. Close-out adds
  one assertion to an existing `review-task` test: `decode(res.content[0].text)` on a
  `prepare` response. Decodes: resolve the deferral citing the test; fails: update its
  context with the spec-lint evidence.
  Target: product code. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — Name the vitest mock pattern.** Add to `agent-rules.md` `## Checks`:
  "`vi.spyOn` cannot wrap an ESM namespace import (`node:fs/promises`). To assert on
  calls, use `vi.mock('<module>', async (importOriginal) => …)` as in
  `src/dashboard/__tests__/task-review-runner.test.ts:16`."
  Target: project steering (agent-rules.md). Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P6 (F6) — Scan added lines, not whole files.** `hygiene-signals.ts:20-27` reads
  every touched file end to end, so a pre-existing `console` call anywhere in the file
  fires; the retro log's "diff hunks" diagnosis is wrong. Give `computeHygieneSignals`
  the range: for a ranged call, scan only the `+` lines of `git diff --unified=0
  <range> -- <file>` with their new line numbers; files-only mode keeps the whole-file
  scan. `review-task.ts` shares the module.
  Target: server code, docs or templates. Effort: M. Risk: low: signals are advisory
  except `debugger`, which still fails the gate when added. Prerequisites: none.
  DECISION NEEDED: no.

- **P7 (F7) — An edit script for the spec store when Edit is refused.** Replace the P5
  rule in the implementation skill and `cleanup.md` with: "Edit `tasks.md` and HANDOFF
  with the Edit tool. When the tool refuses the path (worktree-isolated session), write
  `/tmp/scratchpad/sdd/<SPEC>/spec-edit.mjs` once with the Write tool from the text in
  `cleanup.md` (`node spec-edit.mjs <file> <old> <new>`: one exact match replaced;
  non-zero exit on 0 or 2+ matches) and call it on its own shell line. Never `sed -i`,
  never a heredoc." Ship the script text next to `commit-spec-store.sh`; the
  retrospective skill gets the same rule.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P8 (F8) — Git in the retrospective skill goes through a script.** Step 1 item 6:
  "Write `/tmp/scratchpad/sdd/<SPEC>/git-log.sh` with the Write tool: `cd` into each
  repo inside the script and call `/usr/bin/git log --oneline …` with absolute paths;
  run it with `bash`. Never `-C`, a glob or `&&` on a shell line: the worktree guard
  refuses them."
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P9 (F9) — The retro-log append is a script that stamps the time itself.** Add to
  `sdd-continue/references/formats.md`, next to `event.sh`, a `retro.sh`: `bash retro.sh
  "<stage>" "<vN | task N | phase>" "<category>" "<body>" "<evidence>" "<cost>"` writes
  the entry with `date -u` inside the script and refuses an empty argument. Every
  "append a retro-log entry" line adds "with `retro.sh`". The requirements spawn
  substituted an empty value with P8's rule live; a script cannot.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P10 (F10) — One pointer record per run.** The hook reads one global file
  (`sdd-activity.sh:10`), so two stores cannot run at once.
  Target: harness skills or agents (`harness/hooks/`, sensitive). Effort: M.
  Risk: medium: a hook change; the ledger is a must-keep. Prerequisites: none.
  DECISION NEEDED: yes. How do concurrent runs share the pointer? (a) `active-run` holds
  one line per run, `<main checkout>\t<spec dir>\t<run id>`; the hook picks the line
  whose first field is a prefix of the hook input's `cwd`; the supervisor appends its
  line at `run.start` and removes it at `run.end`. **Recommended.** (b) Keep one file;
  the supervisor rewrites it before every orchestrator spawn (what it did by hand);
  cheap; hook events cross stores during an overlap. (c) A rule: never run two harness
  runs at once.

- **P11 (F11) — A harness spec's in-run verification stops at the installed plugin.**
  Target: harness skills or agents; CLAUDE.md. Effort: S. Risk: low. Prerequisites:
  none.
  DECISION NEEDED: yes. How is the harness half of a harness spec's scenario verified?
  (a) Codify what task 12 did. Implementation step 8: "when the scenario needs a skill
  or tool this spec adds and the installed plugin or server lacks it, verify the tool
  half in-process, stage the fixture under `/tmp/scratchpad/sdd/<SPEC>/scratch-store/`,
  add a `deferrals` record tagged `verification` whose `revisitCriteria` is the exact
  command and evidence, and report `VERIFY: pass (deferred: <id>)`". CLAUDE.md release
  step 7: "run `deferrals list tag=verification`; execute and resolve each open
  record". **Recommended.** (b) The verifier launches `claude -p` with the checkout's
  plugin directory loaded, if the CLI can load a plugin from a path; unverified. (c)
  Accept the manual step with no rule.

- **P12 (F12) — Cleanup inserts a missing version header.** `cleanup.md:58-60`: "zero
  matches: insert `Document version: v<D>` as the line after the H1 (P7's script); a
  mismatch: replace it." Add the header to the tasks drafter brief's output rules so it
  starts at v1.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: P7.
  DECISION NEEDED: no.

- **P13 (F13) — The standing report asks for the commit.** The task implementer's report
  rule (`briefs.md:44-46`) lists files, checks, `logged:` and flags; only the CI fix
  brief (`:207`) asks for `commit: <sha>`. Add `commit: <sha>` to the standing rule. A
  brief gap, not a model misunderstanding.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P14 (F14) — Test lines do not count toward the line rule.** Every new-module task
  ships a suite: tasks 1-7 had 154, 244, 310, 124, 302, 189 and 181 source lines and
  382-541 lines with tests.
  Target: server code, docs or templates. Effort: S. Risk: medium: fewer verifier reads
  on new modules. Prerequisites: P2 for task 9's class.
  DECISION NEEDED: yes. What does `line-count` count? (a) Source lines only: paths
  matching `isTestPath` leave `linesAdded + linesRemoved` (they still satisfy
  `tests-not-touched`); threshold stays 200. This run: tasks 1, 5, 7 pass; 2, 3, 6
  still see a verifier, and task 2 is the one that needed it. With P2 and P3: 3 of 12
  verifier spawns, about 290k saved. **Recommended.** (b) Raise `RISK_LINE_THRESHOLD`
  to 400: tasks 5, 7, 9 pass, but task 2 v1 (382) would have skipped the verifier that
  found its three shape findings. (c) Keep as is; 8 of 12 is the floor for a
  new-module spec. (d) Both (a) and (b).

- **P15 (F15) — No change; report to plan step 4.** P9 and P12 delivered: document share
  67% → 60% of tokens, 77% → 66% of wall clock; three document orchestrator spawns,
  from six; SHOULD_FIX-only closes at 37k and 29k against 124k-150k for a reviewer
  round. Verifier spawns 9 of 12 is the open watch line; P2, P3 and P14 answer it.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P16 (F16) — The code block wins over the prose.** Implementer standing brief, after
  the merged-code rule: "When the design's prose and its `Data Models` block disagree
  on a shape, the block wins; report `RETRO: doc-gap`." The verifier already judges
  against the block.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P17 (F17) — No change.** The verifier ruled the literal acceptable at no cost; an
  example that contradicts its regex is round-1 reviewer work; no rule makes it
  cheaper.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P18 (F18) — A tasks-phase fix that changes a design signature amends the design.**
  Target: harness skills or agents. Effort: S. Risk: low: approval records do not hash
  content (`approval-records.ts`), so an amended design stays approved. Prerequisites:
  none.
  DECISION NEEDED: yes. What happens to an approved design when a tasks finding changes
  its signatures? (a) Widen reviser rule 7 for the tasks phase: "when an accepted
  finding changes a signature `design.md` states, apply the same text to the design's
  component and add a design Revision History line `- **v<D> amended** (<date>) — tasks
  R<A>-<n>: <what>`; list it under the finding as `also applied to design.md`". No
  re-approval. **Recommended.** (b) Leave the design; the implementer standing brief
  says "`tasks.md` wins over `design.md` on a signature; report `RETRO: doc-gap`".
  Stops the re-flags; the design stays wrong. (c) Route it as `PHASE: design-defect`
  and re-open design: a full round, about 300k tokens.

- **P19 (F19) — No change.** Two MINOR under-citations cost nothing. Lint's
  `task-requirement-id` checks that a cited id exists, not that every requirement is
  cited; a `coverage-requirement` rule at `info` is the change if this recurs.
  Target: server code, docs or templates. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P20 (F20) — No change.** Ground errors fell from four to two. The tool count is the
  count-word class the `## Documents` rule (review-gate G2) covers; the Lint-step
  placement is semantic and round 1 caught it. The mechanical half ships in this PR.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P21 (F21) — Mark compounding findings and stop rewording.** Rule 9 targets siblings;
  F21 is one clause rewritten three times.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: yes. What stops a fix relocating a defect? (a) Reviewer round
  section: a finding in text the previous delta wrote carries `Compounds: R<A-1>-<n>`.
  Reviser rule 10: "For a finding marked `Compounds:`, do not reword the clause again.
  Write one plain sentence of what it must claim, delete the old text, and probe the
  new claim as round 1 would; a claim you cannot probe is deleted, not kept."
  **Recommended.** (b) As (a), and the orchestrator spawns the reviser with `model:
  opus` for a round with an accepted `Compounds:` finding; spends Opus tokens R6 moved
  off the reviser. (c) Accept: three rounds inside the cap.

- **P22 (F22) — The cap counts the body.** `lint-words.ts` `checkDocWords` counts from
  the H1 to the line before `## Revision History`; `sdd-document-phase/SKILL.md:95` and
  `docs/TOOLS-REFERENCE.md` say so. Otherwise a document at the cap gets a `doc-words`
  warning and a lint pass at every version.
  Target: server code, docs or templates. Effort: S. Risk: low. Prerequisites: none.
  DECISION NEEDED: no.

- **P23 (F23) — A deferred verification is a row, not a silence.** Implementation step
  6: "A task may be marked `[x]` with part of its verification deferred only when a
  `deferrals` record tagged `verification` names the exact command and evidence; write
  the row `Deferred verification | <id>` in the HANDOFF implementation section, and the
  PR body's Test plan carries the item unticked." The supervisor's retrospective
  conversation (`sdd-continue` step 5) lists the spec's open `verification` records as
  the human's action items.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisites: P11 (a).
  DECISION NEEDED: no.

- **P24 (F24) — No harness change; schedule plan step 3.** Two specs, 13 hours, no
  human contact.
  Target: harness skills or agents. Effort: L (plan step 3). Risk: low.
  Prerequisites: none.
  DECISION NEEDED: yes. When does step 3 (gates A and B) run? (a) Now, before the next
  spec: R5 has no spec in the decomposition, so the plan's "not before R5" order holds
  nothing. **Recommended.** (b) After a bookkeeping spec is written and released, as
  the plan orders. (c) Never: the PR is the gate.

- **P25 (F25) — No change.** P22 works: the three cuts reached the PR body's "Not in
  this PR" bullet; gate B (P24) shows them earlier.
  Target: harness skills or agents. Effort: none. Risk: low. Prerequisites: P24.
  DECISION NEEDED: no.

## Graduation candidates

Patterns in both specs' findings, with the rule text and its home.

1. **Generated paths are not risk.** Review-gate F2, F13 → spec-lint F2, F14. For
   `agent-rules.md`, a new machine-read section: "## Generated paths — Machine-read by
   the review gate: changed lines under these paths do not count toward the line rule.
   - `plugins/`". Lands with P2.

2. **Worktree sessions refuse spec-store edits and complex git.** Review-gate F5 →
   spec-lint F7, F8. For `agent-rules.md` `## Git`, one bullet: "In a worktree-isolated
   session the Edit and Write tools refuse paths under `.spec-workflow`, and the shell
   guard refuses `git` with `-C`, a glob or a compound line. Write files to
   `/tmp/scratchpad/sdd/<spec>/` and `cp` them into place on their own line; run git as
   one plain `/usr/bin/git <verb> <args>` line or from a script written with the Write
   tool." The harness half is P7 and P8.

3. **Retro-log timestamps come from a script.** Review-gate F8 → spec-lint F9, after P8.
   For `sdd-continue/references/formats.md`: "Retro-log entries are appended with
   `retro.sh`, never by hand; the script stamps the time." Lands with P9.

4. **The design cap binds in this repo.** Review-gate design 4,000/4,000 → spec-lint
   F22 at 4,029. P22 is the smaller fix; if designs stay at the cap after it, use the
   `## Word caps` override this spec shipped, in `agent-rules.md`: "## Word caps —
   `design: 4500`".

5. **A harness change needs a re-install before it can be verified.** Review-gate P13
   ("PR #29 merged and the plugin refreshed") → spec-lint F11, F23. For `CLAUDE.md`,
   after "Sessions must restart to pick up server changes": "Then run `deferrals list
   tag=verification` and execute and resolve each open record; a harness spec defers
   the half of its scenario that needs the new plugin." Lands with P11 (a).

Not graduated: compounding fixes (F19 → F21) are P21; ground errors (F18 → F20) halved
with no rule; agent-side approvals (F21 → F24) are plan step 3.
