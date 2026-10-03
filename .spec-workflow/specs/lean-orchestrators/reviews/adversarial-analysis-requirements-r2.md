# Adversarial Analysis — lean-orchestrators/requirements (v2, round 2)

Primary attack surface: completeness, ambiguity, scope. Fresh lens for this round: a cold
read for internal contradictions plus a truth table over the stated cases the prompt names
— the W / per-source split and `base` sizing (Req 1), the transcript-cleanup survival
window (Req 2), the batch idempotency and partial-failure cases (Req 6.7), and the
open-tasks-at-phase-start rule and worst-case restart count in D1 (Req 7). Round 1 used
wire contracts across the four boundaries; this round reads the document as a self-contained
spec and tests the per-source split against the W floor.

## Deltas since v1 (c687ef8) — attacked first

The v2 delta answers R1-1 … R1-7. I checked each fix against the requirement it had to
satisfy, scoped to the diff (fix-induced re-check), and verified every new codebase claim
the delta introduced:

- **R1-1 (Req 1.3 transcript join).** Accurate and sound. A `spawn.end` row carries
  `agentId` but **no** `session` (confirmed against a real row:
  `.spec-workflow/specs/tdd-task-loop/harness-events.jsonl`; keys are `agent, agentId,
  cacheRead, cacheWrite, cacheWrite1h, cacheWrite5m, gapRewrites, input, model, output,
  run, spec, tokens, ts, type` — no `session`). All 8 orchestrator `agentId`s resolve to a
  session through `harness-activity.jsonl` (`ActivityEvent` carries both,
  `src/watch/ledger.ts:26-36`). The observed session is a UUID
  (`f568c603-8010-4b64-a406-3cc2a0dce28d`) and matches the `^[A-Za-z0-9-]+$` validator; the
  transcript segment `<session>/subagents/agent-<agentId>.jsonl` matches the hook
  (`harness/hooks/sdd-activity.sh:135-142`). `<projects dir>` override and the bounded
  per-project scan are now defined; Req 1.7 and NFR Security fold in the unresolvable
  `session`. **Resolved.**
- **R1-2 (Req 3.3 template set).** Accurate. `BRIEF_TEMPLATES` holds six kinds — `drafter`,
  `reviser`, `adjudicator`, `verifier`, `implementer`, `test-author`
  (`src/tools/harness.ts:493-557`); `reviewer` and `checker` are absent, matching Req 3.3's
  "SHALL be added." The deferred-text premise matches the cited comment
  (`src/tools/harness.ts:490-491`). **Resolved** (one range nit, R2-5 below).
- **R1-3 (Req 6.7 idempotency).** Partly resolved; a fix-induced gap remains — see **R2-2**.
- **R1-4 (Req 7.3 / D1).** Resolved for the stated cases; one edge remains — see **R2-4**.
- **R1-5 (Req 1.6 early capture).** Partly resolved; the snapshot half is still open — see
  **R2-3**.
- **R1-6 (Req 7.1 rationale).** Accurate: default `20` sits at
  `harness/skills/sdd-implementation-phase/SKILL.md:16`, rationale at `:17-20`. **Resolved.**
- **R1-7 (Req 3.5 close-path overlap).** Accurate: the implementation orchestrator reads the
  document-phase `references/cleanup.md` for `spec-edit.mjs` and the commit script
  (`harness/skills/sdd-implementation-phase/SKILL.md:49-58`); Req 3.5 now routes the close
  path through the Req 6 batch scripts. **Resolved** (other `spec-edit.mjs` uses left to
  design, as the Revision History states).

No new codebase claim in the v2 delta is false. No MUST_FIX in the delta.

## Findings

### R2-1 — The per-source attribution rule (Req 1.5 / D7) is under-specified: "input W" and `base` sizing — SHOULD_FIX — Novel, carried

Req 1.5: *"A call's output W SHALL go to `own-output`; its input W SHALL be split over the
sources in its context by size, with `base` sized once from the first call (D7)."* D7 claims
the split *"makes the source totals equal W by construction."* Criterion 6 then tests that
the source totals equal W within 1%. Two things that must hold for that test to pass are
never stated:

1. **"input W" is undefined and collides with the `input` field named in criterion 1.** W =
   `input + 1.25·cw5m + 2·cw1h + 0.1·read + 5·output` (criterion 1). On a real orchestrator
   `spawn.end` row the literal `input` is tiny next to the cache terms: `input=30`,
   `cacheRead=939333`, `cacheWrite1h=78278`, `output=4527` — so `input` is ~30 of ~273,000
   W. For D7's "equal by construction" to hold, **every** non-output term
   (`input + 1.25·cw5m + 2·cw1h + 0.1·read`) must be split over sources — which is exactly
   what the probe does (`inW = input + 1.25·cw5m + 2·cw1h + 0.1·cache_read`,
   `/tmp/scratchpad/sdd/lean-orchestrators/source-probe.js`). An implementer who reads
   "its input W" as the `input` field (the only term the formula calls `input`) attributes
   ~0.01% of W to context sources and fails criterion 6 by ~90%. Define "input W" as "all
   non-output W" (the four cache/read/input terms) in the AC, not three words after a
   formula that gives `input` a narrower meaning.
