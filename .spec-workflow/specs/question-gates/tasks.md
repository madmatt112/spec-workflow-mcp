# Tasks Document
Document version: v2

Dependency order: every producer lands before its consumer, so no task needs a bridge or stub.
Task 1 adds the pure `veto-rules.ts` module (new file, no callers). Task 2 adds the `harness` `gate` action, importing task 1's `computeClassA`.
Tasks 1-2 are `src/` changes that each leave `npx tsc --noEmit` and the touched `vitest` suites green.
Tasks 3-6 are `harness/` prose changes that do not affect the TypeScript compile or the `vitest` suites.

Each must run `node scripts/sync-plugin-assets.cjs` (committing the `plugins/` copies in the same commit), `npm run check:plugin-assets`, and `claude plugin validate . --strict` (`.spec-workflow/agent-rules.md:26`).

Task 3 registers the `gate-a` PHASE value; task 4 grants the drafter the tool and its gate-A step; task 5 emits both gates from the document-phase skill (using task 2's ops and re-spawning task 4's drafter); task 6 runs both gates in the supervisor (consuming task 5's emissions and task 2's `get`/`delete`).

- [ ] 1. Add the pure gate-B class (a) module in src/core/veto-rules.ts
  - File: src/core/veto-rules.ts
  - File: src/core/__tests__/veto-rules.test.ts
  - Export `CLASS_A_KEYWORDS` (the six tunable keyword patterns), the `TaskVetoInput` and `ClassAItem` types, and `computeClassA`, mirroring the `gate-rules.ts` pure-module shape with no I/O.
  - `computeClassA` scores a sensitive-path item 2 and a keyword item 1, returns items sorted score-descending, and when `sensitive` is null pushes no path item yet still scans keywords, never emitting `NO_LIST_REASON`.
  - Purpose: Mechanize gate-B class (a) in one tunable place (design Component 1, NFR Reliability).
  - _Leverage: src/core/gate-rules.ts:101-135 (isSensitivePath), the gate-rules.ts pure-module pattern_
  - _Requirements: 4.2, 4.4, 4.5_
  - _Prompt: Task: Create src/core/veto-rules.ts per design Component 1 and Data Models: export the six-keyword CLASS_A_KEYWORDS record (migration, delete/drop, auth, billing, config, external write), the TaskVetoInput and ClassAItem types, and computeClassA(tasks, sensitive) reusing isSensitivePath from src/core/gate-rules.ts; keep it pure with no I/O. Add src/core/__tests__/veto-rules.test.ts beside src/core/__tests__/gate-rules.test.ts. | Restrictions: Do not import from src/tools; do not reuse NO_LIST_REASON; a null sensitive list matches no path but still fires keywords. | Success: computeClassA sorts sensitive-path (score 2) before keyword (score 1) items, each of the six keywords is tested, the null-list case emits no path item and no NO_LIST_REASON, npx tsc --noEmit is clean, and npx vitest run src/core/__tests__/veto-rules.test.ts is green; the new test file alters no existing assertion._

- [ ] 2. Add the harness gate action (class-a, put, get, delete) in src/tools/harness.ts
  - File: src/tools/harness.ts
  - File: src/tools/__tests__/harness.test.ts
  - Add `gate` to the `action` enum plus optional `op`, `slot`, `payload` schema properties, and route a new `case 'gate'` in `harnessHandler` to a `gateAction` with the four ops.
  - `class-a` builds one `TaskVetoInput` per parsed task — coalescing an absent `files` list to `[]` and including header rows — reads the sensitive list (ENOENT gives null), and returns `computeClassA` (task 1); `put` writes `payload` JSON to `gate-<slot>.json`, `get` reads it (ENOENT gives `present: false`), `delete` removes it (ENOENT a no-op success).
  - Purpose: The MCP surface both gates' payloads cross (design Component 2, Req 1.6).
  - _Leverage: briefAction write pattern src/tools/harness.ts:517-612 (guard 537-544), selectRoots, PathUtils.safeJoin, parseTasksFromMarkdown/taskBlock src/core/task-parser.ts:153-356,365-385, computeClassA (task 1)_
  - _Requirements: 1.6, 4.1, 4.2, 4.3, 4.5, 5.6_
  - _Prompt: Task: Extend the harness tool per design Component 2: add gate to the action enum, add op/slot/payload schema properties, and implement gateAction with ops class-a, put, get and delete over the `specs/<spec>/gate-<slot>.json` files, reusing the briefAction write pattern and the computeClassA that task 1 exports. Build each TaskVetoInput with files ?? [] and include header rows (design Component 2, resolving R2-5). A missing or non-object payload on put fails naming it and writes nothing, mirroring briefAction's missing-value guard. | Restrictions: Do not change orient, brief or phase-log; never pass projectPath through; slot is a or b only. | Success: New tests in src/tools/__tests__/harness.test.ts cover put then get round-trip, delete then get present false, get on an absent file present false, class-a ranking a sensitive-path task above a keyword task, a header-row keyword firing, an empty-files task not crashing, and a missing sensitive list not failing; no existing assertion in that file changes (none pins the action enum or the unknown-action message); npx tsc --noEmit clean; npx vitest run src/tools/__tests__/harness.test.ts green._

