# Adversarial Review — question-gates/tasks v1 (Round 1)

First review of the tasks document. Primary attack surface: **atomicity, ordering, coverage**.
Fresh lens: the sub-agent that receives only a task's `_Prompt:` line plus the merged code
prior producer tasks leave — could it execute the task without the surrounding bullets?

Scope authority read: decomposition entry 7, `requirements.md` v4, `design.md` v3
(steering dir empty). Every cited artifact was read at both ends of every range.

## What I verified clean (show-the-work)

- **All delta citations re-verified accurate** (the lint commit fully-qualified tasks 4/5/6):
  `harness/agents/sdd-reviser.md:14-16` (three MCP-grant forms), `harness/agents/sdd-drafter.md:7-13`
  (tools block) `,16-26` (body/rules), `harness/skills/sdd-document-phase/SKILL.md:69-120`
  (Step 1 69-93 + Lint step 95-119) `,80-85` (Step 1 item 3 RE-DECIDED injection) `,127-131`
  (Step 2 item 3 prompt overwrite) `,236-245` (Step 6 approve/report),
  `references/briefs.md:194-218` (Disposition rules; bullet format 202-207),
  `src/core/lint-types.ts:17-24` (LintFinding, 1-based `line`),
  `harness/skills/sdd-continue/SKILL.md:146-210` (dispatch loop + PHASE routing) `,215-230`
  (worktree rule + HANDOFF commit) `,232-261` (retro AskUserQuestion + headless fallback) `,60`
  (HANDOFF commit). Task 1 `src/core/gate-rules.ts:101-135` (parseSensitivePaths 102-104,
  isSensitivePath 133-135). Task 2 `src/tools/harness.ts:517-612` briefAction, guard 537-544;
  `taskBlock` at `task-parser.ts:365-385` (signature `taskBlock(content, taskId): string|undefined`
  matches). Task 3 `formats.md:28-50` (PHASE enum line 29; table 39-49). All resolve.
- **Ordering DAG holds.** 1→2 (computeClassA), 2→4 (put slot a), {2,4}→5 (ops + drafter re-spawn),
  {2,3,5}→6 (get/delete + gate-a PHASE + emissions). Sequence 1..6 is a valid topological order;
  no task consumes a symbol a later task defines. D1's "no bridge/stub" claim is sound.
- **L-7 rejection upheld.** Task 4's forward mention of task 5's re-spawn names no call signature,
  label or helper task 5 creates — the drafter merely reacts to being re-spawned with a
  section-naming brief. No bridge required; producer-before-consumer covers it.
- **D5 confirmed against the tree.** `sdd-document-orchestrator.md` carries no copy of the PHASE
  return enum (the contract arrives via the launch prompt, agent line 43/51), so registering
  `gate-a` in `formats.md` alone (task 3) suffices; no orchestrator edit is needed. The
  orchestrator already invokes `harness` throughout the skill, so the new `gate` action needs no
  new grant — only the drafter (no MCP tool today, `sdd-drafter.md:7-13`) needs task 4's grant.
- **Coverage matrix complete.** Components 1→t1, 2→t2, 3→t4, 4→t5, 5→t6, 6→t3+t6. Every Req AC
  1.1–6.2 maps to at least one task. R2-4 (plugin-asset checks) and R2-5 (class-a input hygiene)
  are the two open MINOR findings from `adversarial-analysis-design-r2.md:139-151`; D3 and D2
  resolve them correctly, and the `additionalProperties:false` schema-atomicity risk
  (design-r2 risk 5) is absorbed by keeping enum+props+handler in one task (task 2).
- **L-1..L-6 dismissed (warnings, my call).** Line-8 citation `agent-rules.md:26` backs only the
  sync/`check:plugin-assets`/`claude plugin validate` mandate it sits with; `harness`, `gate`,
  `computeClassA`, `vitest`, `get`, `delete` are this document's own terms/identifiers scoped to
  other clauses of the split preamble. Same standing reason the requirements doc used to reject
  its recurring citation-identifier warnings. Not findings.

## Topics attacked

