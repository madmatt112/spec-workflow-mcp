Status: CLOSED

# Retrospective plan — spec-lint

Approved 2026-09-14 by Matthew Field in the supervisor's retrospective conversation.
Source: retrospective.md (25 findings) and retrospective-proposals.md (25 proposals).
Every actionable proposal is approved; the seven "no change" proposals are accepted as
report-only. No proposal was rejected.

The close-out phase implements the proposals below, grouped by target repository, and
records the outcome per proposal. Their targets: harness skills/agents and server code
both live in this repo (`spec-workflow-mcp`); `agent-rules.md`, `CLAUDE.md` and the
`.spec-workflow` documents live in the spec store, which is the same repo here.

## Decisions taken (the six DECISION NEEDED proposals)

- **P10 (F10) — concurrent-run pointer → variant (a).** `active-run` holds one line per
  run, `<main checkout>\t<spec dir>\t<run id>`; the hook picks the line whose first field
  is a prefix of the hook input's `cwd`. The supervisor appends its line at `run.start`
  and removes it at `run.end`.
  Target: harness skills or agents (`harness/hooks/`, sensitive). Effort: M. Risk: medium.

- **P11 (F11) — harness-spec in-run verification → variant (a).** Codify what task 12
  did. Implementation step 8: when the scenario needs a skill or tool this spec adds and
  the installed plugin or server lacks it, verify the tool half in-process, stage the
  fixture under `/tmp/scratchpad/sdd/<SPEC>/scratch-store/`, add a `deferrals` record
  tagged `verification` whose `revisitCriteria` is the exact command and evidence, and
  report `VERIFY: pass (deferred: <id>)`. CLAUDE.md release step 7: run
  `deferrals list tag=verification`; execute and resolve each open record.
  Target: harness skills or agents; CLAUDE.md. Effort: S. Risk: low.

- **P14 (F14) — line-count rule → variant (a).** Source lines only: paths matching
  `isTestPath` leave `linesAdded + linesRemoved` (they still satisfy `tests-not-touched`);
  threshold stays 200.
  Target: server code, docs or templates. Effort: S. Risk: medium. Prerequisite: P2 for
  task 9's class.

- **P18 (F18) — tasks-phase signature change → variant (a).** Widen reviser rule 7 for
  the tasks phase: when an accepted finding changes a signature `design.md` states, apply
  the same text to the design's component and add a design Revision History line
  `- **v<D> amended** (<date>) — tasks R<A>-<n>: <what>`; list it under the finding as
  `also applied to design.md`. No re-approval (approval records do not hash content).
  Target: harness skills or agents. Effort: S. Risk: low.

- **P21 (F21) — reviser relocating a defect → variant (a).** Reviewer round section: a
  finding in text the previous delta wrote carries `Compounds: R<A-1>-<n>`. Reviser rule
  10: for a finding marked `Compounds:`, do not reword the clause again; write one plain
  sentence of what it must claim, delete the old text, and probe the new claim as round 1
  would; a claim you cannot probe is deleted, not kept.
  Target: harness skills or agents. Effort: S. Risk: low.

- **P24 (F24) — human gates (efficiency plan step 3) → variant (a).** Build gates A and B
  now, before the next spec: R5 (spec-lint) was the last spec named in the decomposition,
  so the plan's "not before R5" order now holds nothing back.
  Target: harness skills or agents. Effort: L (plan step 3). Risk: low.

## Approved proposals (DECISION NEEDED: no)

### Harness skill & doc fixes

- **P1 (F1) — install dependencies when entering the worktree.** Add `worktree-setup: npm
  ci` to `agent-rules.md` under `worktree-per-change: required`. In the supervisor's
  worktree rule (`sdd-continue/SKILL.md:213-217`), after the branch rename: if
  `agent-rules.md` carries a `worktree-setup:` line, run its command once in the new
  worktree before the step 1 re-check.
  Target: harness skills or agents; project steering (agent-rules.md). Effort: S. Risk: low.

- **P3 (F3) — a verification-only task skips the gate.** Implementation skill step 3: a
  task whose `File:` lines name no path under `CODE_ROOT` is a verification task; do not
  call `review-gate` or spawn a verifier for it; run its commands inside step 8, then mark
  it `[x]` with `outcome=gate`.
  Target: harness skills or agents. Effort: S. Risk: low.

- **P7 (F7) — an edit script for the spec store when Edit is refused.** Replace the P5
  rule in the implementation skill and `cleanup.md`: edit `tasks.md` and HANDOFF with the
  Edit tool; when the tool refuses the path (worktree-isolated session), write
  `/tmp/scratchpad/sdd/<SPEC>/spec-edit.mjs` once with the Write tool from the text in
  `cleanup.md` (`node spec-edit.mjs <file> <old> <new>`: one exact match replaced,
  non-zero exit on 0 or 2+ matches) and call it on its own shell line. Never `sed -i`,
  never a heredoc. Ship the script text next to `commit-spec-store.sh`; the retrospective
  skill gets the same rule.
  Target: harness skills or agents. Effort: S. Risk: low.

