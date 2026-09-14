# Requirements Document

> **Status: deferred scope record, not an approved requirements document.**
> Captured after reviewing the SDD orchestration prompts (`sdd-router.md`, `spec-loop-v3.md`,
> `task-implementation-loop-v2.md`) against this server's behaviour. Nothing here has been
> through a requirements phase. Run the normal Requirements → Design → Tasks flow before
> implementing.

## Introduction

Three prompt files drive spec-driven development against this server: a router that picks between a document loop and an implementation loop, and the two loops themselves. They work, and their core instincts are sound — one phase per invocation with a human gate, an orchestrator that never loads source into its own context, a structured adversarial verdict block.

They also carry three problems with one shape: **prose is doing work that belongs in the tool.** Each is a silent failure — the loop improvises or stalls mid-run, after context is already spent.

This spec moves the deterministic parts into the server.

## Motivating evidence

Found by inspection in one sitting, not by hunting:

- **`HANDOFF.md` is declared "the single source of in-flight phase state"** by the document loop and **did not exist** in this repository. Nothing creates or validates it.
- **The implementation loop's completion gate briefs a sub-agent with "the spec's end-to-end verification scenario (from its decomposition.md entry)"** — no such section existed for any spec.
- **The sub-agent brief hardcoded an absolute path to a different project's `CLAUDE.md`.**
- **The "active spec" rule is stated three times and two are wrong.** The router says *first in build order, not Complete, and not Deferred*; the implementation loop drops the Deferred clause; the document loop drops build order as well. Today that is harmless only because the deferred specs happen to sort last.
- **The document loop's resume contract contradicts this server's own guide.** The loop says *"Never delete an approval; I clean up"* and depends on an approved record persisting. `spec-workflow-guide` says *"Once approved: use approvals with action:'delete' (must succeed) before proceeding."* An agent following the built-in guide breaks the loop's resume detection.

## Root cause

`deriveSpecStatus` keys on **file existence**, so an unapproved `requirements.md` and an approved one derive identically. **There is no durable record that a phase was approved.** Approval records are transient by design and the guide instructs deleting them. The document loop's human convention — "leave the approved record in place until the next phase starts" — exists solely to reconstruct information the data model does not keep.

Every other problem below is downstream of that or of the same prose-instead-of-code pattern.

## Candidate requirements

### A. Durable approval state

- A phase approval SHALL leave a durable per-spec record (at minimum: phase, version or content hash, approved-at) that survives deleting the transient approval request.
- `deriveSpecStatus` SHALL be able to distinguish *document exists* from *document approved*, so a resumed session does not need a human convention to tell them apart.
- The existing guide instruction to delete an approval after approving SHALL remain correct — durability must not depend on leaving records behind.
- Backward compatibility: specs whose documents were approved before this change have no record. Decide whether they are treated as approved (file existence, today's behaviour) or unknown, and state it.

### B. A routing tool

- A single tool SHALL return the routing decision: active spec, current phase, overall status, next action, and what it is blocked on.
- Active-spec derivation SHALL exist once, in code, alongside `deriveSpecStatus` — which already carries the comment *"the single source of truth for spec status… Do not duplicate this logic."*
- It SHALL respect deferred specs, decomposition build order, and specs absent from `decomposition.md`.
- The router prompt then reduces to: call it, state the decision, hand off.

### C. Preflight assertions

- Before routing, the artifacts the chosen loop will consume SHALL be checked to exist — the decomposition entry, its verification scenario, and whatever handoff file the loops rely on.
- A missing artifact SHALL fail fast with a named list, not mid-run at the completion gate.

### D. Portable packaging

- The prompts SHALL stop referencing each other and their inputs by absolute filesystem path. Options: a Claude Code skill (gives a `/`-invocable entry point), or MCP prompts served by this server (versions the prompt alongside the tool whose output shape it depends on — this server already ships prompts).
- Whichever is chosen, the judgment-bearing prose stays prose: adversarial methodology, what counts as `MUST_FIX`, when to escalate.

### E. Convergence cap semantics (smaller, decide in passing)

- The document loop caps a phase at v6. In practice a phase exceeded that here because **human-directed revisions reset convergence** and the loop does not model that. Decide whether a human decision resets the counter, and say so.

## Explicitly not in scope

- Rewriting the loops' judgment sections. The one-phase-per-invocation invariant, the orchestrator-context discipline, and the verdict block are the parts that work.
- Any change to `worktree-execution-context`. This spec is independent of it and must not be folded into it.

## Sequencing

Independent of the three worktree specs — it shares no files with them. Deferred behind `worktree-execution-context` by preference, not dependency: that spec is approved and ready to build, and this one has not had a requirements phase.

## Related repository issues found alongside

Not part of this spec; recorded so they are not rediscovered.

- `src/dashboard/adversarial-runner.ts` sets `JOB_TIMEOUT_MS` to 15 minutes while its rejection message hardcodes "timed out after 10 minutes".
- The same runner's timeout is too short for an iterative adversarial review of a large document once prior analyses and a rolling memory file are in context; later rounds in this repo were run as subagents instead.
- `src/dashboard/task-review-runner.ts` calls `PathUtils.getSpecPath(job.specName, job.specName)` — a spec name passed where a project path belongs. The result is unused and the adjacent comment acknowledges the dead code.
