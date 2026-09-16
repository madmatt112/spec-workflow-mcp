# Adversarial Review — question-gates/design (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/design.md

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-design.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-design.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-design.md using this format:

```markdown
# Adversarial Review Memory — design
Last updated: <today's date> (after v2 review)

## Cumulative Findings Summary
### Accepted
- <finding>: <brief description, which version identified it>

### Partially Accepted
- <finding>: <brief description, user's stance>

### Rejected
- <finding>: <brief description, reason for rejection>

### Unresolved
- <finding>: <not yet responded to>

## Patterns & Themes
- <high-level observations about recurring issues>

## Guidance for Next Review
- Focus areas based on what's been found
- Areas that have been well-covered and don't need re-examination
```

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Feasibility, consistency, edge cases

**Example attack angles to consider:** Conflicts with steering docs, unaddressed failure modes, scaling bottlenecks, missing error paths, alternatives not considered

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Standing directives

- Ground every claim in the real codebase. Read the files the document cites before you judge them. A misstated artifact (wrong path, wrong line range, wrong signature, wrong behaviour) is an automatic MUST_FIX.
- Attack the deltas since the previous version first, then apply one fresh lens the prior rounds did not use.
- Rulings recorded in the document's Revision History are closed. Do not re-open them.
- Do not pad. MINOR-only findings do not keep the loop alive. A clean round is a valid result: show your work (what you checked and how) and say converged.
- Severity: MUST_FIX = contradiction, false claim about the codebase, unimplementable requirement, data or security hole. SHOULD_FIX = a real gap that causes rework or a wrong implementation. MINOR = wording, a value safely left to a later phase, nice-to-have.
- ESCALATE only when a human should look now: security, secrets, auth bypass, data loss, destructive migrations, money, billing, pricing, legal or compliance. Otherwise write `ESCALATE: none`.

## Verdict block

End the analysis file with exactly this block, values filled in:

```
VERDICT: converged | iterate
MUST_FIX: <n>
SHOULD_FIX: <n>
MINOR: <n>
DESIGN_READY: yes | no
ESCALATE: none | <one-line reason a human should look now>
```

`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-design-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md`
  first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked,
  citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v2 before the lint
  pass fixed anything. A rule with no finding listed here passed only that pre-fix run:
  verify meaning only for it. Re-verify only citations the v2 lint commit changed: the
  `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your
  call, info = a note): none.
- Changes: the diff from the newest `docs(sdd): question-gates design v1` commit to the
  working tree follows as `## Changes since <short sha>`, cut at 500 lines, and the v2
  lint commit follows as `## Lint commit <short sha>`.
- Read the Revision History line for v2 first and attack those changes before anything
  else. v2 was the round-1 adversarial response (six findings, all accepted). Every
  MUST_FIX after round 1 in past specs was a claim error introduced by the previous
  delta. Mark a finding that lands in text the v2 delta wrote `Compounds: R1-<n>`, naming
  the round-1 finding whose fix wrote the clause (R1-1 gate delete/run-once, R1-2 gate
  put payload location, R1-3 drafter re-spawn, R1-4 four-option cap / verbatim approve
  test, R1-5 `GateADecision`/`VetoItem` types and score, R1-6 class-a description→title
  mapping).
- Fresh lens for this round: the cost of touching an existing component (its tests,
  fixtures, query keys, e2e assumptions). The design adds a `gate` action to the existing
  `harness` tool schema, changes how `parseTasksFromMarkdown` / `parseSensitivePaths`
  output is consumed, and edits the `sdd-drafter` agent and the `sdd-continue` /
  `sdd-document-phase` skills. For each existing artifact the design mutates, find the
  tests, fixtures and callers that already assert its current shape and name what the
  change breaks or leaves untested.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision
  History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-design.md`.
  Read it first and rewrite it after your analysis, as the section above says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules
  for reading code and running checks:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since 2f2473c

````diff
diff --git a/.spec-workflow/specs/question-gates/design.md b/.spec-workflow/specs/question-gates/design.md
index d1e8c95..01213bb 100644
--- a/.spec-workflow/specs/question-gates/design.md
+++ b/.spec-workflow/specs/question-gates/design.md
@@ -17,7 +17,7 @@ N/A — this spec has no visual surface and the project has no `design-system.md
 
 ## Architecture
 
