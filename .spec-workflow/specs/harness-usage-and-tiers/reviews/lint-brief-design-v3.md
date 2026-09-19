# Lint brief — harness-usage-and-tiers design v3

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v3 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md`
in place, then report in 150 words or fewer: files touched; each finding as `<id>:
accepted | partially accepted | rejected`; citations verified (count); the document's
word count; flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/codebase-context.md`.
  Read it first.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/design.md`
  (v3). Cap: 4,000 words (body only, H1 to line before `## Revision History`). The body is
  at exactly 4,000; the Revision History is excluded from the cap, so fixing the history
  bullet below does not affect the count. Do not grow the body.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-usage-and-tiers/requirements.md`.
- Findings: the list under `## Revision input`.
- Prior dispositions: the v1 and v2 lint passes already dispositioned the recurring
  `citation-identifier` set (see the `- **Lint pass.**` bullets under the v1 and v2
  Revision History lines). Each was rejected because the named token is new/proposed design
  text or a symbol attributed to a different citation in the same prose block.

## Revision input
The 4 errors are the only findings that must change the document. All four sit on the
**v2 `Lint pass.` Revision-History bullet** (currently line 224). That bullet's
parenthetical spot-check examples embed backticked file+line citations
(`vitest.config.ts:7`, `sync-plugin-assets.cjs:74`, `:108`, `:83-100`), which the checker
parses as real citations that lack a directory prefix. Per the reviser rule that a
Revision-History or decision-log bullet cites findings by id and prose only — no backticked
path or identifier token — rewrite that bullet's examples as plain prose with no backticks
and no `:line`/range suffixes, keeping the meaning. For example, write "buildModel is defined
in ledger.ts outside its cited range; loadAgentProfiles is not inside the render.ts import
line it cites; main lives elsewhere in sync-plugin-assets.cjs; readUsage, usage and
transcript_path are new text this design introduces" — as prose, no code spans on the
filenames, no line numbers. This clears all 4 `citation-path` errors and the 4
`citation-identifier` warnings at line 224 (they only fire because the bullet held an
in-range citation).

L-E1 (error, citation-path, line 224): `vitest.config.ts:7` — no directory prefix.
L-E2/E3/E4 (error, citation-path, line 224): `sync-plugin-assets.cjs` cited three times with
line/range — no directory prefix.
L-W1..L-W4 (warning, citation-identifier, line 224): loadAgentProfiles, main, readUsage,
transcript_path absent from the cited ranges — these clear once the bullet holds no citation.

Check the v1 and v3 history bullets for the same defect while you are there: a backticked
`file.ext:line` inside any Revision-History bullet is the same error waiting to fire next
version. De-cite any you find (rule 9, siblings).

The remaining 78 findings are all `citation-identifier` warnings — the standing recurring
set (lines 7, 22, 60, 61, 66, 73, 76, 85, 94, 99, 103, 104, 115, 116, 125, 137, 165, 168,
170, 175, 176, 177, 178, 179, 182, 183, 192, 200). Apply rule 11: re-reject each with the
standing reason, unless on a fresh read a named identifier is one the design claims already
exists inside the exact cited range and does not — that single case is a real fix. Note line
85 now also flags `endedAt`: confirm it is the new mechanism text this design introduces
(the s.endedAt guard), not a false claim about an existing range.

## Disposition rules
1. Assess every finding on its merits, each with one line of reasoning.
2. Verify every citation you add or change against the real tree under
   `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range.
3. Do not widen scope, and do not re-decide what the requirements or a prior ruling pinned.
4. Edit v3 in place. Add no version line. Append under the v3 Revision History line one
   nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`. Write this
   bullet in prose only — no backticked path or identifier token, no `:line` suffix — so it
   does not reintroduce the error you just fixed.
5. Closed by ruling, leave as is: the two RE-DECIDED literals ruled refinement at round 1.
6. MDX rule: no bare angle brackets outside code spans.
7. Edit only the document. You may replace a context-file line an accepted finding refutes.
8. Do not ask questions.
9. After you accept a finding, fix every sibling with the same construct.
10. Every citation you insert or change carries its filename, never a bare `:<line>`.
11. A citation-identifier warning on a token unchanged since a version where it was rejected
    with a reason is suppressed, not re-fired.
