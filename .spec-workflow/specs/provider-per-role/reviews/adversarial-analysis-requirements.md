# Adversarial Analysis — provider-per-role/requirements (v2, round 1)

First adversarial review. v1 was never reviewed (drafted, linted, taken to gate A); v2
applies the gate A answers. Machine checks (spec-lint) passed on v2, so every `path:line`
citation resolves and every named identifier is in range — I re-read both ends of the
load-bearing ones and confirm the paths and ranges are accurate. The findings below are
about meaning, the v1→v2 delta, and the wire contracts across the spec's three boundaries.

Attack order per the round prompt: the gate A delta first (the refused-at-start change),
then the wire-contract lens (provider map → launcher, launcher → per-task spawn, run →
ledger/watch), then completeness and scope against the decomposition entry (spec 10).

---

## 1. The gate A delta: "refused-at-start run writes no ledger row"

The reviser changed D5, Req 1 crit 3, Req 4 crit 2, Req 7 crit 3 and the Reliability NFR.
It did **not** propagate the change to D2, and the change quietly rewrites a decomposition
scenario the document elsewhere claims to honour verbatim.

- **R1-1 (MUST_FIX) — D2 contradicts D5.** D2 (line 132, untouched by v2) still reads "A bad
  map row, an ineligible role, a missing key or a missing launcher refuses the run **with a
  note**." D5 (line 135, revised) now reads a run refused at start (missing key or bad map
  row) "**writes no ledger row**." A `note` is a ledger row (`formats.md:198`, and the
  pre-v2 Req 4 crit 2 wrote `note text="…"`). For three of D2's four cases — bad map row,
  ineligible role, missing key — "with a note" now directly contradicts D5 and the revised
  Req 1 crit 3 / Req 4 crit 2. Only "a missing launcher" is a genuinely different path
  (Req 2 crit 4 → `PHASE: error`, which is not a `note` either). D2 must be split into the
  start-refusal case (no row, per D5) and the mid-run missing-launcher case (`PHASE: error`),
  or it stays a live contradiction the design will inherit.

- **R1-4 (SHOULD_FIX) — Req 7 no longer makes decomposition scenario 4 "runnable as
  written."** Req 7's user story is "I want the decomposition's six scenarios runnable **as
  written**." The decomposition's scenario 4 (`decomposition.md:383-384`) reads: "a run with
  one DeepSeek role **stops at `run.start` with a `note`** naming the role and the missing
  key." Req 7 crit 3 now says the run stops "**writing no ledger row**; `--watch --once`
  SHALL show no entry." The gate A ruling (RI-1) is closed and I do not re-open it — but the
  requirement now silently diverges from the decomposition text it claims to run verbatim,
  and nothing records the divergence. Either the "as written" wording must drop/annotate, or
  the divergence from `decomposition.md` (still "with a note") must be recorded in Scope
  notes. As it stands the design phase reads two mutually contradicting source documents.

