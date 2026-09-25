---
name: sdd-deferrals
description: "Works the deferred-decision queue of a spec-workflow project (the `deferrals` tool): triages every record into decide / fix / sweep / docs / stale / blocked / not-worth-it, escalates decisions, and fixes and verifies the rest with the pinned sdd-implementer, sdd-verifier and sdd-adjudicator agents. Invoke by name only (\"run the sdd deferral loop\", \"work the deferrals queue\", /sdd-deferrals). Never part of \"continue the sdd process\"."
---

# SDD deferral loop

This is the legacy deferral loop, unchanged except for the agents it spawns and the
paths it resolves. Read it end to end before doing anything.

## Agents and roots (read first)

- Find the **agent prefix**: the agent type available to your Agent tool whose name
  ends in `:sdd-reviewer`; the prefix is the part before the colon. Every spawn below
  uses `subagent_type: <prefix>:<agent>` (just `<agent>` when the prefix is `none`), foreground, no `model` parameter, never
  `fork`.
- Where the loop says "spawn a sub-agent" to **reproduce**, **review** or **verify**,
  spawn `sdd-verifier`. Where it says to **implement**, **fix** or **sweep**, spawn
  `sdd-implementer`. When a review does not converge after three rounds, spawn
  `sdd-adjudicator` once to rule on and fix the open findings, then one narrow
  verification with `sdd-verifier`, then resolve the record with the ruling in its
  resolution.
- Roots: call `spec-index` `generate` once; the spec store root is
  `projectContext.workflowRoot`, its parent is the spec store repo. The code root is
  the current working directory. HANDOFF is `<spec store root>/HANDOFF.md` if it
  exists, else `<spec store repo>/HANDOFF.md`. If `<spec store root>/agent-rules.md`
  exists, every brief starts with `Read and obey <that path> first.`
- Brief every worker with a file under `/tmp/scratchpad/sdd/deferrals/` and launch
  it with `Read and execute the instructions in <path>`. Workers report in 150 words
  or fewer, no diffs, no file contents.

You are an **orchestrator** for the deferred-decision queue — the records specs accumulate when
something was found but deliberately not done. You do **not** implement, read source, edit
source, run tests, or grep. Sub-agents do all of that. Your own tools are: spawning sub-agents;
reading and writing deferral records via the spec-workflow `deferrals` tool; and reading and
editing `HANDOFF.md`. None of those touch source content.

**A deferral is not a task.** A task is scoped, approved, and known to be wanted. A deferral is
a finding someone chose to postpone, written at a moment in time, against a codebase that has
since moved. Four things follow, and they shape this whole loop:

1. **It may no longer apply.** Verify before you spend.
2. **It may not be yours to decide.** Several deferrals exist precisely because the choice
   belongs to a human. Those get escalated, never built.
3. **It may be spec-sized.** A deferral that turns out to need requirements and design is a
   spec, not a fix. Stop and say so.
4. **It may not be worth doing at all.** Real, understood, and still not worth anyone's hour.
   Say so and close it. A queue nobody can face reading protects nothing.

**The queue is a shared cost, and you are the one who sets it.** Writing a record is nearly free
for you and expensive for every human who reads the queue afterwards. That asymmetry is the
failure mode of *this* version of the loop: an agent that triages inbound records rigorously and
emits outbound ones freely leaves the queue longer than it found it, run after run, until nobody
reads it. **Ending a run with more records than you started is a failure unless you can justify
it in one line.**

## Workspace contract (identical to the `sdd-continue` skill and both phase skills)

**Deferral state lives in the main checkout. Code may live anywhere.**

- **`.spec-workflow/` always resolves to the main checkout** — the repository root reported by
  `git rev-parse --path-format=absolute --git-common-dir` with the trailing `/.git` stripped.
  Resolve every `.spec-workflow/...` path against **that** root, never the cwd.
- **MCP calls use the default `projectPath`.** The spec-workflow server is pinned by `.mcp.json`.
  Never pass `projectPath` to `deferrals`, `spec-status`, `spec-index`, or `log-implementation`.
- **Sub-agents** inherit the cwd and keep doing source work there. Only their `.spec-workflow`
  reads/writes and MCP calls follow the rule above. Give each sub-agent the resolved absolute
  paths explicitly rather than letting it infer them.

**Commit on the current branch. Never switch branches.** Whatever branch HEAD is on when you
start is the branch every commit lands on. Pass that same instruction to every sub-agent. If the
project's own instructions require a worktree per change, get one **before** starting, not
mid-loop.

## Step 0 — Build the queue and triage it (once, before any work)

1. **Enumerate.** `deferrals action: list, status: deferred`. That is the queue. If it is empty,
   report `deferral queue empty — nothing to work` and stop.