-The change adds no new tool and no new process. One pure module (`veto-rules.ts`) computes gate-B class (a) from a task's declared paths and action keywords; one new `harness` action (`gate`, with ops `class-a`, `put`, `get`) reads the spec store and stores/serves each gate's payload; the two document-phase writers (drafter for gate A, tasks orchestrator for gate B) call `put`; the supervisor calls `get` and drives AskUserQuestion. The only new inter-component seam is the payload surface: a worker writes a JSON payload through `gate put`, and the supervisor reads it back through `gate get`, so the document orchestrator's capped report never carries it (requirements Req 1 AC 6).
+The change adds no new tool and no new process. One pure module (`veto-rules.ts`) computes gate-B class (a) from a task's declared paths and action keywords; one new `harness` action (`gate`, with ops `class-a`, `put`, `get`, `delete`) reads the spec store and stores/serves each gate's payload; the two document-phase writers (drafter for gate A, tasks orchestrator for gate B) call `put`; the supervisor calls `get` and drives AskUserQuestion. The only new inter-component seam is the payload surface: a worker writes a JSON payload through `gate put`, and the supervisor reads it back through `gate get`, so the document orchestrator's capped report never carries it (requirements Req 1 AC 6).
 
 ```mermaid
 graph TD
@@ -38,30 +38,31 @@ graph TD
 - **Interfaces:**
   - `CLASS_A_KEYWORDS: Record<string, RegExp>` — the six tunable keyword patterns: `migration`, `delete`/`drop`, `auth`, `billing`, `config`, external write (D7 of requirements).
   - `type TaskVetoInput = { id: string; title: string; files: string[]; block: string }`.
-  - `type ClassAItem = { taskId: string; title: string; kind: 'sensitive-path' | 'keyword'; reason: string; score: number }`.
-  - `computeClassA(tasks: TaskVetoInput[], sensitive: string[] | null): ClassAItem[]` — when `sensitive` is a list, push a `sensitive-path` item per task whose `files` match `isSensitivePath`; always scan `block` for each keyword and push `keyword` items. When `sensitive` is `null`, push no path item (empty match, Req 4 AC 5) yet still scan keywords; it never emits `gate-rules.ts`'s `NO_LIST_REASON`. Returns items sorted path-matches before keyword-matches.
+  - `type ClassAItem = { taskId: string; title: string; kind: 'sensitive-path' | 'keyword'; reason: string; score: number }` — `score` is `2` for a `sensitive-path` item and `1` for a `keyword` item, the only ranking input class (a) contributes to the orchestrator's cross-class ordering (D5).
+  - `computeClassA(tasks: TaskVetoInput[], sensitive: string[] | null): ClassAItem[]` — when `sensitive` is a list, push a `sensitive-path` item per task whose `files` match `isSensitivePath`; always scan `block` for each keyword and push `keyword` items. When `sensitive` is `null`, push no path item (empty match, Req 4 AC 5) yet still scan keywords; it never emits `gate-rules.ts`'s `NO_LIST_REASON`. Returns items sorted by `score` descending (path-matches before keyword-matches).
 - **Dependencies:** none beyond `gate-rules.ts`.
 - **Reuses:** `parseSensitivePaths`, `isSensitivePath` (`src/core/gate-rules.ts:101-135`); it deliberately does not reuse `NO_LIST_REASON` (`src/core/gate-rules.ts:26,260-261`).
 
 ### Component 2 — `harness` tool `gate` action (`src/tools/harness.ts`)
-- **Purpose:** The server surface both gates' payloads cross. One action, three ops.
-- **Interfaces:** the tool schema (`src/tools/harness.ts:36-77`) adds gate to the `action` enum and optional op (class-a | put | get), slot (a | b), payload (object) properties.
-  - `op: 'class-a'` — reads `tasks.md` (via `parseTasksFromMarkdown`, each task's `files` and `taskBlock`) and `agent-rules.md` at the spec-store root (via `parseSensitivePaths`; ENOENT gives `null`), calls `computeClassA`, returns `data.items: ClassAItem[]`. Read-only.
-  - `op: 'put'` — writes `values.payload` as JSON to `specs/<spec>/gate-<slot>.json` through `PathUtils.safeJoin`; returns `data.path`.
+- **Purpose:** The server surface both gates' payloads cross. One action, four ops.
+- **Interfaces:** the tool schema (`src/tools/harness.ts:36-77`) adds gate to the `action` enum and optional op (class-a | put | get | delete), slot (a | b), payload (object) properties.
+  - `op: 'class-a'` — reads `tasks.md` via `parseTasksFromMarkdown` (`src/core/task-parser.ts:108-128`), taking each `ParsedTask`'s `id`, `description` (renamed to `TaskVetoInput`'s title field) and `files`, plus a second call `taskBlock(tasksContent, task.id)` (`src/core/task-parser.ts:365-385`) for `TaskVetoInput`'s block field; and reads `agent-rules.md` at the spec-store root via `parseSensitivePaths` (`src/core/gate-rules.ts:101-104`; ENOENT gives null); calls computeClassA, returns `data.items: ClassAItem[]`. Read-only.
+  - `op: 'put'` — writes the top-level `payload` argument as JSON to `specs/<spec>/gate-<slot>.json` through `PathUtils.safeJoin`; returns `data.path`.
   - `op: 'get'` — reads `specs/<spec>/gate-<slot>.json`; returns `data: { present: boolean; payload: object | null }`; ENOENT gives `present: false` (so the supervisor sees an empty surface without failing).
+  - `op: 'delete'` — removes `specs/<spec>/gate-<slot>.json`; ENOENT is a no-op success. Only the supervisor calls this, only for slot `b`, right after gate B resolves (Component 5), so the persisted payload cannot make a later implementation entry see `present: true` again (Req 5 AC 6).
 - **Dependencies:** `selectRoots`, `PathUtils`, `parseTasksFromMarkdown`/`taskBlock`, `veto-rules.ts`.
 - **Reuses:** the `briefAction` write pattern — `selectRoots(args, context)`, `PathUtils.safeJoin`, `mkdir`+`writeFile` (`src/tools/harness.ts:517-612`); registration is already wired (`src/tools/index.ts:15,33,83`).
 
 ### Component 3 — `sdd-drafter` gate-A extraction (`harness/agents/sdd-drafter.md`)
 - **Purpose:** In the requirements phase only, extract and rank at most five direction-setting decisions from the document's own `## Decisions taken in this document` section, build one `{header, question, options}` triple each, and write them to the gate-A surface before the drafter's report.
