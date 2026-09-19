# Adversarial Analysis — question-gates/requirements (v1)

Round 1. First review. Fresh lens: wire contracts across a boundary (the
orchestrator → supervisor report, AskUserQuestion return shape, the record-mode
`questions.md` sink). Deltas since `5a8495b` (only AC 1.4, the lint pass) checked
first; then the fresh lens applied across the whole document.

## Delta since 5a8495b (checked first)

AC 1.4's new citation `docs/step-0-answers.md:105` is correct: line 105 reads
"`dontAsk` mode denies the call, also when an allow rule matches." The rewritten
sentence is a faithful, tighter grounding of the prior 96-107 range. No finding on
the delta. The Revision History "Lint pass. 2 fixed" line is consistent.

## Citations verified (grounding)

- `src/core/gate-rules.ts:101-135` — `parseSensitivePaths` (101-104) and
  `isSensitivePath` (133-135) both live in range; pure, no I/O (header 1-9). Accurate.
- `.spec-workflow/agent-rules.md:5-6` — `worktree-per-change: required` /
  `worktree-setup: npm ci`; D8's "top-of-file key beside `worktree-per-change`" is accurate.
- `harness/skills/sdd-continue/SKILL.md:232-261` — §5 uses AskUserQuestion (241);
  step-0 answer 5 (line 106) confirms the tool is absent in subagents, so the
  "supervisor is the only role with AskUserQuestion" claim holds.
- No `steering/product.md` exists; `docs/harness-efficiency-plan.md` exists and its
  step 3 (R7) matches the decomposition. `- File:` lines exist in the tasks template.
- Decomposition spec 7 scope items all appear in the requirements. No cut/deferral gap.

## Attack topics and findings

### Topic A — Gate B has no fire-once guard (the gate-A guard is not mirrored)

