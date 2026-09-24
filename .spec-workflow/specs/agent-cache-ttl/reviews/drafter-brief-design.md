# Drafter brief — agent-cache-ttl design v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Write v1 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/design.md` in place, append to `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/codebase-context.md` (it already exists; never delete a line another phase wrote), then report in 150 words or fewer: files touched, the document's word count (`wc -w`), what you loaded, any scope you cut, flags. No file contents.

## Load, in this order
0. `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/codebase-context.md` first: it maps the code the requirements phase cited. Start from it instead of exploring from cold.
1. Steering: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/steering/tech.md`, `structure.md`, and `design-system.md` if they exist. (The steering directory is currently empty; skip any that are absent.)
2. The decomposition entry for `agent-cache-ttl` (spec 13) in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md` (grep for the slug; the entry is around line 394). It fixes the scope: delivers, decided, end-to-end verification, depends. Read that entry only.
3. This spec's earlier document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/requirements.md` (approved v4). Enumerate every artifact its acceptance criteria name.
4. The template: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/user-templates/design-template.md` if it exists, else `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/templates/design-template.md`.
5. The code under `/home/mcf/repo/spec-workflow-mcp` that the document must describe: the `SubagentStop` hook (`harness/hooks/`), `harness usage` and its reducer (`src/` usage view + `UsageCell`), `scripts/sync-plugin-assets.cjs`, `harness/agent-profiles.json`, the three orchestrator agent files under `harness/agents/`, and supervisor Step 0 in the `sdd-continue` skill. Read before you cite.

## Carried from requirements
None ruled out (all findings accepted/fixed), but the requirements phase left three notes the design MUST address:
- Req 4 splits the unknown-cache counter into `cacheUnknownWrite` and `cacheUnknownGap` (per-kind unknown): pin BOTH fields on the `UsageCell` and its reducer.
- Req 6 crit 7 gates the mandatory non-deferrable block on a tracked `verification-evidence.md` (one line per live scenario) that the restarted rebuilt-harness session writes and the retrospective reads before it starts: pin that artifact and the retrospective's pre-start check.
- Req 4 crit 6 collapses a total cell's cache columns to `unknown` only when the Anthropic spawn count is above 0; an all-DeepSeek total prints the `-` dash.
Address each in this document, or state in `## Scope notes` why it does not apply.

## Additional design requirement (from the coordinating session — treat as binding)
On this machine `~/.claude/agents/sdd-*.md` are symlinks into the MAIN checkout's `harness/agents`, so a restarted session loads main's agent files, not the feature branch's. As written, live verification scenarios (1),(2),(3),(5) could only pass AFTER the merge, but the PR is blocked until they pass. The design MUST state concretely how those scenarios run BEFORE the merge, against the branch's agent files. Candidate approaches: (a) a session launched with the branch's agent definitions passed through `claude --agents <path>`; (b) a fixture agent carrying `experimental: { cacheTtl: 1h }` in its own frontmatter under the branch. Pick either or something better, and state it concretely: the exact command or fixture, and where the evidence lands (tie it to the `verification-evidence.md` artifact above). Record this as a design decision in `## Decisions taken in this document`.

## Size
- Cap: 4,000 words (body only: the H1 down to the line before `## Revision History`). Count with `wc -w` before you report.
- Introduction, overview and alignment sections: three sentences each.
- Do not describe the codebase inside the document. Cite a path when a claim needs it; the map lives in the context file.
- Every sentence is for an agent that will act on it: a criterion, a decision, a constraint, a citation. Cut the rest.

## Codebase context
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/agent-cache-ttl/codebase-context.md` exists. Append (never delete). Shape: `# Codebase context — agent-cache-ttl` H1 already present; one `## <area>` heading per area; under each, one line per file that matters: `- path:start-end — what it is, one clause`. Cite only after reading both ends of the range. No prose, no design opinions. Lists only.

## Rules
- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after reading both ends of the range. A misstated artifact is an automatic MUST_FIX.
- A claim about compiler, library or wire behaviour is checkable: probe the installed version under `/home/mcf/repo/spec-workflow-mcp` and cite the probe, or leave the claim out. The prompt-caching wire fields (`ephemeral_5m_input_tokens`, `ephemeral_1h_input_tokens`, `cache_creation`) and the Claude Code frontmatter key `experimental: { cacheTtl: 1h }` (2.1.248+) are load-bearing: probe the transcripts and the installed `claude --version` before you cite them.
- Keep the decomposition entry's scope. If you cut or defer anything it lists, say so in a `## Scope notes` section and in your report.
- Do not re-decide what requirements pinned. Design enumerates every artifact the requirements name.
- When you pin an interface whose Testing Strategy needs an extra argument (for example a `timeoutMs`), pin that argument as an optional trailing parameter, so the implementer does not have to invent a backward-compatible shim.
- When a design departs from a requirement's literal (a widened enum, a defaulted param, a changed shape), flag it in your report as `RE-DECIDED: <req> — <one line>`.
- Record every call you make on the product's behalf under `## Decisions taken in this document` as `D<n> — <decision>: <options considered>; chosen because <one line>`. A human reads that list.
- End the document with `## Revision History` and the line `- **v1** (2026-09-24) — Initial draft.`
- In `## Revision History` and decision-log bullets, cite findings by id and prose only. Never write a backticked path, line range or code identifier there; the citation lint does not scan these sections.
- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval lint; write `` `<name>` `` or "name".
- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and every other file belong to the orchestrator.
- Do not ask questions. Decide, and record the decision in the document.