-- **Interfaces:** after writing requirements v1, call `harness gate put slot=a` with `payload` = `{ items: GateADecision[] }` (Data Models). `options[0]` is the recorded choice; the rest are the rejected alternatives from that decision's "options were" clause (Req 2 AC 1).
+- **Interfaces:** after writing requirements v1, call `harness gate put slot=a` with `payload` = `{ items: GateADecision[] }` (Data Models). `options[0]` is the recorded choice; the rest are the rejected alternatives from that decision's "options were" clause, capped at four options total per decision (D9) — the chosen option plus at most three rejected alternatives, kept in clause order, extras dropped (Req 2 AC 1).
 - **Dependencies:** the `harness` tool.
-- **Reuses:** the drafter frontmatter gains the harness MCP tool in all three plugin-prefixed forms, mirroring the reviser's single-MCP grant (`harness/agents/sdd-reviser.md:14-16`); the drafter body (`harness/agents/sdd-drafter.md:16-26`) gains one requirements-phase-only step. Design and tasks phases write no gate-A payload.
+- **Reuses:** the drafter frontmatter gains the harness MCP tool in all three plugin-prefixed forms, mirroring the reviser's single-MCP grant (`harness/agents/sdd-reviser.md:14-16`); the drafter body (`harness/agents/sdd-drafter.md:16-26`) gains one requirements-phase-only step. Design and tasks phases write no gate-A payload. When the Lint step (Component 4) lands a fix that must reword a decision's `question` or its "options were" clause (Req 2 AC 2), the document orchestrator re-spawns `sdd-drafter` once more, narrowly, naming just that decision; the drafter rewrites only that triple with `harness gate put slot=a` before the orchestrator returns `PHASE: gate-a`.
 
 ### Component 4 — document-phase gate emission (`harness/skills/sdd-document-phase/SKILL.md`)
 - **Purpose:** Emit gate A and assemble gate B without ever reading the document body.
 - **Interfaces:**
-  - **Gate A:** in Step 1, in the `requirements` phase and `MODE: normal` only, after the Lint step lands its fix (`harness/skills/sdd-document-phase/SKILL.md:69-120`) and before Step 2's first round, return `PHASE: gate-a`; the drafter's triples already sit on the surface (Component 3). A resume that orients to a later step (`Step 2`/`Step 3`/`Step R`) never re-emits it (Req 2 AC 3), because Step 0's nextStep is never `Step 1` on resume.
+  - **Gate A:** in Step 1, in the `requirements` phase and `MODE: normal` only, after the Lint step lands its fix (`harness/skills/sdd-document-phase/SKILL.md:69-120`) — including the narrow drafter re-spawn Component 3 describes when that fix rewords a decision — and before Step 2's first round, return `PHASE: gate-a`; the drafter's triples already sit on the surface (Component 3). A resume that orients to a later step (`Step 2`/`Step 3`/`Step R`) never re-emits it (Req 2 AC 3), because Step 0's nextStep is never `Step 1` on resume.
   - **Gate B:** in the `tasks` phase, `MODE: normal`, on the first `approved` (Step 6, `harness/skills/sdd-document-phase/SKILL.md:236-245`): call `harness gate class-a` for the mechanical class (a) items, judge classes (b) new external dependencies and (c) work beyond the approved requirements from `tasks.md`/`requirements.md`, order all three most-consequential-first into one list, and `harness gate put slot=b` with payload = `{ tasks: [{id,title}], veto: VetoItem[] }`. In `MODE: revision` it writes no list (Req 5 AC 6).
 - **Dependencies:** the `harness` tool (already called throughout this skill for `orient`/`brief`/`phase-log`).
 - **Reuses:** the existing Step 1/Step 6 structure and the `harness` calls the orchestrator already makes.