- [ ] 3. Register the gate-a PHASE value in the supervisor contract
  - File: harness/skills/sdd-continue/references/formats.md
  - Add `gate-a` to the report-contract PHASE enum and one PHASE-table row describing it: `gate-a` | document orchestrator | run gate A, then re-spawn requirements.
  - Purpose: Register the new orchestrator return the supervisor routes on (design Component 6).
  - _Leverage: the PHASE enum and table at harness/skills/sdd-continue/references/formats.md:28-50_
  - _Requirements: 1.6, 2.2_
  - _Prompt: Task: Add the gate-a value to the PHASE enum and a matching PHASE-table row per design Component 6. Run grep -n 'PHASE:' over the file to find every enum listing so no copy is missed. | Restrictions: Change no other field name or order; this is a harness/ prose change; edit only the harness/ source, never the plugins/ copies by hand. | Success: gate-a appears in the enum and the table; node scripts/sync-plugin-assets.cjs regenerates the plugins/ copies (committed in the same commit); npm run check:plugin-assets passes; claude plugin validate . --strict passes._

- [ ] 4. Grant the drafter the harness tool and add its gate-A extraction step
  - File: harness/agents/sdd-drafter.md
  - Add the `harness` MCP tool to the frontmatter in the three plugin-prefixed forms that mirror the reviser's `adversarial-response` grant, and add one requirements-phase-only body step.
  - The step extracts and ranks at most five direction-setting decisions from the document's own `## Decisions taken in this document`, builds one header/question/options triple each (options[0] the recorded choice plus at most three rejected alternatives in clause order), and writes `{items}` through the gate action's `put` op (task 2, slot a) before the report; design and tasks phases write nothing.
  - Purpose: Put gate A's ranked decisions on the server surface (design Component 3, Req 2.1).
  - _Leverage: harness/agents/sdd-reviser.md:14-16 (three-form MCP grant), harness/agents/sdd-drafter.md:7-13,16-26, design Data Models GateADecision_
  - _Requirements: 2.1, 1.6_
  - _Prompt: Task: Per design Component 3, add the harness MCP tool to sdd-drafter.md's tools in all three plugin-prefixed forms (as harness/agents/sdd-reviser.md:14-16 grants adversarial-response), and add a requirements-phase-only step that extracts up to five ranked direction-setting decisions from the document's own Decisions section, builds one header/question/options triple each capped at four options, and writes {items} through the gate action's put op that task 2 adds (slot a) before the drafter's report. When the document-phase skill (task 5) re-spawns the drafter after a decision-touching lint fix, re-read the corrected section, re-extract and re-rank the full set, and re-put the complete item list (put overwrites the whole file). | Restrictions: Only the requirements phase writes a gate-A payload; keep the drafter's report under 150 words with no file contents; edit only harness/ source, never the plugins/ copies. | Success: The frontmatter lists the three harness forms; the body step matches Req 2.1 and design D9; node scripts/sync-plugin-assets.cjs regenerates plugins/ (committed together); npm run check:plugin-assets and claude plugin validate . --strict pass._

- [ ] 5. Emit gate A and assemble gate B in the document-phase skill
  - File: harness/skills/sdd-document-phase/SKILL.md
  - File: harness/skills/sdd-document-phase/references/briefs.md
  - Gate A: Step 1 (requirements, MODE normal) returns `PHASE: gate-a` after the Lint step and before Step 2; a fixed lint finding whose line falls in the Decisions-section range re-spawns the drafter (task 4) first. A resume to a later step never re-emits it.
  - Gate B: the round prompt tags new-dependency/out-of-scope tasks `[gate-b:Tid]`/`[gate-c:Tid]`, the reviser records kept or removed, and the first `approved` (Step 6, MODE normal) folds the kept tags with `gate class-a` (task 2) into one ranked list `put` to slot b; MODE revision writes none.
  - Purpose: Emit both gates without reading the document body (design Component 4).
  - _Leverage: harness/skills/sdd-document-phase/SKILL.md:69-120 (Step 1 + Lint), :80-85,127-131 (round-prompt injection), :236-245 (Step 6), harness/skills/sdd-document-phase/references/briefs.md:194-218, src/core/lint-types.ts:17-24_
  - _Requirements: 2.2, 2.3, 4.1, 4.3, 4.4, 5.6_
  - _Prompt: Task: Per design Component 4, edit the document-phase skill and briefs so Step 1 (requirements, MODE normal) returns PHASE: gate-a after the Lint step and before Step 2, re-spawning the drafter (task 4) when a fixed lint finding's line falls inside the Decisions section range computed from LINT.findings minus LINT.open and grep -n '^#'; and so gate B is assembled from reviewer tags [gate-b:Tid]/[gate-c:Tid] injected at the same round-prompt point Step 1 item 3 uses for RE-DECIDED, recorded kept or removed in the reviser's Revision-History bullet, then collected by grepping Revision-History lines, folded with gate class-a (task 2) into one ranked list, and put to slot b on the first approved. | Restrictions: Never read the document body beyond the permitted greps and worker reports; MODE revision returns no veto list and re-emits no gate-a; edit only harness/ source, never the plugins/ copies. | Success: Step 1 returns gate-a only in the requirements normal path; the gate-B veto list is assembled without a body read and put to slot b once; node scripts/sync-plugin-assets.cjs regenerates plugins/ (committed together); npm run check:plugin-assets and claude plugin validate . --strict pass._

