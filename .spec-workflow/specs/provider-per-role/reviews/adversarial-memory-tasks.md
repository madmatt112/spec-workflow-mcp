# Adversarial Review Memory — tasks
Last updated: 2026-09-22 (after v4 review)

## Cumulative Findings Summary

### Accepted
- **R1-1 (SHOULD_FIX, v1)** — "halts the spec" false this run; restated as human-mediated
  stop (no automatic halt; task 3's branch not loaded). Fixed v2. NOTE: R4-1 reopens the
  edge of this text — the unset-key branch of the mechanism is contradicted by task 1's prompt.
- **R1-3 (MINOR, v1)** — Req 3.5/4.1/4.5 map to no `_Requirements:` line; Scope note names
  them restriction-carried. Fixed v2.
- **R1-4 (MINOR, v1)** — task 1 now names all nine `SDD_*` exports. Fixed v2.
- **R2-1 (MUST_FIX, v2)** — implementer barred from `deferrals`; task 10 now reports
  `AFFECTS-FUTURE-SPECS:` and the orchestrator files. Orchestrator DOES hold `deferrals`
  (`sdd-implementation-orchestrator.md:31-33`, re-verified r3/r4). Core resolved.
- **R2-2 (SHOULD_FIX, v2)** — `RETRO: escalation` not in implementer brief; v3 switched
  task 1 to `RETRO: gotcha`. `gotcha` in `briefs.md:43-45` and `retro.sh`. Sound.
- **R2-3 (MINOR, v2)** — Scope note narrowed to End-to-end section; citation defect became R3-1.
- **R3-1 (MUST_FIX, v3)** — line 119 bare refs bound to `SKILL.md` out of bounds. v4 fix:
  both now explicit `decomposition.md:383-384` / `:344,346`. **Re-verified r4: sound**
  (377-387 End-to-end holds 383-384; 341-350 subprocess-spawn bullet holds 344,346; file 680 lines).
- **R3-2 (SHOULD_FIX, v3)** — Deferral bar does not guarantee a `verification` deferral. v4
  fix qualified Prompt/D5/Scope note ("only when the three-part test holds; bar names no tag;
  may go to HANDOFF gotcha"). **Substantively resolved in 3 of 4 sites; residual R4-2.**
- **R3-3 (MINOR, v3)** — Success line count reconciled to "one … line naming that command." Fixed v4.

### Partially Accepted
- **R1-2 (SHOULD_FIX, v1)** — verifier-brief premise removed; decomposition-grep concession
  recorded (closed by ruling). Deferral chain resolved via R2-1; tag determinism was R3-2.

### Rejected
- Wiring task 10 into the step-8 grep slot (would edit the decomposition entry). Closed by ruling.
- Lint citation-identifier / bridge-missing class (new artifacts / cited-correctly-elsewhere /
  two documented forward refs lines 9,37). Rejected v1/v2/v3/v4. Closed.

### Unresolved (raised v4, awaiting reviser)
- **R4-1 (MUST_FIX, carried, Compounds R1-1)** — Dependency-order `:7` and D6 say a failed
  proof OR an unset key makes task 1 report `ESCALATE:` and `RETRO: gotcha`; task 1's prompt
  `:16` unset branch reports `ESCALATE:` only (write nothing / log / escalate). So the
  human-mediated-stop-via-retro-entry the paragraph names never fires for the unset case
  (the likely run state — drafter shell has key unset). Fix: add `RETRO: gotcha` to the
  unset branch, or scope line 7/D6 to the (a)-failed case and name the log entry as the
  unset case's visible record.
- **R4-2 (SHOULD_FIX, fix-induced, Compounds R3-2)** — the v4 delta rewrote all four R3-2
  sites but left task 10's description bullet `:96` unqualified ("routes … and files the
  record, tagged `verification` explicitly"), while Prompt `:100`, D5 `:108`, Scope `:118`
  all now carry "only when the three-part test holds / may go to HANDOFF gotcha." The v4
  Revision History's "All four now say … only when the bar's test holds" is inaccurate for
  `:96`. Fix: qualify line 96 or point it to D5.

## Patterns & Themes
- **Fix-induced drift keeps landing one site short.** R2-3→R3-1 (one of two bare refs), now
  R3-2→R4-2 (three of four sites harmonised, the description bullet missed). When a fix
  claims "all N sites updated," re-diff every site; the delta's own Revision-History
  self-claim has twice overstated completeness.
- **Cross-branch flag consistency is the new seam.** The drafter models the happy/primary
  branch precisely (the (a)-failed case gets ESCALATE+RETRO) but leaves a sibling branch
  (unset key) with a different flag set that a narrative paragraph then over-generalises.
  Any "X or Y makes task N report FLAGS" clause must be checked against BOTH branches of the
  prompt, not just the one the drafter had front of mind.
- Well-covered, do not re-open: orchestrator holds `deferrals` (`:31-33`); implementer bar
  (`:35`); `gotcha` in both category lists; R3-1 citation ranges; pinned `tokens 6.3M`;
  cross-task launcher/SDD_*/@deepseek/alias signatures (r3 lens); tasks 7/8 regression
  safety (r2 lens); component/requirement coverage; Req 2 crit 5/7 rulings; compare-mode
  pair placement (task 7/D3); step-8-grep-slot wiring; the `none`/exit-3 truth-table paths.

## Guidance for Next Review
- Re-check R4-1 hardest: confirm task 1's unset branch and line 7/D6 now agree on the flag
  set, and that whatever visible record the unset case leaves (retro entry or log line) is
  the one the paragraph names. Accept only an exact match between the prompt branch and the
  narrative.
- Re-check R4-2: confirm the description bullet `:96` no longer states an unconditional
  `verification` deferral, and that the Revision-History completeness claim matches reality.
- Fresh lenses already spent: wire contracts / decomposition scope (r1), cost of touching
  existing components (r2), prompt-only implementer (r3), internal-contradiction truth table
  (r4). A clean r5 is the expected outcome if R4-1/R4-2 land — do not manufacture findings.
- Do not re-run: the lint citation-identifier class, the R3-1 ranges, the pinned literals,
  the cross-task signature set, or the provider/`none` truth-table paths (all verified consistent).
