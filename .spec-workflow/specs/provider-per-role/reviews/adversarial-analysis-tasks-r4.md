# Adversarial Analysis — provider-per-role/tasks (v4), round 4

Primary attack surface: atomicity, ordering, coverage. Fresh lens: a cold read for
internal contradictions and a truth table of the stated cases — the `DEEPSEEK_API_KEY`
set/unset branches across tasks 1, 4, 5, 7, 8, 10 and the `provider = deepseek |
anthropic | none` cases across the launcher, the hook and the usage/watch fold. Deltas
(the R3-1 / R3-2 / R3-3 fixes and the v4 lint commit) attacked first.

## What I checked and how

- **R3-1 fix — line 119's two decomposition refs, now explicit.** Read
  `.spec-workflow/spec-decomposition/decomposition.md` (680 lines). `377-387` is the
  **End-to-end verification** bullet; line 383-384 is the superseded scenario (4) wording
  ("stops at `run.start` with a `note` naming the role and the missing key"). `341-350` is
  the **A subprocess spawn path** bullet; line 344 holds the superseded `--model` DeepSeek
  name, 346 `ANTHROPIC_MODEL`. Both refs now read `decomposition.md:383-384` and
  `decomposition.md:344,346` and resolve in bounds. **R3-1 fix sound.** The v4 lint commit
  (17db435) only re-prefixed these two; both confirmed against the file.