- [ ] 6. Run both gates in the supervisor skill
  - File: harness/skills/sdd-continue/SKILL.md
  - Mode resolution: `gates: block | record` from `agent-rules.md`, else by AskUserQuestion availability; a denied, errored or absent call stays record, ledger `headless` untouched.
  - Gate A: on `PHASE: gate-a`, receipt then ask; approve to MODE normal, any change to one MODE revision re-spawn; record writes no answer and a HANDOFF row. Resume: step 3 rule 4 re-checks the receipt before dispatching (Req 2 AC 7).
  - Gate B: before the first implementation spawn/worktree, `gate get` slot b, ask approve-or-annotate (one round on annotate; record writes the veto list and a HANDOFF row); `gate delete` slot b.
  - Purpose: Resolve each gate's mode without stalling (design Component 5).
  - _Leverage: harness/skills/sdd-continue/SKILL.md:122, :146-210, :215-230, :232-261, :60_
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.4, 2.5, 2.6, 2.7, 3.1, 3.2, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.1, 6.2_
  - _Prompt: Task: Per design Component 5, add gate execution to the supervisor skill. Add mode resolution (read gates: block | record from agent-rules.md; default block when AskUserQuestion is available, record when not; a denied, errored or absent call is record and leaves the ledger headless flag untouched) and document the optional key. On PHASE: gate-a, gate get slot a, write and commit the questions.md receipt best-effort before asking, ask the triples (at most five across at most two calls, four options each), map an approve to options[0] verbatim with no free text and anything else to a single MODE revision re-spawn naming each decision's option and free text, and record every decision and answer; record mode writes no answer, a HANDOFF row, and MODE normal. At step 3 rule 4 (harness/skills/sdd-continue/SKILL.md:122), before dispatching phase requirements, check whether the gate-A receipt in questions.md is unanswered; if so resolve gate A now (ask or record) exactly as for a fresh PHASE: gate-a, instead of dispatching MODE normal straight to round 1. Before the first implementation spawn and worktree entry, gate get slot b, ask approve-or-annotate (annotate runs one MODE revision tasks round; record writes the veto list and a HANDOFF row), then gate delete slot b so a later entry finds present false. | Restrictions: Never stall an unattended run; never read a spec document; a denied call never flips headless; edit only harness/ source, never the plugins/ copies. | Success: Both gates resolve, ask or record, and route without stalling; an unanswered gate-A receipt found at phase-requirements entry is resolved before dispatch, never silently reaching round 1 unanswered; gate B runs at most once via gate delete; node scripts/sync-plugin-assets.cjs regenerates plugins/ (committed together); npm run check:plugin-assets and claude plugin validate . --strict pass._

## Decisions taken in this document

- D1 — Tasks are ordered producer-before-consumer, so no task needs a bridge or stub: options were interleaving skill and code work or a strict producer-first order; chosen because forward-only dependencies keep each step compiling and every existing suite green without scaffolding.
- D2 — R2-5 (class-a input hygiene) is covered in task 2 by coalescing an absent `files` list to `[]` and including header rows: options were dropping header rows or keeping them; chosen because a header's block is bounded by the next checkbox, so a keyword there (migration, auth) is real signal, and the advisory ranked list tolerates a header false positive.
- D3 — R2-4 (plugin-asset checks) is covered by baking `node scripts/sync-plugin-assets.cjs` + `npm run check:plugin-assets` + `claude plugin validate . --strict` into every harness/ task's Success line: options were one separate verification task or per-task checks; chosen because each harness/ edit must leave `plugins/` in sync on its own commit (`.spec-workflow/agent-rules.md:26`).
- D4 — No edit is made to the live `.spec-workflow/agent-rules.md` `gates` key: options were adding the key or leaving it absent; chosen because the key is optional and absent by default (design Component 6), so the supervisor mode-resolution step (task 6) documents it and mode resolution handles its absence.
- D5 — No task edits `sdd-document-orchestrator.md`: options were editing the wrapper or only the skill; chosen because the agent is a thin wrapper that reports whatever PHASE the skill returns, and the `gate-a` value is registered in `formats.md` (task 3), so the skill change (task 5) suffices.
- D6 — The four end-to-end gate scenarios and the full-suite run (`npm run build`, `npm test`) are the run-level verification gate, not an automated task here: options were a scripted e2e task or the existing verification gate; chosen because the decomposition entry's scenarios need a live supervisor with and without AskUserQuestion, which no `vitest` suite can drive.

