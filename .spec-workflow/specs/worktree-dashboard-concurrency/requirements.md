# Requirements Document

> **Status: deferred scope record, not an approved requirements document.**
> This spec was split out of `worktree-execution-context` after its third adversarial design
> review (see `.spec-workflow/spec-decomposition/decomposition.md`). The criteria below were
> approved as part of that spec's v4 requirements and are carried here so nothing is lost.
> They have **not** been through a requirements phase at this scope and are expected to change
> — several are known to need amendment, noted inline. Run the normal Requirements → Design →
> Tasks flow before implementing.

## Introduction

Keeps the dashboard's work constant in the number of registered worktrees, and makes concurrent writes to shared state safe. Neither is a correctness fix for the reviewing path — both address duplication and contention that only become visible once per-worktree identity exists.

Depends on `worktree-execution-context` for that identity. Independent of `worktree-review-signals`.

## Carried criteria

### From R10 — worktrees sharing a workflow root share their dashboard components

- Entries resolving to the same `workflowRootPath` share one `SpecParser`, one `SpecWatcher`, and one `SpecArchiveService` (`project-manager.ts:146-152`).
- **`ApprovalStorage` is excluded** and stays one instance per project entry. Its file resolution is per-workspace instance state reached from five public methods; one shared instance forces the constructing project's workspace onto every entry, and because the workflow root is the fallback candidate, resolution still finds *a* file — the wrong one, from a sibling worktree, silently.
- The underlying tree is read **once** per workflow root; each subscriber still receives a message whose project identifier matches its own subscription, because the broadcast layer filters per connection. "Broadcast once" means one read fanned out per subscriber, not one message carrying many identifiers — so the WebSocket shape is unchanged and no frontend work is implied.
- Every server-side handler destructuring a single identifier is updated, and any per-project debounce keyed by it is rekeyed.
- Shared components are torn down only when no remaining entry references that root; construction and teardown are serialized against a sync loop invoked from two unguarded watcher handlers; a failed construction leaves no partial entry.
- Scheduled cleanup runs once per distinct workflow root, not once per entry.
- Each entry keeps its own workspace path, file resolution, and dashboard identity. A single entry on a root behaves exactly as before.

**Known to need work at this scope** (from design review v3):
- `removeProject` (`project-manager.ts:206-227`) unconditionally stops the watcher and strips its listeners, so removing any project on a shared root tears down the survivors' watcher. That site had no owner.
- `deferral-change` (`multi-server.ts:444`) builds its payload inside the per-id handler, so fan-out produces N reads of one tree. `spec-change` and `broadcastTaskUpdate` were hoisted; this one was not. `steering-change` needs no hoist — its payload arrives in the event.
- `broadcastTaskUpdate` has two callers of different arity; refactoring the function changes what the task-status endpoint broadcasts, which needs stating.
- The v3 design wrote `new Mutex()` with no such class in the codebase and an NFR forbidding new dependencies. The serialization primitive needs a home and a test.
- Ordering: a project must not become eligible for fan-out before its `project-added` event is emitted, or a change can broadcast before the client knows the project exists.

### From R11 — concurrent worktrees do not corrupt shared state

> **Note (after design review v4):** a **minimal registry lock moved into `worktree-execution-context`**
> as its Requirement 6, because spec 1 is what turns concurrent registration into a lost-registration
> race. The criteria below that concern the registry are retained for context; the ones that remain
> owned here are the four other shared-root files, the staleness and atomic-break mechanics, and the
> global-directory anchor.

- Registry writes use a temp filename unique to the writing process. This — not rename atomicity — is what stops two writers interleaving bytes into one shared temp file.
- N processes registering concurrently for N worktrees produce N entries.
- Mutation uses an **exclusive lock** across the read-modify-write, not optimistic retry. With no registry file present, every process observes absence at every check and every process writes; the last rename silently discards the others. There is no compare-and-swap in `rename`.
- Acquisition retries within a stated **time budget**, justified against the number of concurrent worktrees supported.
- All **four** writers are covered: `registerProject`, `cleanupStaleProjects`, `unregisterProject`, `unregisterProjectById`. The last two delete and are reachable from the dashboard's removal route.
- On ultimate failure the server logs prominently and **continues unregistered** rather than aborting startup — `registerProject` is awaited before the transport connects, so throwing kills the MCP handshake.
- Per-task state shared across worktrees is safe against concurrent writers.
- Concurrent agent edits to `tasks.md` are **explicitly unprotected**; the only in-repo writer is the single-process dashboard endpoint, and agents edit the file directly. Closing it needs a task-status MCP tool (deferral `d-75761c78`).
- Approval content resolution stays workspace-first with a workflow-root fallback — already implemented, carried as a non-regression.

**Known to need work at this scope:**
- **The global-directory location is decided but not designed.** `getGlobalDir()` resolves a relative `SPEC_WORKFLOW_HOME` against `process.cwd()`, which under N servers in N directories yields N registries and makes the concurrency criteria vacuous. **Decision taken: reject relative values with a startup error naming the absolute form.** The v3 attempt to anchor them to the workflow root failed three ways — uncomputable at `server.ts:56` where `ProjectRegistry` is constructed, equal to the workspace under `--no-shared-worktree-specs` so it splits anyway, and unavailable to the dashboard, which would then read a registry nobody writes and show no projects at all. Note `getGlobalDir()` has five callers (`project-registry.ts:57`, `dashboard-session.ts:22`, `settings-manager.ts:11`, `execution-history-manager.ts:12`, `workspace-initializer.ts:172`); any change applies to all of them or the registry parts company with `activeSession.json`.
- Stale-lock breaking needs an **atomic** mechanism — `stat`-then-`unlink`-then-`open` races, and two processes that both judge a lock stale can both acquire. Break via `rename`-then-verify.
- `acquiredAt` is a self-reported timestamp compared across hosts; on the shared/NFS `$HOME` invoked to justify recording `hostname`, clock skew exceeds the staleness window. Use the lock file's `mtime`. And `O_EXCL` is not reliably atomic on NFSv2/v3 — either state the caveat or restrict the guarantee to local filesystems.
- A machine suspended mid-critical-section defeats window-only breaking. There is no timer-based fix; record it as an accepted residual.
- Each protected file needs a concrete lock path and one acquisition-ordering rule. `info/exclude`'s lock would land inside `.git`, and the per-spec and per-task locks are in an ancestor/descendant relationship.
- **Locking `getNextVersion` accomplishes nothing** — it is a pure read (`task-review-manager.ts:62-66`); the write is `fs.writeFile` fifteen lines later in `saveReview`. The critical section must span both.
- `.prepare-<taskId>` markers are unkeyed on the shared root, so one worktree's review deletes another's gate. Renaming them touches three methods and four callers, including one internal call from `saveReview`, and `TaskReviewManager` is constructed from `specPath` alone.
