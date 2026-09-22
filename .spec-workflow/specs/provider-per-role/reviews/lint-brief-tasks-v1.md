# Lint brief — provider-per-role tasks v1

Read and obey /home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md first.

## Job
Fix the lint findings below in v1 of
`/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md` in
place, then report in 150 words or fewer: files touched; each finding as `<id>: accepted
| partially accepted | rejected`; citations verified (count); the document's word count;
flags. No file contents.

## Inputs
- Context file:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/codebase-context.md`.
  Read it first; it maps the code the document cites.
- Document:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/tasks.md`
  (v1). Cap: 150 words per task block excluding its prompt. Do not grow a block past it.
- Requirements:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/requirements.md`.
- Design:
  `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/provider-per-role/design.md`.
- Findings: the list under `## Revision input`.

## Revision input
L-1 (warning, bridge-missing, line 9): task 1 names later task 4 with no bridge
L-2 (warning, citation-identifier, line 16): 'DEEPSEEK_API_KEY' absent from cited ranges (harness/hooks/sdd-activity.sh:11-12, :37-49, docs/step-0-answers.md:1-17)
L-3 (warning, citation-identifier, line 16): 'effort' absent from same cited ranges
L-4 (warning, citation-identifier, line 16): 'mcp__' absent from same cited ranges
L-5 (warning, citation-identifier, line 16): 'SDD_SPEC_STORE_REPO' absent from same cited ranges
L-6 (warning, citation-identifier, line 16): 'SDD_CODE_ROOT' absent from same cited ranges
L-7 (warning, citation-identifier, line 16): 'SDD_HARNESS_REPO' absent from same cited ranges
L-8 (warning, citation-identifier, line 16): 'ANTHROPIC_AUTH_TOKEN' absent from same cited ranges
L-9 (warning, citation-identifier, line 16): 'tools' absent from same cited ranges
L-10 (warning, citation-identifier, line 16): 'ANTHROPIC_API_KEY' absent from same cited ranges
L-11 (warning, citation-identifier, line 16): 'start' absent from same cited ranges
L-12 (error, citation-path, line 16): cited path `briefs.md` has no directory prefix; cite it by its path from the code root or spec store (for example `dir/briefs.md`)
L-13 (error, citation-path, line 16): cited path `formats.md` has no directory prefix; cite it by its full path from the code root or spec store
L-14 (warning, citation-identifier, line 25): 'CLAUDE_CONFIG_DIR' absent (src/__tests__/hook-spawn-events.test.ts:13-41, :58-94)
L-15 (warning, citation-identifier, line 25): 'PATH' absent from same ranges
L-16 (warning, citation-identifier, line 25): 'SDD_LAUNCH_BODY' absent from same ranges
L-17 (warning, citation-identifier, line 25): 'DEEPSEEK_API_KEY' absent from same ranges
L-18 (warning, citation-identifier, line 25): 'SDD_PROVIDERS' absent from same ranges
L-19 (warning, citation-identifier, line 25): 'start' absent from same ranges
L-20 (warning, citation-identifier, line 25): 'agent' absent from same ranges
L-21 (warning, citation-identifier, line 25): 'role' absent from same ranges
L-22 (warning, citation-identifier, line 25): 'provider' absent from same ranges
L-23 (warning, citation-identifier, line 25): 'ANTHROPIC_API_KEY' absent from same ranges
L-24 (warning, citation-identifier, line 25): 'ANTHROPIC_AUTH_TOKEN' absent from same ranges
L-25 (warning, citation-identifier, line 25): 'ANTHROPIC_MODEL' absent from same ranges
L-26 (warning, citation-identifier, line 25): 'SDD_SPEC_STORE_REPO' absent from same ranges
L-27 (warning, citation-identifier, line 25): 'status' absent from same ranges
L-28 (warning, citation-identifier, line 25): 'stdout' absent from same ranges
L-29 (warning, citation-identifier, line 25): 'stderr' absent from same ranges
L-30 (warning, citation-identifier, line 25): 'existsSync' absent from same ranges
L-31 (warning, citation-identifier, line 35): 'escalation' absent (harness/skills/sdd-continue/SKILL.md:247-248)
L-32 (warning, citation-identifier, line 35): 'ESCALATE' absent from same range
L-33 (warning, bridge-missing, line 37): task 4 names later task 10 with no bridge
L-34 (warning, citation-identifier, line 44): 'ELIGIBLE' absent (harness/hooks/sdd-activity.sh:32-35, src/__tests__/hook-spawn-events.test.ts:36-41)
L-35 (warning, citation-identifier, line 44): 'none' absent from same ranges
L-36 (warning, citation-identifier, line 44): 'deepseek' absent from same ranges
L-37 (warning, citation-identifier, line 44): 'anthropic' absent from same ranges
L-38 (warning, citation-identifier, line 44): 'DEEPSEEK_API_KEY' absent from same ranges
L-39 (warning, citation-identifier, line 44): 'status' absent from same ranges
L-40 (warning, citation-identifier, line 44): 'stderr' absent from same ranges
L-41 (warning, citation-identifier, line 44): 'stdout' absent from same ranges
L-42 (warning, citation-identifier, line 72): 'Spawn' absent (src/watch/__tests__/usage.test.ts:258-259, src/tools/harness.ts:1063-1084, src/watch/__tests__/usage.test.ts:222-241)
L-43 (warning, citation-identifier, line 72): 'reduceSpawn' absent from same ranges
L-44 (warning, citation-identifier, line 72): 'provider' absent from same ranges
L-45 (warning, citation-identifier, line 72): 'anthropic' absent from same ranges
L-46 (warning, citation-identifier, line 72): 'UsagePhase' absent from same ranges
L-47 (warning, citation-identifier, line 72): 'AGENT' absent from same ranges
L-48 (warning, citation-identifier, line 72): 'kinds' absent from same ranges
L-49 (warning, citation-identifier, line 72): 'orchestratorShare' absent from same ranges
L-50 (warning, citation-identifier, line 72): 'headLine' absent from same ranges
L-51 (warning, citation-identifier, line 72): 'formatOne' absent from same ranges
L-52 (warning, citation-identifier, line 72): 'formatCompare' absent from same ranges
L-53 (warning, citation-identifier, line 72): 'providers' absent from same ranges
L-54 (warning, citation-identifier, line 72): 'deepseek' absent from same ranges
L-55 (warning, citation-identifier, line 83): 'SpawnNode' absent (src/watch/__tests__/render.test.ts:42-62, src/watch/__tests__/ledger.test.ts:251-273, src/watch/__tests__/index.test.ts:82-94)
L-56 (warning, citation-identifier, line 83): 'provider' absent from same ranges
L-57 (warning, citation-identifier, line 83): 'start' absent from same ranges
L-58 (warning, citation-identifier, line 83): 'RunModel' absent from same ranges
L-59 (warning, citation-identifier, line 83): 'providers' absent from same ranges
L-60 (warning, citation-identifier, line 83): 'deepseek' absent from same ranges
L-61 (warning, citation-identifier, line 83): 'hasActivity' absent from same ranges
L-62 (warning, citation-identifier, line 83): 'none' absent from same ranges
L-63 (warning, citation-identifier, line 83): 'anthropic' absent from same ranges
L-64 (warning, citation-identifier, line 83): 'tokensByProvider' absent from same ranges
L-65 (warning, citation-identifier, line 100): 'DEEPSEEK_API_KEY' absent (src/watch/__tests__/index.test.ts:79, harness/skills/sdd-implementation-phase/SKILL.md:201-209)
L-66 (warning, citation-identifier, line 100): 'model' absent from same ranges
L-67 (warning, citation-identifier, line 100): 'provider' absent from same ranges
L-68 (warning, citation-identifier, line 100): 'buildUsageReport' absent from same ranges
L-69 (warning, citation-identifier, line 100): 'formatUsageTable' absent from same ranges
L-70 (warning, citation-identifier, line 100): 'deepseek' absent from same ranges
L-71 (warning, citation-identifier, line 100): 'anthropic' absent from same ranges

