# Adversarial Analysis — question-gates/design (v1), round 1

Scope: design v1. Delta since the `docs(sdd): question-gates design v1` checkpoint is a
lint pass (21 citation fixes, one range widened, inline code un-backticked, one Revision
History bullet). Fresh lens applied: **wire contracts across a boundary** — trace every
shape the drafter/orchestrator write and the server/supervisor read.

## What I checked, and how

- **Delta first.** Re-verified every citation the v1 lint commit changed against the tree
  (both ends): `harness/skills/sdd-document-phase/SKILL.md:69-120` (Step 1 + Lint step) and
  `:236-245` (Step 6 reports `approved`); `harness/skills/sdd-continue/SKILL.md:14, 60,
  146-210, 185-210, 215-230, 232-261`; `references/formats.md:28-35` (PHASE enum block) and
  `:37-50` (PHASE table); `.spec-workflow/agent-rules.md:5-6`; `src/tools/harness.ts:24-25,
  517-544, 517-612`; `src/tools/index.ts:15,33,83`. All resolve, all ranges correct, the
  widened `517-544` now contains the `briefAction` identifier. **No misstated-artifact
  MUST_FIX in the delta.**
- **Code reads (both ends):** `src/tools/harness.ts` (schema 36-77, action switch 84-100,
  `briefAction` 517-612 incl. the missing-value guard 537-544); `src/core/gate-rules.ts`
  (`parseSensitivePaths`/`isSensitivePath` 101-135, `NO_LIST_REASON` 26 + consumption
  260-261, the local `taskBlock(markdown, lineNumber)` 157-167); `src/tools/review-gate.ts`
  177-194 (ENOENT⇒null); `src/core/task-parser.ts` (`ParsedTask` 108-128, `Files:` parse
  279-288, `taskBlock(content, taskId)` 365-385); `src/tools/index.ts`.
- **Harness reads:** `sdd-drafter.md` (tools 7-13, body 16-26), `sdd-reviser.md` (grant
  14-16), `sdd-document-orchestrator.md`, `sdd-document-phase/SKILL.md` (Step 0/1/Lint/
  Step 5/6/R), `sdd-continue/SKILL.md` (whole file), `references/formats.md`,
  `requirements-template.md` (Decisions 47-52).
- **Scope authority:** decomposition spec 7 and requirements v4. The design covers every
  listed item (gate A/B interactive+headless, mode resolution, three veto classes). No cut
  scope. Nothing in the decomposition entry is dropped.

The fresh lens found four seams where a producer and a consumer of the same shape disagree
or a mandated behaviour has no actor. Detail below.

---

## Topics attacked

### 1. The `gate put` payload wire (`slot`/`ops`/`put`/`get`) — Component 2

- **Challenge the claim that the schema and the `put` op agree on where the payload lives.**
  Component 2 says the schema (`harness.ts:36-77`) adds a top-level `payload (object)`
  property; the same bullet's `op: 'put'` says the action "writes **`values.payload`**";
  Component 3 has the drafter "call `harness gate put slot=a` with **`payload`** = `{…}`".
  Top-level vs nested is a contradiction on the exact field a producer writes and a consumer
  reads.
- **Stress-test the `briefAction` reuse.** Error Handling item 6 mirrors "`briefAction`'s
  missing-value guard (`harness.ts:517-544`)", and that guard reads `values.path`
  (line 538). Reusing that pattern implies `values.payload`; the schema addition implies a
  first-class `payload` arg. One of the two is dead on arrival.
- **Trace the malformed-payload path.** If the implementer builds the schema as written
  (top-level `payload`) but the handler reads `values.payload`, every well-formed call trips
  the "malformed payload" guard and writes nothing — gate A silently produces an empty
  surface, and the supervisor's `gate get slot=a` returns `present: false`.

### 2. Gate B "runs at most once" has no mechanism — Components 4/5, Req 5 AC 3/AC 6