2. **Read each one in full** via `deferrals action: get`. The `revisitCriteria` field is the
   acceptance test and the `revisitTrigger` says when it was meant to be revisited — a deferral
   whose trigger has not fired is usually not ready.

3. **Classify every item into exactly one bucket.** This is your judgement and it is the most
   important thing you do; do not delegate it.

   | Bucket | Meaning | What happens |
   | --- | --- | --- |
   | **DECIDE** | The choice belongs to the human. Product behaviour, UX, scope, cost, anything with more than one defensible answer. | Escalated at Step 1. Never built. |
   | **FIX** | A defect with one right answer, scoped small enough to build and verify. | Worked in the per-item loop. |
   | **SWEEP** | Mechanical, repetitive, wide. Verified once, applied many times. | Worked as one item with sampled review. |
   | **DOCS** | Belongs to a spec's own documents. | Reported for the `sdd-document-phase` skill's revision branch. Not built here. |
   | **STALE** | No longer reproduces, or was overtaken. | Resolved with evidence at Step 2. |
   | **BLOCKED** | Real, but its trigger has not fired or it depends on unfinished work. | Left deferred, reported. |
   | **NOT-WORTH-IT** | Real and reproducible, but the cost of doing it exceeds the harm of leaving it. | Closed at Step 2 with a resolution saying so. Never silently left queued. |

   When an item could sit in two buckets, put it in the **earlier** one in that table. A thing
   that is arguably a FIX but has a product question inside it is a DECIDE.

   **NOT-WORTH-IT is a real disposition, not a way to duck work.** It is for records that would
   sit unactioned forever: no victim, a trigger that will not fire, or a fix costing more than
   the defect. It is distinct from STALE (does not reproduce) and BLOCKED (real, waiting on
   something). Use it honestly and say plainly in the resolution that the thing was **not fixed**
   — a reader must never mistake it for work that was done. If in doubt between BLOCKED and
   NOT-WORTH-IT, ask whether the trigger will ever plausibly fire; if it will, it is BLOCKED.

## Step 1 — Escalate the DECIDE bucket, and stop on it

Report every DECIDE item **before doing any other work**, in this shape:

```
<id> — <one-line statement of the choice>
  Options: <2-4 concrete options, each with its consequence>
  Recommendation: <your pick, one line, with the reason>
```

Then **stop working those items**. Do not build them, do not pick for the human, do not park
them silently. Continue to Step 2 with the other buckets.

If the human has already supplied decisions — in the invoking prompt, or in reply to your
escalation mid-run — apply them: the item moves to FIX with the decision recorded, and you note
which decision you were given.

**A decided item runs the full per-item loop, including step 6.** It re-enters at step 2 and is
not finished until its record is resolved. This is the single easiest thing in this loop to get
wrong: the decision arrives, the work gets built and reviewed, and the record is left sitting at
`deferred` because the item never went through the loop that would have closed it. A built,
reviewed, shipped deferral still marked `deferred` is indistinguishable from an untouched one at
the next triage, and someone will re-cost it from scratch.

**Record the decision verbatim in the resolution**, including where it differed from what the
record proposed. A future reader needs to know the human chose this, not you.

## Step 2 — Clear the cheap buckets (STALE, NOT-WORTH-IT, duplicates)

For each STALE candidate, spawn a sub-agent to **prove** it no longer applies — reproduce the
original finding against current code. Proof, not reasoning: a deferral that merely *looks*
overtaken has been wrong before.

- Still reproduces ⇒ move it to FIX (or DECIDE if a choice surfaced).
- Genuinely gone ⇒ `deferrals action: resolve` with `resolution` naming the evidence and, where
  known, the change that closed it.

**Expect the record to be wrong about itself as often as it is stale.** Reproduction routinely
finds the finding is *worse* than recorded, or has a different cause, or was two problems filed
as one. Report what you actually measured against what the record claimed, and correct the
record — a number a later reader trusts is worse than no number.

For each NOT-WORTH-IT item, `resolve` it with a resolution that states it was **not fixed**, what
it would have cost, and what would make it worth revisiting. Do not delete records — other
records' resolutions cite them by ID, and a deleted ID leaves a dangling reference in prose you
can no longer edit.

Do the same for anything a newer deferral supersedes: `deferrals action: merge` folds the
duplicate into the canonical record rather than leaving two. Two records describing one problem
from different angles are a merge, not two items.

## Per-item loop (FIX and SWEEP)

Work one item at a time. Loop until the bucket is empty or a stop condition trips.

1. **Announce it.** Print `▶ <id>: <title>`.

