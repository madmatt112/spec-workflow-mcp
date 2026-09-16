# Adversarial Review — question-gates/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/design.md

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md`
  first; it maps the code this document cites. Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked,
  citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint
  pass fixed anything. A rule with no finding listed here passed only that pre-fix run:
  verify meaning only for it. Re-verify only citations the v1 lint commit changed: the
  whole `## Changes since` section below (the v1 lint pass fixed 21 citation findings —
  12 unresolvable bare-filename paths and 9 absent-identifier citations). Still open
  (error = MUST_FIX candidate, warning = your call, info = a note): none.
- Changes: the diff from the `docs(sdd): question-gates design v1` checkpoint to the
  working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `question-gates` in
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`
  and check the document against its scope (steering docs are absent, so the
  decomposition entry and this spec's approved requirements are the scope authority).
  The context file is drafter-written and unreviewed; re-probe any `## Probes` line the
  document relies on.
- Fresh lens for this round: wire contracts across a boundary. The design adds a new
  `harness` tool `gate` action with a payload surface, a gate-A extraction the drafter
  emits, and an AskUserQuestion `{header, question, options}` contract the supervisor
  consumes. Trace each shape end to end — what one side writes and what the other reads,
  including the `slot`/`ops`/`put`/`get` payload fields, the gate-A `PHASE` value, and
  the option/answer round-trip — and find every place a producer and a consumer of the
  same shape disagree.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision
  History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/reviews/adversarial-memory-design.md`.
  The scaffold above does not mention it on the first round. Create it after your
  analysis, in the format later rounds expect: `# Adversarial Review Memory — design`,
  `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted /
  Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns &
  Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules
  for reading code and running checks:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since 1087647

````diff
diff --git a/.spec-workflow/specs/question-gates/design.md b/.spec-workflow/specs/question-gates/design.md
index d4cdae5..d1e8c95 100644
--- a/.spec-workflow/specs/question-gates/design.md
+++ b/.spec-workflow/specs/question-gates/design.md
@@ -45,7 +45,7 @@ graph TD
 
 ### Component 2 — `harness` tool `gate` action (`src/tools/harness.ts`)
 - **Purpose:** The server surface both gates' payloads cross. One action, three ops.
-- **Interfaces:** the tool schema (`src/tools/harness.ts:36-77`) adds `gate` to the `action` enum and optional `op` (`class-a` | `put` | `get`), `slot` (`a` | `b`), `payload` (object) properties.
+- **Interfaces:** the tool schema (`src/tools/harness.ts:36-77`) adds gate to the `action` enum and optional op (class-a | put | get), slot (a | b), payload (object) properties.
   - `op: 'class-a'` — reads `tasks.md` (via `parseTasksFromMarkdown`, each task's `files` and `taskBlock`) and `agent-rules.md` at the spec-store root (via `parseSensitivePaths`; ENOENT gives `null`), calls `computeClassA`, returns `data.items: ClassAItem[]`. Read-only.
   - `op: 'put'` — writes `values.payload` as JSON to `specs/<spec>/gate-<slot>.json` through `PathUtils.safeJoin`; returns `data.path`.
   - `op: 'get'` — reads `specs/<spec>/gate-<slot>.json`; returns `data: { present: boolean; payload: object | null }`; ENOENT gives `present: false` (so the supervisor sees an empty surface without failing).
@@ -56,13 +56,13 @@ graph TD
 - **Purpose:** In the requirements phase only, extract and rank at most five direction-setting decisions from the document's own `## Decisions taken in this document` section, build one `{header, question, options}` triple each, and write them to the gate-A surface before the drafter's report.
 - **Interfaces:** after writing requirements v1, call `harness gate put slot=a` with `payload` = `{ items: GateADecision[] }` (Data Models). `options[0]` is the recorded choice; the rest are the rejected alternatives from that decision's "options were" clause (Req 2 AC 1).
 - **Dependencies:** the `harness` tool.
