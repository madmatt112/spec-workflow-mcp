# provider-per-role tasks, post-cap corrective pass

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Open items
The review loop reached its cap: v4 of tasks.md was reviewed in reviews/adversarial-analysis-tasks-r4.md and still carries MUST_FIX 1 / SHOULD_FIX 1. Fix or rule out each; write v5 in place; stop. Keep the Revision History line words 'Post-cap corrective pass' exactly and set the Document version header to v5. Cap: 150 words per task block excluding its prompt. Every citation carries a directory prefix (dir/file.md:line), never a bare file.md or bare :line. Read /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md first, then the r4 analysis, memory, requirements.md, design.md; code under /home/mcf/repo/spec-workflow-mcp.

Open items:
- R4-1 (MUST_FIX, carried, Compounds R1-1): task 1's prompt emits only ESCALATE on the DEEPSEEK_API_KEY-unset case, but the Dependency-order paragraph and decision D6 say that case emits `RETRO: gotcha`. Reconcile the three sites to one outcome grounded in what the implementer brief authorises (RETRO categories at harness/skills/sdd-implementation-phase/references/briefs.md:43-45 list bug/gotcha for the implementer, not escalation). Fix the contradiction at every site, or rule it out with a standalone reason.
- R4-2 (SHOULD_FIX, fix-induced, Compounds R3-2): task 10's description bullet still asserts an unconditional `verification` deferral, but the Prompt/D5/Scope note (fixed in v4) say the orchestrator files it only when the Deferral bar's three-part test holds. Align the description bullet to the conditional wording, or rule it out with a standalone reason (its reason is carried to the next phase's drafter brief, so it must stand on its own).

Report in 150 words or fewer: each item as `<id>: fixed | ruled out (<severity>) — <reason>`, files touched, flags. No file contents. Edit only the document.
