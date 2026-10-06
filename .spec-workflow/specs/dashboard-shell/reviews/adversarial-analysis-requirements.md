# Adversarial Analysis — dashboard-shell/requirements (v2, round 1)

Round 1 (no prior adversarial analysis or memory file for this lineage).
Primary surface: completeness, ambiguity, scope. Fresh lens: testability of
acceptance criteria. Deltas attacked first (RI-1, RI-2, the vitest-prefix lint fix).

## Verification performed

Read both ends of every cited range the document relies on; all resolve and are
accurate (no misstated-artifact MUST_FIX):

- `./vitest.config.ts:7-8` — line 7 `include`, line 8 `exclude: ['src/dashboard_frontend/**/*', ...]`. The v2 lint fix (adding `./`) is correct; the frontend exclude is real. (L-10 fix verified.)
- `src/dashboard/harness/run-setup.ts:166-168` — `launchable`/`disabledReason` at 167-168. Correct (Req 3 AC 4, D12).
- `src/dashboard/harness/types.ts:52-61` — `LaunchRecord` with `state 'running'|'stopping'|'stopped'|'exited'`, `exitCode`, `signal`, `endedAt`. Correct (Req 2 AC 4).
- `src/dashboard/harness/overview-watch.ts:238-265` — `buildRows`/`ledgerPaths` resolve pointer-spec-else-HANDOFF; `computeWaiting` (79-94) flags `gate-a`/`retro-ready`/`escalate`. Correct (Req 2 AC 7, AC 2).
- `src/dashboard/harness/project-watch.ts:62-65` (`parseGateSections`) and `:79-81` (`WATCHED_FILES` = events, activity, tasks, questions, HANDOFF). Correct.
- `src/watch/ledger.ts:186-199` (`parseJsonl` torn-line skip), `:202-218` (`parseHandoffPhaseRows`, row = date/phase/state/result/note), `:245-317`/`:245-460` (`buildModel`, spawn pairing). Correct.
- `src/watch/index.ts:42-56` (`resolveSpec` flag→HANDOFF→newest ledger). Correct.
- `harness/skills/sdd-continue/SKILL.md:513-516` (gate B record = HANDOFF row, no `phase.end`), `:218-230` (plan absent/`Status: DRAFT`→retrospective). Correct.
- `harness/skills/sdd-retrospective/SKILL.md:94-95` (count `DECISION NEEDED: yes`). Correct.
- `src/types.ts:126-136` (`SpecIndexEntry.deferred`). Correct.
- `src/dashboard/multi-server.ts:2019-2042` (task-review summary), `:2183-2284` (setup/launch/stop). Correct.
- `scripts/validate-i18n.js:88-90` (eleven locales). Correct.
- `src/dashboard_frontend/src/modules/app/App.tsx:240-270` (route table gated on `currentProjectId`), `ProjectProvider.tsx:62-105` (`/api/projects/list`, auto-select, 2.5 s poll), `HarnessPage.tsx:228-240` (save/launch/stop). Correct.
- `spec-decomposition/decomposition.md:784-855` — the dashboard-shell entry; line 837-839 confirms Gate A's four open questions (open-in-editor, i18n, **row density**, one-run-per-store); lines 799/817-818 confirm the decomposition's own "Rows 36 px" and "Open button for the editor" wording that Gate A overrode.

Lint items L-1..L-18: all `citation-identifier` warnings on prose/concept tokens
(browser API `localStorage`, backticked `jsonl`, wait-kind names). Confirmed each
cited range resolves; rejections stand.

## Findings

### R1-1 — SHOULD_FIX (fix-induced, from RI-2): the density setting has no defined values or default
Req 1 AC 6 now reads "Every list row SHALL render at the list density the operator
selects in the gear," AC 4 adds "the list density" to the gear, D4/D15 restate the
Gate A choice. But nothing in the document — not AC 4/6, not D4/D15, not the
decomposition (which only ever named "Rows 36 px", decomposition.md:799) —
enumerates the density options (how many levels, which row heights) or the default
when `localStorage` is empty. v1 carried a concrete, testable value (36 CSS px);
v2 replaced it with an unnamed "density."
- Untestable: an acceptance test cannot assert "rows render at the selected
  density" without the density set and their pixel heights.
- Incomplete: no default is stated for a fresh load.
- Downstream coupling: specs 16/17/18 "render inside this shell"; the decomposition
  e2e check 6 (no sideways scroll at 1000/375 px) and the 20-row pager (AC 7) assume
  a known row size. An implementer choosing arbitrary heights, or a later spec
  assuming 36 px, diverges.