-- **Reuses:** the drafter frontmatter gains the `harness` MCP tool in all three plugin-prefixed forms, mirroring the reviser's single-MCP grant (`harness/agents/sdd-reviser.md:14-16`); the drafter body (`harness/agents/sdd-drafter.md:16-26`) gains one requirements-phase-only step. Design and tasks phases write no gate-A payload.
+- **Reuses:** the drafter frontmatter gains the harness MCP tool in all three plugin-prefixed forms, mirroring the reviser's single-MCP grant (`harness/agents/sdd-reviser.md:14-16`); the drafter body (`harness/agents/sdd-drafter.md:16-26`) gains one requirements-phase-only step. Design and tasks phases write no gate-A payload.
 
 ### Component 4 — document-phase gate emission (`harness/skills/sdd-document-phase/SKILL.md`)
 - **Purpose:** Emit gate A and assemble gate B without ever reading the document body.
 - **Interfaces:**
-  - **Gate A:** in Step 1, in the `requirements` phase and `MODE: normal` only, after the Lint step lands its fix (`SKILL.md:69-120`) and before Step 2's first round, return `PHASE: gate-a`; the drafter's triples already sit on the surface (Component 3). A resume that orients to a later step (`Step 2`/`Step 3`/`Step R`) never re-emits it (Req 2 AC 3), because Step 0's `nextStep` is never `Step 1` on resume.
-  - **Gate B:** in the `tasks` phase, `MODE: normal`, on the first `approved` (Step 6, `SKILL.md:236-245`): call `harness gate class-a` for the mechanical class (a) items, judge classes (b) new external dependencies and (c) work beyond the approved requirements from `tasks.md`/`requirements.md`, order all three most-consequential-first into one list, and `harness gate put slot=b` with `payload` = `{ tasks: [{id,title}], veto: VetoItem[] }`. In `MODE: revision` it writes no list (Req 5 AC 6).
+  - **Gate A:** in Step 1, in the `requirements` phase and `MODE: normal` only, after the Lint step lands its fix (`harness/skills/sdd-document-phase/SKILL.md:69-120`) and before Step 2's first round, return `PHASE: gate-a`; the drafter's triples already sit on the surface (Component 3). A resume that orients to a later step (`Step 2`/`Step 3`/`Step R`) never re-emits it (Req 2 AC 3), because Step 0's nextStep is never `Step 1` on resume.
+  - **Gate B:** in the `tasks` phase, `MODE: normal`, on the first `approved` (Step 6, `harness/skills/sdd-document-phase/SKILL.md:236-245`): call `harness gate class-a` for the mechanical class (a) items, judge classes (b) new external dependencies and (c) work beyond the approved requirements from `tasks.md`/`requirements.md`, order all three most-consequential-first into one list, and `harness gate put slot=b` with payload = `{ tasks: [{id,title}], veto: VetoItem[] }`. In `MODE: revision` it writes no list (Req 5 AC 6).
 - **Dependencies:** the `harness` tool (already called throughout this skill for `orient`/`brief`/`phase-log`).
 - **Reuses:** the existing Step 1/Step 6 structure and the `harness` calls the orchestrator already makes.
 
@@ -70,14 +70,14 @@ graph TD
 - **Purpose:** Resolve each gate's mode, ask or record, and route, never stalling.
 - **Interfaces:**
   - **Mode resolution:** read `gates: block | record` from `agent-rules.md` when present; otherwise `block` when AskUserQuestion is available and `record` when it is not (Req 1 AC 1-2). A missing, errored or denied AskUserQuestion is `record` and never changes the ledger `headless` flag (Req 1 AC 3-4).
