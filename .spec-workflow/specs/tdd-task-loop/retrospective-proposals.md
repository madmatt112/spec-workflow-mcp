# Retrospective proposals — tdd-task-loop

One proposal per finding. Written 2026-09-28 by the retro analyst.

- **P1 (F1) — Scope the first-task gate to the implementer commit, not pre-implement HEAD.**
  The skill already tells the shared-repo layout to gate `base=<sha>^..sha` once the
  implementer reports its commit (Step 1, lines 102-108). F1 shows the first task still
  gated against pre-implement HEAD and swept in 38 uncommitted files. Make the
  single-commit scoping the default for every layout where CODE_ROOT and the spec store
  share one repo, and re-order Step 1 so the base is captured but never used as the gate
  base — the gate always uses `base=<implementer sha>^`.
  Target: harness skills (sdd-implementation-phase SKILL.md, Step 1 / Step 4).
  Effort: S. Risk: low: narrows an already-documented practice.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P2 (F2) — Verifier fires on line-count/sensitive-path alone.** Task 7 (289 lines) and
  task 9 (sensitive path) drew a verifier that passed with no fix — 2 of 3 spawns on
  low-defect diffs. The line rule is a coarse proxy and this is deliberately conservative,
  so the human owns the trade.
  Target: agent-rules.md line rule / review-gate risk scoring (src/tools/review-task.ts).
  Effort: S. Risk: medium: a looser gate can miss a real defect.
  Prerequisites: none.
  DECISION NEEDED: yes. Should the gate keep spawning a verifier on line-count or
  sensitive-path alone?
  - (a) Keep as is — conservative, cost is ~2 spawns/spec. **[recommended]**
  - (b) Raise the line threshold from 200 to 300.
  - (c) Exempt test-only diffs from the line-count trigger.
  Recommend (a): the false-positive cost is small and the safety value is real.

- **P3 (F3) — RED-IMPOSSIBLE leaves an untracked test file.** On the design-defect stop
  (`SEAM-DEFECT`, or `RED-IMPOSSIBLE` on every criterion), have the test author remove its
  own uncommitted test files before it reports, so nothing stray sits in the tree for the
  next run. State this in the author routing (Step 1b) and the sdd-test-author agent.
  Target: harness skills/agents (sdd-implementation-phase Step 1b, sdd-test-author).
  Effort: S. Risk: low: only touches the stop path that spawns no implementer.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P4 (F4) — Coupled count assertion outside the grep list went stale.** Task 13 added the
  13th agent profile but `ledger.test.ts:103` still asserted `toHaveLength(12)`. Extend the
  agent-rules "Documents" count rule to cover counts in code and test files, and have the
  tasks-phase decomposition list the grep that finds every dependent count/length assertion
  (not only the edited symbol) in each count-changing task's edit scope.
  Target: agent-rules.md (Documents section) + tasks template / document-phase skill.
  Effort: S. Risk: low: adds a grep step, no behaviour change.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P5 (F5) — Gate/prepare ran against the wrong tree on a worktree branch.** The gate ran
  its checks in the default (main-checkout) root, so tests failed or passed vacuously. The
  server already prefers `CODE_ROOT` when set (review-task.ts:587), so it did not receive
  it. Have the skill pass `projectPath: <CODE_ROOT>` (and the implementer commit) on every
  `gate`, `prepare` and `record` call, and confirm the harness exports `CODE_ROOT` to the
  MCP server process. The explicit `projectPath` is the smallest reliable fix.
  Target: harness skills (sdd-implementation-phase Step 4/5) + note to verify the
  CODE_ROOT env export.
  Effort: S. Risk: medium: gates were vacuous until fixed; correctness matters.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P6 (F6) — `harness brief` rejected an unmarked task with no `redTests`.** The merged
  code already lists `redTests` in `OPTIONAL_BRIEF_KEYS` (harness.ts:555), so it defaults to
  empty. The live run hit an un-rebuilt server (see F16). No code change: rebuild and
  restart, then re-run the unmarked-task brief in the operator verification session.
  Target: none (already fixed in tree); operator rebuild.
  Effort: S. Risk: low.
  Prerequisites: server rebuild + session restart (the F16 operator session).
  DECISION NEEDED: no.

- **P7 (F7) — Docs-only task scored high from bookkeeping commits.** Same root cause as F1:
  the single-repo gate range took in spec-store bookkeeping commits and untracked
  `.spec-workflow/templates/`. P1's single-commit scoping (`base=<sha>^..sha`) excludes both
  the later bookkeeping commits and untracked files, so no separate change is needed beyond
  P1.
  Target: covered by P1.
  Effort: S. Risk: low.
  Prerequisites: P1.
  DECISION NEEDED: no.