- Challenge the claim that Req 5 AC 3 ("run exactly one tasks-revision round, then
  proceed to implementation") is what the mechanism produces.
- Stress-test the interaction of Req 4 AC 1 + Req 5 AC 1 (both unconditional on
  "tasks reports approved") against a tasks-revision that itself ends in approval.
- Contrast with Req 2 AC 2, which explicitly stops gate A re-firing; gate B has nothing.

**R1-1 (MUST_FIX).** Gate B re-fires and contradicts itself. Req 4 AC 1 returns the
veto list "WHEN the `tasks` phase reports `approved`", and Req 5 AC 1 runs gate B
"WHEN the tasks phase reports `approved` and the veto list is returned" — both
unconditional. To run the "one tasks-revision round" of Req 5 AC 3 the supervisor
must re-spawn the document orchestrator for tasks with `MODE: revision`; that path is
Step R of `sdd-document-phase/SKILL.md`, which runs the reviser plus "At least one
review round runs before approval" (SKILL.md:257) and ends in `Step 6` reporting
`PHASE: approved` again — with a fresh veto list. Req 4 AC 1 + Req 5 AC 1 then fire
gate B a second time, directly contradicting Req 5 AC 3's "then proceed to
implementation." The same unguarded re-fire happens on the existing `design-defect`
loop (`sdd-continue/SKILL.md:198-203`), which re-runs tasks in revision mode before
resuming implementation. Gate A avoids this because Req 2 AC 2 guards it and its
revision is absorbed *before* round 1; gate B's revision happens *after* approval, so
nothing stops the loop. Add a fire-once guard for gate B (or scope Req 4 AC 1 to the
first approval, excluding gate-B and design-defect revalidation re-approvals).

### Topic B — The orchestrator→supervisor channel is undefined and over-capped

- Challenge the assumption behind D2/D11 that the orchestrator can "carry the
  decisions" and "return one ranked veto list" without a defined wire.
- Stress-test the payloads against the real report contract's hard limits.
- Cross-check that step 0 forbids the obvious escape hatch (a JSON schema).

**R1-2 (SHOULD_FIX).** No channel is defined for the gate-A decisions or the gate-B
veto list to cross the orchestrator → supervisor boundary, and the established
channel forbids them. The orchestrator report contract is "at most 150 words above
it, never file contents" (`formats.md:26`), restated in the agent itself: "Never
paste file contents… at most 150 words above it" (`sdd-document-orchestrator.md:49,51`).
The decisions are extracted document text and up to five veto items (paths, keywords,
dependencies, out-of-scope tasks) can easily exceed 150 words. The plan closes the
obvious workaround: "the Agent tool has no `schema` option, so… the text report
contract stays" (`harness-efficiency-plan.md:36,156`). D11 defers "the exact server
surface" but not this constraint, and the supervisor "never reads spec documents"
(D2), so it cannot fetch the text itself. Requirements must state that the payload
crosses via a server surface (not the 150-word report) or accept a bounded text
budget — otherwise design inherits an unsatisfiable contract.

**R1-3 (MINOR).** Related: Req 2 AC 3 has the supervisor "ask those decisions with
AskUserQuestion," but a `## Decisions taken in this document` entry is a *statement*
("D8 — … chosen because …"), not a `{header, question, options}` object. Nothing
says who converts a recorded decision (with its embedded "options considered") into
an askable question with options. Leave the payload shape to design, but name the
transformation and its owner.

### Topic C — Who reads and ranks the decisions

- Stress-test D2's rationale "ranking must happen where the document is read" against
  the orchestrator's actual reading discipline.
- Challenge the claim that the document orchestrator is the role that reads bodies.

**R1-4 (SHOULD_FIX).** Req 2 AC 1 and D2 assign "extracts and ranks the gate-A
decisions" to the document orchestrator, but the orchestrator's standing rule is:
"never the whole document: read the Revision History lines (grep), the verdict block…,
`grep -n '^#'` for structure, and worker reports. Nothing else"
(`sdd-document-phase/SKILL.md:20`). The document body is read by *workers*
(drafter/reviewer/reviser), not the orchestrator. D2's rationale — "the supervisor
never reads spec documents, so ranking by direction must happen where the document is
read" — conflates the orchestrator with the reader and is therefore wrong: the
orchestrator does not read bodies either. Either amend the skill's standing rule
(a real design change) or move extraction/ranking to a worker (the drafter already
writes the section and raises `RE-DECIDED` flags). As written the requirement forces
a rule violation.

### Topic D — Class (a) "no-list behaviour" is undefined and its one precedent is wrong

- Challenge "the module's no-list behaviour" as if it were a named, existing behaviour.
- Stress-test the Security NFR's "rather than reporting nothing" against the only
  concrete precedent in the codebase.

**R1-5 (SHOULD_FIX).** Req 4 AC 5 and the Security NFR say class (a) "SHALL fall back
to the module's no-list behaviour rather than reporting nothing," but no such
behaviour is defined for the new gate-B module, and the one precedent it points at
does the opposite of what a veto gate wants. `parseSensitivePaths` returns `null`
when there is no `## Sensitive paths` heading (`gate-rules.ts:98,102-103`); the only
consumer, `review-gate.ts:177-179`, reads `null` as "every path is sensitive." If the
gate-B module reuses that convention, a missing list makes *every* task's `- File:`
paths a class-(a) hit and floods the veto list — the exact "not five, but fifty"
failure the plan warns against (`harness-efficiency-plan.md:154`). The requirement
must state class (a)'s no-list behaviour explicitly (match no paths, keep the keyword
matches firing), not defer to an undefined "module behaviour."

### Topic E — Gate A "annotate" is unrouted; the approve/change/annotate branch is unpinned

- Challenge the completeness of Req 2's three human outcomes.
- Stress-test the AskUserQuestion return model the branch depends on.

