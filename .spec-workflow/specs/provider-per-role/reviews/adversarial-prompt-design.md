# Adversarial Review — provider-per-role/design (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/design.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-analysis-design.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, doc-words on v1 before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v1 lint commit changed: the whole `## Changes since` section below (the lint pass touched the Testing Strategy Unit paragraph — bare ranges given filenames; the out-of-bounds range `:519-530` re-pointed to `src/tools/__tests__/harness.test.ts`; one range widened to `:201-210`). Still open (error = MUST_FIX candidate, warning = your call, info = a note): the citation-identifier warnings L-1..L-33, L-39..L-46, L-48..L-62 and L-64 were all rejected by the lint pass as false positives — the flagged tokens are the design's own new vocabulary (PROVIDERS, LAUNCHER, ALIAS, SID, CFG, SLUG, providers, provider, effort, deepseek, anthropic) at insertion-point citations, or prose words bound to a different citation in the same block. Your call: spot-check a sample and confirm none is a genuinely wrong citation.
- Changes: the diff from the `docs(sdd): provider-per-role design v1` checkpoint to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for provider-per-role in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on (the drafter probed `claude --version` = 2.1.280 and `claude -p --help`).
- The drafter re-decided these requirement literals. Rule on each: `refinement` (closed) or `widening` (a MUST_FIX):
  - Req 2 criterion 5 — the `--agents` JSON `model` key carries the request alias, not the profile's declared model (effort still comes from the profiles).
  - Req 2 criterion 7 — `--add-dir` is passed when the spec store repo is outside the code root.
- Fresh lens for this round: wire contracts across a boundary — the launcher writes ledger rows through `event.sh`, the child command and its environment, the `--agents` JSON, and the producer-to-consumer wire into the `harness usage` fold and the watch model/render. Check that every field a producer writes is the field the consumer reads (names, string values, defaults such as `provider=none`/`anthropic`), and that the TypeScript additions parse exactly what the launcher emits.
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds: none (first review).
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-memory-design.md`. The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — design`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since 3603033

````diff
diff --git a/.spec-workflow/specs/provider-per-role/design.md b/.spec-workflow/specs/provider-per-role/design.md
index c852ee7..f4521fb 100644
--- a/.spec-workflow/specs/provider-per-role/design.md
+++ b/.spec-workflow/specs/provider-per-role/design.md
@@ -180,9 +180,9 @@ providers sdd-reviewer:deepseek:deepseek-v4-pro
 
 ## Testing Strategy
 
-- **Unit:** `src/watch/__tests__/usage.test.ts` (beside `:42-73`): provider from `spawn.end`, else `spawn.start`, else `anthropic`; the `@deepseek` key; `providers` cells per phase and spec; the `anthropic N  deepseek N` pair on total lines in one-spec and compare output; the empty-report literal (`:263-267`) gains `providers` with zero cells, every number unchanged; the fixture (`:270-283`) keeps `4,554,189` with `providers.deepseek.spawns` 0. `src/watch/__tests__/ledger.test.ts` (beside `:251-263`): `provider` from `spawn.start`, overwritten by `spawn.end`; `tokensByProvider`; `providers` from `run.start`; `tokensTotal` unchanged. `src/watch/__tests__/render.test.ts` (beside `:122-132`): header `tokens A deepseek D`, no `deepseek` word at zero, the `providers` line, tier line `actual deepseek deepseek-v4-pro !=`. `src/watch/__tests__/index.test.ts:82-94` unchanged. `src/tools/__tests__/harness.test.ts` (beside `:519-530`): `data.report.providers` with `deepseek` zero on the review-gate-shape ledger.
+- **Unit:** `src/watch/__tests__/usage.test.ts:42-73`: provider from `spawn.end`, else `spawn.start`, else `anthropic`; the `@deepseek` key; `providers` cells per phase and spec; the `anthropic N  deepseek N` pair on total lines in one-spec and compare output; the empty-report literal (`usage.test.ts:263-267`) gains `providers` with zero cells, every number unchanged; the fixture (`usage.test.ts:270-283`) keeps `4,554,189` with `providers.deepseek.spawns` 0. `src/watch/__tests__/ledger.test.ts:251-263`: `provider` from `spawn.start`, overwritten by `spawn.end`; `tokensByProvider`; `providers` from `run.start`; `tokensTotal` unchanged. `src/watch/__tests__/render.test.ts:122-132`: header `tokens A deepseek D`, no `deepseek` word at zero, the `providers` line, tier line `actual deepseek deepseek-v4-pro !=`. `src/watch/__tests__/index.test.ts:82-94` unchanged. `src/tools/__tests__/harness.test.ts:519-530`: `data.report.providers` with `deepseek` zero on the review-gate-shape ledger.
 - **Integration:** `src/__tests__/providers-map.test.ts` drives Component 1 with `execFileSync` on temp `agent-rules.md` files, with and without `DEEPSEEK_API_KEY` in `env` (pattern `src/__tests__/hook-spawn-events.test.ts:36-41`): `none` for a missing path, file, heading or bullets; the two-row value in section order; exit 2 per bad-row case; exit 3 naming the role. `src/__tests__/launcher.test.ts` drives Component 3 with a stub `claude` first on `PATH` (a bash file that dumps its argv and environment, writes the fixture transcript of `src/__tests__/hook-spawn-events.test.ts:58-94` at `CLAUDE_CONFIG_DIR/projects/SLUG/SID.jsonl`, prints a report, exits per a knob file), a temp spec dir with the `formats.md` `event.sh` text, and `HOME`, `CLAUDE_CONFIG_DIR`, `XDG_STATE_HOME` in a temp root. Assertions: exit 2 and no row without the key, for an unmapped agent, for a missing agent file; the `spawn.start` keys; `spawn.end` sums equal to the fixture literals with `model` `claude-opus-4-8+claude-sonnet-5`; the child environment (no `ANTHROPIC_API_KEY`, base URL, token, `ANTHROPIC_MODEL` and `--model` both the alias, `XDG_STATE_HOME` under scratch); a UUID `--session-id` that differs across two calls; `--strict-mcp-config`, `--permission-prompts none`, `--tools` the frontmatter list; `--mcp-config` for the reviser only; stdout equals the stub report with exit 0; stub exit 1 gives exit 1 and still one `spawn.end`; no transcript gives `tokens=unknown` and no `model`. Only node 20 guaranteed fields are read: `execFileSync` options `input`, `env`, `cwd`, the thrown error's `status` and `stdout`, and `fs` read, write, `existsSync` (`.spec-workflow/agent-rules.md:30-32`).