## Scope notes

- Every design component is covered: Component 1 → task 1; Component 2 → task 2; Component 3 → task 4; Component 4 → task 5; Component 5 → task 6; Component 6 → task 3 (`formats.md`) and task 6 (the `gates` key documentation).
- The two open MINOR design gaps are weighed and covered: R2-4 (plugin-asset checks) by D3, R2-5 (class-a input hygiene) by D2.
- Nothing the decomposition entry (spec 7) lists is cut or deferred: gate A interactive and headless, gate B interactive and headless, mode resolution, and all three veto classes are covered.
- The four end-to-end fixture scenarios and the full-suite run are the run-level verification gate (D6), not an automated task in this document.

## Revision History
- **v1** (2026-09-16) — Initial draft.
  - **Lint pass.** 11 fixed; rejected: L-7 (task 4's mention of task 5's re-spawn behavior names no call signature, label or helper name task 5 creates, so the template's bridge/stub rule does not trigger; D1's producer-before-consumer order already covers it).
    - L-1..L-6 (accepted): split the overloaded dependency-order paragraph into one sentence per line so the plugin-sync-checks citation sits only with the identifiers it supports (the sync script, the generated-copies directory, and the two check commands); no other paragraph in the document mixes a citation with unrelated identifiers.
    - L-8, L-9 (accepted): qualified task 4's two reviser-file citations (Leverage and Prompt lines) to their `harness/agents/` path; verified against the same file.
    - L-10, L-11 (accepted): qualified task 5's two skill-file citations to their `harness/skills/sdd-document-phase/` path; verified against both ranges.
    - L-12 (accepted): qualified task 6's skill-file citation to its `harness/skills/sdd-continue/` path; verified against the same file.
- **v2** (2026-09-16) — Round-1 adversarial response (adversarial-analysis-tasks.md, verdict iterate 0/2/3).
  - **R1-1 — Accepted (SHOULD_FIX).** Task 6 covered only Req 2 AC 7's receipt write, not its step-3 resume recheck. Added a Gate A resume clause to task 6's body, Leverage (`harness/skills/sdd-continue/SKILL.md:122`), Prompt and Success: at step 3 rule 4, before dispatching phase `requirements`, the supervisor re-checks an unanswered gate-A receipt and resolves it (ask or record) instead of dispatching MODE normal straight to round 1. Also applied to design.md Component 5 (see design.md's own v3 amended Revision History line).
  - **R1-2 — Accepted (SHOULD_FIX).** Five bare-path mentions across the v1 Lint-pass sub-bullets were unresolvable citations. Un-fenced each "before" mention to plain prose and kept only the paired, already-verified fully-qualified path as the citation, without rewriting what the historical bullet records.
  - **R1-3 — Accepted (MINOR).** Task 2's Leverage line cited the wrong task-parser range for the parsing function, which was actually the parsed-task type range; the function itself is defined further down. Corrected the range; verified against the file at both ends.
  - **R1-4 — Rejected (MINOR).** Task 5 already follows this document's one-task-per-design-component pattern (D1, endorsed by the reviewer's own D1 verification); gate A and gate B are independently coded and tested within one commit with no shared data or ordering dependency. Splitting a MINOR, stylistic "would review more cleanly" observation into two tasks would break that symmetry without closing any coverage or correctness gap.
  - **R1-5 — Rejected (MINOR).** Design Component 1 and requirements D7 deliberately leave the six class-a keywords' patterns as an implementer-tunable module (NFR Reliability); task 1 already requires each keyword tested, giving a checkable oracle. Pinning a specific "external write" regex at tasks phase would redecide what design left open, and the finding itself calls this latitude, not a blocker.
  - **Lint pass.** 19 fixed; rejected: L-7 (bridge-missing, closed by ruling — task 4's mention of task 5's re-spawn behaviour names no artefact task 5 creates, so the template's bridge rule does not trigger; the producer-before-consumer ordering decision already covers it).