@@ -70,8 +71,8 @@ graph TD
 - **Purpose:** Resolve each gate's mode, ask or record, and route, never stalling.
 - **Interfaces:**
   - **Mode resolution:** read `gates: block | record` from `agent-rules.md` when present; otherwise `block` when AskUserQuestion is available and `record` when it is not (Req 1 AC 1-2). A missing, errored or denied AskUserQuestion is `record` and never changes the ledger `headless` flag (Req 1 AC 3-4).
-  - **Gate A:** on `PHASE: gate-a` from the dispatch loop (`harness/skills/sdd-continue/SKILL.md:146-210`): `harness gate get slot=a`; write the receipt to `specs/<spec>/questions.md` (decisions, no `answer`) and commit best-effort before asking (Req 2 AC 7). In block, ask the triples with AskUserQuestion, at most five across at most two calls; a decision whose reply selects `options[0]` with no free text is approve, else needs revision (Req 2 AC 5); a denied/errored/timed-out second call keeps the first call's answers and treats the rest as `no answer` (Req 2 AC 4). Any needing-revision decision re-spawns the document orchestrator once with `MODE: revision` and `REVISION_INPUT` naming each decision's new option and free text; all-approve re-spawns `MODE: normal`. In `record`, write the decisions and `no answer`, a HANDOFF row, and re-spawn `MODE: normal` (Req 3).
-  - **Gate B:** before the first implementation spawn and worktree entry (`harness/skills/sdd-continue/SKILL.md:215-230`, D9): `harness gate get slot=b`; when present, in block present payload.tasks and payload.veto and ask approve-or-annotate; annotate runs exactly one `MODE: revision` tasks round then proceeds; approve proceeds directly (Req 5). In record, write the veto list to `questions.md` and a HANDOFF row and proceed (Req 6). It runs at most once: a design-defect re-approval resumes implementation without re-reaching this point (Req 5 AC 6).
+  - **Gate A:** on `PHASE: gate-a` from the dispatch loop (`harness/skills/sdd-continue/SKILL.md:146-210`): `harness gate get slot=a`; write the receipt to `specs/<spec>/questions.md` (decisions, no `answer`) and commit best-effort before asking (Req 2 AC 7). In block, ask the triples with AskUserQuestion, at most five across at most two calls, each decision capped at four options (D9); a decision's reply is approve when its selected-option text matches `options[0]` verbatim with no appended free text, else needs revision (Req 2 AC 5); a denied/errored/timed-out second call keeps the first call's answers and treats the rest as `no answer` (Req 2 AC 4). Any needing-revision decision re-spawns the document orchestrator once with `MODE: revision` and `REVISION_INPUT` naming each decision's new option and free text; all-approve re-spawns `MODE: normal`. In `record`, write the decisions and `no answer`, a HANDOFF row, and re-spawn `MODE: normal` (Req 3).
+  - **Gate B:** before the first implementation spawn and worktree entry (`harness/skills/sdd-continue/SKILL.md:215-230`, requirements D9): `harness gate get slot=b`; when present, in block present payload.tasks and payload.veto and ask approve-or-annotate; annotate runs exactly one `MODE: revision` tasks round then proceeds; approve proceeds directly (Req 5). In record, write the veto list to `questions.md` and a HANDOFF row and proceed (Req 6). Either way, once gate B resolves the supervisor calls `harness gate delete slot=b` before proceeding, so a later implementation entry for the same spec — the annotate path's own re-approval, a design-defect re-approval, or a fresh resume before any task has run — finds `present: false` and skips straight to implementation without asking again (Req 5 AC 6).
 - **Dependencies:** the `harness` tool, AskUserQuestion.
 - **Reuses:** the retro conversation's AskUserQuestion-with-headless-fallback pattern (`harness/skills/sdd-continue/SKILL.md:232-261`); the HANDOFF-row commit path (`harness/skills/sdd-continue/SKILL.md:60`); the PHASE dispatch table (`harness/skills/sdd-continue/SKILL.md:185-210`).
 