- **R1-3 (SHOULD_FIX) — the "first ledger row" boundary is under-specified; the refusal
  ordering and the pointer file are the casualties.** The prompt asks whether an implementer
  knows exactly when the first ledger row is written. They do not. Req 1 crit 4 pins the map
  **read** to the roots step (`SKILL.md:71-72`, step 1). But `run.start` — the first ledger
  row — is written in a later block (`SKILL.md:76-86`, after step 2), and that block first
  chooses the run id, writes `event.sh`, and **appends this run's line to the `active-run`
  pointer file**, then writes `run.start`. The document never states that the map
  *validation* and the `DEEPSEEK_API_KEY` *presence check* complete at the roots step, before
  that block runs. An implementer who follows Req 1 crit 4 (read at roots) and Req 2 crit 1
  (write `launch.sh` "at run start") can reasonably place the check after `run.start` — which
  violates Req 1 crit 3 / Req 4 crit 2, and leaves a stale `active-run` pointer line and an
  orphan `event.sh` with no `run.end`/`deregister` (memory: a stale pointer line silences a
  resumed supervisor's hooks). State that both checks complete before the `SKILL.md:76-86`
  ledger-start block, so a refusal precedes the run id, the pointer line and `run.start`.

Everything else about the delta is internally consistent: Req 5 crit 7 ("when `run.start`
carries a `providers` value") is unaffected because a refused-at-start run has no `run.start`;
the watch-view story (Req 7 crit 3, "no entry for that run") matches; the mid-run `PHASE:
error` path (Req 2 crit 4) still logs and is correctly kept distinct.

## 2. Wire contract: launcher → child → DeepSeek (the `--model` value)

- **R1-2 (SHOULD_FIX) — the launcher passes DeepSeek native names as `--model`, but the
  settled mapping routes them to `deepseek-flash`.** Req 2 crit 5 sets `--model` to "the
  map's DeepSeek name" and Req 2 crit 6 sets `ANTHROPIC_MODEL` to the same name — i.e.
  `deepseek-v4-pro` or `deepseek-flash` (Req 1 crit 1). The decomposition's settled endpoint
  facts (`decomposition.md:256-258`, which Scope notes line 150 says are taken as given and
  not re-probed) are that the endpoint maps `claude-opus*`→`deepseek-v4-pro`,
  `claude-sonnet*`/`claude-haiku*`→`deepseek-flash`, and **"any other name … silently to
  `deepseek-flash`."** `deepseek-v4-pro` is not a `claude-*` name, so by the settled rule it
  is "any other name" → **`deepseek-flash`**. Failure scenario: the operator maps the
  reviewer (the whole point — the most-spawned role, wanting the big model) to
  `deepseek-v4-pro`; the endpoint silently serves `deepseek-flash`; the ledger records the
  actual `message.model` (Req 3 crit 2) so the number is honest but the reviewer ran on the
  weaker model and no one is told. And preflight (a) does **not** catch it: its pass condition
  (Req 6 crit 2) is only "analysis file exists and ends with the verdict block"; it *records*
  `message.model` but asserts nothing about it. Resolve by either (a) mapping the tier to the
  `claude-*` alias the endpoint recognises before passing `--model`, or (b) making preflight
  (a) assert `message.model` matches the requested DeepSeek model, and failing when it does
  not.

## 3. Wire contract: provider map → per-run launcher

- **R1-5 (SHOULD_FIX) — `launch.sh`'s filled values omit the path the launcher needs to find
  its own body, the agent file and `agent-profiles.json`.** Req 2 crit 1 enumerates what the
  supervisor fills into `/tmp/scratchpad/sdd/<spec>/launch.sh`: "the spec dir, run id, spec
  and **the map**." Req 2 crit 2 says the per-run file "SHALL carry only run values and SHALL
  call a launcher body that ships with the harness under `harness/`," and Req 2 crit 5 says
  the body reads the agent file (`harness/agents/sdd-reviewer.md`) and `harness/agent-profiles.json`.
  None of those paths is derivable from "spec dir, run id, spec, map." The launcher needs the
  harness source path (`HARNESS_REPO`, the preflight's `source`, `SKILL.md:56`,`204`) to
  locate its body and the agent files. The enumerated set is incomplete; an implementer
  following crit 1 literally writes a `launch.sh` that cannot find what crit 2/crit 5 tell it
  to call and read.

- **R1-7 (SHOULD_FIX) — the stated purpose of reading `agent-profiles.json` contradicts the
  ledger contract.** Req 2 crit 5 says `--agents` is built partly from "`harness/agent-profiles.json`
  (**declared model and effort for the ledger**, `agent-profiles.json:47-51`)." But the ledger
  gets neither: Req 3 crit 1 writes `model=<requested DeepSeek name>` and `effort=not-applied`
  on `spawn.start`, and Req 3 crit 2 writes `model=<actual message.model>` on `spawn.end`. The
  declared values (reviewer `claude-opus-4-8`/`xhigh`) never reach any ledger row. Either
  `agent-profiles.json` is not needed by the launcher (drop the parenthetical) or its real use
  in the `--agents` JSON (a `model`/`effort` key the endpoint ignores anyway) must be stated —
  "for the ledger" is wrong and will send the implementer down a dead end.

## 4. Wire contract: run → child execution context (cwd / worktree)

- **R1-6 (SHOULD_FIX) — the launcher's "worktree cwd" premise never occurs for the eligible
  roles.** Req 2 crit 7 says the child "SHALL read the spec store and write under `reviews/`
  **from a worktree cwd**, where the spec store sits in the main checkout (`SKILL.md:63-67`;
  `--add-dir`)." But every DeepSeek-eligible role is a **document-phase** role — reviewer and
  checker (Req 1 crit 2), reviser only if promoted (Req 6 crit 4) — and the supervisor enters
  a worktree only "**Before the first implementation spawn**" (`SKILL.md:270-282`;
  `agent-rules.md:40`). Document phases run in the main checkout: the live `run.start` for
  this very spec has `worktree=no`, `codeRoot=<main checkout>`
  (`provider-per-role/harness-events.jsonl:1`). So no eligible role ever runs in a worktree;
  the child cwd is the main checkout with the spec store already under it, and the
  `--add-dir` is a no-op. If the launcher is built to compute the transcript slug from a
  worktree path or to depend on `--add-dir`, it targets a context that does not exist for its
  own roles. Describe the actual document-phase context (cwd = main checkout), or state both
  cases explicitly.

## Minor (do not keep the loop alive)

- **M1 — session id per launcher call.** Req 3 crit 3 requires locating the transcript
  deterministically via `--session-id <uuid>`, but does not say the uuid is fresh per
  invocation. A reviewer that runs across rounds 1/2/3 is three separate `claude -p` calls;
  reusing one session id would append round 2 onto round 1's transcript and `readUsage`
  (`sdd-activity.sh:37-49` summing all assistant entries) would over-count. The launcher
  generates the uuid, so this is naturally per-call, but a one-clause statement removes the
  risk.
- **M2 — count word.** Req 1 crit 6 adds `## Providers` as the fifth machine-read line;
  `docs/SDD-HARNESS.md:271` currently says "Four lines are machine-read." The count word must
  change to "Five" (agent-rules Documents rule, `agent-rules.md:58-59`) — a task-phase detail,
  noted so it is not lost.

---

## Top 5 risks / gaps

1. **R1-1 (MUST_FIX)** — D2 still says start-refusals write "a note"; D5 says no ledger row.
   Live self-contradiction from the v2 delta not reaching D2.
2. **R1-2 (SHOULD_FIX)** — `--model deepseek-v4-pro` silently resolves to `deepseek-flash`
   under the settled mapping; the reviewer runs on the weaker model and the preflight does not
   assert otherwise.
3. **R1-3 (SHOULD_FIX)** — the moment the first ledger row is written, and where the
   map/key check sits relative to the pointer-file append, is unstated; a wrong ordering
   leaves a stale `active-run` line.
4. **R1-5 (SHOULD_FIX)** — `launch.sh`'s enumerated values omit the harness-source path the
   launcher needs to find its body, the agent file and `agent-profiles.json`.
5. **R1-6 (SHOULD_FIX)** — the launcher's worktree-cwd premise contradicts how every eligible
   (document-phase) role actually runs (main checkout, `worktree=no`).

## Top 3 conclusions to challenge or reverse

1. **"A run refused at start should appear nowhere" is only half-wired.** The decision is
   closed, but the document ships it with D2 unchanged (R1-1) and Req 7 still claiming the
   decomposition scenario is honoured verbatim (R1-4). Ship the decision fully or not at all.
2. **"The map names the DeepSeek model and the launcher passes it as `--model`" (Req 2 crit
   5).** Reverse or qualify: the settled endpoint fact is a mapping *from Claude names*;
   passing a native `deepseek-*` name is the "any other name → flash" path (R1-2). The tier
   is selected by the Claude alias, not the DeepSeek name — or the preflight must prove
   otherwise before the launcher is built on this assumption.
3. **"The child runs from a worktree" (Req 2 crit 7).** Reverse: the eligible roles are all
   document-phase and run in the main checkout (R1-6). The launcher's cwd, `--add-dir` and
   transcript-location logic should be designed for the main-checkout case.

## What's missing before acting on this document

- Reconcile D2 with D5 and reconcile Req 7's "as written" claim with `decomposition.md`
  (which still says "with a note"). Until then the design phase has contradicting sources.
- Pin the supervisor's refusal ordering: map validation + key check complete at the roots
  step, before the run id / `event.sh` / pointer-line / `run.start` block.
- Settle the `--model` question in the preflight design (assert `message.model` equals the
  requested model), because the accounting value of the whole spec rests on the reviewer
  actually running on `deepseek-v4-pro`.
- Add the harness-source path to `launch.sh`'s filled values, and correct the
  `agent-profiles.json` "for the ledger" rationale.
- Rewrite Req 2 crit 7 for the real (main-checkout, document-phase) execution context.

ESCALATE: none — the `DEEPSEEK_API_KEY` handling (Req 4) is defensive by design (env only,
never in store/ledger/commit, child never carries `ANTHROPIC_API_KEY`); no secret hole, no
destructive action, no money/billing/legal surface a human must review now.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 6
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