-- **End-to-end:** Req 7 at the completion gate. (1) Key set, the map naming `sdd-reviewer: deepseek deepseek-v4-pro`, a fixture requirements round: the analysis has the verdict block; the ledger has the launcher's `spawn.start` (`model=deepseek-v4-pro`) and `spawn.end` (`model` equal to the recorded `message.model`, digit usage, both `provider=deepseek`); the reviser round has today's hook rows. (2) Every role `anthropic`: no `provider` key, `run.start` gains only `providers`. (3) Key unset with the same map: the supervisor stops at the roots step with the Component 1 line; `node dist/index.js --watch . --spec SPEC --once` shows no entry for that run. (4) `harness usage` on (1) prints the reviewer under `deepseek` and an `anthropic` total without it. (5) `node dist/index.js --watch . --spec review-gate --once` prints `tokens 6.3M`. (6) `npm test`, `npx tsc --noEmit`, `claude plugin validate . --strict`, `npm run check:plugin-assets`. Without the key in the session, (1) and (4) are the deferred half per `harness/skills/sdd-implementation-phase/SKILL.md:201-205`, tagged `verification`.
+- **End-to-end:** Req 7 at the completion gate. (1) Key set, the map naming `sdd-reviewer: deepseek deepseek-v4-pro`, a fixture requirements round: the analysis has the verdict block; the ledger has the launcher's `spawn.start` (`model=deepseek-v4-pro`) and `spawn.end` (`model` equal to the recorded `message.model`, digit usage, both `provider=deepseek`); the reviser round has today's hook rows. (2) Every role `anthropic`: no `provider` key, `run.start` gains only `providers`. (3) Key unset with the same map: the supervisor stops at the roots step with the Component 1 line; `node dist/index.js --watch . --spec SPEC --once` shows no entry for that run. (4) `harness usage` on (1) prints the reviewer under `deepseek` and an `anthropic` total without it. (5) `node dist/index.js --watch . --spec review-gate --once` prints `tokens 6.3M`. (6) `npm test`, `npx tsc --noEmit`, `claude plugin validate . --strict`, `npm run check:plugin-assets`. Without the key in the session, (1) and (4) are the deferred half per `harness/skills/sdd-implementation-phase/SKILL.md:201-210`, tagged `verification`.
 
 ## Decisions taken in this document
 
@@ -217,3 +217,4 @@ providers sdd-reviewer:deepseek:deepseek-v4-pro
 ## Revision History
 
 - **v1** (2026-09-22) — Initial draft.
+  - **Lint pass.** 7 fixed; rejected: L-1..L-33, L-39..L-46, L-48..L-62, L-64 (false positives: prose words, or citations marking where new material goes, not claims the range already holds it).
````
