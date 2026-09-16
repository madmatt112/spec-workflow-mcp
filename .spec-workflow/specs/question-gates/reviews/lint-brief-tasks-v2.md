# Lint brief — question-gates tasks v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v2 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/tasks.md` in place,
then report in 150 words or fewer: files touched; each finding as
`<id>: accepted | partially accepted | rejected`; citations verified (count); the
document's word count; flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/tasks.md` (v2).
  Cap: 150 words per task block excluding its prompt. Do not grow the document past it; a
  fix that adds a paragraph removes one.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/requirements.md`.
- Design:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/question-gates/design.md`.
- Findings: the list under `## Revision input`.

## Revision input
L-1 (warning, citation-identifier, line 4): Identifier 'harness' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
L-2 (warning, citation-identifier, line 4): Identifier 'gate' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
L-3 (warning, citation-identifier, line 4): Identifier 'computeClassA' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
L-4 (warning, citation-identifier, line 4): Identifier 'vitest' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
L-5 (warning, citation-identifier, line 4): Identifier 'get' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
L-6 (warning, citation-identifier, line 4): Identifier 'delete' is absent from the cited ranges (.spec-workflow/agent-rules.md:26)
L-7 (warning, bridge-missing, line 39): task 4 names later task 5 with no bridge
L-8 (warning, task-words, line 58): task 6: 152 words, cap 150
L-9 (error, citation-path, line 66): Cited path resolves under no base: SKILL.md (task 6 Prompt, "step 3 rule 4 (SKILL.md:122)")
L-10 (error, citation-path, line 87): Cited path resolves under no base: agent-rules.md (v1 Lint-pass bullet)
L-11 (error, citation-path, line 88): Cited path resolves under no base: sdd-reviser.md (v1 Lint-pass bullet)
L-12 (error, citation-path, line 89): Cited path resolves under no base: SKILL.md (v1 Lint-pass bullet)
L-13 (error, citation-path, line 89): Cited path resolves under no base: references/briefs.md (v1 Lint-pass bullet)
L-14 (error, citation-path, line 90): Cited path resolves under no base: SKILL.md (v1 Lint-pass bullet)
L-15 (error, citation-path, line 93): Cited path resolves under no base: sdd-reviser.md (v2 R1-2 bullet)
L-16 (error, citation-path, line 93): Cited path resolves under no base: SKILL.md (v2 R1-2 bullet)
L-17 (error, citation-path, line 93): Cited path resolves under no base: references/briefs.md (v2 R1-2 bullet)
L-18 (error, citation-path, line 93): Cited path resolves under no base: SKILL.md (v2 R1-2 bullet)
L-19 (warning, citation-identifier, line 94): Identifier 'parseTasksFromMarkdown' is absent from the cited ranges (src/core/task-parser.ts:108-128) (v2 R1-3 bullet)
L-20 (warning, citation-identifier, line 94): Identifier 'TaskParserResult' is absent from the cited ranges (src/core/task-parser.ts:108-128) (v2 R1-3 bullet)

## How the findings group (fix strategy)
- REAL task-body defects — fix in the task:
  - L-9: task 6's `_Prompt:` line writes a bare `SKILL.md:122`. Qualify it to
    `harness/skills/sdd-continue/SKILL.md:122` (the same file task 6's `- File:` line 59
    and Leverage line 64 already name). Verify line 122 exists.
  - L-8: task 6's non-prompt body is 152 words (cap 150). Trim two or more words from its
    body bullets (not the `_Prompt:` line) without dropping the resume-recheck behaviour.
- PREAMBLE (line 4) — L-1..L-6: the `.spec-workflow/agent-rules.md:26` citation shares a
  paragraph with the backticked identifiers `harness`, `gate`, `computeClassA`, `vitest`,
  `get`, `delete`, which do not appear at that line. Put the sentence carrying the
  `.spec-workflow/agent-rules.md:26` citation in its own paragraph (a blank line before and
  after) so those identifiers no longer share its paragraph. Keep the citation; do not
  delete the sync-plugin-assets requirement.
- REVISION-HISTORY PROSE — L-10..L-18 (citation-path errors) and L-19, L-20
  (citation-identifier warnings): these live in the v1 Lint-pass sub-bullets (lines 86-90)
  and the v2 R1-2 / R1-3 bullets (lines 93-94). They describe past citation fixes and, in
  doing so, embed bare file names (`SKILL.md`, `sdd-reviser.md`, `references/briefs.md`,
  `agent-rules.md`) and a stale `src/core/task-parser.ts:108-128` code-span, which
  spec-lint parses as unresolvable citations. Rewrite each of those bullets so it records
  the same fix in plain prose with NO file-path token, NO `path:line` citation, and NO
  backticked code identifier — refer to each fix by its finding id and by the destination
  directory in words (for example: "qualified task 4's two skill-file citations to their
  `harness/agents/` path"). Do not rewrite what each decision recorded; only remove the
  lintable tokens. Editing an existing Revision-History bullet to clear a lint token is in
  scope.
- L-7 (bridge-missing): the v1 lint pass already ruled this rejected (task 4's forward
  mention of task 5's runtime re-spawn names no artefact task 5 creates). Reject again;
  leave as-is.

## Convergence rule (do not re-introduce the findings)
Revision History is a decision log, not a citation surface. The Lint-pass bullet you add
for v2, and every Revision-History bullet you touch, must contain no file path, no
`path:line` citation, and no backticked code identifier. All paths and identifiers belong
in the task bodies (File / Leverage / Prompt lines), never in the log. After your edit,
reason that spec-lint would report zero citation-path findings and zero
citation-identifier findings arising from any Revision-History line or the preamble.

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with one
   line of reasoning. Never accept to be agreeable; never reject to save work.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact
   is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned.
4. Edit v2 in place. Add no version line. Append under the v2 Revision History line one
   nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>` — and this
   bullet, too, must carry no path, `path:line` citation, or backticked identifier.
5. Closed by ruling, leave as is: L-7 (the bridge-missing ruling from the v1 lint pass).
6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template's task
   shape; every task numbered; `_Prompt: …_` ends with `_`.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong
   to others. You may replace a context-file line that an accepted finding refutes: same
   line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same
   construct (the same bare file name, the same stale range) and fix each; list them under
   the finding's bullet. A sibling left unchanged is next round's finding.