### 1. Req 2 AC 7 (durable receipt + resume recheck) — task 6 / design Component 5

- Challenge the claim that task 6 covers Req 2.7: its prompt writes the receipt "before asking"
  but never adds the step-3 resume check AC 7's second sentence mandates.
- Stress-test the resume path: an interrupted gate A leaves an unanswered receipt; on the next run
  the orchestrator orients to Step 2 (Req 2 AC 3 bars re-emitting `gate-a`), so nothing re-asks.
- Trace where the "re-ask or fall to record" logic would live — `SKILL.md:122` step-3 routing —
  and confirm neither task 6 nor design Component 5 puts it there.

### 2. Residual citation-path lint errors in the Revision History (L-8..L-12)

- Attack the lint-cleanliness claim: the v1 Lint-pass bullet (lines 87-90) describes its own fixes
  with bare filenames (`sdd-reviser.md`, `SKILL.md`, `references/briefs.md`), which spec-lint
  re-flags as unresolvable paths (error, citation-path).
- Stress-test "11 fixed": the document still emits five open ERROR-level findings, so it is not
  lint-green as its Revision History implies.

### 3. Atomicity of task 5 (gate A emission + gate B assembly in one task)

- Challenge one-task-per-component: task 5 bundles gate A (Step 1 emission + drafter re-spawn
  trigger) and gate B (reviewer tagging + reviser disposition + collection + fold + put on Step 6)
  — six behaviors across two files, two independent features that never depend on each other.

### 4. Under-specified tunables (task 1)

- Stress-test "each of the six keywords is tested": "external write" is a concept, not a literal
  token; design Component 1 / D7 give no pattern, so the regex is left to the implementer.

## Findings

### R1-1 — SHOULD_FIX — Task 6 covers only half of Req 2 AC 7; the resume recheck is specified nowhere

Task 6 lists `2.7` in `_Requirements` and its prompt writes "and commit the questions.md receipt
best-effort before asking." That satisfies AC 7's **first** sentence. AC 7's **second** sentence
requires: "WHEN step 3 (`harness/skills/sdd-continue/SKILL.md:122`) finds that receipt unanswered
THEN the supervisor SHALL re-ask or fall to `record` mode … instead of re-spawning `MODE: normal`
straight to round 1." Neither task 6's body/prompt **nor** design Component 5 (which task 6
delegates to via "Per design Component 5") specifies any step-3 check of `questions.md`. Design
Component 5's gate-A bullet is only "write the receipt … before asking (Req 2 AC 7)" — the write,
not the recheck.

Concrete failure: a run reaches requirements v1, gate A fires, the supervisor writes the receipt to
`questions.md`, then the process is interrupted (token cap, crash, Ctrl-C) before AskUserQuestion
returns or before the re-spawn. A fresh supervisor routes requirements (rule 4, `SKILL.md:122`) →
document orchestrator → orient D=1/A=0 → **Step 2**, never `gate-a` again (Req 2 AC 3). The human is
never asked; round 1 runs on v1 with direction unconfirmed — the exact waste gate A exists to
prevent, and precisely the silent-drop that requirements R3-2 added AC 7 to close. The task
delegates to a design that lacks the guard, so an implementer builds an incomplete AC 7. Fix: task 6
must add the step-3 receipt check (or the tasks doc must flag the Component 5 gap for a design
amendment); the coverage claim on Req 2.7 is otherwise overstated.

### R1-2 — SHOULD_FIX — Five open citation-path errors in the v1 Lint-pass Revision-History bullet

Lines 87-90 (the "Lint pass" nested bullets) describe the fixes with bare filenames that spec-lint
resolves against no path: `sdd-reviser.md:14-16` (L-8, L-9, line 88), `SKILL.md:69-120` and
`references/briefs.md:194-218` (L-10, L-11, line 89), `SKILL.md:146-210` (L-12, line 90). These are
open ERROR-level `citation-path` findings — the document is not lint-green, contrary to what "11
fixed" implies. Each bare name is ambiguous (e.g. `SKILL.md` matches `sdd-continue/` and
`sdd-document-phase/`, plus four `plugins/*` copies). Fix: code-fence or fully-qualify the paths in
the historical bullet without rewriting history (the paired fully-qualified citations already sit
beside them, so no artifact is wrong — only unresolvable as written).

