# provider-per-role tasks v4 lint

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v4 of /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md in place, then report in 150 words or fewer: files touched; each finding as <id>: accepted | partially accepted | rejected; citations verified (count); the document's word count; flags. No file contents. Add no version line. Append under the v4 Revision History line one nested bullet: '- **Lint pass.** <n> fixed; rejected: <none | L-n reason, ...>'.

## Inputs
- Context file: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md. Read it first.
- Document: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md (v4). Cap: 150 words per task block excluding its prompt. Do not grow past the cap.
- Requirements: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md. Design: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/design.md.
- Code under /home/mcf/repo/spec-workflow-mcp. The decomposition file is at .spec-workflow/spec-decomposition/decomposition.md; confirm the line ranges resolve there before citing.
- Prior dispositions: the v1, v2 and v3 lint passes all rejected the citation-identifier/bridge-missing class, reasoning each flagged token is a new artifact/env var/field this spec creates or an identifier cited correctly elsewhere in the same task's prompt, and bridge-missing warnings are the forward references the preamble's dependency order documents. Disposition rule 11 suppresses, does not re-fire, a citation-identifier warning on a token unchanged since a version where it was rejected with a reason.

Disposition rules: assess each on merits; verify every citation you add/change against the real tree, both ends; do not widen scope; keep the tasks template shape, every task numbered, _Prompt: ..._ ends with _; every citation you insert or change carries its filename WITH a directory prefix (dir/file.md:line), never a bare file.md; edit only the document.

## Findings
Two errors (citation-path, MUST fix) plus the recurring warning class.
L-1 (error, citation-path, line 119): Cited path `decomposition.md` has no directory prefix. The v4 R3-1 fix bound the range to `decomposition.md` but omitted its directory. Cite it by its full path from the spec store: `.spec-workflow/spec-decomposition/decomposition.md:383-384`. Confirm 383-384 resolves in that file (it is the End-to-end verification section) before citing.
L-2 (error, citation-path, line 119): Cited path `decomposition.md` has no directory prefix (second occurrence on line 119, the `:344,346` reference). Cite it as `.spec-workflow/spec-decomposition/decomposition.md:344,346`; confirm those lines resolve there (the subprocess-spawn bullet).
L-3 (69 warnings, citation-identifier + bridge-missing, lines 9,16,25,35,37,44,72,83,96,100,117): the same class v1/v2/v3 lint rejected — new env vars/artifacts/fields this spec creates (including the `verification` tag at line 96, which is the deferral tag task 10 sets), identifiers cited correctly elsewhere in the same task's prompt, and the two documented forward references (lines 9, 37). Assess and suppress unchanged rejected-class tokens per rule 11; fix only any range genuinely wrong. Do not delete a correct forward reference.