2. **`base` sizing needs a chars-per-token constant the document never names.** `base` is
   "the prefix not in the transcript" (~32k tokens, the single largest source at 25-36% of
   W); every other source is measured in characters ("character-proportional estimates",
   line 13). To "size `base` once from the first call" and split "by size" across a set that
   mixes a token-measured `base` and char-measured sources, you must reconcile the two units
   — the probe hardcodes `3.5` chars/token (`BASE = ctxTok − visibleChars/3.5`). No
   tokenizer is installed (D7). The constant does not threaten the *W total* (base+visible =
   ctxTok regardless), but it sets how much W lands on `base` versus `skill`/`read`/etc.,
   which is the breakdown's whole deliverable ("see which source a cut removed", Req 1 user
   story). Leaving the largest source's sizing method and the char/token bridge unstated
   hands the design phase an under-specified core algorithm.

Fix: in Req 1.5, (a) define "input W" as the sum of the non-output W terms, and (b) state
the `base`-sizing method (residual of the first call) and the char-to-token assumption the
split depends on, or point the AC at the probe as the normative algorithm.

### R2-2 — Req 6.7 idempotency does not cover the retro-log append or the HANDOFF rewrite — SHOULD_FIX — Compounds R1-3, fix-induced

Req 6.7 (the v2 fix for R1-3) makes the batch scripts idempotent by skipping "any step that
already landed (ledger row present, checkbox in the target state, change committed)." Those
three detectors cover three of the five steps the close batch bundles (Req 6.1). The close
batch is: checkbox `[x]`, `task.done` row, **retro-log entry**, **HANDOFF State row**,
spec-store commit (confirmed at `harness/skills/sdd-implementation-phase/SKILL.md:252-259`:
"Append a retro-log entry with `retro.sh` … Then rewrite the State row of the HANDOFF
section … and commit the spec store"). The two middle steps have no detector:

- The **retro-log entry** is an *append* carrying a per-run timestamp
  (`## <ts> · implementation · task <N> · …`, `SKILL.md:255-256`). Partial-failure case:
  the script appends the retro-log line, then the commit fails (Req 6.6). The orchestrator
  re-runs (Req 6.7). Checkbox is `[x]` → skip; `task.done` row present → skip; but the
  retro-log entry is an uncommitted working-tree append that none of the three detectors
  sees, so the re-run **appends it a second time** and the commit captures both. Matching on
  "task N" to detect it is itself unsafe — a task can legitimately carry two retro entries
  (a `ruling` entry at `SKILL.md:250` plus the task entry at `:255`).
- The **HANDOFF State row** is a rewrite (safer), but Req 6.7 does not say so; name it so
  the design does not treat it as another append.

This is the exact duplicate-record harm R1-3 named, surviving the fix for the two batched
steps that are not ledger rows — and Req 6.7's own "double-append a row (Req 6.5)" language
only reasons about ledger rows. Fix: extend Req 6.7's "already landed" set to the retro-log
entry (state its detection, e.g. a run-id-stamped marker the script can grep) and declare
the HANDOFF State row a rewrite, so a re-run cannot double-write either.

### R2-3 — The scenario-1 / baseline verification still hangs on transcripts that expire on a fixed calendar — MINOR — Compounds R1-5

v2 answered R1-5 by tying the scenario-1 capture to Req 2.1's early write (Req 1.6: "at the
same early point … before the transcripts age out"). That fixes *when* the capture happens
relative to implementation, but not the absolute clock:

- Req 2.3 establishes a retention window from the swm project dir only (oldest kept
  transcript 2026-09-13 on 2026-10-02 — roughly a 19-day horizon). The `tdd-task-loop`
  orchestrator transcripts are from late September; if Requirement 1's implementation (it is
  the first requirement) slips past mid-October, "the early point" is already past the
  expiry and scenario 1 (Req 1.6, the headline acceptance test) is unverifiable. R1-5
  offered two halves — "do it early **or** snapshot the transcripts"; v2 took only the first.
- Req 2.1 also writes the **`trading-rules`** baseline from the `tradr-hosted` project dir,
  whose retention Req 2.3 never establishes (it cites only the swm dir). That half of the
  baseline could already be un-capturable with no evidence either way.