- **P8 (F8) — git in the retrospective skill goes through a script.** Step 1 item 6: write
  `/tmp/scratchpad/sdd/<SPEC>/git-log.sh` with the Write tool (`cd` into each repo inside
  the script and call `/usr/bin/git log --oneline …` with absolute paths); run it with
  `bash`. Never `-C`, a glob or `&&` on a shell line.
  Target: harness skills or agents. Effort: S. Risk: low.

- **P9 (F9) — the retro-log append is a script that stamps the time itself.** Add a
  `retro.sh` next to `event.sh` in `sdd-continue/references/formats.md`: `bash retro.sh
  "<stage>" "<vN | task N | phase>" "<category>" "<body>" "<evidence>" "<cost>"` writes the
  entry with `date -u` inside the script and refuses an empty argument. Every "append a
  retro-log entry" line adds "with `retro.sh`".
  Target: harness skills or agents. Effort: S. Risk: low.

- **P12 (F12) — cleanup inserts a missing version header.** `cleanup.md:58-60`: zero
  matches ⇒ insert `Document version: v<D>` as the line after the H1 (P7's script); a
  mismatch ⇒ replace it. Add the header to the tasks drafter brief's output rules so it
  starts at v1.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisite: P7.

- **P13 (F13) — the standing report asks for the commit.** Add `commit: <sha>` to the task
  implementer's standing report rule (`briefs.md:44-46`), not only the CI fix brief.
  Target: harness skills or agents. Effort: S. Risk: low.

- **P16 (F16) — the code block wins over the prose.** Implementer standing brief, after
  the merged-code rule: when the design's prose and its `Data Models` block disagree on a
  shape, the block wins; report `RETRO: doc-gap`.
  Target: harness skills or agents. Effort: S. Risk: low.

- **P23 (F23) — a deferred verification is a row, not a silence.** Implementation step 6: a
  task may be marked `[x]` with part of its verification deferred only when a `deferrals`
  record tagged `verification` names the exact command and evidence; write the row
  `Deferred verification | <id>` in the HANDOFF implementation section, and the PR body's
  Test plan carries the item unticked. The supervisor's retrospective conversation
  (`sdd-continue` step 5) lists the spec's open `verification` records as the human's
  action items.
  Target: harness skills or agents. Effort: S. Risk: low. Prerequisite: P11 (a).

### Server code fixes

- **P2 (F2) — the gate skips generated paths in the line count.** Add a machine-read
  heading `## Generated paths` to `agent-rules.md` with the bullet `plugins/`.
  `gate-rules.ts` parses it like `## Sensitive paths`; `computeRisk` drops matching paths
  from `linesAdded + linesRemoved` and the hygiene scan, and keeps them in `touched`.
  Target: server code, docs or templates; project steering (agent-rules.md). Effort: M.
  Risk: low.

- **P6 (F6) — scan added lines, not whole files.** `hygiene-signals.ts:20-27` reads every
  touched file end to end. Give `computeHygieneSignals` the range: for a ranged call, scan
  only the `+` lines of `git diff --unified=0 <range> -- <file>` with their new line
  numbers; files-only mode keeps the whole-file scan. `review-task.ts` shares the module.
  Target: server code, docs or templates. Effort: M. Risk: low (signals are advisory
  except `debugger`, which still fails the gate when added).

- **P22 (F22) — the cap counts the body.** `lint-words.ts` `checkDocWords` counts from the
  H1 to the line before `## Revision History`; `sdd-document-phase/SKILL.md:95` and
  `docs/TOOLS-REFERENCE.md` say so.
  Target: server code, docs or templates. Effort: S. Risk: low.

### agent-rules.md rule and graduation candidates

- **P5 (F5) — name the vitest mock pattern.** Add to `agent-rules.md` `## Checks`:
  `vi.spyOn` cannot wrap an ESM namespace import (`node:fs/promises`); to assert on calls,
  use `vi.mock('<module>', async (importOriginal) => …)` as in
  `src/dashboard/__tests__/task-review-runner.test.ts:16`.
  Target: project steering (agent-rules.md). Effort: S. Risk: low.

- **Graduation 1 — generated paths are not risk.** New machine-read section in
  `agent-rules.md`: "## Generated paths — Machine-read by the review gate: changed lines
  under these paths do not count toward the line rule. - `plugins/`". Lands with P2.

- **Graduation 2 — worktree sessions refuse spec-store edits and complex git.** One bullet
  in `agent-rules.md` `## Git`: in a worktree-isolated session the Edit and Write tools
  refuse paths under `.spec-workflow`, and the shell guard refuses `git` with `-C`, a glob
  or a compound line; write files to `/tmp/scratchpad/sdd/<spec>/` and `cp` them into place
  on their own line; run git as one plain `/usr/bin/git <verb> <args>` line or from a
  script written with the Write tool. Harness half is P7 and P8.

- **Graduation 3 — retro-log timestamps come from a script.** In
  `sdd-continue/references/formats.md`: retro-log entries are appended with `retro.sh`,
  never by hand; the script stamps the time. Lands with P9.

- **Graduation 4 — the design cap binds in this repo.** P22 is the smaller fix; if designs
  stay at the cap after it, use the `## Word caps` override in `agent-rules.md`:
  "## Word caps — `design: 4500`".

- **Graduation 5 — a harness change needs a re-install before it can be verified.** In
  `CLAUDE.md`, after "Sessions must restart to pick up server changes": then run
  `deferrals list tag=verification` and execute and resolve each open record; a harness
  spec defers the half of its scenario that needs the new plugin. Lands with P11 (a).

### Product-code probe

- **P4 (F4) — probe the TOON deferral; do not resolve it blind.** Close-out adds one
  assertion to an existing `review-task` test: `decode(res.content[0].text)` on a `prepare`
  response. Decodes ⇒ resolve `d-a2233b94` citing the test; fails ⇒ update its context with
  the spec-lint evidence.
  Target: product code. Effort: S. Risk: low.

## Accepted with no action (report-only)

- **P15 (F15)** — P9 and P12 delivered; document share fell to 60% of tokens / 66% of wall
  clock. Reported to efficiency-plan step 4. Verifier spawns (9 of 12) are answered by P2,
  P3 and P14.
- **P17 (F17)** — the verifier ruled the citation-example mismatch acceptable at no cost;
  no rule makes it cheaper.
- **P19 (F19)** — two MINOR under-citations cost nothing; a `coverage-requirement` lint at
  `info` is the change only if it recurs.
- **P20 (F20)** — drafter ground errors fell from four to two; the mechanical half ships in
  PR #36.
- **P25 (F25)** — P22 works; the three scope cuts reached the PR body's "Not in this PR"
  bullet. Gate B (P24) surfaces them earlier.

## Rejected

None.

## Close-out

One line per proposal, written by the close-out phase.

- P10: done — ff3c6b5
- P11: done — d33db1c (implementation step-8 half); the CLAUDE.md release-step-7 half is a to-do — see G5.
- P14: done — e8b44cf
- P18: done — 696bf2a
- P21: done — 56977e9
- P24: to-do (human) — efficiency-plan step 3 defines the gates' behaviour but leaves gate placement (AskUserQuestion runs only in the main session, gates A/B run in subagents), the gate-B "veto list" source, and gate-A reviser routing undefined; needs its own design spec before it can be built.
- P1: done — b1dcbce
- P3: done — 393dcbf
- P7: done — 8c94bf6
- P8: done — 34699e9
- P9: done — c995382
- P12: done — b269c0f
- P13: done — 1bb9175
- P16: done — b721cda
- P23: done — 4de9f18
- P2: done — da16809
- P6: done — cbd2ce2
- P22: done — aaea176
- P4: done — probe found the review-task `prepare` response does NOT decode through TOON (RangeError on the ~4000-char methodology scalar, @toon-format/toon@0.8.0); d-a2233b94 context updated with the evidence and kept deferred (not resolved); no test committed (a decode assertion would be red).
- P5: done — 9231f4a
- G1: done — delivered by P2 (da16809): `## Generated paths` section in agent-rules.md
- G2: to-do (human) — worktree-session content classifier blocks writing the guard-documentation bullet; a human must author it in agent-rules.md `## Git`, or grant a Write/Bash permission and re-run from a non-worktree session.
- G3: done — delivered by P9 (c995382): retro.sh in sdd-continue/references/formats.md and "with `retro.sh`" on the append-lines.
- G4: to-do (human) — conditional on P22; if designs still exceed the word cap after P22, add `## Word caps — design: 4500` to agent-rules.md.
- G5: to-do (human) — CLAUDE.md is gitignored/untracked (not in the PR); add to CLAUDE.md after "Sessions must restart to pick up server changes": run `deferrals list tag=verification` and execute and resolve each open record.
- spec-workflow-mcp: PR https://github.com/madmatt112/spec-workflow-mcp/pull/37 (chore/spec-lint-retro → feat/spec-lint, stacks on #36; not merged).