2. **Confirm it still applies (fresh sub-agent).** Brief it with the deferral's `decision`,
   `context` and `revisitCriteria`, and have it reproduce the finding against current code
   before changing anything. **A deferral that cannot be reproduced is not fixed — it is
   resolved as STALE**, with evidence. Report which.

3. **Implement (same sub-agent).** Give it the `revisitCriteria` as the acceptance bar, plus the
   project's standing rules. Standing instructions:
   - Fix the cause the deferral names, not its symptom.
   - **Scope fence:** if the fix turns out to need its own requirements and design, or reaches
     well beyond what the record describes, STOP and report `SPEC-SIZED` with a one-line reason.
     Do not build it.
   - Add coverage that fails without the fix, and **prove it** — break it, watch it fail,
     restore. A deferral usually exists because nothing caught the problem the first time.
   - Report back in **≤150 words**: files touched (1 line each), the reproduction before and
     after, checks run + result, and any `SPEC-SIZED` or `NEW-FINDING` flag. **No diffs, no file
     contents.**

4. **Review (fresh, independent sub-agent).** Never self-review. Brief it against the deferral's
   `revisitCriteria` and the actual changed files. It SHALL report in ≤150 words: findings by
   severity, and a final line `VERDICT: pass | fix-required`.

   For a **SWEEP**, the review samples: a dozen instances spread across the affected areas, plus
   the mechanical proof that the sweep was complete (the grep, the count, the regenerated
   artifact). A sweep that changed 400 sites cannot be read line by line, so the reviewer's job
   is to confirm the *transformation* was sound and the *coverage* was total.

5. **Action findings, then re-review (cap 3 rounds).** Fix each Warning+ finding with a fresh
   sub-agent, then re-run step 4 so fix-induced regressions are caught. If still `fix-required`
   after 3 rounds, STOP at this item and report `review not converging`.

   **Route findings by severity, and do not let the leftovers become records.** This is where
   queue noise is manufactured: a thorough reviewer emits a dozen Warnings and Nits per item, and
   an agent with nowhere to put them files them all.
   - **Critical / Major** — fix, then re-review.
   - **Warning** — fix. If you genuinely will not, it may become a record **only if it passes the
     step 7 bar**. Most will not.
   - **Nit** — never becomes a record. Fix it in passing or let it go.

   **Expect each fix round to introduce its own defect, sometimes worse than the original.** A
   fix that trades a clipped element for a collapsed one, or a false message for a differently
   false one, is the normal shape of round two. That is what the re-review is for; do not skip it
   because the change looked small.

6. **Resolve the record.** Only after `VERDICT: pass`: `deferrals action: resolve` with a
   `resolution` that states what was actually done and `resolvedInSpec` where one applies. A
   fixed deferral left `deferred` is indistinguishable from an unfixed one at the next triage.

7. **Capture anything new — but make it earn the slot.** Step 0 triages inbound records
   rigorously. Apply the same rigour on the way out, or this loop is a net record generator and
   the queue grows every time it runs.

   A `NEW-FINDING` becomes a record **only if it passes all three**:
   1. **Symptom.** You can name what a user or a contributor would actually see. "X is
      unenforced", with no violation anywhere, is not a symptom — it is an observation.
   2. **Trigger.** The `revisitTrigger` names something that will plausibly happen. "If we ever
      build Y" is not a trigger.
   3. **Worth an hour.** If this were the last item in the queue, would you spend an hour on it?
      If not, it is not worth someone else rediscovering and re-costing it in six months.

   **Fails the bar but is worth knowing? It goes in `HANDOFF.md` as a gotcha, not the queue.** A
   trap that will bite whoever next edits a particular file belongs where they will meet it — a
   queue entry they will never read protects nobody. Most `NEW-FINDING` flags are gotchas.

   When a finding does pass, record it with `originPhase: implementation` and the origin spec.
   **Then read the record back and confirm the fields landed** — a record whose `originSpec` is
   missing will not appear in a filtered list, so it is invisible at the next triage.

   Two things that look like one record usually are not: if a record bundles unrelated edges, it
   cannot be actioned or closed as a unit, so split it. Two records describing one problem from
   different angles are the opposite case — merge them.

   **Never cite a deferral ID before it exists.** `resolution` cannot be edited after `resolve`,
   so an invented ID is permanent. Create the record first, then reference the ID it was given.

## Completion

When FIX and SWEEP are empty:

- **Verify as a set (fresh sub-agent).** Individually-green fixes can still break each other.
  Run the project's full check suite — typecheck, lint, unit, e2e, generated-artifact drift,
  and anything else CI gates on — the way CI runs it. Report ≤150 words + `VERIFY: pass | fail`.
  On fail, do not resolve anything further; stop and report.

  This step earns its cost. Every item can pass its own review and the suite still go red
  together, and what it catches is typically a regression one fix caused in another's territory
  — the worst kind, because per-item review structurally cannot see it.

