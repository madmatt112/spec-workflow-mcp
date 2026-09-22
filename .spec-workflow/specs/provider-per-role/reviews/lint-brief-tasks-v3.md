# provider-per-role tasks v3 lint

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v3 of /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md in place, then report in 150 words or fewer: files touched; each finding as <id>: accepted | partially accepted | rejected; citations verified (count); the document's word count; flags. No file contents. Add no version line. Append under the v3 Revision History line one nested bullet: '- **Lint pass.** <n> fixed; rejected: <none | L-n reason, ...>'.

## Inputs
- Context file: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md. Read it first.
- Document: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md (v3). Cap: 150 words per task block excluding its prompt. Do not grow the document past the cap.
- Requirements: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md. Design: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/design.md.
- Code under /home/mcf/repo/spec-workflow-mcp. Read both ends of every range you cite.
- Prior dispositions: v1 and v2 lint passes both rejected the entire citation-identifier/bridge-missing class (v2 rejected it as L-6), reasoning each flagged token is a new artifact/env var/field this spec creates or an identifier cited correctly elsewhere in the same task's prompt, and bridge-missing warnings are the forward references the preamble's dependency order documents. Disposition rule 11 suppresses, does not re-fire, a citation-identifier warning on a token unchanged since a version where it was rejected with a reason.

Disposition rules: assess each on its merits; verify every citation you add/change against the real tree, both ends; do not widen scope; MDX no bare angle brackets; keep the tasks template shape, every task numbered, _Prompt: ..._ ends with _; every citation you insert or change carries its filename with a directory prefix (dir/file.md:line), never a bare file.md or bare :line; edit only the document.

## Findings
Seven errors (citation-path, MUST fix) plus the recurring warning class.

Errors — each is a bare filename with no directory prefix, introduced by the v3 delta; add the directory prefix from the real tree (harness/agents/sdd-implementer.md, harness/skills/sdd-implementation-phase/SKILL.md, harness/skills/sdd-implementation-phase/references/... or harness/skills/sdd-document-phase/references/briefs.md as the surrounding text intends). Read the file to confirm the correct prefix before citing:
L-1 (error, citation-path, line 96): Cited path `sdd-implementer.md` has no directory prefix.
L-2 (error, citation-path, line 96): Cited path `SKILL.md` has no directory prefix.
L-3 (error, citation-path, line 100): Cited path `sdd-implementer.md` has no directory prefix.
L-4 (error, citation-path, line 100): Cited path `SKILL.md` has no directory prefix.
L-5 (error, citation-path, line 117): Cited path `briefs.md` has no directory prefix.
L-6 (error, citation-path, line 119): Cited path `SKILL.md` has no directory prefix.
L-7 (error, citation-path, line 119): Cited path `SKILL.md` has no directory prefix (second occurrence on the line).

Warning class (disposition per rule 11 / prior dispositions above):
L-8 (68 warnings, citation-identifier + bridge-missing, lines 9,16,25,35,37,44,72,83,96,100,119): the same citation-identifier/bridge-missing class v1 and v2 lint rejected. citation-identifier tokens are new env vars/artifacts/fields this spec creates (for example DEEPSEEK_API_KEY, SDD_PROVIDERS, ANTHROPIC_MODEL, provider, effort, tokensByProvider, reduceSpawn, SpawnNode, buildUsageReport, formatUsageTable, ELIGIBLE) or identifiers cited correctly elsewhere in the same task's prompt; bridge-missing (lines 9, 37) are the forward task references the preamble dependency order documents. Assess and, where the token is unchanged since a prior rejection, suppress rather than re-fire; fix any that name a range genuinely wrong. Do not delete a correct forward reference.