The accepted Gate A decision (a gear density setting) is closed and not reopened
here; the gap is that the document never states the density levels and default that
decision requires. Fix: enumerate the density options (named levels + row heights)
and the default in AC 4/6 or D4.

### R1-2 — SHOULD_FIX: the `retro` and `exited` waits have no update-latency acceptance criterion
Req 2 gives latencies for only two of five wait kinds: AC 6 (`quiet`, 60 s via the
D10 minute tick) and AC 9 (`gate-a`, 5 s). Req 3 AC 9 refreshes Now within 5 s only
"WHEN a watched ledger, HANDOFF or pointer file changes" — which covers `gate`/
`ruling` (ledger `phase.end`) but NOT:
- `retro` (AC 3), derived from `retrospective-proposals.md`/`retrospective-plan.md`.
  Those are `.md` files; the existing per-project watcher globs `**/*.md`
  (src/dashboard/watcher.ts:37), so they can be observed without a new watcher —
  but no AC commits Now to re-deriving on that change, and they are not a "watched
  ledger, HANDOFF or pointer file." D10's minute tick is scoped to `quiet`.
- `exited` (AC 4), derived from the launch-record JSON (driven by `launch-update`,
  not a watched file), likewise with no stated latency.
Result: "the Now page reflects a retro/exited wait within N seconds" is untestable
(no target) and the shell may be built with no refresh trigger for these two kinds.
Scenario: an analyst writes `retrospective-proposals.md` for an otherwise idle
project; the operator's Now page shows no `retro` wait until an unrelated ledger
event forces a rebuild — possibly never. Fix: add a freshness AC for `retro` and
`exited` (event-driven on the spec-md watcher / `launch-update`, or fold them into
the D10 minute re-evaluation) and map each live-update AC to a test, a Playwright
spec, or a `verification-evidence.md` line (Scope note line 169 maps only e2e
checks 1-4 and 6, not these per-AC timers).

### R1-3 — MINOR: Now "Recently closed" and Specs "closed" use different definitions
Req 3 AC 5 populates Recently closed only from a `closeout` phase-log row with
result `closed` dated within seven days. Req 5 AC 2 marks a spec closed on that row
OR a `retrospective-plan.md` status of `CLOSED` (D17: older specs have only the
plan). A spec closed via plan-`CLOSED` with no dated closeout row therefore never
appears in Recently closed. This is defensible (plan status carries no date) but the
document never says why the two pages differ. Add a one-line note.

### R1-4 — MINOR (fix-induced, from RI-1): "Open action" names a copy, not an open
Req 5 AC 5 keeps the label "Open action" for an action that only copies the absolute
path to the clipboard and never opens anything (the decomposition called it an "Open
button for the editor", decomposition.md:817-818). The copy-only behaviour is a
closed Gate A ruling and is not reopened; only the label misleads — operators will
expect it to open the file. Suggest "Copy path".

### R1-5 — MINOR: Runs state values vs grouping
Req 4 AC 1 lists four state values (live, ended, stopped, exited) but only two
groups (Live then Ended). The grouping of `stopped` and `exited` rows is
unspecified (presumably under Ended). State it.

### R1-6 — MINOR: default visibility of a newly-registered project
Req 1 AC 2 says project toggles are "all on by default, kept in `localStorage`." It
does not say whether a project that registers after the toggle map is persisted
defaults on (absence-from-map = on). The obvious reading ("all on by default") is
on; a note removes the chance an implementer hides a new project's runs/waits,
which would defeat the "see all projects without switching" user story.

## Top risks/gaps

1. Density setting is unimplementable/untestable as written — no levels, no default (R1-1).
2. `retro` and `exited` waits have no update-latency AC — untestable and a plausible "wait never appears" bug (R1-2).
3. Live-update timing ACs beyond gate-a/ledger-follow are not mapped to any named verification path (R1-2, secondary).

## Top 3 conclusions to challenge

1. "RI-2 resolved the density decision." It recorded the *choice* (a gear setting)
   but not the *values*; the AC is not yet testable or buildable (R1-1).
2. "All waits are covered by the five-second / sixty-second freshness ACs." Only
   gate/ruling/quiet are; retro and exited fall through (R1-2).
3. "The Open action is settled." The behaviour is; the label contradicts it (R1-4).

## What's missing before acting

- Density levels and default in AC 4/6 or D4.
- A freshness AC for `retro` and `exited`, plus a verification-path map (test /
  Playwright / evidence line) for every "within N seconds" AC.
- One-line clarifications: Now-vs-Specs closed definition, Runs state grouping,
  new-project default visibility.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 4
DESIGN_READY: no
ESCALATE: none
```