- **Reconcile the queue before reporting.** Re-run `deferrals action: list, status: deferred` and
  check every item you worked this run is closed. Anything built, reviewed and shipped that is
  still `deferred` is a bookkeeping failure — fix it now, not when someone asks. Confirm the
  count you are about to report matches what the tool actually returns; do not report from
  memory of what you did.

- **Update `HANDOFF.md`**: what was resolved, what is still deferred and why, what is waiting on
  a human decision. The DECIDE bucket is the most valuable thing in that update — it is the list
  the human actually has to act on. Put the gotchas here too: the traps that failed the step 7
  bar, and anything a future run would waste time rediscovering.

## Stop + report

Close with a one-line status report, then stop. **Every form reports net queue change**, because
a run that closes eight and opens fifteen is not a success and must not read like one:

- Success: `deferrals: <n> resolved, <n> closed no-action, <n> raised — net <±n>; <n> awaiting decision, <n> still deferred`
- Awaiting decisions only: `deferrals: <n> awaiting decision — nothing else runnable (net <±n>)`

**A net-positive run must justify itself in one line, immediately after the status.** Sometimes
it is legitimate — a sweep genuinely uncovers a family of real defects. Usually it means the
step 7 bar was not applied.
- Spec-sized: `deferrals: <id> is spec-sized — needs its own spec, not a fix`
- Verification failed: `deferrals: set verification FAILED — <one-line>, resolutions not recorded`
- Review not converging: `deferrals: stopped at <id> — review not converging after 3 rounds`
- Budget: `deferrals: stopped at <id> — budget`
- Drift: `deferrals: stopped at <id> — drift (sub-agent over-shared)`

## Stop conditions

- **Success** — FIX and SWEEP empty, set verification passed, records resolved, HANDOFF updated.
- **Decisions outstanding** — everything runnable is done and only DECIDE items remain. This is
  a normal, healthy end state, not a failure.
- **Spec-sized** — a deferral needs requirements and design. Do not build it; it goes through
  the `sdd-document-phase` skill as its own spec.
- **Set verification failed** — individual fixes passed but the suite is red together.
- **Review not converging** — an item fails review after 3 fix+re-review rounds.
- **Budget risk** — continuing risks exhausting the token budget.
- **Drift** — file contents, diffs or test output accumulated in your own context.

## Notes

- **Triage is the product — on the way out as well as in.** A run that escalates six decisions
  and fixes two is a good run. So is one that closes five records as not worth doing. The two
  failure modes are an agent quietly deciding something that was not its to decide, and an agent
  leaving the queue longer than it found it.

- **Measure; do not infer from a passing test.** For anything geometric or visual — clipping,
  collapse, overlap, truncation — a green test is *no evidence at all*. These defects are
  invisible to DOM and presence assertions, which is how they ship in the first place and how
  they survive review. Require a real browser and a real number (rendered height, overflow,
  intersection) before and after, and require the coverage added to fail when reverted. The same
  applies to a claim about behaviour: prefer an executed request over a reading of the route.

- **A review can be confidently, specifically wrong.** Findings arrive with exact line numbers
  and correct-looking reconstructions and still reach a false conclusion. When two agents
  disagree on something load-bearing, do not pick the more detailed answer — settle it by
  experiment, and prefer the agent that ran something over the one that read something. Check
  especially whether a schema is actually *parsed* at runtime or merely used as a type; the two
  look identical in source and behave completely differently.

- **Never run two committing sub-agents on the same branch.** They collide: one broad `git add`
  sweeps another's staged files into the wrong commit, and the history cannot be repaired once
  pushed. Reviews and other read-only agents may run in parallel; anything that commits, or that
  regenerates artifacts or captures screenshots, runs alone against a clean tree.
- **Order within FIX:** cheapest-verifiable first. Deferrals are independent by nature, so there
  is rarely a dependency order — but a fix that lands with a green check quickly is worth more
  than a large one half-finished at the budget stop.
- **Do not re-open resolved records** to re-litigate them. If a resolution was wrong, that is a
  new deferral that supersedes the old one.
- **Do not bulk-resolve.** Each record gets its own verification. A deferral resolved without a
  reproduction check is exactly the thing this loop exists to stop. Closing as NOT-WORTH-IT is
  not an exception — it needs its own reasoning, stated in its own resolution.

- **Write the resolution for a stranger.** It is the only durable account of what happened. State
  what was actually done, what the record got wrong, what was deliberately left, and where the
  residuals went. It cannot be edited afterwards, so get the IDs right the first time.
