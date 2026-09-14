# Adversarial Review — worktree-execution-context/design (v3)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/design.md

## Governing requirements
/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/requirements.md

## Prior review context

This is review v3. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/reviews/adversarial-memory-design.md (it may not exist yet).
2. Read the latest prior analysis at /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/reviews/adversarial-analysis-design-r2.md.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover resolved findings.
5. After completing your analysis, write an UPDATED memory file to the path in step 1, using this format:

```markdown
# Adversarial Review Memory — design
Last updated: <today's date> (after v3 review)

## Cumulative Findings Summary
### Accepted
- <finding>: <brief description, which version identified it>

### Partially Accepted
- <finding>: <brief description, user's stance>

### Rejected
- <finding>: <brief description, reason for rejection>

### Unresolved
- <finding>: <not yet responded to>

## Patterns & Themes
- <high-level observations about recurring issues>

## Guidance for Next Review
- Focus areas based on what's been found
- Areas that have been well-covered and don't need re-examination
```

**The prior round's central lesson: the fixes introduced a worse defect than the ones they closed.** Narrowing the containment rule was correct in isolation and catastrophic in combination with a path pre-resolution three hundred lines earlier. Attack this revision the same way — not component by component, but along the paths that cross them.

## Ground every claim in the code

This design cites files and line numbers throughout, and the prior two rounds each found citations that did not say what the document claimed. Verify them. Flag every citation that has drifted and every claim about existing behaviour the code contradicts. Where a claim concerns git's actual output, verify it empirically in a scratch repository rather than reasoning about it.

## Analysis approach

Attack the six dimensions below. They are priorities, not a boundary — lead with anything worse you find. For each, produce 3–5 directive bullets grounded in the document's concrete content and the actual code.

### 1. Component 11 — the `:361` deletion and the rewritten `validateAllFiles`

- The previous revision was defeated by an interaction it never traced. Trace this one end to end: from `latestLog.filesModified` through `validateAllFiles` into each of its four consumers, and establish whether the partition is correct for every input shape — bare relative names, absolute paths under either root, paths that exist in *both* roots because a worktree is a checkout of the same repository, and paths that exist in neither.
- Establish what happens when a bare relative name resolves successfully under **both** roots. The design says "workspace first" — determine whether that is right for a file the agent genuinely edited in the main checkout, and whether anything detects the ambiguity.
- `validateAllFiles` is exported and directly unit-tested. Enumerate every existing test its new signature and return shape break, and every other caller.
- Determine whether `filesToReview` containing both partitions is coherent for the reviewing agent, which is told these are the files it should read — some now live outside the worktree it was spawned in.

### 2. Component 1 — the split resolvers

- Verify `gitCommonDirAbsolute` against real repositories: repo root, subdirectory, linked worktree, submodule, bare repo, and a `.git` file rather than a directory. Establish that `resolve(cwd, raw)` is correct in each, and what it returns when the command fails.
- Attack `sameRepository` as the inference gate. Establish whether comparing common dirs admits or rejects cases the requirements care about, and how it behaves across symlinked paths, case-insensitive volumes, and `--git-dir` overrides.
- The design asserts the old normalization at `git-utils.ts:60-66` is *not* reused. Confirm nothing else in the design still depends on it and that `resolveGitRoot`'s existing behaviour is genuinely untouched.
- R1 AC 12's logging now has an owner. Establish whether the stated condition fires exactly when the requirement says it should.

### 3. Components 7 and 8 — one lock helper now guarding four file classes

- The lock began as protection for one file and now covers the registry, `TaskStateStore`, `.prepare` markers, review-version allocation, and `info/exclude`. Attack the generalization: establish whether one retry budget and one staleness window are correct for operations with very different durations, and what a long-running agent holding a review-version lock would do.
- Establish the lock-path convention for each protected file and whether any two collide or nest. Determine what happens if one code path acquires two locks.
- Attack anchoring a relative `SPEC_WORKFLOW_HOME` to the workflow root. Establish what breaks for existing users of that documented form, and whether the dashboard — which has no single workflow root — can apply the rule at all.
- Stress-test stale-lock breaking by window alone: a machine suspended mid-critical-section, clock skew on a shared filesystem, two processes both deciding to break the same lock.

### 4. Component 9 — the dependency probe and the untouched pinned prose

- Attack the `package.json` sampling predicate with concrete layouts: workspace/monorepo hoisting where `node_modules/<name>` legitimately does not exist under the workspace, pnpm's symlinked store, optional and platform-specific dependencies, and a bounded sample that misses the one absent package.
- Establish whether "up to 10, deterministic order" can be both deterministic and representative, and what it costs in `fs` calls per typecheck.
- The design leaves `R4_6B_TYPECHECK_UNAVAILABLE` unedited, accepting that its enumeration becomes non-exhaustive. Establish what the reviewing agent actually sees when a typecheck is unavailable for a reason the prose does not list, and whether the execution-context block reaches it on every path that emits `R4_6B`.
- Establish whether the second stat for `no-tsconfig-in-workspace` can distinguish the cases R7 AC 8 names, given where `no-tsconfig` currently returns.

### 5. Component 10 — rejection classification against four pinned tests

- The design keeps four `!ok` causes benign and promotes only the pathspec case. Establish whether stderr can reliably distinguish that case across git versions and locales, and what happens when it cannot.
- `runGit`'s return type changes. Enumerate every caller and every test that breaks.
- Establish whether the `kept.length === 0` branch is reachable in ways the design does not enumerate, and whether `fileSet.workspaceCount === 0` genuinely catches all of them.

### 6. Cross-cutting: ownership, ordering, and Migration

- Sweep the requirements for acceptance criteria with no owning component, as prior rounds did. Report any that remain, and any component that owns a criterion it cannot satisfy.
- The design claims several prior recurring findings are closed — `broadcastTaskUpdate`, event ordering, re-keying on workflow-root change, the Migration section. Verify each against the code rather than the prose, and escalate any that are asserted rather than designed.
- Attack the Migration position that `ToolContext` is "internal-only". Establish whether the package's published surface supports that claim.
- Establish the implementation order this design implies, and whether any two changes are individually safe but jointly breaking if landed separately.

## Closing deliverables
- **Top 5 risks/gaps**
- **Top 3 conclusions to challenge or reverse**, with reasoning
- **What's missing** — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Output
Write your analysis to: /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/reviews/adversarial-analysis-design-r3.md