@@ -82,22 +83,23 @@ graph TD
 
 ## Data Models
 
-Gate-A payload (`specs/<spec>/gate-a.json`), written by the drafter:
+Gate-A payload (`specs/<spec>/gate-a.json`), written by the drafter — `items: GateADecision[]`:
 ```
-{ items: [ { header: string,      // AskUserQuestion header
-             question: string,     // the decision's one-line choice
-             options: string[] } ] // options[0] = recorded choice, rest rejected
-}  // at most 5 items, ranked most direction-setting first
+type GateADecision = { header: string,    // AskUserQuestion header
+                        question: string, // the decision's one-line choice
+                        options: string[] } // options[0] = recorded choice, rest
+                                            // rejected, capped at 4 total (D9)
+// at most 5 items, ranked most direction-setting first
 ```
 
-Gate-B payload (`specs/<spec>/gate-b.json`), written by the tasks orchestrator:
+Gate-B payload (`specs/<spec>/gate-b.json`), written by the tasks orchestrator — `tasks` plus `veto: VetoItem[]`:
 ```
-{ tasks: [ { id: string, title: string } ],       // compact plan, for presentation
-  veto:  [ { rank: number, class: 'a'|'b'|'c',
-             taskId: string, summary: string } ] } // one ranked list (Req 4 AC 4)
+type VetoItem = { rank: number, class: 'a'|'b'|'c', taskId: string, summary: string }
+{ tasks: [ { id: string, title: string } ],  // compact plan, for presentation
+  veto:  VetoItem[] }                        // one ranked list (Req 4 AC 4)
 ```
 