### R1-3 — MINOR — `parseTasksFromMarkdown` cited at `task-parser.ts:108-128` points at the type, not the function

Task 2's `_Leverage` reads `parseTasksFromMarkdown/taskBlock src/core/task-parser.ts:108-128,365-385`.
`taskBlock` is correctly at 365-385, but `parseTasksFromMarkdown` is **defined at lines 153-356**;
`108-128` is the `ParsedTask`/`TaskParserResult` interface. `citation-identifier` passed only because
the identifier appears as a call inside the 365-385 range (line 366). The range is inherited verbatim
from approved design Component 2, and the function is trivially locatable, so MINOR — but the leverage
line points a reader at the return type rather than the function.

### R1-4 — MINOR — Task 5 bundles two independent features (gate A + gate B) in one task

Task 5 edits `SKILL.md` and `briefs.md` to deliver: gate A emission (Step 1, `PHASE: gate-a` after
Lint), the drafter re-spawn trigger (Decisions-range from `LINT.findings` minus `LINT.open`), gate B
reviewer tagging (round-prompt injection), gate B reviser disposition (briefs), gate B tag collection
(grep), and gate B fold+`put` on Step 6. Gate A and gate B share no data and target different skill
steps; either could ship and be verified independently. One-task-per-component is defensible, but this
is the largest and least atomic task and would review more cleanly split (5a gate A, 5b gate B).

### R1-5 — MINOR — "external write" class-a keyword has no defined pattern

Task 1 requires exporting `CLASS_A_KEYWORDS` with six patterns "(migration, delete/drop, auth,
billing, config, external write)" and success requires "each of the six keywords is tested." Five are
literal-ish tokens; "external write" is a concept with no regex in design Component 1 or requirements
D7, so the implementer invents both the pattern and its test oracle. The module is explicitly tunable,
so this is latitude rather than a blocker — but the sixth keyword is the one an implementer cannot
derive from the spec.

## Closing deliverables

### Top risks/gaps

1. **AC 7 resume recheck is un-designed and un-tasked (R1-1).** Interrupted gate A silently proceeds
   to round 1 unanswered — the failure the requirement exists to prevent.
2. **The document is not lint-green (R1-2).** Five open citation-path errors sit in its own Revision
   History; the next lint pass re-flags them.
3. **Task 5 concentration (R1-4).** The two-gate emission logic is the highest-risk change and is
   least atomic; a partial implementation is hard to catch in review.
4. **"external write" tunable (R1-5).** The one class-a keyword the implementer must invent.
5. **`parseTasksFromMarkdown` leverage range (R1-3).** Points at the type, not the function.

### Top 3 conclusions to challenge or reverse

1. **"Every design component is covered … all three veto classes are covered" (Scope notes) —
   overstated for Req 2.7.** Task 6 covers AC 7's write but not its recheck; the coverage assertion
   should be qualified until R1-1 is resolved.
2. **"11 fixed" (Revision History) implies lint-clean — reverse.** The document still emits five
   ERROR-level citation-path findings introduced by the fix itself (R1-2).
3. **D1: "no task needs a bridge or stub" — sound, keep.** Verified against the DAG; the only
   forward mention (task 4→task 5) is prose reaction, not a shared symbol. Do not add a bridge.

### What's missing before acting on this document

- Add the step-3 unanswered-receipt check to task 6 (and, if the design is the source of truth, an
  amendment to design Component 5), so Req 2.7 is fully implementable from the tasks doc.
- Code-fence the five bare paths in the v1 Lint-pass bullet so the document lints clean.
- Optionally split task 5 into gate-A and gate-B tasks and pin the "external write" pattern so task 1
  has a checkable oracle for all six keywords.

```
VERDICT: iterate
MUST_FIX: 0
SHOULD_FIX: 2
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
