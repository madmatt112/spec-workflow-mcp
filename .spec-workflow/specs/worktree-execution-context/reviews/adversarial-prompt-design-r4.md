# Adversarial Review — worktree-execution-context/design (v4)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/design.md

## Governing requirements
/home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/requirements.md

## Decomposition context
/home/mcf/reference/spec-workflow-mcp/.spec-workflow/spec-decomposition/decomposition.md

The spec was **split three ways** after the previous review. This document covers only the first spec — identity resolution, the two-root tool context, file partitioning, and runner contracts. Two sibling specs (`worktree-review-signals`, `worktree-dashboard-concurrency`) are deferred and carry the rest. Read the decomposition document before judging anything as missing: some gaps are deliberate and assigned elsewhere. Your job includes checking whether the boundary is honest — whether this spec can actually ship on its own, and whether anything it defers is in fact load-bearing for what it keeps.

## Prior review context

This is review v4. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/reviews/adversarial-memory-design.md
2. Read the latest prior analysis at /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/reviews/adversarial-analysis-design-r3.md
3. Classify each finding as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover resolved findings — but do verify that findings the document claims to have closed are closed in substance rather than in prose.
5. After completing your analysis, write an UPDATED memory file to the path in step 1, using this format:

```markdown
# Adversarial Review Memory — design
Last updated: <today's date> (after v4 review)

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

**The pattern across three prior rounds: each revision closed the previous findings properly and introduced a worse defect along a path that crossed components.** Attack this revision the same way — trace paths, not components.

## Ground every claim in the code

This document cites files and line numbers throughout, and all three prior rounds found citations that did not say what the document claimed. Verify them. Flag every drifted citation and every claim about existing behaviour the code contradicts. Where a claim concerns git's actual output, verify it empirically in a scratch repository rather than reasoning about it.

## Analysis approach

Attack the six dimensions below. They are priorities, not a boundary — lead with anything worse you find. For each, produce 3–5 directive bullets grounded in the document's concrete content and the actual code.

### 1. The split's central bet — can this spec ship alone?

- Error Handling item 4 concedes that when every logged path drops, `counts` records why and **nothing tells the reviewing agent**, because the disclosure channel is deferred. Establish whether that is an acceptable partial delivery or the same silent-failure class the spec exists to eliminate, relocated. Determine what a reviewing agent actually receives today when `filesToReview` is empty.
- R4 AC 5 counts ambiguous resolutions and explicitly declines to disambiguate. Establish how often ambiguity occurs in practice, what the design does with the count, and whether "workspace first" plus an uncommunicated counter is better or worse than the current behaviour for a sibling-worktree review.
- Establish whether anything this spec defers is load-bearing for something it keeps — in either direction. Check the deferred specs' scope records for criteria that the kept components silently depend on.
- Determine whether shipping spec 1 alone changes any *currently working* behaviour for a non-worktree user, and whether the design's parity claims actually cover that population.

### 2. Component 3 — the new file resolver

- Trace every input shape through `resolveLoggedFiles` into all four consumers: bare relative names, absolute paths under either root, paths existing under both, paths existing under neither, and paths that are neither strings nor valid.
- The design claims `safeRealpath` needs no change because it already warns on non-ENOENT and is silent on ENOENT. Verify that, and verify the deleted-in-workspace guard (R4 AC 7) is implementable with the information `safeRealpath` returns — it returns `undefined` for every failure, so establish whether the design can actually distinguish ENOENT from other causes at the call site.
- Establish what breaks: enumerate every existing test of the function being replaced, every assertion on its current return shape and warning keys, and every other caller.
- Attack the dedupe-across-partitions claim and the four-way `counts` split. Determine whether the counts are actually distinguishable at the point they are computed.

### 3. Component 2 — `selectRoots` and the override

- The design changes what `args.projectPath` means: today it is taken verbatim as `projectPath`; the design derives the workflow root from it with `resolveGitRoot`. Enumerate every existing caller and every committed test that pins current behaviour, and establish whether the change is safe for non-worktree overrides.
- Establish whether deriving the workflow root from an override is correct when the override names a path that is not a repository, or names a path whose `SPEC_WORKFLOW_SHARED_ROOT` differs from the server's.
- Verify the claim that annotating the literal and typing `setupHandlers` is sufficient to make the compiler catch every construction site. Look for other paths into the handlers that bypass both.

### 4. Component 1 — resolution helpers

- Verify `gitCommonDirAbsolute` empirically across repo root, subdirectory, linked worktree, nested worktree, submodule, bare repo, `.git`-as-file, and a symlinked root. Establish that `realpath(resolve(cwd, raw))` is correct in each and what happens when `realpath` fails on a path that exists in one form but not another.
- Attack the environment-scrubbing rule. Establish whether scrubbing those four variables is sufficient, whether it breaks any legitimate configuration, and whether the three existing call sites in `git-utils.ts` are the only ones that need it.
- Establish whether `sameRepository` returning false for two non-git directories is reachable given the order of checks in `resolveWorkspaceRoots`, and whether the precedence chain has any state where two rules both apply.

### 5. Components 6 and 7 — identity and the CLI flag

- Establish whether moving `normalizeIdentityPath` inside `generateProjectId` is safe for every caller, including any that compares a computed id against a stored one.
- The design adds `unregisterInstanceById`. Establish whether that method can be written against the existing registry structure, and what happens to entries registered before the upgrade under a differently-normalized id.
- Trace the `--no-workspace-inference` flag through argument parsing and establish whether the two changes named are sufficient.

### 6. Cross-cutting: ownership, ordering, migration

- Sweep the requirements for acceptance criteria with no owning component, as prior rounds did. Report any that remain, and any component that owns a criterion it cannot satisfy.
- Establish the implementation order this design implies and whether any two changes are individually safe but jointly breaking if landed separately.
- Attack the Migration section's claim about the `exports` map and the `projectId` change. Establish whether adding an `exports` map in the same release breaks any current consumer, including this repository's own tooling and tests.

## Closing deliverables
- **Top 5 risks/gaps**
- **Top 3 conclusions to challenge or reverse**, with reasoning
- **What's missing** — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Output
Write your analysis to: /home/mcf/reference/spec-workflow-mcp/.spec-workflow/specs/worktree-execution-context/reviews/adversarial-analysis-design-r4.md