- **Challenge the claim that gate B runs at most once.** The trigger is "before the first
  implementation spawn and worktree entry" (`SKILL.md:215-230`), and the guard is only that
  the orchestrator "writes no list" in `MODE: revision`. But `gate-b.json` **persists on
  disk**, and `gate get slot=b` returns `present: true` from the stale file every time the
  supervisor reaches implementation entry.
- **Trace the annotate path.** Req 5 AC 3: annotate ⇒ one `MODE: revision` tasks round ⇒
  orchestrator reports `approved` again ⇒ supervisor `approved` handler (`SKILL.md:187-190`)
  ⇒ step 3 ⇒ implementation. Implementation has **not** started yet, so this *is* "the first
  implementation spawn" ⇒ `gate get slot=b` ⇒ `present: true` (old list) ⇒ gate B asks
  approve-or-annotate **again**. This contradicts "run exactly one tasks-revision round, then
  proceed."
- **Contrast with gate A.** Gate A cannot re-fire because its trigger (`PHASE: gate-a`) only
  occurs in Step 1, and Step 0 never routes to Step 1 on resume (verified: `documentNextStep`
  returns `Step 2` once `D≥1`, `harness.ts:263`). Gate A also got a re-entrancy receipt
  (Req 2 AC 7). Gate B has neither a self-limiting trigger nor a run-once marker; the design
  imports gate A's safety story without the parts that make it safe.
- **Stress-test the design-defect claim.** The design says a design-defect re-approval
  "resumes implementation without re-reaching this point." That holds only because
  implementation already began (the defect came from implementation) so it is not the *first*
  spawn — but the design never states that dependence, and it does not save the annotate case
  or a fresh session resuming a tasks-approved spec with zero tasks done.

### 3. The gate-A reword-staleness path has no actor — Components 3/4, Req 2 AC 2

- **Challenge the claim that the drafter can rewrite a triple after the Lint step.** Req 2
  AC 2 mandates: if a lint fix must reword a decision's question or "options were" clause,
  "the drafter SHALL rewrite that decision's triple on the server surface before gate-a
  fires." The drafter runs **once**, in Step 1, before the Lint step (Component 3: "after
  writing requirements v1"). The Lint step spawns `sdd-reviser` (`SKILL.md:108-113`), not the
  drafter.
- **Trace the tool grant.** Only the drafter gains the `harness` gate grant (Component 3);
  `sdd-reviser.md:7-16` holds `adversarial-response` only. So the actor that performs the
  lint reword (the reviser) cannot write the gate-A surface, and the actor that can (the
  drafter) is not re-spawned. The mandated rewrite is unimplementable as designed.
- **Stress-test the ordering claim.** Component 4 fires `gate-a` "after the Lint step lands
  its fix." A lint fix that touches a decision line (a caps trim, a citation correction
  inside a decision) leaves `gate-a.json` stale, and the supervisor asks the pre-lint text —
  exactly the staleness Req 2 AC 2 (R2-5) was written to close.

### 4. The `{header, question, options}` → AskUserQuestion round-trip — Component 5, D4

- **Challenge the shape of `options`.** The gate-A payload's `options` is `string[]` (Data
  Models). AskUserQuestion consumes option entries, and Req 2 AC 4 already establishes that
  the tool caps *questions per call* (four) — so it is a capped, structured surface. The
  design never states the transform from `string[]` to what the tool takes, nor a bound on
  how many rejected alternatives a decision may carry.
- **Trace an overflow.** "options = chosen option plus the rejected alternatives already
  named in that decision's 'options were' clause." A decision that considered four or more
  alternatives yields five or more options for one question; nothing caps or truncates it,
  and the design does not say what happens when the tool refuses the call.