-`ClassAItem` (returned by `gate class-a`, input to the orchestrator's ranking): `{ taskId, title, kind: 'sensitive-path'|'keyword', reason, score }`.
+`ClassAItem` (returned by `gate class-a`, input to the orchestrator's ranking): `{ taskId, title, kind: 'sensitive-path'|'keyword', reason, score }` (`score`: `2` sensitive-path, `1` keyword). The orchestrator folds each into a `VetoItem` one for one: `taskId`→`taskId`, `reason`→`summary`, `kind`→`class: 'a'`; `rank` is assigned last, across all three classes, by the orchestrator's most-consequential-first judgment (D5), with class (a) items pre-ordered by `score` descending going in.
 
 `questions.md` (`specs/<spec>/questions.md`), written by the supervisor: a markdown receipt — one section per gate, each decision or veto item with its text and an `answer:` line (empty in the pre-ask receipt and in `record` mode, filled after AskUserQuestion returns).
 
@@ -106,26 +108,28 @@ Gate-B payload (`specs/<spec>/gate-b.json`), written by the tasks orchestrator:
 1. **AskUserQuestion absent, errored, or denied:** the gate falls to `record` mode, writes the payload and `no answer` to `questions.md` plus a HANDOFF row, and proceeds; the ledger `headless` flag is untouched (Req 1 AC 3-4, Req 3, Req 6).
 2. **Second gate-A call denied after the first answered:** keep the first call's answers, treat the unreturned decisions as `no answer`, proceed under the approve/record branch (Req 2 AC 4).
 3. **No `## Sensitive paths` list:** `gate class-a` gets `sensitive: null`; `computeClassA` matches no path but still fires keywords; the gate does not fail (Req 4 AC 5).
-4. **Empty surface (`gate get present: false`):** the supervisor treats gate A as nothing to ask (should not occur after a `gate-a` return) and gate B as no veto items; it proceeds without stalling.
+4. **Empty surface (`gate get present: false`):** the supervisor treats gate A as nothing to ask (should not occur after a `gate-a` return) and gate B as no veto items; it proceeds without stalling. For gate B this is the expected state on any implementation entry after the first (Component 5's `gate delete`), not a failure.
 5. **Receipt write or commit failure (gate A):** best-effort — logged, the run proceeds (Req 2 AC 7, Req 1 AC 5).
-6. **Malformed payload on `put`:** the action fails naming the field and writes nothing, mirroring `briefAction`'s missing-value guard (`src/tools/harness.ts:517-544`).
+6. **Malformed payload on `put`:** when the top-level payload argument is missing or not an object, the action fails naming it and writes nothing — the same fail-fast shape as `briefAction`'s (`src/tools/harness.ts:517-544`) missing-value guard (`src/tools/harness.ts:537-544`), checking for a payload argument instead of `values.path`.
+7. **A decision names more than four options:** the drafter (Component 3) truncates to the chosen option plus the first three rejected alternatives in clause order before writing the gate-A surface, so AskUserQuestion never receives more than four options for one decision (D9).
 
 ## Testing Strategy
 
 - **Unit:** `src/core/__tests__/veto-rules.test.ts` — `computeClassA` with a sensitive-path list (path item ranks first), with keyword-only tasks, and with `sensitive: null` (no path item, keywords still fire, no `NO_LIST_REASON`); each of the six keywords.
-- **Integration:** extend `src/tools/__tests__/harness.test.ts` — `gate class-a` over a fixture `tasks.md`+`agent-rules.md`; `gate put` then `gate get` round-trips a payload; `gate get` on an absent file returns `present: false`; a missing sensitive list does not fail. Node-version-independent (pure module; scope notes).
-- **End-to-end:** the decomposition entry's four scenarios, run by `npm test` and `claude plugin validate . --strict` (agent-rules.md checks): gate A interactive (one changed answer yields v2 before any round; unchanged answers in `questions.md`), gate A headless (proceeds to round 1 on v1), gate B interactive (sensitive-path item ranks above new-dependency above out-of-scope; one revision round), gate B headless (writes the veto list and proceeds).
+- **Integration:** extend `src/tools/__tests__/harness.test.ts` — `gate class-a` over a fixture `tasks.md`+`agent-rules.md`; `gate put` then `gate get` round-trips a payload; `gate delete` then `gate get` returns `present: false`; `gate get` on an absent file returns `present: false`; a missing sensitive list does not fail. Node-version-independent (pure module; scope notes).
+- **End-to-end:** the decomposition entry's four scenarios, run by `npm test` and `claude plugin validate . --strict` (agent-rules.md checks): gate A interactive (one changed answer yields v2 before any round; unchanged answers in `questions.md`), gate A headless (proceeds to round 1 on v1), gate B interactive (sensitive-path item ranks above new-dependency above out-of-scope; one revision round, then the annotate path's re-approval proceeds straight to implementation with no second ask, Req 5 AC 6), gate B headless (writes the veto list and proceeds).
 
 ## Decisions taken in this document
 
 - D1 — Server surface is a new gate action on the existing `harness` tool (`src/tools/harness.ts:24-25`), not a new MCP tool: options were a new tool, a harness action, or plain file writes; chosen because `harness` already owns spec-store bookkeeping writes and reuses `selectRoots`/`safeJoin` (`src/tools/harness.ts:517-612`), and Req 2 AC 1 requires an MCP write tool.
 - D2 — The drafter's granted MCP write tool (Req 2 AC 1 / requirements D2) is `harness`: options were a dedicated gate tool or `harness`; chosen because it adds no new tool surface and the drafter needs only the one write.
 - D3 — Payloads are two JSON files (`gate-a.json`, `gate-b.json`) separate from the human `questions.md` receipt: options were one combined file or embedding in HANDOFF; chosen because each gate writes and reads independently and JSON is machine-parseable, while `questions.md` stays human-readable (requirements D5).
-- D4 — The gate-A triple's `options[0]` is the recorded choice, so approve equals selecting `options[0]` with no free text: options were an explicit `chosen` field or positional; chosen because Req 2 AC 1 already lists "chosen option plus rejected alternatives," so position carries it and the triple shape is unchanged.
+- D4 — The gate-A triple's `options[0]` is the recorded choice, so approve equals selecting `options[0]` with no free text, tested by the supervisor comparing the AskUserQuestion answer's selected-option text against `options[0]` verbatim: options were an explicit `chosen` field or positional; chosen because Req 2 AC 1 already lists "chosen option plus rejected alternatives," so position carries it and the triple shape is unchanged.
 - D5 — Only class (a) is mechanized in `veto-rules.ts`; classes (b)/(c) and the final cross-class ordering are the tasks orchestrator's judgment: options were an all-mechanical or all-orchestrator gate B; chosen to match requirements D6 — path/keyword matching is mechanizable, new-dependency and out-of-scope judgment is not.
 - D6 — The gate-B payload carries a compact tasks list plus the ranked veto items so the supervisor can present the plan: options were the supervisor reading `tasks.md` or a self-contained payload; chosen because the supervisor never reads spec documents (`harness/skills/sdd-continue/SKILL.md:14`).
 - D7 — Gate mode resolution stays supervisor skill logic (read `gates:` from `agent-rules.md`, default by AskUserQuestion availability), with no new server code: options were a server helper or skill logic; chosen because it is a single scalar key like `worktree-per-change` the supervisor already reads (`.spec-workflow/agent-rules.md:5-6`).
 - D8 — The `class-a` keyword scan runs over each task's whole block (title and detail lines from `taskBlock`), not only `- File:` paths: options were file-only or block scan; chosen because keywords such as `migration` and `auth` appear in task prose and Req 4 AC 2 names both a path match and a keyword match.
+- D9 — Gate-A `options` is capped at four total per decision (the chosen option plus at most three rejected alternatives, clause order, extras dropped): options were uncapped or a different cap; chosen to match the tool's own four-per-call question cap already pinned by Req 2 AC 4, keeping one predictable number across the design and guaranteeing AskUserQuestion never has to refuse a call for size.
 
 ## Scope notes
 
@@ -137,3 +141,11 @@ Gate-B payload (`specs/<spec>/gate-b.json`), written by the tasks orchestrator:
 ## Revision History
 - **v1** (2026-09-16) — Initial draft.
   - **Lint pass.** 21 fixed; rejected: none.
+- **v2** (2026-09-16) — Round-1 adversarial response (adversarial-analysis-design.md, verdict iterate 0/4/2).
+  - **R1-1 — Accepted (SHOULD_FIX).** Gate B's payload persisted with no run-once mechanism, so the annotate path and a fresh pre-implementation resume both re-asked. Added a `gate delete` op (Component 2) the supervisor calls right after gate B resolves (Component 5), so a later implementation entry finds `present: false`; updated Error Handling item 4 and the Testing Strategy end-to-end scenario.
+  - **R1-2 — Accepted (SHOULD_FIX).** The schema, `op: 'put'`, and Error Handling item 6 disagreed on whether the payload is top-level or `values.payload`. Pinned it to the top-level `payload` argument everywhere: fixed `op: 'put'`'s description and Error Handling item 6 (also corrected its guard citation to the precise `537-544` range).
+  - **R1-3 — Accepted (SHOULD_FIX).** Req 2 AC 2's mandated post-lint triple rewrite had no actor: the drafter runs once before the Lint step, and `sdd-reviser` holds no gate-write grant. Added a narrow drafter re-spawn (Component 3, referenced from Component 4's gate-A bullet) that rewrites only the affected triple before `PHASE: gate-a` fires.
+  - **R1-4 — Accepted (SHOULD_FIX).** The gate-A `options` array was unbounded and the answer→`options[0]` mapping was unstated. Added D9: a four-option-per-decision cap (chosen plus up to three rejected alternatives, clause order), an overflow rule (Error Handling item 7), and pinned the approve test to verbatim text equality against `options[0]` (Component 5, D4); also applied the cap to Component 3 and the Data Models comment.
+  - **R1-5 — Accepted (MINOR).** `GateADecision` and `VetoItem` were used but never typed, and the `ClassAItem`→`VetoItem` transform and `score` semantics were unstated. Named both types in Data Models, defined `score` (`2` sensitive-path, `1` keyword) in Component 1 and Data Models, and stated the field-by-field transform.
+  - **R1-6 — Accepted (MINOR).** "via `parseTasksFromMarkdown`, each task's `files` and `taskBlock`" glossed the `description`→title rename and the separate `taskBlock` call. Rewrote Component 2's `op: 'class-a'` bullet with the precise field mapping and both citations (`src/core/task-parser.ts:108-128`, `:365-385`).
+  - **Lint pass.** 8 fixed; rejected: none.
````

## Lint commit 381bf0b

````diff
diff --git a/.spec-workflow/specs/question-gates/design.md b/.spec-workflow/specs/question-gates/design.md
index 2119ddc..01213bb 100644
--- a/.spec-workflow/specs/question-gates/design.md
+++ b/.spec-workflow/specs/question-gates/design.md
@@ -46,7 +46,7 @@ graph TD
 ### Component 2 — `harness` tool `gate` action (`src/tools/harness.ts`)
 - **Purpose:** The server surface both gates' payloads cross. One action, four ops.
 - **Interfaces:** the tool schema (`src/tools/harness.ts:36-77`) adds gate to the `action` enum and optional op (class-a | put | get | delete), slot (a | b), payload (object) properties.
-  - `op: 'class-a'` — reads `tasks.md` via `parseTasksFromMarkdown` (`src/core/task-parser.ts:108-128`), taking each `ParsedTask`'s `id`, `description` (renamed `TaskVetoInput.title`) and `files`, plus a second call `taskBlock(tasksContent, task.id)` (`src/core/task-parser.ts:365-385`) for `TaskVetoInput.block`; and reads `agent-rules.md` at the spec-store root (via `parseSensitivePaths`; ENOENT gives `null`); calls `computeClassA`, returns `data.items: ClassAItem[]`. Read-only.
+  - `op: 'class-a'` — reads `tasks.md` via `parseTasksFromMarkdown` (`src/core/task-parser.ts:108-128`), taking each `ParsedTask`'s `id`, `description` (renamed to `TaskVetoInput`'s title field) and `files`, plus a second call `taskBlock(tasksContent, task.id)` (`src/core/task-parser.ts:365-385`) for `TaskVetoInput`'s block field; and reads `agent-rules.md` at the spec-store root via `parseSensitivePaths` (`src/core/gate-rules.ts:101-104`; ENOENT gives null); calls computeClassA, returns `data.items: ClassAItem[]`. Read-only.
   - `op: 'put'` — writes the top-level `payload` argument as JSON to `specs/<spec>/gate-<slot>.json` through `PathUtils.safeJoin`; returns `data.path`.
   - `op: 'get'` — reads `specs/<spec>/gate-<slot>.json`; returns `data: { present: boolean; payload: object | null }`; ENOENT gives `present: false` (so the supervisor sees an empty surface without failing).
   - `op: 'delete'` — removes `specs/<spec>/gate-<slot>.json`; ENOENT is a no-op success. Only the supervisor calls this, only for slot `b`, right after gate B resolves (Component 5), so the persisted payload cannot make a later implementation entry see `present: true` again (Req 5 AC 6).