-  - **Gate A:** on `PHASE: gate-a` from the dispatch loop (`SKILL.md:146-210`): `harness gate get slot=a`; write the receipt to `specs/<spec>/questions.md` (decisions, no `answer`) and commit best-effort before asking (Req 2 AC 7). In `block`, ask the triples with AskUserQuestion, at most five across at most two calls; a decision whose reply selects `options[0]` with no free text is approve, else needs revision (Req 2 AC 5); a denied/errored/timed-out second call keeps the first call's answers and treats the rest as `no answer` (Req 2 AC 4). Any needing-revision decision re-spawns the document orchestrator once with `MODE: revision` and `REVISION_INPUT` naming each decision's new option and free text; all-approve re-spawns `MODE: normal`. In `record`, write the decisions and `no answer`, a HANDOFF row, and re-spawn `MODE: normal` (Req 3).
-  - **Gate B:** before the first implementation spawn and worktree entry (`SKILL.md:215-230`, D9): `harness gate get slot=b`; when `present`, in `block` present `payload.tasks` and `payload.veto` and ask approve-or-annotate; annotate runs exactly one `MODE: revision` tasks round then proceeds; approve proceeds directly (Req 5). In `record`, write the veto list to `questions.md` and a HANDOFF row and proceed (Req 6). It runs at most once: a design-defect re-approval resumes implementation without re-reaching this point (Req 5 AC 6).
+  - **Gate A:** on `PHASE: gate-a` from the dispatch loop (`harness/skills/sdd-continue/SKILL.md:146-210`): `harness gate get slot=a`; write the receipt to `specs/<spec>/questions.md` (decisions, no `answer`) and commit best-effort before asking (Req 2 AC 7). In block, ask the triples with AskUserQuestion, at most five across at most two calls; a decision whose reply selects `options[0]` with no free text is approve, else needs revision (Req 2 AC 5); a denied/errored/timed-out second call keeps the first call's answers and treats the rest as `no answer` (Req 2 AC 4). Any needing-revision decision re-spawns the document orchestrator once with `MODE: revision` and `REVISION_INPUT` naming each decision's new option and free text; all-approve re-spawns `MODE: normal`. In `record`, write the decisions and `no answer`, a HANDOFF row, and re-spawn `MODE: normal` (Req 3).
+  - **Gate B:** before the first implementation spawn and worktree entry (`harness/skills/sdd-continue/SKILL.md:215-230`, D9): `harness gate get slot=b`; when present, in block present payload.tasks and payload.veto and ask approve-or-annotate; annotate runs exactly one `MODE: revision` tasks round then proceeds; approve proceeds directly (Req 5). In record, write the veto list to `questions.md` and a HANDOFF row and proceed (Req 6). It runs at most once: a design-defect re-approval resumes implementation without re-reaching this point (Req 5 AC 6).
 - **Dependencies:** the `harness` tool, AskUserQuestion.
-- **Reuses:** the retro conversation's AskUserQuestion-with-headless-fallback pattern (`SKILL.md:232-261`); the HANDOFF-row commit path (`SKILL.md:60`); the PHASE dispatch table (`SKILL.md:185-210`).
+- **Reuses:** the retro conversation's AskUserQuestion-with-headless-fallback pattern (`harness/skills/sdd-continue/SKILL.md:232-261`); the HANDOFF-row commit path (`harness/skills/sdd-continue/SKILL.md:60`); the PHASE dispatch table (`harness/skills/sdd-continue/SKILL.md:185-210`).
 
 ### Component 6 — contracts (`references/formats.md`, `agent-rules.md`)
 - **Purpose:** Register the new PHASE value and the new config key.
-- **Interfaces:** `references/formats.md` adds `gate-a` to the `PHASE` enum (`formats.md:28-35`) and one row to the PHASE table (`formats.md:37-50`): *`gate-a` | document orchestrator | run gate A, then re-spawn requirements*. `agent-rules.md` documents the optional top-of-file `gates: block | record` key beside `worktree-per-change` (`agent-rules.md:5-6`); it is absent by default, so existing runs default per mode resolution and need no edit.
+- **Interfaces:** `references/formats.md` adds `gate-a` to the `PHASE` enum (`harness/skills/sdd-continue/references/formats.md:28-35`) and one row to the PHASE table (`harness/skills/sdd-continue/references/formats.md:37-50`): *`gate-a` | document orchestrator | run gate A, then re-spawn requirements*. `agent-rules.md` documents the optional top-of-file `gates: block | record` key beside `worktree-per-change` (`.spec-workflow/agent-rules.md:5-6`); it is absent by default, so existing runs default per mode resolution and need no edit.
 - **Reuses:** the existing key style and the PHASE table.
 
 ## Data Models
@@ -108,7 +108,7 @@ Gate-B payload (`specs/<spec>/gate-b.json`), written by the tasks orchestrator:
 3. **No `## Sensitive paths` list:** `gate class-a` gets `sensitive: null`; `computeClassA` matches no path but still fires keywords; the gate does not fail (Req 4 AC 5).
 4. **Empty surface (`gate get present: false`):** the supervisor treats gate A as nothing to ask (should not occur after a `gate-a` return) and gate B as no veto items; it proceeds without stalling.
 5. **Receipt write or commit failure (gate A):** best-effort — logged, the run proceeds (Req 2 AC 7, Req 1 AC 5).
