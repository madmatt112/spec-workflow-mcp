# Adversarial Analysis — question-gates/requirements (v3)

Round 3. Deltas since `59decb3` (the v3 round-2 response, R2-1..R2-6 + lint pass)
attacked first, then the fresh lens the prompt names: failure, rollback and
partial-failure paths (AskUserQuestion returns partially or times out, `questions.md`
write fails, the HANDOFF `## Phase log` row cannot be written, the run crashes between a
gate decision and the phase it gates, a `MODE: revision` round is interrupted).

## Delta citations re-verified

The v3 lint commit (`71f9ba6`) changed no body citation — it only appended a Revision
History disposition bullet. The v3 body delta (`c20fd99`) moved one citation into Req 1
AC 6; I re-read it and the adjacent unchanged citations the delta lines carry:

- `harness/agents/sdd-drafter.md:26` — "Report in 150 words or fewer: files touched,
  what you loaded, scope cut, flags. No file contents." Backs Req 1 AC 6's gate-A
  report-cap clause. Accurate.
- `harness/agents/sdd-document-orchestrator.md:49,51` — line 49 "Never paste file
  contents…", line 51 "…at most 150 words above it." Backs Req 1 AC 6 (gate B). Accurate.
- `harness/skills/sdd-continue/references/formats.md:25-26` — "At most 150 words above
  it, never file contents." Backs Req 1 AC 6 (gate B). Accurate.
- `harness/skills/sdd-document-phase/SKILL.md:20` — "…never the whole document… Nothing
  else." Backs Req 2 AC 1 / D2. Accurate.
- `src/core/gate-rules.ts:101-135` — `parseSensitivePaths` (102-104) and `isSensitivePath`
  (133-135). Backs Req 4 AC 2. Accurate.

Lint L-1..L-9 confirmed rejected, not overturned. L-1..L-5 are the recurring
citation-identifier false positive (`record`, `headless`, `question`, `options` are this
document's own gate-mode terms and AskUserQuestion payload keys, not text that must
appear in the cited ranges). L-6..L-9 flag the v2 Lint-pass bullet's own rejection note,
which the v3 disposition preserves verbatim. No new evidence to overturn any.

The R2-1 fix (Req 4 AC 1 scoped to first `MODE: normal` approval, cross-referencing Req
5 AC 6) is consistent: the first tasks approval is `MODE: normal`, an annotation- or
design-defect-driven re-approval is `MODE: revision`. Contradiction resolved. The R2-3
fix (Req 2 AC 5's per-decision approve/needs-revision split with one revision round
covering all such decisions) reads clean on the happy path. The remaining problem is the
producer-side capability and the failure paths, below.

## Attack topics and findings

### Topic A — Req 2 AC 1 hands the server-surface write to the one worker with no server tool

- Challenge the claim (Req 2 AC 1, R2-2 fix) that "the drafter SHALL write that ranked
  list of triples directly to the gate-A server surface."
- Cross-check D2's rationale ("the drafter already writes and reads the section it
  produces and needs no relay") against what "writing a server surface" actually requires.
- Stress-test the R2-2 fix: did moving the write onto the drafter close the broken wire,
  or relocate it onto an actor that cannot reach the surface?

**R3-1 (SHOULD_FIX). Compounds R2-2.** The R2-2 fix relocated the gate-A payload write
from the document orchestrator onto the drafter (Req 2 AC 1: "The drafter SHALL write
that ranked list of triples directly to the gate-A server surface… before its report").
But the drafter cannot reach a spec-workflow MCP server surface: its frontmatter grants
exactly `Read, Grep, Glob, Bash, Write, Edit` (`harness/agents/sdd-drafter.md:7-13`) and
no `mcp__spec-workflow__*` tool. Writing to a server surface in this codebase requires an
explicit MCP grant — the document orchestrator carries six of them
(`harness/agents/sdd-document-orchestrator.md:19-36`), and the reviser carries
`mcp__spec-workflow__adversarial-response` precisely because it writes to a server
surface (`harness/agents/sdd-reviser.md:14-16`). The drafter carries none. D2's rationale
conflates two different acts: the drafter "already writes and reads the section it
produces" through `Write`/`Edit` on the document file, which does not imply it can call a
server tool. So the accepted R2-2 fix did not close the broken-wire problem — it moved
the payload onto the only actor in the chain that cannot put it on the server, re-opening
the exact gap R2-2 was accepted to fix. Neither Req 2 AC 1, D2, D11 nor the Scope notes
flag that the drafter's tool grant must be extended (contrast: R1-4's memory note already
called the drafter "a hidden third role in the wire"). Fix: either state that the drafter
gains the gate-A server-write tool (a real change to `sdd-drafter.md`, verifiable in
design), or return the write to an actor that already holds a server grant (the
orchestrator, which then needs a way to obtain the list the drafter built — the relay
R2-2 tried to remove).

### Topic B — Gate A is dropped when the supervisor is interrupted mid-gate (D3's "no extra state")

- Trace what happens when the run crashes between the orchestrator's `gate-a` return and
  the supervisor's completion of the gate (Req 2 AC 5/AC 6 re-spawn).
- Stress-test D3's conclusion that a re-spawn "never re-fires it, needing no extra state."
- Check whether an interrupted block-mode gate A leaves any recoverable trace.