- **P8 (F8) — Supervisor ran inside the worktree and hit the isolation guard.** The whole
  run worked around the guard with `/usr/bin/git` and a node helper on every main-checkout
  write. agent-rules already documents the `/usr/bin/git` + cp-into-place workaround
  (Git section, lines 44-48), so this is either accepted cost or a structural change.
  Target: harness supervisor design / agent-rules.md.
  Effort: workaround S; restructure L.
  Risk: low (a) / medium (b): moving the supervisor changes worktree ownership.
  Prerequisites: none.
  DECISION NEEDED: yes. Where should the supervisor run relative to the worktree?
  - (a) Keep it in the worktree; the `/usr/bin/git` + cp workaround is already documented. **[recommended]**
  - (b) Run the supervisor from the main checkout, workers in the worktree.
  Recommend (a): the workaround is already codified and low cost; (b) is a large change to
  the run model for a cosmetic gain.

- **P9 (F9) — spec-lint skip-regex misses the indented sub-bullet form.** The regex at
  lint-citations.ts:75, `/^\s*_(?:Leverage|Prompt):/`, does not match the template-mandated
  `  - _Prompt:` form (a `- ` bullet precedes the `_`), so 39 valid prompt/leverage lines
  drew citation-identifier warnings. Fix the regex to allow an optional bullet marker:
  `/^\s*(?:[-*]\s+)?_(?:Leverage|Prompt):/`. Add a test covering the sub-bullet form. This
  also clears deferral d-53b7f443 (note only — do not edit the deferral).
  Target: product code (src/core/lint-citations.ts) + a vitest case.
  Effort: S. Risk: low: widens a skip, cannot add false negatives to real citations.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P10 (F10) — Tasks 1-5 gates passed vacuously.** Direct consequence of F5 (no
  `projectPath`). P5's fix removes it; no separate change.
  Target: covered by P5.
  Effort: S. Risk: low.
  Prerequisites: P5.
  DECISION NEEDED: no.

- **P11 (F11) — Skill documents a `redTests` default the tool now honours.** With
  `OPTIONAL_BRIEF_KEYS` in the merged code, skill and tool agree; the disagreement was only
  against the stale binary (F6). No change beyond the F6 rebuild.
  Target: none (resolved by P6's rebuild).
  Effort: S. Risk: low.
  Prerequisites: P6.
  DECISION NEEDED: no.

- **P12 (F12) — Implementer missed a coupled assertion outside its grep list.** Root cause
  of F4; the decomposition-grep fix in P4 covers it. No separate change.
  Target: covered by P4.
  Effort: S. Risk: low.
  Prerequisites: P4.
  DECISION NEEDED: no.

- **P13 (F13) — One ruling, no adjudications or escalations.** Healthy phase behaviour;
  nothing to change.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P14 (F14) — Verifier skipped by policy on docs-only and verification-only tasks.**
  Sanctioned policy, disclosed in the completion report; reviewCoverage 15/17 is expected.
  Nothing to change.
  Target: none.
  Effort: S. Risk: low.
  Prerequisites: none.
  DECISION NEEDED: no.

- **P15 (F15) — 39 lint warnings deferred, not fixed.** Correct triage of a known
  false-positive class; P9 removes the class at the source, which resolves d-53b7f443. No
  separate change.
  Target: covered by P9.
  Effort: S. Risk: low.
  Prerequisites: P9.
  DECISION NEEDED: no.

- **P16 (F16) — Live criteria carried as pending for an operator.** Sanctioned by the
  agent-rules "Fixtures and live verification" section: a scenario that cannot run in the
  loop stays pending behind a tracked verification-evidence.md. Working as designed; the
  operator session must also finish the F6/F11 rebuilt-server brief check before the
  evidence file reads all `passed`.
  Target: none (process working as intended).
  Effort: S. Risk: low.
  Prerequisites: P6.
  DECISION NEEDED: no.

## Graduation candidates

- **Worktree gate/prepare/record calls name the code root.** Seen in tdd-task-loop (F5/F10),
  review-gate (F11), spec-lint (F5-class), worktree-review-signals and
  worktree-execution-context: gate/prepare operations and implementer paths resolve against
  the main checkout instead of the worktree branch, so checks run vacuously.
  Rule text: "In a worktree run, every `review-task` `gate`, `prepare` and `record` call
  passes `projectPath: <CODE_ROOT>` and the implementer commit; never rely on the process
  default root. A gate that reports the main checkout's tree is void — re-run it scoped to
  CODE_ROOT."
  Target: `.spec-workflow/agent-rules.md` (a new "Worktree gates" bullet under Git).

- **Fix a known lint false-positive class at the check, do not re-defer it.** Seen in
  tdd-task-loop (F9/F15), spec-lint (F17), worktree-review-signals (F11), harness-bookkeeping
  (F11), question-gates (F4) and provider-per-role: citation-identifier / citation-path
  false positives recur version after version and are triaged rather than fixed.
  Rule text: "A lint warning class that has been triaged as a known false positive in two or
  more specs is fixed at the check (its skip-regex or exemption), not deferred again.
  Skip-regexes for `_Leverage:` / `_Prompt:` lines must match the template's indented
  sub-bullet form (`  - _Prompt:`)."
  Target: `.spec-workflow/agent-rules.md` (a "Lint false positives" bullet), enforced in
  src/core/lint-citations.ts.