- **Stress-test approve-detection (D4).** Approve = "the reply selects `options[0]` with no
  free text." This assumes the tool returns something comparable to `options[0]` verbatim.
  The design never pins how the returned selection maps back to `options[0]`; if the reply is
  an index, a normalized label, or a truncated string, approve/needs-revision misclassifies —
  and misclassification here either wastes a revision round or skips a wanted one.
- **Note the source structure.** `requirements-template.md:47-52` gives decisions as
  "[decision]: [options considered]; chosen because [one line]" — it does not machine-separate
  the chosen option from the rejected set. The drafter (the LLM author) can pick `options[0]`,
  but the design leans on a phrasing convention the template does not enforce.

### 5. Data-model and parser field names — Components 1/2

- **Challenge "via `parseTasksFromMarkdown`, each task's `files` and `taskBlock`."**
  `parseTasksFromMarkdown` returns `ParsedTask` (`task-parser.ts:108-128`) with `files?` but
  **no** `taskBlock` field and **no** `title` — it has `description`. `taskBlock` is a
  separate exported function `taskBlock(content, taskId)` (`task-parser.ts:365`). The block
  is obtained per task by a second call; `TaskVetoInput.title` is `ParsedTask.description`
  renamed. (Dependencies does list `parseTasksFromMarkdown/taskBlock` separately, so this is
  imprecise prose, not a false signature.)
- **Stress-test the type coverage.** Component 1 defines `TaskVetoInput` and `ClassAItem`
  but not `GateADecision` or `VetoItem`, both used in Component 3/4 and Data Models. The
  `ClassAItem` → `veto` transform is unstated: which field becomes `summary`, how `rank` and
  `class: 'a'` are assigned, and what `ClassAItem.score` is computed from and means.

---

## Findings

**R1-1 — SHOULD_FIX — Gate B has no run-once mechanism; the annotate path re-fires it.**
Components 4/5 rely on `gate-b.json` presence plus "orchestrator writes no list in revision
mode," but the file persists and `gate get slot=b` returns `present: true` on every
implementation entry. The interactive annotate path (Req 5 AC 3) loops tasks-revision →
`approved` → step 3 → implementation entry, which is still the *first* implementation spawn,
so gate B asks again — contradicting Req 5 AC 3/AC 6 and the design's own "runs at most once."
A fresh session resuming a tasks-approved spec with zero tasks done hits the same re-ask.
Fix: consume/delete `gate-b.json` after the gate resolves, or gate on task progress, or add a
run-once marker mirroring gate A's `questions.md` receipt (Req 2 AC 7).

**R1-2 — SHOULD_FIX — The `gate put` payload field location is contradictory.** Component 2's
schema adds a top-level `payload` property, but `op: 'put'` writes `values.payload`, and the
Error Handling item-6 reuse points at `briefAction`'s `values.path` guard. Component 3's
caller passes top-level `payload`. If schema and caller are right, the handler reads
`values.payload = undefined` and trips the malformed-payload guard; if the handler is right,
the schema's `payload` property is dead. Producer and consumer disagree on the one field the
whole surface exists to carry. Pin it in one place (top-level `payload`, or `values.payload`)
and align the schema, the `put` op, Component 3, and Error Handling item 6.

**R1-3 — SHOULD_FIX — The Req 2 AC 2 reword-staleness rewrite has no actor.** Req 2 AC 2
requires the drafter to rewrite a gate-A triple when a lint fix rewords a decision, before
`gate-a` fires. The drafter runs once in Step 1 before the Lint step; the Lint step spawns
`sdd-reviser` (`SKILL.md:108-113`), which has no gate grant (`sdd-reviser.md:7-16`), and the
drafter is not re-spawned. As designed, no actor can perform the mandated rewrite, so a lint
fix touching a decision line leaves the surface stale and the supervisor asks pre-lint text.
Fix: either forbid the Lint step from touching decision text and state how that is enforced,
or grant the reviser the gate write and assign it the rewrite, or re-run the drafter's gate-A
step after lint.

