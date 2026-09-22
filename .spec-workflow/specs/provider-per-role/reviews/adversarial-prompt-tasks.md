# Adversarial Review — provider-per-role/tasks (v1)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Atomicity, ordering, coverage

**Example attack angles to consider:** Tasks too large or too small, missing dependency edges, gaps between tasks and design, unclear completion criteria, tasks that don't map to any requirement

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
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-analysis-tasks.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md`
  first; it maps the code this document cites. Start your code reads from it.
- Version under review: v1.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked,
  citation-bare, citation-identifier, mdx, caps-invalid, tasks-format,
  task-requirement-id, task-requirement-unchecked, task-words, coverage-component,
  coverage-unchecked and bridge-missing on v1 before the lint pass fixed anything. A rule
  with no finding listed here passed only that pre-fix run: verify meaning only for it.
  Re-verify only citations the v1 lint commit changed: the whole `## Changes since`
  section below (the lint pass corrected two path citations to
  `harness/skills/sdd-document-phase/references/briefs.md` and
  `harness/skills/sdd-continue/references/formats.md`). Still open (error = MUST_FIX
  candidate, warning = your call, info = a note): 69 citation-identifier and
  bridge-missing warnings, all rejected by the lint pass with reason — each flagged token
  is either a new artifact, env var or field this spec creates (the tasks doc cites it
  ahead of its own creation) or an existing artifact cited correctly elsewhere in the
  same task's prompt, and the two bridge-missing warnings (tasks 1 and 4 naming a later
  task) are narrative ordering with no compile-time dependency. Judge whether that
  disposition holds; nothing here is an open error.
- Changes: the diff from the `docs(sdd): provider-per-role tasks v1` checkpoint to the
  working tree follows as `## Changes since <short sha>`, cut at 500 lines.
- First review. Read the decomposition entry for `provider-per-role` in
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md`
  and check the document against its scope. The context file is drafter-written and
  unreviewed; re-probe any `## Probes` line the document relies on.
- Fresh lens for this round: the sub-agent that receives only one task's prompt and must
  produce a correct, compiling change from it alone — check that every task's `_Prompt:`
  states its inputs, the artifacts it creates, and testable success criteria without
  pinning a signature or helper name that a different task in this document creates, and
  that a task using an artefact a later task creates names the bridge (a cast or stub)
  and the later task says to remove it.
- Tasks phase, gate B: if a task introduces a new external dependency, number it as a
  normal finding and append `[gate-b:T<task id>]` to that finding's title; if a task does
  more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the
  tasks and the approved
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md`
  — your normal reviewer read.
- Closed by ruling, do not re-open: Req 2 crit 5 — the `--agents` JSON `model` key
  carries the request alias, not the profile's declared model (effort still from
  profiles); Req 2 crit 7 — `--add-dir` is passed when the spec store repo is outside the
  code root; R2-1 (MINOR) — compare-mode provider-pair placement is left to
  implementation, do not re-raise it as blocking.
- Rejected findings from earlier rounds: none (this is round 1).
- Rolling memory file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/reviews/adversarial-memory-tasks.md`.
  The scaffold above does not mention it on the first round. Create it after your
  analysis, in the format later rounds expect: `# Adversarial Review Memory — tasks`,
  `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted /
  Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns &
  Themes`, `## Guidance for Next Review`.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for
  reading code and running checks:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Changes since f51faa5

````diff
diff --git a/.spec-workflow/specs/provider-per-role/tasks.md b/.spec-workflow/specs/provider-per-role/tasks.md
index d33e9e9..2c58cf6 100644
--- a/.spec-workflow/specs/provider-per-role/tasks.md
+++ b/.spec-workflow/specs/provider-per-role/tasks.md
@@ -13,7 +13,7 @@ Dependency order: task 1 writes the launcher body and proves it against DeepSeek
   - Purpose: the launcher is built on measured DeepSeek behaviour and the reviser's eligibility is recorded (design Components 3 and 7, D3-D6, D9-D10, D13, D15-D16; Requirement 6).
   - _Leverage: harness/hooks/sdd-activity.sh:32-49, harness/skills/sdd-continue/references/formats.md:5-17, harness/skills/sdd-continue/references/formats.md:170-182, harness/skills/sdd-continue/references/harness-source.sh:13-21, harness/agents/sdd-reviewer.md:7-12, harness/agents/sdd-reviser.md:7-16, harness/agent-profiles.json:47-56, harness/skills/sdd-document-phase/references/briefs.md:125-197, docs/step-0-answers.md:1-17_
   - _Requirements: 2.5, 2.6, 2.7, 2.8, 3.1, 3.2, 3.3, 3.4, 4.3, 4.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
