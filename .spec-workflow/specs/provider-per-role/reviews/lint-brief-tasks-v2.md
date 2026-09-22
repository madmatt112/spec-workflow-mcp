# Lint brief — provider-per-role tasks v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v2 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md` in
place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted
| partially accepted | rejected`; citations verified (count); the document's word count;
flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md`.
  Read it first.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md`
  (v2). Cap: 150 words per task block excluding its prompt. Do not grow a block past it.
- Requirements and design:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md`,
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/design.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: v1's lint pass rejected the whole citation-identifier /
  bridge-missing class with documented reasons — each flagged token is a new artifact,
  env var or field this spec creates (cited ahead of its own creation) or an existing
  artifact cited correctly elsewhere in the same task's prompt, and the two
  bridge-missing warnings are narrative ordering with no compile-time dependency. Rule 11
  suppresses an unchanged rejected token.

## Revision input
L-1 (error, citation-path, line 16): cited path `design.md` has no directory prefix;
cite it as `.spec-workflow/specs/provider-per-role/design.md` (or the spec-store-relative
form the rest of the document uses).
L-2 (error, citation-path, line 96): cited path `SKILL.md` has no directory prefix; cite
the full path of the skill file meant (for example
`harness/skills/sdd-implementation-phase/SKILL.md`).
L-3 (error, citation-path, line 100): cited path `SKILL.md` has no directory prefix; cite
the full path.
L-4 (error, citation-path, line 100): cited path `SKILL.md` has no directory prefix
(second occurrence on this line); cite the full path.
L-5 (error, citation-path, line 119): cited path `decomposition.md` has no directory
prefix; cite it as
`.spec-workflow/spec-decomposition/decomposition.md`.
L-6 (warning class, citation-identifier + bridge-missing, 79 findings on lines 9, 16, 25,
35, 37, 44, 72, 83, 100): the same class v1's lint pass rejected, plus a few tokens the
v2 edits introduced (SDD_EVENT_SCRIPT, SDD_SPEC_DIR, SDD_RUN, SDD_SPEC on line 16 from the
nine-export fix; deferrals, add, verification, revisitCriteria on line 100 from the
task-10 deferrals-add fix). Re-apply v1's reasoning: reject each token that is a new
artifact/env var/field this spec creates or an existing artifact cited correctly
elsewhere in the same prompt; fix only a token whose cited range is genuinely wrong.

## Disposition rules
1. Assess every finding on its merits; one line of reasoning each.
2. The five errors (L-1 through L-5) are real: a cited path with no directory prefix
   cannot be resolved. Fix each by citing the full spec-store- or code-root-relative path
   of the file actually meant. Verify each path exists.
3. L-6: re-apply v1's rejection reasoning per token; fix only a genuinely-wrong range.
   Judge each against the real tree under /home/mcf/repo/spec-workflow-mcp.
4. Edit v2 in place. Add no version line. Append under the v2 Revision History line one
   nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
5. MDX rule: no bare angle brackets outside code spans. Keep the template's task shape;
   every task numbered; `_Prompt: …_` ends with `_`.
6. Edit only the document (and a context-file line an accepted finding refutes).
7. Every citation you insert or change carries its filename, never a bare `:<line>`.
8. Do not widen scope, do not re-decide what an earlier phase pinned, do not ask
   questions.