**R1-6 (SHOULD_FIX).** Gate A defines "changes an answer" (AC 4 → revision) and "every
answer unchanged" (AC 5 → proceed), but AC 6's "annotates rather than approves" only
says the gate is advisory and "SHALL NOT hard-block" — it never routes the annotation
anywhere. Gate B's Req 5 AC 3 gives an annotation a concrete effect (one revision
round); gate A's annotation vanishes. Failure scenario: a human keeps the selected
option but adds "reconsider the persistence choice" as free text; under AC 6 that
comment is neither a change (no revision) nor recorded to `questions.md` — it is
silently dropped. Specify what a gate-A annotation does. This also exposes that the
spec branches on approve / change / annotate without pinning how those map to
AskUserQuestion's actual return (selected option + optional free text); the mapping is
the wire contract the fresh lens targets and it is unstated for both gates.

### Topic F — Smaller gaps

**R1-7 (MINOR).** Req 3 AC 1 and Req 6 AC 1 enumerate "unavailable or denied" but drop
the "returns an error" case that Req 1 AC 3 includes. Req 1 AC 3 is the general rule so
behaviour is defined, but an implementer reading Req 3/6 in isolation may not write the
error branch (does an errored AskUserQuestion write "no answer" to `questions.md`?).

**R1-8 (MINOR).** `questions.md` is a brand-new spec-store artifact — no references
exist anywhere under `harness/` or `src/` — with no template, schema, or persistence
rule. D5 names the writer but nothing says the file is committed; in record mode on a
crashing headless run the "record" is lost. Format is design-level, but the durability
(commit) and the "no answer" content shape belong in requirements.

**R1-9 (MINOR).** Gate-A timing versus the Lint step is unspecified. `Step 1` ends
"D = 1. Run the Lint step. Go to Step 2" (`sdd-document-phase/SKILL.md:93`); the Lint
step spawns a reviser that can rewrite citations inside `## Decisions`. Req 2 AC 1
fires "after v1 checkpoint" without saying before or after lint, so it is unclear which
text the human is shown.

## Top 5 risks / gaps

1. Gate B re-fires after its own annotation round and after design-defect revalidation
   — a contradiction and a potential loop (R1-1).
2. The decisions and veto list have no defined, in-budget channel to reach the
   supervisor; the text contract forbids file contents and caps at 150 words (R1-2).
3. Class (a)'s no-list behaviour is undefined and its only precedent floods the veto
   list with every task (R1-5).
4. Extraction/ranking is assigned to a role whose standing rule forbids reading the
   document body; D2's rationale is wrong about who reads (R1-4).
5. A gate-A annotation that is not a changed answer is silently dropped (R1-6).

## Top 3 conclusions to challenge or reverse

1. **D3: "a re-spawn… never re-fires it, needing no extra state."** True for gate A
   (guarded by Req 2 AC 2, revision absorbed before round 1) but the same reasoning was
   never applied to gate B, which fires *after* approval and therefore does need a guard.
   Reverse the implicit assumption that gate B is symmetric to gate A (R1-1).
2. **D2: extraction/ranking belongs to the orchestrator "where the document is read."**
   The orchestrator does not read bodies; workers do. Move the work or amend the rule
   (R1-4).
3. **Security NFR: no list ⇒ "the module's no-list behaviour rather than reporting
   nothing."** The only real no-list behaviour in the code is "every path sensitive,"
   which is the wrong default for a surface-the-worst gate. Pin the intended behaviour
   (R1-5).

## What's missing before acting on this document

- A fire-once condition for gate B, and a statement of what happens after a design-defect
  tasks revalidation (does gate B re-run?).
- The wire shape for `gate-a` and the veto list: a server surface or an explicit text
  budget, plus the decision→question transformation and its owner.
- An explicit class-(a) no-list rule (paths match nothing; keywords still fire).
- A gate-A annotation route (record to `questions.md`? feed the reviser? drop?).
- The `questions.md` contract: content on "no answer", and whether it is committed.
- The AskUserQuestion return mapping for approve / change / annotate, for both gates.

VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 4
MINOR: 4
DESIGN_READY: no
ESCALATE: none