## Disposition rules
1. Assess every finding on its merits: accept, partially accept, or reject, each with
   one line of reasoning. Never accept to be agreeable; never reject to save work.
2. The two errors (L-12, L-13) are real: a cited path with no directory prefix cannot be
   resolved. Cite `briefs.md` and `formats.md` by their full path from the code root or
   spec store (the supervisor's `references/` directory). Fix them.
3. citation-identifier warnings: many of these tokens are artifacts THIS spec creates
   (new env vars like `DEEPSEEK_API_KEY`, `SDD_PROVIDERS`; new fields like `provider`,
   `tokensByProvider`; new functions like `reduceSpawn`, `buildUsageReport`) — they do
   not yet exist in the cited ranges and that is correct for a tasks document; reject
   those with that reason (rule 11 below: an unchanged token rejected with a reason is
   suppressed next pass). Where the token IS an existing artifact the task modifies but
   the cited range is simply wrong, fix the citation to the range that contains it. Judge
   each against the real tree under /home/mcf/repo/spec-workflow-mcp.
4. bridge-missing (L-1, L-33): a task that names a later task's artifact needs the prompt
   to name the bridge (a cast or stub) and the later task's prompt to say to remove it.
   Add the bridge where the forward reference is real; reject if the reference is only
   narrative ordering (the task does not compile against the later artifact).
5. Verify every citation you add or change against the real tree under
   /home/mcf/repo/spec-workflow-mcp. Read both ends of a line range.
6. Do not widen scope, and do not re-decide what an earlier phase pinned.
7. Edit v1 in place. Add no version line. Append under the v1 Revision History line one
   nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.
8. MDX rule: no bare angle brackets outside code spans. Keep the template's task shape;
   every task numbered; `_Prompt: …_` ends with `_`.
9. Edit only the document (and a context-file line an accepted finding refutes). Approvals,
   HANDOFF, INDEX and the memory file belong to others.
10. Every citation you insert or change carries its filename, never a bare `:<line>`.
11. A citation-identifier warning on a token that is unchanged since a version where it
    was rejected with a reason is suppressed, not re-fired.
12. Do not ask questions.