Fix: either snapshot the two baseline specs' transcripts into the scratch store at spec
start, or state the `tradr-hosted` retention horizon so the reader can see the window is
open. MINOR because it is a verifiability risk, not a wrong implementation.

### R2-4 — "Open tasks read once at phase start and held fixed" has no holder across a supervisor restart — MINOR — Compounds R1-4

Req 7.3 pins the runaway-guard allowance to "the open-tasks count … read once at phase
start and held fixed." The guard lives in the **supervisor**
(`harness/skills/sdd-continue/SKILL.md:379-380`: "More than 12 orchestrator spawns for one
phase in this run is an error"), and the supervisor can itself be resumed/restarted
mid-phase (a resumed supervisor reuses its run id). The requirement names no place the
"phase start" count is persisted; a restarted supervisor would re-read a smaller open-tasks
count from `tasks.md` and recompute a smaller allowance — the very shrink R1-4 asked to
prevent. The floor of `max(12, …)` bounds the damage: the allowance only exceeds 12 when
`ceil(open/BUDGET) > 8`, i.e. more than 40 open tasks, which SDD specs rarely reach
(`tdd-task-loop` had 17). So this bites only a large phase that also sees a supervisor
restart. Fix: say the allowance is computed from the original task total (recoverable from
`tasks.md`'s total count, which does not shrink) rather than the live open count, so no
cross-spawn state is needed.

### R2-5 — Req 3.3 citation range truncates the sixth template — MINOR

Req 3.3 cites `BRIEF_TEMPLATES` as "six skeletons (`src/tools/harness.ts:493-544`)." All six
keys appear by line 544, so the "six" claim is substantiated, but the sixth template
(`test-author`) body runs to line 556 and the object closes at 557; the cited range stops at
the sixth key's opening line. Extend to `src/tools/harness.ts:493-557` so the citation covers
the whole of the sixth skeleton. Not a wrong target, so MINOR rather than a MUST_FIX.

## Truth-table check (fresh lens) — no contradiction found in the restart cases

D1 / Req 7, 17 tasks at BUDGET 5: `ceil(17/5)=4` work spawns → 3 restarts, matching D1's
"about three." Req 7.5 fires only when a budget-filling task (#5/#10/#15) is also the last
open task; for 17 it never aligns, so the completion-gate-only spawn does not occur and the
worst case for 17 is 3, within D1's "about four" upper bound. Guard: `max(12, ceil(17/5)+4)
= max(12, 8) = 12`, comfortably above the ~5 spawns needed. The restart accounting is
internally consistent for the stated cases; the only residual is the holder question (R2-4).

## Top 5 risks / gaps

1. The central attribution rule (Req 1.5/D7) is ambiguous on which W terms "input W" covers
   and silent on the `base` char/token constant; a literal reading fails the criterion-6
   test by ~90% (R2-1).
2. The batch idempotency fix (Req 6.7) leaves two of the five batched close steps — the
   retro-log append and the HANDOFF rewrite — without a detector, so a re-run after a commit
   failure double-writes the retro log (R2-2).
3. The headline acceptance test (scenario 1) and the `trading-rules` baseline still depend
   on transcripts with an expiry the document fixes only for one project dir (R2-3).
4. The runaway-guard allowance cannot be "held fixed" across a supervisor restart as written
   (R2-4) — low blast radius but unbounded in a >40-task phase.
5. A citation range nit (R2-5), cosmetic.

## Top 3 conclusions to challenge

1. **"the split makes the source totals equal W by construction" (D7).** It only holds if
   "input W" means every non-output term; as written the AC invites the one reading that
   breaks the construction (R2-1).
2. **"Req 6.7 … re-running after a partial failure cannot double-append a row" (Req 6.7).**
   True for ledger rows; false for the retro-log append the same batch performs (R2-2).
3. **"captured … before the transcripts age out" (Req 1.6).** Capturing early does not stop
   the clock; the transcripts expire on a calendar the spec only partly documents (R2-3).

## What's missing before acting on this document

- A precise definition of "input W" (the non-output W terms) and the `base`-sizing /
  char-to-token method in Req 1.5, or a pointer to the probe as the normative algorithm.
- Idempotency detection for the retro-log entry and an explicit "rewrite" classification for
  the HANDOFF State row in Req 6.7.
- Either a transcript snapshot at spec start or a stated retention horizon for the
  `tradr-hosted` project dir (Req 2 / Req 1.6).
- A restart-safe basis for the runaway-guard allowance (compute from the original task
  total, not the live open count).

ESCALATE: none. The transcript read is bounded to validated `session`/`agentId` and project
subdirs under `<projects dir>`; no secrets, auth, money or destructive action. The batch
idempotency gap risks duplicate retro-log lines, not data loss.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