**R1-4 — SHOULD_FIX — The option/answer round-trip is underspecified and can overflow or
misclassify.** Gate-A `options: string[]` is unbounded and its transform into AskUserQuestion's
option surface is unstated; a decision considering four or more alternatives produces a
question the tool may refuse, and the design gives no truncation or fallback. D4's
approve-detection ("reply selects `options[0]`") never states how the returned selection maps
back to `options[0]`, so a non-verbatim reply misclassifies approve vs needs-revision — either
wasting a revision round or skipping one. Pin a per-decision options bound (and the overflow
behaviour) and the answer→`options[0]` comparison.

**R1-5 — MINOR — Data-model gaps.** `GateADecision` and `VetoItem` are referenced but not
typed in Component 1; the `ClassAItem` → `veto` transform (source of `summary`, assignment of
`rank`/`class`) and the meaning/derivation of `ClassAItem.score` are unstated.

**R1-6 — MINOR — Parser field-name mismatch.** `TaskVetoInput` uses `title` and `block`, but
`ParsedTask` exposes `description` (not `title`) and no block field; `taskBlock(content,
taskId)` is a separate call. The Component 2 phrase "via `parseTasksFromMarkdown`, each task's
files and taskBlock" glosses the description→title rename and the second function call. State
the mapping so the handler is unambiguous.

---

## Closing deliverables

### Top 5 risks/gaps

1. **Gate B re-asks the human** on the annotate path and on any resume before implementation
   starts (R1-1) — the interactive contract Req 5 AC 3 promises "exactly one round, then
   proceed," and the design breaks it.
2. **The payload surface can be built inert** (R1-2): a schema/handler mismatch makes every
   `put` write nothing and every `get` return `present: false`, silently disabling both gates.
3. **Gate A asks stale text** after a decision-touching lint fix (R1-3), reintroducing the
   staleness R2-5 closed, with no actor able to correct it.
4. **Gate A can jam on a rich decision** (R1-4): >4 alternatives overflow the ask, and a
   non-verbatim reply misclassifies approve/needs-revision.
5. **Under-typed cross-component shapes** (R1-5/R1-6) leave the `ClassAItem`→`veto` transform
   and the parser→`TaskVetoInput` mapping to implementer guesswork.

### Top 3 conclusions to challenge or reverse

1. **"It runs at most once" (Component 5, gate B).** Reverse: as written it runs at least
   twice on any annotate, and again on a fresh resume. The claim needs a concrete run-once
   mechanism, not an orchestrator-side "writes no list" that leaves the file in place.
2. **"mirroring `briefAction`'s missing-value guard" for the payload (Error Handling 6 /
   Component 2).** Challenge: `briefAction` reads `values.*`; the schema declares a top-level
   `payload`. Decide one and make the mirror real, or the guard fires on valid input.
3. **"the drafter SHALL rewrite that decision's triple … before gate-a fires" (imported from
   Req 2 AC 2).** Challenge: the design assigns lint fixes to the reviser and never re-invokes
   the drafter. The conclusion that gate A always shows post-lint text is unsupported.

### What's missing — do before acting on this document

- A stated lifecycle for `gate-a.json` / `gate-b.json`: who writes, who reads, and **who
  deletes or marks consumed**, so neither gate re-fires from a persisted file.
- A single authoritative statement of the `gate` args shape (top-level `payload` vs
  `values.payload`) that the schema, the three ops, and both callers cite.
- The gate-A `options` bound and the answer→`options[0]` mapping, plus the overflow/refusal
  behaviour of AskUserQuestion for a decision with many alternatives.
- Types for `GateADecision` and `VetoItem`, and the `ClassAItem`→`VetoItem` transform incl.
  the `score` semantics and the `description`→`title` rename.
- One line resolving the reviser-vs-drafter grant for the Req 2 AC 2 reword case.

---

VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 4
MINOR: 2
DESIGN_READY: no
ESCALATE: none
