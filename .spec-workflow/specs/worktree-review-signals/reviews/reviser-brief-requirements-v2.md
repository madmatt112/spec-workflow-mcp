# Reviser brief — worktree-review-signals requirements v2

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Produce v2 of `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md` in place from the revision input under `## Findings` below, then report in 150 words or fewer: files touched; RI-1 as `accepted | partially accepted | rejected`; the count of L-n findings fixed and the ids you rejected; citations verified (count); the document's word count (`wc -w`); flags. No file contents.

## Inputs
- Context file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/codebase-context.md`. Read it first; it maps the code the document cites.
- Document: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/requirements.md` (v1). Cap: 3,500 words for the body (H1 down to the line before `## Revision History`). Do not grow the document past it; a fix that adds a paragraph removes one.
- Lint brief for v1: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/lint-brief-requirements-v1.md`. Its `## Findings` section lists L-1..L-49 as `(severity, rule, line): message`; its `## Priority guidance` and `## Disposition rules` say how to disposition each one. Line numbers in it refer to v1 as committed, which is the document as it stands now.
- Findings: the list under `## Findings` below (revision input). Every RI item is a MUST_FIX; you may still reject one with a reason.
- Memory: none yet; no adversarial round has run on this document.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`. Use absolute paths.
- You may call the spec-workflow `adversarial-response` tool (`specName: worktree-review-signals`, `phase: requirements`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.

## Disposition rules
1. Assess every L-n finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim. Never fabricate a range or invent a line to satisfy the linter.
2. Verify every citation you add or change against the real tree under `/home/mcf/repo/spec-workflow-mcp`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.
3. Do not widen scope, and do not re-decide what an earlier phase pinned. Gate A is resolved and every decision in `## Decisions taken in this document` was kept as written: you may correct a citation inside that section, but do not change any decision's choice, its options considered, or its reasoning.
4. Write v2 in place. Add the Revision History line `- **v2** (2026-09-17) — Lint pass on v1 from revision input RI-1 (the v1 lint brief; 2 error, 34 warning, 13 info).` followed by exactly these nested bullets: `- **RI-1 — Accepted (MUST_FIX).** <one line: what the pass did>` and `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>` naming every rejected L-n with its one-line reason. A Revision-History bullet cites findings by id and prose only; it carries no backticked path or identifier token. State what the fix did, not what it did not.
5. Closed by ruling, leave as is: none.
6. MDX rule: no bare angle brackets outside code spans; write `` `<name>` `` or the word.
7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and gate files belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.
8. Do not ask questions.
9. After you accept a finding, search the document for every other place with the same construct (the same cited range, the same non-EARS shape, the same bare range) and fix each; list them under the Lint pass bullet. A sibling left unchanged is next round's finding.

## Findings
RI-1: The v1 lint pass was interrupted before it landed. Apply every finding listed in `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/worktree-review-signals/reviews/lint-brief-requirements-v1.md` (L-1..L-49: 2 `citation-range` errors for out-of-bounds cited ranges, `citation-identifier` warnings for identifiers absent from their cited ranges, `citation-bare` info findings for bare `:NNN` ranges, and one `ears-shape` criterion without SHALL). Disposition each L-n as that brief's `## Priority guidance` and `## Disposition rules` describe: fix the accepted ones in place with citations you verified at both ends, reject the rest with a one-line reason each. Write the result as v2 with the Revision History line and the `Lint pass` bullet that rule 4 above prescribes.