-  - _Prompt: Task: First test `DEEPSEEK_API_KEY` in your environment: when unset or empty, write nothing under `docs/`, call `log-implementation` with the summary `preflight not run: DEEPSEEK_API_KEY unset`, and report `ESCALATE: DEEPSEEK_API_KEY unset; preflight not run` (Requirement 6 criterion 7). Otherwise write harness/skills/sdd-continue/references/sdd-launch.sh as design Component 3 specifies, steps 1 to 8, with the child command, environment and `--agents` JSON from the design's Data Models: usage `bash sdd-launch.sh AGENT "MESSAGE"`; every run value read from the `SDD_*` environment the per-run wrapper exports; step 1 refusals as exit 2 with one stderr line `launcher: REASON` and no row; the `--agents` `effort` from the first existing profiles file, else the frontmatter (D13); a fresh session id per call from `node -e 'console.log(require("crypto").randomUUID())'`; an empty per-run `XDG_STATE_HOME` directory so the child's hooks exit before reading their payload (D3, harness/hooks/sdd-activity.sh:11-12); `--add-dir` only when the store repo is outside the code root (D9); the `--mcp-config SDD_CODE_ROOT/.mcp.json` and `--allowedTools` pair only when the frontmatter lists `mcp__` tools (D10); the transcript at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/SLUG/SID.jsonl` with the D15 slug rule, summed with a copy of `readUsage` (harness/hooks/sdd-activity.sh:37-49) into `spawn.end` with `provider=deepseek`, `model` and the five digit keys, or `tokens=unknown` alone when the file is missing or sums nothing. Put node code in single-quoted strings without apostrophes, as the hook does (:32-35). Then stage `/tmp/scratchpad/sdd/provider-per-role/preflight/` as a scratch spec dir: an `event.sh` from the formats.md text (:170-182) pointed at a ledger there, a fixture document (a copy of this spec's `requirements.md`), and a review prompt file that names the document, an analysis path under the scratch dir, the round section shape (briefs.md:125-197) and the verdict block (formats.md:5-17). Export the `SDD_*` values for that dir (`SDD_SPEC_STORE_REPO` the scratch dir, so `--add-dir` covers it; `SDD_CODE_ROOT` and `SDD_HARNESS_REPO` this checkout; `SDD_PROVIDERS=sdd-reviewer:deepseek:deepseek-v4-pro,sdd-reviser:deepseek:deepseek-v4-pro`) and run (a): `bash sdd-launch.sh sdd-reviewer "Read and execute the instructions in PROMPT_PATH"`. Run (b) the same way for `sdd-reviser` with a prompt that makes one `adversarial-response` call (`specName: provider-per-role`, `phase: requirements`) and writes the first line of the answer to a file; `dist/index.js` must exist first (`npm run build` when it does not). From the two runs' stderr, transcripts and scratch files, record the five one-line probes of Requirement 6 criterion 5: auth by `ANTHROPIC_AUTH_TOKEN` alone; whether `--agents` rejected `tools` or `model`; where the transcript landed and whether `--session-id` named it; whether the child appended anything to the scratch ledger or activity file beyond the launcher's two rows; whether effort was applied. Where a probe shows a flag or path wrong (a rejected `tools` key moves the list to `--tools`; a different directory name changes the slug rule), fix the body and say so in the record. Write docs/deepseek-preflight.md in the docs/step-0-answers.md:1-17 shape: `Date`, `Source` (the commands run, key redacted), a seven-row summary table — (a) reviewer run, (b) reviser MCP call, auth token alone, `--agents` keys, transcript path and `--session-id`, child hooks, effort — and one section per row with the evidence and the consequence Requirement 6 criterion 5 names; the (a) section states the `message.model` string, the transcript path and the usage sums. Run `node scripts/sync-plugin-assets.cjs` and commit the `plugins/` copies with the body. (a) passes when all three hold: the analysis file exists and ends with the verdict block; the transcript was found at the computed path and sums to digits; `message.model` is `deepseek-v4-pro` or `claude-opus-4-8`. On any other (a) outcome write the record with the failure, commit, log, and report `ESCALATE: preflight (a) failed — REASON` and `RETRO: escalation — the same line` | Restrictions: Never print, commit or write the key anywhere; the child gets it only as `ANTHROPIC_AUTH_TOKEN` with `ANTHROPIC_API_KEY` unset (Requirement 4 criteria 3-5). Do not pass `--bare`, `--no-session-persistence` or `--effort` (design Data Models). Read no file in the projects directory other than the computed transcript (Requirement 3 criterion 3). Do not edit `harness/hooks/`, any skill markdown, or `harness/agent-profiles.json`; do not add `sdd-reviser` to any eligible list, task 4 reads this record. Scratch files stay under `/tmp/scratchpad/sdd/provider-per-role/` | Success: `bash -n harness/skills/sdd-continue/references/sdd-launch.sh` is clean; `npm run check:plugin-assets` and `claude plugin validate . --strict` pass; docs/deepseek-preflight.md holds the seven-row table and a consequence line per section; the scratch ledger holds exactly one `spawn.start` and one `spawn.end` per launcher call, both `provider=deepseek`, the start with `effort=not-applied`; the report says (a) passed with the recorded `message.model` string and whether (b) answered, or carries `ESCALATE:`_
+  - _Prompt: Task: First test `DEEPSEEK_API_KEY` in your environment: when unset or empty, write nothing under `docs/`, call `log-implementation` with the summary `preflight not run: DEEPSEEK_API_KEY unset`, and report `ESCALATE: DEEPSEEK_API_KEY unset; preflight not run` (Requirement 6 criterion 7). Otherwise write harness/skills/sdd-continue/references/sdd-launch.sh as design Component 3 specifies, steps 1 to 8, with the child command, environment and `--agents` JSON from the design's Data Models: usage `bash sdd-launch.sh AGENT "MESSAGE"`; every run value read from the `SDD_*` environment the per-run wrapper exports; step 1 refusals as exit 2 with one stderr line `launcher: REASON` and no row; the `--agents` `effort` from the first existing profiles file, else the frontmatter (D13); a fresh session id per call from `node -e 'console.log(require("crypto").randomUUID())'`; an empty per-run `XDG_STATE_HOME` directory so the child's hooks exit before reading their payload (D3, harness/hooks/sdd-activity.sh:11-12); `--add-dir` only when the store repo is outside the code root (D9); the `--mcp-config SDD_CODE_ROOT/.mcp.json` and `--allowedTools` pair only when the frontmatter lists `mcp__` tools (D10); the transcript at `${CLAUDE_CONFIG_DIR:-$HOME/.claude}/projects/SLUG/SID.jsonl` with the D15 slug rule, summed with a copy of `readUsage` (harness/hooks/sdd-activity.sh:37-49) into `spawn.end` with `provider=deepseek`, `model` and the five digit keys, or `tokens=unknown` alone when the file is missing or sums nothing. Put node code in single-quoted strings without apostrophes, as the hook does (:32-35). Then stage `/tmp/scratchpad/sdd/provider-per-role/preflight/` as a scratch spec dir: an `event.sh` from the formats.md text (:170-182) pointed at a ledger there, a fixture document (a copy of this spec's `requirements.md`), and a review prompt file that names the document, an analysis path under the scratch dir, the round section shape (harness/skills/sdd-document-phase/references/briefs.md:125-197) and the verdict block (harness/skills/sdd-continue/references/formats.md:5-17). Export the `SDD_*` values for that dir (`SDD_SPEC_STORE_REPO` the scratch dir, so `--add-dir` covers it; `SDD_CODE_ROOT` and `SDD_HARNESS_REPO` this checkout; `SDD_PROVIDERS=sdd-reviewer:deepseek:deepseek-v4-pro,sdd-reviser:deepseek:deepseek-v4-pro`) and run (a): `bash sdd-launch.sh sdd-reviewer "Read and execute the instructions in PROMPT_PATH"`. Run (b) the same way for `sdd-reviser` with a prompt that makes one `adversarial-response` call (`specName: provider-per-role`, `phase: requirements`) and writes the first line of the answer to a file; `dist/index.js` must exist first (`npm run build` when it does not). From the two runs' stderr, transcripts and scratch files, record the five one-line probes of Requirement 6 criterion 5: auth by `ANTHROPIC_AUTH_TOKEN` alone; whether `--agents` rejected `tools` or `model`; where the transcript landed and whether `--session-id` named it; whether the child appended anything to the scratch ledger or activity file beyond the launcher's two rows; whether effort was applied. Where a probe shows a flag or path wrong (a rejected `tools` key moves the list to `--tools`; a different directory name changes the slug rule), fix the body and say so in the record. Write docs/deepseek-preflight.md in the docs/step-0-answers.md:1-17 shape: `Date`, `Source` (the commands run, key redacted), a seven-row summary table — (a) reviewer run, (b) reviser MCP call, auth token alone, `--agents` keys, transcript path and `--session-id`, child hooks, effort — and one section per row with the evidence and the consequence Requirement 6 criterion 5 names; the (a) section states the `message.model` string, the transcript path and the usage sums. Run `node scripts/sync-plugin-assets.cjs` and commit the `plugins/` copies with the body. (a) passes when all three hold: the analysis file exists and ends with the verdict block; the transcript was found at the computed path and sums to digits; `message.model` is `deepseek-v4-pro` or `claude-opus-4-8`. On any other (a) outcome write the record with the failure, commit, log, and report `ESCALATE: preflight (a) failed — REASON` and `RETRO: escalation — the same line` | Restrictions: Never print, commit or write the key anywhere; the child gets it only as `ANTHROPIC_AUTH_TOKEN` with `ANTHROPIC_API_KEY` unset (Requirement 4 criteria 3-5). Do not pass `--bare`, `--no-session-persistence` or `--effort` (design Data Models). Read no file in the projects directory other than the computed transcript (Requirement 3 criterion 3). Do not edit `harness/hooks/`, any skill markdown, or `harness/agent-profiles.json`; do not add `sdd-reviser` to any eligible list, task 4 reads this record. Scratch files stay under `/tmp/scratchpad/sdd/provider-per-role/` | Success: `bash -n harness/skills/sdd-continue/references/sdd-launch.sh` is clean; `npm run check:plugin-assets` and `claude plugin validate . --strict` pass; docs/deepseek-preflight.md holds the seven-row table and a consequence line per section; the scratch ledger holds exactly one `spawn.start` and one `spawn.end` per launcher call, both `provider=deepseek`, the start with `effort=not-applied`; the report says (a) passed with the recorded `message.model` string and whether (b) answered, or carries `ESCALATE:`_
 
 - [ ] 2. Launcher integration test with a stub `claude`
   - File: src/__tests__/launcher.test.ts
@@ -124,3 +124,4 @@ Dependency order: task 1 writes the launcher body and proves it against DeepSeek
 ## Revision History
 
 - **v1** (2026-09-22) — Initial draft.
+  - **Lint pass.** 2 fixed; rejected: L-1, L-33 (bridge-missing) — narrative ordering only, the naming task does not compile or depend on the later task's artifact contents; L-2–L-11, L-14–L-30, L-34–L-41, L-42–L-54, L-55–L-64, L-65–L-71 (citation-identifier) — each token is either a new artifact/env var/field this spec introduces (correct for a tasks document to cite ahead of its own creation) or an existing artifact already cited correctly elsewhere in the same task's prompt, not tied to the particular range the finding compared it against; L-31, L-32 (citation-identifier) — `ESCALATE` and `escalation` are new text task 3 adds; the cited line is the existing dispatch branch the new text hooks into, not a claim the words already appear there.
````