-6. **Malformed `payload` on `put`:** the action fails naming the field and writes nothing, mirroring `briefAction`'s missing-value guard (`src/tools/harness.ts:537-544`).
+6. **Malformed payload on `put`:** the action fails naming the field and writes nothing, mirroring `briefAction`'s missing-value guard (`src/tools/harness.ts:517-544`).
 
 ## Testing Strategy
 
@@ -118,13 +118,13 @@ Gate-B payload (`specs/<spec>/gate-b.json`), written by the tasks orchestrator:
 
 ## Decisions taken in this document
 
-- D1 — Server surface is a new `gate` action on the existing `harness` tool, not a new MCP tool: options were a new tool, a harness action, or plain file writes; chosen because `harness` already owns spec-store bookkeeping writes and reuses `selectRoots`/`safeJoin` (`src/tools/harness.ts:517-612`), and Req 2 AC 1 requires an MCP write tool.
+- D1 — Server surface is a new gate action on the existing `harness` tool (`src/tools/harness.ts:24-25`), not a new MCP tool: options were a new tool, a harness action, or plain file writes; chosen because `harness` already owns spec-store bookkeeping writes and reuses `selectRoots`/`safeJoin` (`src/tools/harness.ts:517-612`), and Req 2 AC 1 requires an MCP write tool.
 - D2 — The drafter's granted MCP write tool (Req 2 AC 1 / requirements D2) is `harness`: options were a dedicated gate tool or `harness`; chosen because it adds no new tool surface and the drafter needs only the one write.
 - D3 — Payloads are two JSON files (`gate-a.json`, `gate-b.json`) separate from the human `questions.md` receipt: options were one combined file or embedding in HANDOFF; chosen because each gate writes and reads independently and JSON is machine-parseable, while `questions.md` stays human-readable (requirements D5).
 - D4 — The gate-A triple's `options[0]` is the recorded choice, so approve equals selecting `options[0]` with no free text: options were an explicit `chosen` field or positional; chosen because Req 2 AC 1 already lists "chosen option plus rejected alternatives," so position carries it and the triple shape is unchanged.
 - D5 — Only class (a) is mechanized in `veto-rules.ts`; classes (b)/(c) and the final cross-class ordering are the tasks orchestrator's judgment: options were an all-mechanical or all-orchestrator gate B; chosen to match requirements D6 — path/keyword matching is mechanizable, new-dependency and out-of-scope judgment is not.
-- D6 — The gate-B payload carries a compact `tasks` list plus the ranked `veto` items so the supervisor can present the plan: options were the supervisor reading `tasks.md` or a self-contained payload; chosen because the supervisor never reads spec documents (`SKILL.md:14`).
-- D7 — Gate mode resolution stays supervisor skill logic (read `gates:` from `agent-rules.md`, default by AskUserQuestion availability), with no new server code: options were a server helper or skill logic; chosen because it is a single scalar key like `worktree-per-change` the supervisor already reads (`agent-rules.md:5-6`).
+- D6 — The gate-B payload carries a compact tasks list plus the ranked veto items so the supervisor can present the plan: options were the supervisor reading `tasks.md` or a self-contained payload; chosen because the supervisor never reads spec documents (`harness/skills/sdd-continue/SKILL.md:14`).
+- D7 — Gate mode resolution stays supervisor skill logic (read `gates:` from `agent-rules.md`, default by AskUserQuestion availability), with no new server code: options were a server helper or skill logic; chosen because it is a single scalar key like `worktree-per-change` the supervisor already reads (`.spec-workflow/agent-rules.md:5-6`).
 - D8 — The `class-a` keyword scan runs over each task's whole block (title and detail lines from `taskBlock`), not only `- File:` paths: options were file-only or block scan; chosen because keywords such as `migration` and `auth` appear in task prose and Req 4 AC 2 names both a path match and a keyword match.
 
 ## Scope notes
@@ -136,3 +136,4 @@ Gate-B payload (`specs/<spec>/gate-b.json`), written by the tasks orchestrator:
 
 ## Revision History
 - **v1** (2026-09-16) — Initial draft.
+  - **Lint pass.** 21 fixed; rejected: none.
````
