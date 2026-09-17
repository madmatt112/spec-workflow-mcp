# Drafter brief — worktree-review-signals requirements v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md` in place (overwriting the stale scaffold that is there now), write `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md`, then report in 150 words or fewer: files touched, the document's word count (`wc -w`), what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
0. Requirements phase: nothing from a prior phase of this spec. You write the context file (below).
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/product.md` is ABSENT (the steering/ directory is empty). The decomposition entry is the scope authority.
2. The decomposition entry for `worktree-review-signals` in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`: grep the slug; it is the section `### 2. worktree-review-signals — what the reviewer is told` (near line 40). Read that entry only (what it delivers, the line `Carries R5 (per-task diff base), R7 (typecheck degrades honestly), R8 (attribution), R9 (disclosures reach the reviewing agent)`, `Depends on 1`, and the end-to-end verification paragraph). Then read `## Build order` (near line 240), `## Boundary notes` (near line 248), and `## Open question deferred to spec 2` (near line 255) — each names this spec's scope. This entry fixes the scope; keep it.
3. This spec's earlier documents: none. BUT the current `requirements.md` is a STALE carried-criteria scaffold from the 2026-09-14 spec split — it has no EARS requirements and no Revision History. Overwrite it with a fresh v1. Read its `## Carried criteria` (R5, R7, R8, R9) and `## Non-functional notes carried` sections first: they capture the criteria this spec inherits from `worktree-execution-context` and are scope input, not a document to preserve.
4. The template: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/requirements-template.md`.
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the document must describe. Read before you cite. Surfaces the scope names: `src/dashboard/task-review-runner.ts`, `src/tools/review-task.ts`, `src/core/task-diff.ts`, and `ToolContext.workspacePath` (delivered by spec 1, worktree-execution-context). Probe the installed `@toon-format/toon` version before any claim about TOON round-tripping.

## Carried from the spec split and inherited deferrals
The decomposition entry names R5, R7, R8, R9 as this spec's scope. Turn each into a Requirement, or state under `## Scope notes` why it does not apply. Fold in these inherited deferrals — each was deferred TO this spec's requirements phase and its revisit trigger fires now:
- `d-6e59490b` — Diff state (`data.diff` and `data.diffRejection`) never reaches the dashboard-spawned reviewer's prompt; the runner destructures six fields and none carries diff data. R9 must require the disclosure to arrive on BOTH review paths (the direct MCP call and the dashboard-spawned runner), not only the direct call. Cite `src/dashboard/task-review-runner.ts`.
- `d-a2233b94` — TOON round-trip is unsafe for large payloads: the ~4000-char `methodology` field throws on decode under `@toon-format/toon@0.8.0`. The disclosure channel needs a response shape that survives round-tripping (fall back to JSON, drop the field, or fix the encoder — state the observable, not the mechanism). Probe the installed version and cite the probe.
- The disclosure-channel halves of `d-f3cb6fd8` — two byte-pinned read-every-listed-file instructions survive the all-drop guard: the unconditional methodology header (`src/tools/review-task.ts` near line 584) and `R4_2A_DIFF_EMPTY` (near line 684), which fires on the all-drop path and supplies a fabricated already-committed-before-review explanation. This spec's honesty scope should make the all-drop signal honest at these sites; read both ends of each cited range.
- Open question deferred to spec 2 (decomposition `## Open question deferred to spec 2`): R7 AC 6's new typecheck `unavailable` reasons must be added to a byte-pinned methodology constant whose drift test compares against `tighter-reviews`' gitignored `requirements.md`. Amend that criterion here; record the resulting divergence as a deferred decision to raise against `tighter-reviews` (do NOT edit another spec's approved document; the orchestrator files deferrals).
Address each item in this document, or state in `## Scope notes` why it does not apply to this phase.

## Size
- Cap: 3,500 words. Count with `wc -w` before you report (body only: the H1 down to the line before `## Revision History`).
- Introduction, overview and alignment sections: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs it; the map of the code lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md` is the map of the code this spec touches, written from the exploration you do anyway. Create it (it does not exist). Shape:
- First line `# Codebase context — worktree-review-signals`.
- One `## <area>` heading per area (a route, a package, a table, a component tree).
- Under each, one line per file that matters: `- path:start-end — what it is, one clause`. Cite only after reading both ends of the range.
- No prose, no design opinions, no requirements. Lists only.
Every later reviewer, reviser and implementer reads it first.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after reading both ends of the range. A misstated artifact is an automatic MUST_FIX for the reviewer.
- A claim about compiler, library or wire behaviour is checkable: probe the installed version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or leave the claim out.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in a `## Scope notes` section and in your report.
- Do not re-decide what an earlier phase pinned. This spec depends on `worktree-execution-context` (spec 1) for `ToolContext.workspacePath` and the file partition; treat those as given, do not re-specify them.
- When you must depart from an inherited criterion's literal wording (R5/R7/R8/R9), flag it in your report as `RE-DECIDED: <req> — <one line>`.
- Record every call you make on the product's behalf under `## Decisions taken in this document` as `D<n> — <decision>: <options considered>; chosen because <one line>`. A human reads that list.
- End the document with `## Revision History` and the line `- **v1** (2026-09-17) — Initial draft.`
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval lint; write `` `<name>` `` or "name".
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.