@@ -110,7 +110,7 @@ type VetoItem = { rank: number, class: 'a'|'b'|'c', taskId: string, summary: str
 3. **No `## Sensitive paths` list:** `gate class-a` gets `sensitive: null`; `computeClassA` matches no path but still fires keywords; the gate does not fail (Req 4 AC 5).
 4. **Empty surface (`gate get present: false`):** the supervisor treats gate A as nothing to ask (should not occur after a `gate-a` return) and gate B as no veto items; it proceeds without stalling. For gate B this is the expected state on any implementation entry after the first (Component 5's `gate delete`), not a failure.
 5. **Receipt write or commit failure (gate A):** best-effort — logged, the run proceeds (Req 2 AC 7, Req 1 AC 5).
-6. **Malformed payload on `put`:** when the top-level `payload` argument is missing or not an object, the action fails naming `payload` and writes nothing — the same fail-fast shape as `briefAction`'s missing-value guard (`src/tools/harness.ts:537-544`), checking `payload` instead of `values.path`.
+6. **Malformed payload on `put`:** when the top-level payload argument is missing or not an object, the action fails naming it and writes nothing — the same fail-fast shape as `briefAction`'s (`src/tools/harness.ts:517-544`) missing-value guard (`src/tools/harness.ts:537-544`), checking for a payload argument instead of `values.path`.
 7. **A decision names more than four options:** the drafter (Component 3) truncates to the chosen option plus the first three rejected alternatives in clause order before writing the gate-A surface, so AskUserQuestion never receives more than four options for one decision (D9).
 
 ## Testing Strategy
@@ -147,4 +147,5 @@ type VetoItem = { rank: number, class: 'a'|'b'|'c', taskId: string, summary: str
   - **R1-3 — Accepted (SHOULD_FIX).** Req 2 AC 2's mandated post-lint triple rewrite had no actor: the drafter runs once before the Lint step, and `sdd-reviser` holds no gate-write grant. Added a narrow drafter re-spawn (Component 3, referenced from Component 4's gate-A bullet) that rewrites only the affected triple before `PHASE: gate-a` fires.
   - **R1-4 — Accepted (SHOULD_FIX).** The gate-A `options` array was unbounded and the answer→`options[0]` mapping was unstated. Added D9: a four-option-per-decision cap (chosen plus up to three rejected alternatives, clause order), an overflow rule (Error Handling item 7), and pinned the approve test to verbatim text equality against `options[0]` (Component 5, D4); also applied the cap to Component 3 and the Data Models comment.
   - **R1-5 — Accepted (MINOR).** `GateADecision` and `VetoItem` were used but never typed, and the `ClassAItem`→`VetoItem` transform and `score` semantics were unstated. Named both types in Data Models, defined `score` (`2` sensitive-path, `1` keyword) in Component 1 and Data Models, and stated the field-by-field transform.
-  - **R1-6 — Accepted (MINOR).** "via `parseTasksFromMarkdown`, each task's `files` and `taskBlock`" glossed the `description`→`title` rename and the separate `taskBlock` call. Rewrote Component 2's `op: 'class-a'` bullet with the precise field mapping and both citations (`src/core/task-parser.ts:108-128`, `:365-385`).
+  - **R1-6 — Accepted (MINOR).** "via `parseTasksFromMarkdown`, each task's `files` and `taskBlock`" glossed the `description`→title rename and the separate `taskBlock` call. Rewrote Component 2's `op: 'class-a'` bullet with the precise field mapping and both citations (`src/core/task-parser.ts:108-128`, `:365-385`).
+  - **Lint pass.** 8 fixed; rejected: none.
````