**R3-2 (SHOULD_FIX). Novel.** Gate A fires as an early return from document-phase Step 1
(Req 2 AC 2: "WHEN the document orchestrator checkpoints v1 and the Lint step has run…
THEN it SHALL return `PHASE: gate-a`"). Everything after that — asking, classifying,
re-spawning `MODE: normal`/`revision` — is supervisor-side. If the supervisor is
interrupted (crash, context exhaustion, killed session) after receiving `gate-a` but
before it completes the gate, a fresh supervisor re-orients: `spec-status` shows
requirements not approved (step 3 rule 4), it re-spawns the document orchestrator
`MODE: normal`. That orchestrator's Step 0 orient sees `D=1, A=0` and routes to Step 2
(the first review round) — orient never routes a v1 document back to Step 1, so the
`gate-a` return point is never reached again, and Req 2 AC 3 (resumes "from any later
state… SHALL NOT return `gate-a`") reinforces the suppression. The gate is silently
skipped. Worse, a block-mode gate A writes nothing durable: `questions.md` and the
HANDOFF `## Phase log` row are written only in `record` mode (Req 1 AC 5, Req 3 AC 2),
and the `## Phase log` row is by contract "one per phase transition" written by the
supervisor (`formats.md:51-58`) — a block-mode gate is neither. So the human confirmation
the whole spec exists for is dropped with no `record`-mode fallback and no
`questions.md` trace. This directly refutes D3's conclusion that a re-spawn "never
re-fires it, needing no extra state": "no extra state" is exactly what makes an
interrupted gate unrecoverable. (Secondary: the `gate-a` early return leaves the Step-0
`phase.start` with no matching `phase.end`, so the ledger's interrupted-row logic —
`sdd-continue` step 3 — may stamp the requirements phase `interrupted` even on a clean
gate-A run, but that row still neither re-runs nor records the gate.) Fix: persist gate-A
receipt (a `questions.md` stub or a HANDOFF marker) before asking, and define the
resume: re-ask, or fall through to `record` mode.

### Topic C — Partial / timed-out AskUserQuestion across the two-call split is undefined

- Enumerate Req 2 AC 4's "at most five, across at most two calls" against Req 3's
  whole-gate denial handling.
- Find the return the acceptance criteria leave undefined.

**R3-3 (SHOULD_FIX). Novel.** Req 2 AC 4 splits five gate-A decisions across two
AskUserQuestion calls (the tool takes at most four questions per call). Req 3 handles
denial/error only as a whole-gate event "WHEN the supervisor receives `gate-a`" — i.e.
at gate entry. Nothing covers a failure *between* the two calls: call 1 returns real
answers for decisions 1–4, call 2 is denied, errors, or times out for decision 5. This is
not hypothetical — the project's own memory records that on mobile Remote Control
AskUserQuestion returns "Denied by user" from a prompt bug, so a mid-sequence denial is a
live failure mode. The acceptance criteria never say whether the supervisor (a) records
decisions 1–4's real answers and `no answer` for decision 5, (b) discards call 1 and
treats the whole gate as `record` (losing four genuine human answers), or (c) re-asks
call 2. The same undefined split applies if the run crashes between the two calls. Gate B
avoids this — it presents one approve/annotate decision, not five — so this is gate-A
specific. Fix: define the partial-return outcome (most consistent: record the answered
decisions, treat the unreturned ones as `record`/`no answer`, proceed).

### Topic D — Record-mode write/commit failure

**R3-4 (MINOR). Novel.** Req 1 AC 5 requires `record` mode to write `questions.md`, write
a HANDOFF `## Phase log` row, and commit both "and proceed"; the Reliability NFR promises
the gate "always proceeds in `record` mode." If the `questions.md` write or the commit
fails, the two directives collide: non-stall says proceed, but proceeding loses the only
record of the skipped gate with no defined retry or surfacing. Low likelihood and
arguably a later-phase concern, but the fresh lens names it explicitly and the document's
non-stall guarantee is stated as absolute. Note the intended failure behaviour (proceed;
best-effort record) so an implementer does not stall the run trying to guarantee the write.

## Top 3 risks / gaps

1. The R2-2 fix routes gate A's payload through the drafter, the one worker with no MCP
   server grant (`sdd-drafter.md:7-13`); as written the drafter cannot put the list on the
   server surface, re-opening the broken wire R2-2 closed (R3-1).
2. An interrupted supervisor drops gate A entirely: orient re-routes a resumed v1 to the
   first review round, `gate-a` never re-fires, and block mode left no `questions.md` or
   HANDOFF trace — no `record`-mode fallback. D3's "no extra state" is the cause (R3-2).
3. A partial or timed-out AskUserQuestion across Req 2 AC 4's two-call split has no defined
   outcome; a call-2 denial after a call-1 success either loses real answers or is
   undefined (R3-3).

## Top 3 conclusions to challenge or reverse

1. **R2-2 "resolved" the drafter→surface channel.** It named the drafter as the direct
   writer but did not give the drafter a server tool; the payload still cannot leave the
   drafter (R3-1).
2. **D3: gate A needs "no extra state."** True only when every re-spawn happens *after* the
   gate completed. A re-spawn caused by an interruption *during* the gate silently drops
   it; the gate needs a durable receipt marker (R3-2).
3. **Req 3 covers the "denied AskUserQuestion" path.** It covers whole-gate denial at
   entry, not a mid-sequence denial across the two calls Req 2 AC 4 mandates (R3-3).

## What's missing before acting on this document

- State whether the drafter gains a gate-A server-write tool, or return the write to an
  actor that already holds a server grant; either way name the actor's capability, do not
  leave it implied by D2's document-write rationale.
- Define gate-A recovery after an interruption: a durable receipt written before asking,
  and the resume behaviour (re-ask vs fall through to `record`).
- Define the partial/timed-out AskUserQuestion outcome for gate A's two-call split.
- Note the record-mode write/commit-failure behaviour (proceed; best-effort record).

VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 3
MINOR: 1
DESIGN_READY: no
ESCALATE: none