- **R3-2 fix — the Deferral bar.** Read `harness/skills/sdd-implementation-phase/SKILL.md`
  (320 lines). The bar (`167-175`) is a three-part gate ("only if all three hold: a
  symptom, a trigger, and enough weight"), its record fields are
  `originSpec/originPhase/title/context/decision/revisitTrigger/revisitCriteria/tags`
  (generic `tags`, no `verification` by name), and "anything that fails the bar … goes into
  the HANDOFF section as a gotcha." The deterministic `verification`-tag path is the step-8
  `VERIFY: pass (deferred: <id>)` at `201-209` (tag `verification` at 207-209) that task 10
  bypasses. D5 (`108`), the Prompt (`100`) and the Scope note (`118`) now carry the "only
  when its three-part test holds … the bar names no tag on its own and may instead record a
  HANDOFF gotcha" qualifier — accurate. **But the description bullet (`96`) was rewritten by
  the same delta and left unqualified — see R4-2.**
- **Permitted-writer chain (R2-1/R3-2 base).** `harness/agents/sdd-implementer.md:35` bars
  the implementer from `deferrals` and `:34` lets it report `AFFECTS-FUTURE-SPECS`; the
  orchestrator holds `deferrals` at `sdd-implementation-orchestrator.md:31-33` (the three
  plugin-prefixed names, tool list runs to 42). Both correct. `SKILL.md:84-99` is the
  per-task loop; `100-106` the flag routing (`AFFECTS-FUTURE-SPECS ⇒ Deferral bar`). Correct.
- **Pinned literals.** `node dist/index.js --watch . --spec review-gate --once` prints
  `tokens 6.3M` today, so task 8's Success line and task 10 scenario (5) are both right.
- **Truth table (fresh lens).** Built the `DEEPSEEK_API_KEY` set/unset grid over tasks 1,
  4, 5, 7, 8, 10 and the `provider` grid over the launcher/hook/usage/watch. One
  contradiction surfaced on the task-1 unset branch (R4-1). The map-value `none` path
  (task 4 → task 5 `LAUNCHER=none` → task 6 no deepseek worker due → task 8 no dim
  `providers` line) is internally consistent; the exit-3 unset-key path (task 4 → task 5
  roots refusal → task 10 scenario (3)) is consistent; scenario (1)/(4) model/split claims
  match Requirement 7.1/7.4 and task 1's (a)-pass condition.

## Findings

### R4-1 (MUST_FIX, carried, Compounds R1-1) — the Dependency-order paragraph and D6 claim the unset-key case emits `RETRO: gotcha`; task 1's prompt does not

The Dependency-order paragraph (`tasks.md:7`) states:

> a failed proof **or an unset key** makes task 1 report `ESCALATE:` **and `RETRO:
> gotcha`** (Requirement 6 criteria 6-7). … this is a human-mediated stop … a human
> reading **the retro entry** decides whether to continue.

Task 1's prompt (`tasks.md:16`) splits the two triggers and gives the unset case only one
flag:

> when unset or empty, write nothing under `docs/`, call `log-implementation` with the
> summary `preflight not run: DEEPSEEK_API_KEY unset`, and report `ESCALATE:
> DEEPSEEK_API_KEY unset; preflight not run` (Requirement 6 criterion 7).

Only the *other* branch — "On any other (a) outcome … report `ESCALATE: preflight (a)
failed — REASON` and `RETRO: gotcha — the same line`" — emits the retro flag. Verified by
reading the line: the unset branch's action list is exhaustive (write nothing / log /
`ESCALATE:`) and contains no `RETRO:`. So the paragraph and D6 assert a behaviour the
executable prompt contradicts for the unset case.

This is not a requirements miss — Requirement 6 criterion 7 asks only that the task "report
the missing key and stop; … NOT record a fabricated outcome," which the prompt satisfies.
The defect is internal: the paragraph promises the run's actual stop mechanism for the
unset case is *a retro entry a human reads*, and D6's rationale is "the retro flag it
already routes leaves a visible record." In this run `ESCALATE:` is not routed (task 3's
branch is not loaded — R1-1), so the retro entry is the only visible decision record the
document names. For the unset case the prompt writes no retro flag, so no such entry
exists; the human-mediated stop the paragraph describes does not fire.

Failure scenario: the drafter's shell has `DEEPSEEK_API_KEY` unset (codebase-context
:107), so the implementer's session very plausibly hits the unset branch. Task 1 then
reports an unrouted `ESCALATE:` plus a buried `log-implementation` line, writes no launcher
body, and produces none of the retro entry the operator is told (line 7) to read. Fix:
either add `RETRO: gotcha` to task 1's unset branch (matching line 7 / D6 and preserving
the visible-record mechanism), or narrow line 7 and D6 to the `(a)`-failed case and state
that the unset case's visible record is the `log-implementation` summary, not a retro entry.

Classification: the clause lands in the human-mediated-stop text R1-1's v2 fix wrote and
deepens it, so Compounds R1-1; the v4 delta did not touch line 7 or line 16, so carried.

### R4-2 (SHOULD_FIX, fix-induced, Compounds R3-2) — the R3-2 fix left task 10's description bullet asserting an unconditional `verification` deferral, contradicting the Prompt/D5/Scope note it was harmonised with

The v4 delta rewrote all four R3-2 sites. Three now carry the discretionary qualifier:

- Prompt (`100`): "which — **only when its three-part test holds** — files a `deferrals`
  record with tag `verification`…"
- D5 (`108`): "**when its three-part test holds**, files the record with tag `verification`
  set explicitly (**the bar names no tag on its own and may instead record a HANDOFF
  gotcha**)"
- Scope note (`118`): "**per the Deferral bar's three-part test**, files the resulting
  record…"

The fourth — task 10's description bullet (`96`), also rewritten by this delta — does not:

> the orchestrator, which holds `deferrals`, routes that flag through the Deferral bar
> (…`SKILL.md:100-106,167-175`) **and files the record, tagged `verification` explicitly
> since the bar itself names none**.

Read alone it states the record is unconditionally filed and tagged — the exact
"guaranteed `verification` deferral" overstatement R3-2 was accepted to remove. The bar may
route the discovery to HANDOFF-as-a-gotcha instead (`SKILL.md:172-173`), in which case
`deferrals list tag=verification` (CLAUDE.md's re-run sweep) never surfaces the deferred
supervisor/orchestrator halves. The v4 Revision History entry for R3-2 asserts "**All
four** now say … only when the bar's test holds" — inaccurate for the description bullet.
Fix: add the same "only when its three-part test holds / may instead go to HANDOFF as a
gotcha" qualifier to line 96, or reduce it to a pointer to D5/the Prompt.

Severity note: the operative Prompt is correct and the orchestrator's filing is driven by
`SKILL.md`, not this bullet, so the practical blast radius is a reader/summary
inconsistency rather than a wrong implementation — a reviewer could defensibly downgrade to
MINOR. It is raised at SHOULD_FIX because it is an unresolved remnant of an accepted
SHOULD_FIX sitting in the task's headline description, paired with a false completeness
claim in the delta's own Revision History.

## Attack on the deltas (dispositions)

- **R3-1 fix — sound.** Both bare refs are now explicit `decomposition.md:…` and both
  ranges read exactly as the note claims. The out-of-bounds `SKILL.md` binding is gone.
- **R3-2 fix — landed in three of four sites; one gap.** D5, Prompt and Scope note are now
  accurate about the bar. The description bullet (`96`) still asserts the unconditional
  outcome (R4-2).
- **R3-3 fix — sound.** Success now reads "one … line naming that command," matching the
  Prompt's one-line/one-record design; the "per deferred half" count is gone.
- **v4 lint commit (17db435) — clean.** It only re-prefixed the two line-119
  `decomposition.md` refs (verified) and appended a Revision-History lint bullet; no ranges
  regressed. L-3 (69 tokens) remains the same new-artifact/correctly-cited-elsewhere class
  rejected v1–v3; spot-checked `DEEPSEEK_API_KEY`, `SDD_PROVIDERS`, `provider`,
  `tokensByProvider`, `verification`, and the two forward refs (lines 9, 37) — no range is
  genuinely wrong. Not re-raised.

## Fresh lens — truth table of the stated cases

- **`DEEPSEEK_API_KEY` set/unset.** Consistent everywhere except the task-1 unset branch
  (R4-1). Task 4 exit 3 (deepseek row + empty key) → task 5 roots refusal → task 10
  scenario (3) `env -u DEEPSEEK_API_KEY … exits 3` all agree. Task 10's own unset handling
  (scenarios (1)/(4) "failed, not deferred, `RETRO: bug`") is self-consistent and distinct
  from task 1's `gotcha`; both categories are authorised (`briefs.md:43-45`).
- **`provider = deepseek | anthropic | none`.** The launcher writes `provider=deepseek`;
  an absent key reads `anthropic` in the hook (scenario (2)), the usage fold (task 7 "else
  anthropic") and the watch model (task 8 `?? 'anthropic'`); the map value `none` yields
  `LAUNCHER=none` (task 5), no deepseek worker due (task 6) and no dim `providers` line
  (task 8). No contradictory outcome across surfaces.
- **Soft, checked, not raised:** task 7 keys the usage cell `AGENT@deepseek` for *any*
  non-`anthropic` provider, while task 8 buckets a non-`deepseek`/non-`anthropic` value
  into `anthropic`; they would diverge for a third provider string, but task 4's validator
  refuses any provider outside `{anthropic, deepseek}`, so the value never reaches either
  fold. Not a live contradiction.

## Top risks / gaps

1. **R4-1** — line 7 / D6 claim the unset-key preflight emits `RETRO: gotcha`; the prompt
   does not, so the retro-entry stop the document promises does not exist for the most
   likely run state (key unset in the drafter's shell).
2. **R4-2** — task 10's description bullet still asserts an unconditional `verification`
   deferral the discretionary Deferral bar does not guarantee, contradicting the Prompt/D5/
   Scope note the R3-2 fix claims it harmonised.
3. No third material gap. R3-1/R3-3 are cleanly resolved; the truth table is otherwise
   consistent; pinned literals and cited ranges verify.

## Top 3 conclusions to challenge

1. **Dependency order `:7` / D6: "a failed proof or an unset key makes task 1 report
   `ESCALATE:` and `RETRO: gotcha`."** Reverse: the unset branch of the prompt emits
   `ESCALATE:` only. Pick one — add the retro flag to the unset branch, or scope the claim
   to the `(a)`-failed case. (R4-1)
2. **Task 10 description `:96`: the orchestrator "routes that flag through the Deferral bar
   and files the record, tagged `verification` explicitly."** Challenge: the bar is
   discretionary and may file nothing (HANDOFF gotcha). Qualify it as the other three sites
   now are. (R4-2)
3. **v4 Revision History (R3-2): "All four now say … only when the bar's test holds."**
   Challenge: three do; the description bullet does not. (R4-2)

## What's missing before acting

- One consistent flag set for task 1's unset case across the Dependency-order paragraph,
  D6, and the prompt.
- The three-part-test qualifier on task 10's description bullet (or a pointer down to D5),
  so no site asserts a `verification` deferral the bar does not guarantee.

## Gate B / Gate C

No task introduces a new external dependency (the DeepSeek `claude -p` vendor path is
approved by Requirements 2/4/6; no new npm package). No `[gate-b:T…]`. No task does more
than the approved requirements ask: task 1's flags serve Requirement 6.6/6.7, task 10's
deferral serves Requirement 7 verification — the R4-1/R4-2 defects are wording/consistency,
not new scope. No `[gate-c:T…]`.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 1
MINOR: 0
DESIGN_READY: no
ESCALATE: none
```
