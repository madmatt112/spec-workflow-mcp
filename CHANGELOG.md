# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.0.0] - 2026-07-31

Git worktrees now get a correct execution context. The server tracks **two roots** rather than one: a **workspace path** (the checkout whose code is diffed, typechecked and handed to spawned agents) and a **workflow root** (where `.spec-workflow/` lives, shared across a repository's worktrees). Previously both were the same value, so a review triggered from a worktree diffed and compiled the main checkout while reporting the worktree's paths.

Projects with a single checkout are unaffected in behaviour: the two roots resolve to the same directory, and the files diffed, the files typechecked, the containment decisions and the reported `tsconfig.json` path are all unchanged. The migration consequences below apply mainly to worktree users and to anyone whose project path differs between `realpath` and `resolve`.

### Added
- **Workspace inference, on by default.** The workspace is inferred from the directory the server was launched in when that directory is a *different* checkout of the *same* repository as the path argument. This is what makes a stock committed `.mcp.json` work in every worktree: that file is tracked in git and byte-identical across worktrees, so its path argument is structurally incapable of naming the current one. Inference requires a successful `git rev-parse --show-toplevel` on both sides (a bare repository and a path inside `.git` do not qualify), differing top-levels, and the same git common directory — so a submodule is never inferred as its superproject's workspace.
- **`--no-workspace-inference`** — the opt-out. The workspace becomes the git top-level of the path argument. Use it when the launch directory is not the checkout you want reviewed.
- **`SPEC_WORKFLOW_WORKSPACE`** — set the workspace explicitly. Outranks inference; validated with `stat().isDirectory()`, and an unusable value logs and falls through to inference rather than aborting startup. Ignored in `--dashboard` mode. The dashboard sets it (and `SPEC_WORKFLOW_SHARED_ROOT`) explicitly on every agent it spawns, so a review agent always runs in the workspace its job named rather than inheriting a stale value.
- **An exclusive file lock around project registration.** With per-worktree identity, N worktrees compute N project ids, so two servers starting together each read a registry without the other and the second write erased the first. Staleness is judged from the lock file's `mtime` and broken by an atomic rename-aside, so exactly one contender proceeds. On budget exhaustion the server logs prominently and continues **unregistered** rather than throwing — registration is awaited before the MCP transport connects, and throwing there kills the handshake.
- **File-resolution reporting in `review-task action: prepare`.** `data.fileResolution` carries `{ workspaceCount, workflowCount, drops }`, with drops tallied by cause (non-array input, non-string element, `path.resolve` throw, `ENOENT`, non-`ENOENT` realpath failure, containment rejection).
- **A disclosure when no reviewable files resolve.** If the implementation log listed files but none resolved in the workspace, both the `nextSteps` guidance and the dashboard runner's first prompt instruction are *replaced* with a statement that no reviewable files were resolved and that a passing verdict must not be returned on that basis.
- **A pathspec containment assertion before the diff runs.** A logged path outside the workspace now produces a stated diff rejection instead of an empty diff. The check is computed from the paths themselves, never matched against git's stderr, which is gettext-marked and translates.

### Changed
- **`SPEC_WORKFLOW_SHARED_ROOT` now outranks `--no-shared-worktree-specs`.** This is a precedence flip: previously the flag was consulted first and the environment variable never reached. If you set both, the environment variable now decides and the flag has no effect. Relative values of the variable are also resolved to absolute before use.
- **Boolean flags written as `--flag=value` are now rejected** with an error naming the bare form, for all five: `--dashboard`, `--help` (and `-h`), `--no-open`, `--no-shared-worktree-specs`, `--no-workspace-inference`. Previously `--dashboard=true` passed validation, was read as `false` because the reads are exact string matches, escaped the flag filter, and became the **project path** — silently flipping the run mode and pointing the server at a directory named `--dashboard=true`. Stripping the `=value` instead would have been worse for `--no-workspace-inference`, where it would silently discard the opt-out. `--port` still accepts both `--port 3456` and `--port=3456`.
- **The MCP-mode startup banner no longer prints a project path.** It printed `Starting Spec Workflow MCP Server for project: <path>` before the roots had settled, and an inferred workspace can still be rejected and replaced after that point. The banner no longer names either root — it still prints a `Working directory:` line — and the roots are reported exactly once, after settlement, in the resolution block (`workspacePath=` / `workflowRootPath=`, preceded by one line naming which rule chose them). The block is emitted on both the succeeding and the throwing startup path.
- **An `args.projectPath` override now names the *workspace*, not the single root — for four tools.** In `review-task`, `log-implementation`, `adversarial-review` and `adversarial-response`, an override is the checkout whose code is read, and the shared workflow root is **derived** from it with git. Previously the override was taken verbatim as both roots, so handing one of these tools a worktree path sent every `.spec-workflow` lookup inside that worktree instead of to the shared root the worktree's specs live on. Each distinct override value logs one warning naming the context `workspacePath` it discarded and the workflow root derived in its place. Four cases cannot derive — git unavailable or the path is not in a repository, a `--separate-git-dir` layout, and a bare repository — and each falls back to the override verbatim with a warning saying so; a plain main checkout also returns unchanged but is the correct answer and does not warn. `SPEC_WORKFLOW_SHARED_ROOT` outranks the derivation entirely. The `projectPath` schema description on these four tools was updated from "project root" to match.
- **The other five override-accepting tools are unchanged.** `deferrals`, `get-task-review`, `spec-index`, `spec-status` and `approvals` still take `args.projectPath` verbatim as the single root and keep the "project root" schema description. They read only `.spec-workflow` and never touch working-tree code, so there is no second root for them to get wrong.
- **`review-task action: prepare` response shape:** `data.filesToReview` changed from `string[]` to `{ path, root, ambiguous }[]`, where `root` is `'workspace'` or `'workflow'`. `ambiguous` marks a *relative* entry that anchored to two distinct existing files under the two roots; absolute entries are never ambiguous.
- **Logged file paths are resolved against both roots.** The pre-absolutization against the workflow root is gone. Relative entries anchor to the workspace first and the workflow root second; absolute entries are classified by containment alone. Containment accepts the workspace or `<workflowRoot>/.spec-workflow` — never the workflow root itself, which in a nested layout contains every sibling worktree. Entries that exist only under the workflow root and not in `.spec-workflow` are **dropped, not substituted**: substituting hands the reviewer the main checkout's undeleted copy of a file the task removed. Paths reaching the diff, the typecheck and the hygiene signals are workspace-resolved only.
- **The typecheck splits its root.** The compiler binary, the `tsconfig.json`, the `-p` argument and the spawn working directory all take the **workspace**; the cache directory and the `.gitignore` entry take the **workflow root** — taking the workspace for those would create a `.spec-workflow` directory inside every worktree and leave each with an uncommitted edit to a tracked file. The build-info file is now keyed per workspace (`.spec-workflow/.cache/tsc-<hash>.tsbuildinfo`) so worktrees no longer truncate each other's cache.
- **`GIT_DIR`, `GIT_COMMON_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` are removed** from the environment of every git invocation and every spawned agent. `SPEC_WORKFLOW_HOST_PATH_PREFIX` and `SPEC_WORKFLOW_CONTAINER_PATH_PREFIX` are preserved, so Docker path translation is unaffected.
- **Project identity is `realpath`-normalized.** `generateProjectId` normalizes inside the function, so every call site — including the dashboard's manual-add path — normalizes by construction, and both the stored workspace path and the stored workflow root are normalized identically. When `realpath` fails (a removed worktree) the fallback is the deterministic absolute path and the substitution is logged once per distinct path. The registry is normalized **on write only**; reads perform no `realpath`.
- The server now unregisters by the project id **cached at registration** rather than recomputing it from the path at shutdown. After `git worktree remove`, `realpath` fails and a recomputed id no longer matches the stored one, so the entry was never deleted.
- Dashboard-spawned runners carry both roots explicitly. `TaskReviewRunner` takes `workflowRoot` and `workspacePath` in place of the single `projectPath` it was spending three incompatible ways; `AdversarialRunner` keeps a single-rooted options object and receives the workflow root as a separate argument, because it spends its root at exactly one place.

### Fixed
- **Adversarial review from the dashboard looked for spec documents inside the worktree.** Both the primary and the retry route passed the untranslated workspace path, so `.spec-workflow` lookups went to the worktree — and, under Docker path translation, to a path the process cannot read. Both now pass the translated workflow root.
- **A diff pathspec outside the workspace produced a silently empty diff**, which the review methodology then explained to the reviewing agent as "the task changes were already committed before review". It now produces a rejection whose text says git was not invoked, that this is neither an exception nor a benign empty diff, and that the already-committed explanation does not hold.
- **The typecheck's rejection arm reported a different `tsconfig.json` path** from its success and unavailable arms.
- Concurrent registration of two worktrees no longer loses an entry, and each registry write uses a per-process-unique temporary filename — a shared temporary name lets two writers interleave bytes into one file, which rename atomicity cannot repair because both renames then move the same corrupted file.

### Migration
- **`projectId` moves wherever `realpath` differs from `resolve`** — a symlinked home, an automounted network home, macOS `/tmp` → `/private/tmp`. The project's dashboard URL changes and the previous registry entry orphans. **Those orphans are permanent under Docker path translation**, because the liveness check that would otherwise reap them returns `true` unconditionally when both path-translation variables are set. Remove them by hand from `activeProjects.json` in `$SPEC_WORKFLOW_HOME` (default `~/.spec-workflow-mcp`).
- **Worktrees gain new identifiers.** Prior job history, review artifacts and approvals stay attributed to the main checkout's identifier and are not migrated.
- **Fresh worktrees report `tsc-not-found`.** Compiler resolution moved to the workspace, so a worktree without `node_modules` reports `tsc-not-found` and returns no typecheck signal where it previously resolved against the main checkout and ran — reporting a result for a tree it had not compiled. This is a behaviour change in the **primary use case**, not an edge case. Run `npm install` in the worktree to restore the signal.
- **`GIT_*` scrubbing changes the `git --git-dir=$HOME/.dotfiles --work-tree=$HOME` dotfiles pattern**, where the exported variables *are* the configuration. Under this server, resolution sees the directory's own repository instead. That is the intended answer here, and it is stated rather than left to be discovered.
- **A relative `SPEC_WORKFLOW_HOME` is unsupported in multi-worktree use.** It is resolved against `process.cwd()`, and each worktree's server now runs from its own worktree, so a relative value gives every worktree a private registry while the dashboard resolves the same value against its own directory and sees none of them. Use an absolute path whenever more than one worktree of a repository runs at once. Relative values remain fine for a single checkout.
- **Exported type shapes changed, and the exported type surface is undocumented and unintended.** `ToolContext` gained a required `workspacePath`; `validateAllFiles` was removed; `safeRealpath` changed its return type and moved to `src/core/file-resolution.ts`; both runner option types renamed fields. The package has no `exports` map and no `types` field, so a deep import of the generated declarations resolves and type-checks today — the surface is undocumented and unintended, not unsupported by the packaging. **No `exports` map has been added**, deliberately: the actual consumption route is `bin` via `npx`, which bypasses `exports` entirely, so a map would enforce nothing while requiring a `./package.json` entry and a `types` condition to avoid breaking manifest reads. Treat anything not reachable through the MCP tool surface or the CLI as internal.

### Notes
- Two instructions telling the reviewing agent to read every listed file survive the no-reviewable-files disclosure: the unconditional methodology header, and the empty-diff preamble that additionally supplies the "already committed" explanation and fires necessarily on the all-drop path. Both are byte-pinned by committed methodology fixtures and a cross-spec drift test, so changing them is cross-spec work this release does not carry. The disclosure text names the contradiction outright so the reviewing agent is not left to resolve it; the residual is recorded as a deferred decision.
- Registration is the only registry writer taking the lock. The other shared-root writers, and the dashboard's file watcher — which watches `activeProjects.json` by name while each write replaces its inode, so two closely spaced registrations deliver at most one change event — are left to the `worktree-dashboard-concurrency` spec.

## [4.3.0] - 2026-07-24

### Added
- The dashboard Deferrals page now covers **deferred specs** as well as deferred decisions. Whole specs postponed in the build order (`specs/<name>/deferred.json`, written by the `spec-index` tool's `defer` action) previously surfaced only in the generated INDEX.md; they now get their own section on the page showing each spec's reason and deferral date.
- Deferred decisions render the full detail already recorded against them — Context, Decision Deferred and Revisit Criteria — behind a per-card "Show details" toggle. The endpoint had always returned these fields; the page simply never displayed them.
- The origin-spec filter is now a **Scope** filter with a "Project-level" option, so decisions recorded without an `originSpec` can be isolated rather than being reachable only via "All". Project-level deferrals are labelled as such on their cards instead of showing no scope at all.
- The Deferrals page updates live. The file watcher now covers `.spec-workflow/deferrals/*.md` and `specs/*/deferred.json`, and the server broadcasts a `deferrals-update` message carrying the whole payload, so the page no longer depends on its manual Refresh button.
- `IndexGenerator.listDeferredSpecs()` exposes the deferred-spec markers as data, reusing the marker parsing that already feeds the INDEX.md Deferred section.

### Changed
- `GET /api/projects/:projectId/deferrals` gained a `deferredSpecs` array. The existing `deferrals` and `duplicateGroups` fields are unchanged and existing consumers are unaffected.
- Every string on the Deferrals page is now translated. The page previously relied on inline English fallbacks, so all ten non-English locales rendered it in English regardless of the selected language.

### Notes
- Deferred SPECS and deferred DECISIONS remain distinct concepts with separate stores and separate tools (`spec-index` vs `deferrals`). The dashboard presents them in one place but keeps them clearly separated, matching the distinction the `spec-index` tool description already draws.
- Read-only: the dashboard displays deferrals but does not resolve, merge or delete them. Those remain MCP-tool operations.

## [4.2.0] - 2026-07-24

### Changed
- Removed expert-persona preamble ("You are a senior engineer…") from every prompt the server generates. Current research finds persona assignment does not improve task performance and measurably reduces directness; the behavioural directives it was wrapped around are retained unchanged.
  - `adversarial-review` no longer carries a `persona` per phase — the domain lens was already expressed, more specifically, by each phase's `attackSurface` and `exampleAngles`. The `PhaseGuidance` type drops the field.
  - The adversarial review methodology no longer instructs the generating agent to assign the reviewing agent a senior expert persona; it now directs it to name the phase's attack surface instead, so the pattern stops propagating into newly generated prompt files.
  - The `review-task` methodology and the dashboard task-review runner open with directives rather than role assignments. Task context (id, description, spec name) is unchanged.

### Removed
- **`Role` is no longer part of the `_Prompt` contract** in `tasks.md`. The field was generated and validated but never consumed — `review-task` reads only `Restrictions` and `Success`, and the dashboard never rendered it. The documented format is now `_Prompt: Task: … | Restrictions: … | Success: …`.
  - Existing `tasks.md` files remain valid: prompts that still carry a `Role:` segment parse as before for `Task`/`Restrictions`/`Success`, and a missing `Role` no longer produces a validation warning. Generators emitting the old four-field form need no immediate change.

## [4.0.0] - 2026-06-05

### Added
- `design-system` is now a first-class steering document type. The optional `design-system.md` captures the project's visual design system (color, typography, spacing, components, accessibility) as durable, cross-cutting guidance, handled like product/tech/structure across the server and dashboard.
  - New `design-system-template.md` is auto-populated into `.spec-workflow/templates/` on server start (overridable via `user-templates/`). Like the sibling steering docs, it captures durable **direction and rules** (principles, semantic roles, usage rules, non-negotiable gates) and treats concrete values (exact palette/tokens, type scale, per-component decisions) as deferred to the design spec / token source of truth — a "direction-light" doc with `Deferred:` entries is a first-class outcome.
  - Added as an optional Phase 4 in the `steering-guide` workflow (after structure; may be skipped).
  - Loaded in the Decomposition and Design phases when present (see the steering-doc loading table in `spec-workflow-guide`).
  - Supported by the `approvals` and `adversarial-review` flows (steering category) and rendered on the dashboard Steering page.
  - Closes the consumption loop: the per-spec design template gained a conditional "Design System (design-system.md)" alignment subsection, so UI/visual specs are prompted to honor the design system. It degrades to N/A for non-visual specs and for projects without the optional doc.
- Internal `STEERING_DOCS` registry (`src/core/steering-docs.ts`) is now the single source of truth for the steering doc set; the dashboard Steering page renders from the status payload so future steering types need no frontend change.

### Changed
- **BREAKING:** `SteeringStatus.documents` changed from a fixed `{ product, tech, structure }` object to a `Record<string, boolean>` keyed by steering doc name (now also includes `design-system`). API/WebSocket consumers reading these fields should treat the map as open-ended.

### Notes
- The new doc is fully optional and opt-in. Existing projects (product/tech/structure only) are unaffected; absence of `design-system.md` never breaks orientation, status, decomposition, or existing specs.
- The VS Code extension does not yet surface `design-system` (consistent with its existing coverage); a follow-up pass will add it.

## [3.0.2] - 2026-06-03

### Documentation
- Realigned `docs/` with the actual 11-tool server. Rewrote the tool reference (removing the non-existent upstream `create-spec-doc` / `spec-list` / `manage-tasks` / `request-approval` surface), documented the six fork tools and the required Decomposition phase, and folded the duplicate `api-reference.md` into a redirect.
- Added `docs/AUTONOMOUS-USAGE.md` covering non-interactive / headless operation: enforced-vs-advisory constraints, iterate-to-converge, and the headless review path.
- Documented the 8 MCP prompts (`src/prompts/`) and corrected the claim that `refresh-tasks` does not exist (it is a registered prompt).
- Corrected the "no automated AI review / no external calls" claim in the technical docs to reflect the adversarial/task review CLI subprocesses; fixed the `adversarial-settings.json` schema, default port (5000), SDK import, broken links, and i18n count; consolidated duplicate troubleshooting and developer guides.

### Fixed
- Corrected stale upstream tool references in runtime guidance strings that the agent acts on: `spec-workflow-guide` and `spec-status` `nextSteps`, and the `refresh-tasks` prompt body (`get-template-context`, `spec-list`, `create-spec-doc` no longer exist — the agent reads templates and writes files directly).
- `spec-status` template guidance no longer points at a `*-template-v*.md` glob that matches no files, and now honors the `user-templates/` override; `create-spec` and `create-steering-doc` prompts check `user-templates/` before `templates/`.

## [3.0.1] - 2026-05-15

### Changed
- Switched the npm publish workflow to OIDC (trusted publishing) and added CI gates: plugin-manifest version sync, npm registry version-uniqueness, and a matching git tag at HEAD.

## [3.0.0] - 2026-04-22

### Notes
- Hard fork from upstream `Pimzino/spec-workflow-mcp@2.2.6`. No longer tracking upstream. See the README "Fork Notice" for background.
- `.spec-workflow/` state format and all tool / config / env-var identifiers remain wire-compatible with upstream 2.2.6 — existing user state migrates in place.

### Added
- **Adversarial Review** — automated oppositional review of spec documents (requirements / design / tasks / steering / decomposition). Spawns fresh-context CLI subagents (defaults to Claude CLI; configurable for any LLM CLI) to generate and execute adversarial prompts. Dashboard trigger, in-card progress stepper, versioning / retry, review memory.
- **Spec Decomposition** — new required workflow phase that forces task breakdown before implementation. New `decomposition-guide` tool with dashboard integration and adversarial-review eligibility.
- **Deferred Decisions Tracker** — new `deferrals` tool and dashboard UI for recording decisions intentionally punted during spec authoring.
- **Task Review** — new `review-task` and `get-task-review` tools that spawn a fresh-context dashboard agent to review completed task implementations before they're marked done.

### Changed
- Renamed npm package: `@pimzino/spec-workflow-mcp` → `@madmatt112org/spec-workflow-mcp`.
- Dashboard version banner now resolves against the new npm scope.
- VSCode extension publisher renamed `Pimzino` → `madmatt112` (see `vscode-extension/CHANGELOG.md`).
- Removed "Buy Me a Coffee" buttons from dashboard (desktop + mobile) and VSCode sidebar; dropped associated `support.*` / `header.support` locale keys across all 11 languages.
- Removed README showcase videos, multi-language translation links, star-history chart, and Pimzino-hosted promotional content.

### Removed
- 90 non-English documentation translations (README + docs). The English docs are the single source of truth for the fork.
- Stale PR-draft files `pr-203-description.md` and `pr-204-description.md` (artefacts of the abandoned upstream PR attempt).

---

_Entries below this line predate the fork and were authored by the upstream maintainer._

## [2.2.6] - 2026-03-07

### Changed
- **Task Logging Workflow Guidance** (PR #200) - Strengthened implementation instructions so AI agents are explicitly directed to record implementation details before marking tasks complete:
  - Updated the `implement-task` prompt to make `log-implementation` a mandatory step before changing tasks from `[-]` to `[x]`
  - Updated the `spec-workflow-guide` implementation phase to reinforce the same ordering and emphasize implementation logs as required workflow context for future agents

## [2.2.5] - 2026-03-02

### Security
- **Upgrade Fastify and Plugins** - Resolved all remaining npm audit vulnerabilities by upgrading from Fastify v4 to v5:
  - `fastify` 4.29.1 -> 5.7.4 (fixes DoS via unbounded memory in sendWebStream, Content-Type header bypass)
  - `@fastify/cors` 9.0.1 -> 11.2.0
  - `@fastify/static` 7.0.4 -> 9.0.0
  - `@fastify/websocket` 8.3.1 -> 11.2.0
  - Updated WebSocket handler to use v11 API (socket-first signature instead of connection wrapper)
  - Also resolved: `@isaacs/brace-expansion`, `@modelcontextprotocol/sdk`, `ajv`, `hono`, `markdown-it`, `minimatch`, `qs`, `rollup` vulnerabilities via `npm audit fix`

## [2.2.4] - 2026-03-02

### Security
- **Fix Arbitrary File Read Vulnerability** (Issue #201) - Prevented reading files outside the project directory via crafted `filePath` values in approval requests:
  - Reject absolute paths and path traversal (`..`) sequences at three defense layers: MCP tool input, approval creation, and file path resolution
  - Replace unsafe `join()` calls with `PathUtils.safeJoin()` which validates resolved paths stay within project bounds
  - Add `PathUtils.validatePathWithinBases()` for verifying resolved paths against allowed directories
  - Previously, an attacker with dashboard access could read arbitrary system files (e.g., `/etc/passwd`) by creating approval requests with absolute or traversal paths

### Fixed
- **Empty Test Suite on Linux** - Case-sensitivity tests in `path-utils.test.ts` used a conditional `if` block that produced an empty `describe` on Linux, causing vitest to error. Replaced with `it.skipIf()` for proper test skipping
- **Missing `@mdx-js/mdx` Dependency** - Restored missing package to fix 4 cascading test suite failures

## [2.2.3] - 2026-02-08

### Added
- **MDX Pre-Render Validation for Approvals** (PR #197) - All markdown files are now validated for MDX compatibility before approval requests are accepted:
  - Approval requests for any `.md` file are blocked if MDX compilation fails, preventing dashboard rendering issues
  - Actionable error messages with line/column references and fix suggestions (e.g., escape `<` as `&lt;` or use inline code)
  - Existing `tasks.md` structural validation still runs after MDX validation
- **`validate:mdx` CLI Script** - New `npm run validate:mdx` command for batch-scanning markdown files:
  - Scans all `.md` files in `.spec-workflow/specs/` and `.spec-workflow/steering/` directories
  - Supports `--spec <name>` to validate a single spec, `--file <path>` for a single file
  - `--json` output mode for CI/automation integration
- **MDX Validator Module** - New `src/core/mdx-validator.ts` using `@mdx-js/mdx` compile for syntax validation with structured error reporting

### Dependencies
- Added `@mdx-js/mdx` (^3.1.1) for MDX compilation-based validation

## [2.2.2] - 2026-02-04

### Fixed
- **NPX Entrypoint Execution** (PR #195) - Fixed CLI silently not executing when invoked via `npx`:
  - Resolved symlinked paths using `realpathSync()` for proper entrypoint detection
  - `process.argv[1]` returns symlink path while `import.meta.url` returns real path, causing comparison to fail
  - Removed `process.stdin.resume()` in dashboard mode which could suspend the process in some shells

### Added
- **Markdown Thematic Breaks** - Added support for horizontal rules (`---`) in the dashboard editor:
  - Enabled `thematicBreakPlugin` in MDX editor
  - Added toolbar button for inserting thematic breaks

## [2.2.1] - 2026-02-04

### Fixed
- **NPX Installation Error** (Issue #196) - Fixed "Cannot find package 'ajv'" error when installing via `npx`:
  - Added `ajv`, `ajv-formats`, and `zod` as direct dependencies to ensure proper ESM module resolution
  - These packages are required by `@modelcontextprotocol/sdk` but npm's dependency hoisting in npx environments could fail to resolve them correctly
  - The fix ensures the MCP SDK's validation modules can always find their dependencies regardless of installation method

## [2.2.0] - 2026-02-03

### Added
- **Git Worktree Support** (PR #194) - Separate worktree identity from shared `.spec-workflow` root:
  - Each git worktree now registers as its own project identity in the dashboard
  - Project labels reflect worktree context with `repo · worktree` naming format
  - `.spec-workflow` remains shared by default across worktrees (existing behavior preserved)
  - Artifact/approval content resolution now prioritizes workspace/worktree paths with workflow root fallback
  - New `--no-shared-worktree-specs` CLI flag to opt-out of sharing and use workspace-local `.spec-workflow`
  - Added `resolveGitWorkspaceRoot()` helper using `git rev-parse --show-toplevel`
  - Backward compatible: legacy registry entries without `workflowRootPath` are normalized automatically

### Added (Testing)
- Comprehensive test coverage for worktree functionality:
  - Unit tests for CLI argument parsing, git-utils, project-registry, and approval-storage path resolution
  - Integration tests for multi-server approval content resolution
  - E2E Playwright tests for no-shared worktree dashboard flow
  - New `test:e2e:worktree` npm script with dedicated Playwright config

## [2.1.12] - 2026-01-29

### Added
- **Approval Deeplinks** (Issue #192) - Approval requests now return direct URLs to specific approvals:
  - Dashboard URL includes approval ID as query parameter: `/approvals?id={approvalId}`
  - Clicking a deeplink auto-scrolls to the specific approval and highlights it with an amber ring
  - Approval is automatically expanded when navigating via deeplink
  - Improves workflow when running multiple AI agents in parallel

## [2.1.11] - 2026-01-27

### Fixed
- **Subdirectory Path Resolution** (Issue #189) - Fixed "Path traversal detected" error when starting the MCP server from a subdirectory within a git repository:
  - `git rev-parse --git-common-dir` returns relative paths (e.g., `../../.git`) when run from subdirectories
  - Updated `resolveGitRoot()` to use `path.resolve()` for converting relative paths to absolute paths
  - Absolute paths (Unix and Windows) are returned unchanged to preserve existing worktree behavior
  - Added test coverage for relative path scenarios

- **Task Prompt Spec Mismatch** (Issue #191) - Fixed copied task prompts using wrong spec name when switching between specs:
  - When selecting a spec without tasks, stale tasks from the previous spec remained displayed
  - Copying the prompt would incorrectly use the new spec name with old task data
  - Now clears task data immediately when switching specs to prevent stale data display

## [2.1.10] - 2026-01-24

### Added
- **Bulk Approval Management** (PR #181) - New batch selection and action system for managing multiple approval requests:
  - **Selection Mode** - Toggle to enable multi-select with visual checkboxes on approval items
  - **Select All / Deselect All** - Quick controls to select or clear all visible approval items
  - **Batch Actions** - Approve All or Reject All selected items in a single operation
  - **Undo Operations** - 30-second undo window with visual progress bar countdown after batch actions
  - **Continue-on-Error** - Batch operations process all items and report individual failures without stopping
  - **Security Controls** - Batch size limit of 100 items, ID validation with alphanumeric regex pattern
  - **Full i18n Support** - Translations for all 11 supported locales

- **Custom Typography System** - Added locally-bundled fonts for improved readability and visual consistency:
  - **Inter** (400, 500, 600, 700 weights) - Modern sans-serif for UI text, designed for screens
  - **JetBrains Mono** (400, 500, 700 weights) - Developer-focused monospace for code and specs
  - Fonts are bundled locally in the build (no CDN dependency)
  - Added `font-display: swap` for optimal loading performance
  - Added `unicode-range` for efficient font subsetting
  - Updated `--font-sans` and `--font-mono` CSS variables with new fonts and fallback stack

### Changed
- **Utility Consolidation** - Eliminated duplicate utility functions across the codebase:
  - Created shared `dateUtils.ts` with `formatDate()` and `formatDistanceToNow()` functions
  - Consolidated 5 duplicate `formatDate` implementations from SpecsPage, TasksPage, LogsPage, ApprovalsPage, and SteeringPage
  - Created shared `colorUtils.ts` for VSCode webview with `isValidHex()` and `hexToRgba()` functions
  - Removed duplicate color validation logic from CommentModal component

- **Design Token Migration** - Replaced hardcoded Tailwind colors with CSS variable design tokens:
  - Updated DashboardStatistics to use `--text-primary`, `--text-secondary`, `--text-muted` tokens
  - Updated SideBySideView to use `--surface-inset`, `--surface-panel`, `--border-default` tokens
  - Updated ProjectDropdown to use design tokens for all gray color variants
  - Improved theming consistency between light and dark modes

- **ApprovalEditorService Refactor** - Extracted hardcoded decoration colors into constants:
  - Created `APPROVAL_STATUS_COLORS` constant for pending, approved, rejected, needs-revision, and commented states
  - Added `DECORATION_BORDER_RADIUS` constant for consistent styling

- **Build Script Improvement** - Updated `build:dashboard` script to automatically run `copy-static`:
  - Ensures dashboard builds are always copied to the correct serving location (`dist/dashboard/public/`)
  - Prevents issues where dashboard changes don't appear after rebuild

### Fixed
- **Changelog Modal Rendering** - Fixed the changelog modal displaying blank content when clicking the version badge:
  - Replaced complex MDXEditor component with lightweight custom markdown renderer
  - Added proper rendering for headers, bullet lists, nested lists, and bold text
  - Uses design token CSS variables for consistent theming in light/dark modes

## [2.1.9] - 2026-01-23

### Added
- **Git Worktree Support** (GitHub Issue #187) - Specs are now shared across git worktrees:
  - Auto-detects git worktrees and stores specs in the main repository's `.spec-workflow/` directory
  - All worktrees of the same repository share the same specs automatically
  - New `SPEC_WORKFLOW_SHARED_ROOT` environment variable to override automatic detection
  - Silent fallback for non-git directories or when git is unavailable
  - Logs "Git worktree detected. Using main repo: <path>" when worktree is detected

- **MCP Tool Annotations** (PR #176) - Added semantic metadata annotations to all 5 tools for improved LLM tool understanding:
  - `readOnlyHint: true` for read-only tools (`spec-workflow-guide`, `steering-guide`, `spec-status`)
  - `destructiveHint: true` for state-modifying tools (`approvals`, `log-implementation`)
  - `title` annotations for human-readable tool display names
  - Enables MCP clients like Claude Code to auto-approve read-only tools and prompt for confirmation on destructive operations

### Changed
- **Design Tokens Refactor** - Replaced hardcoded colors and styles with design tokens for improved consistency:
  - Updated components including App, ApprovalsAnnotator, KanbanBoard, and others
  - New CSS variables for background, text, and border colors
  - Enhanced visual elements such as buttons, modals, and status indicators

### Fixed
- **Comments Section Height** - Improved height and layout of the Comments & Feedback section:
  - Increased height from 50vh to 70vh for better visibility
  - Added minimum height constraints to prevent collapsing to content height
  - Comments section now properly stretches to match the annotations panel height

### Security
- **Dependency Updates** - Fixed 8 vulnerabilities (6 high, 1 moderate, 1 low) via `npm audit fix`:
  - `@modelcontextprotocol/sdk` - ReDoS vulnerability (GHSA-8r9q-7v3j-jr4g)
  - `@remix-run/router` / `react-router` / `react-router-dom` - XSS via Open Redirects (GHSA-2w69-qvjg-hvjx)
  - `diff` - DoS vulnerability in parsePatch/applyPatch (GHSA-73rr-hh4g-fpgx)
  - `hono` - JWT algorithm confusion vulnerabilities (GHSA-3vhc-576x-3qv4, GHSA-f67f-6cw9-8mq4)
  - `lodash-es` - Prototype Pollution in unset/omit functions (GHSA-xxjr-mmjv-4gpg)
  - `qs` - DoS via memory exhaustion in arrayLimit (GHSA-6rw7-vpxm-498p)

## [2.1.8] - 2026-01-22

### Added
- **Side-by-Side Annotation View** (GitHub Issue #179) - New view mode in the Approvals tab that displays source markdown and rendered preview side-by-side:
  - Left panel shows source text with full annotation capability
  - Right panel shows live rendered markdown preview using MDXEditorWrapper
  - Bidirectional scroll synchronization between panels with toggle to enable/disable
  - Full-width layout with comments section stacked below (not sidebar)
  - Responsive design: panels stack vertically on mobile, side-by-side on tablet+
  - New mode button in the Approvals tab mode switcher alongside Preview and Annotate

- **Edit Button on Comment Cards** - Added edit button (pencil icon) to comment cards in the Comments & Feedback section for quick access to edit annotations

### Changed
- **Text Annotation Library Integration** - Replaced manual highlight implementation with `react-text-annotate-blend` library:
  - More reliable text selection and offset calculation
  - Consistent highlighting between Annotate and Side-by-Side modes
  - Handles edge cases (line endings, special characters) automatically
  - Shows annotation tag/ID inline with highlighted text

- **Comment Card Redesign** - Improved comment card layout following design principles:
  - Clean card structure with header (type badge + actions) and body sections
  - Full comment ID displayed on separate line with monospace styling
  - Full highlighted text displayed without truncation (was limited to 80 chars)
  - Full comment text displayed without truncation
  - Better visual hierarchy with proper spacing and typography
  - White card background with subtle border for cleaner appearance

### Fixed
- **Highlight Click Handler** - Fixed clicking on highlights to open the edit modal:
  - Improved mark click detection using background color matching
  - Added fallback text-based matching for edge cases
  - Works reliably in both Annotate and Side-by-Side modes

### Dependencies
- Added `react-text-annotate-blend` (^1.2.0) - React 18 compatible text annotation library

## [2.1.7] - 2025-12-20

### Fixed
- **Missing ws Package Dependency** - Fixed `ERR_MODULE_NOT_FOUND` error when running the package via npx:
  - Added `ws` package (^8.18.0) to dependencies (was missing, only @types/ws was in devDependencies)
  - The ws package is required at runtime by `dashboard/multi-server.ts` for WebSocket functionality
  - Users installing via `npx @pimzino/spec-workflow-mcp@latest` will now have all required dependencies

## [2.1.6] - 2025-12-19

### Fixed
- **Approvals Tool Path Translation Error** (PR #173) - Fixed error when `PathUtils.translatePath` is called with undefined or null values in the approvals tool:
  - Added defensive checks to `safeTranslatePath` helper function to guard against undefined/null input paths
  - Prevents runtime errors when path translation encounters missing or invalid path values
  - Improves stability of the approvals workflow on cross-platform environments

## [2.1.5] - 2025-12-16

### Fixed
- **Codex CLI Transport Closed on Approvals** (PR #171) - Fixed intermittent "Transport closed" errors when using Codex CLI during approval workflows:
  - Changed `console.log` to `console.error` in approval snapshot creation to prevent stdout contamination
  - MCP protocol requires stdout to be reserved exclusively for JSON-RPC communication
  - Diagnostic messages now correctly use stderr, preventing JSON parsing errors in MCP clients

## [2.1.4] - 2025-12-14

### Fixed
- **Dashboard Annotation Word-Level Highlighting** (fixes #169) - Fixed issue where annotating text in the Dashboard Approvals tab would highlight all occurrences of the same text instead of just the specific selection:
  - Added `startOffset` and `endOffset` fields to capture exact character positions when selecting text for annotation
  - Rewrote `renderContentWithAnnotations()` to use position-based highlighting instead of global regex text-matching
  - Updated modal state and comment creation to preserve and pass position data
  - Existing annotations without position data fall back to highlighting the first occurrence only (backward compatible)

## [2.1.3] - 2025-12-10

### Fixed
- **Dashboard Startup Crash for Users with Older Data Files** (fixes #168) - Fixed `Cannot read properties of undefined (reading 'filter')` error that prevented dashboard startup for users upgrading from older versions:
  - Added backward compatibility guard in `project-registry.ts` to ensure `instances` array exists on all registry entries
  - Added backward compatibility guard in `settings-manager.ts` to ensure `automationJobs` array exists in settings
  - Users with older `activeProjects.json` or `settings.json` files from previous versions can now start the dashboard without errors

## [2.1.2] - 2025-12-10

### Fixed
- **Dashboard JS/CSS Loading Fails with Custom Port** (fixes #167) - Fixed issue where the dashboard would fail to load JavaScript and CSS assets when using a custom port (e.g., `--port 5002`):
  - CORS `allowedOrigins` was hardcoded to port 5000, blocking requests from other ports
  - CSP `connect-src` directive was missing WebSocket origins for custom ports
  - Added `generateAllowedOrigins(port)` helper to dynamically generate allowed origins based on the actual port
  - Updated `getSecurityConfig()` to accept port parameter and generate port-aware CORS configuration
  - Updated `createSecurityHeadersMiddleware()` to include dynamic `connect-src` for WebSocket connections
  - Security configuration now correctly displays the actual allowed origins on startup

## [2.1.1] - 2025-12-09

### Added
- **Enterprise Security Features** (PR #165) - Comprehensive security controls for corporate environments:
  - **Localhost Binding** - Dashboard binds to `127.0.0.1` by default, preventing network exposure
  - **Rate Limiting** - 120 requests/minute per client with automatic cleanup to prevent abuse
  - **Audit Logging** - Structured JSON logs with timestamp, actor, action, and result for compliance
  - **Security Headers** - X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, CSP, Referrer-Policy
  - **CORS Protection** - Restricted to localhost origins by default
  - **Network Security Validation** - Explicit opt-in required for non-localhost binding (`SPEC_WORKFLOW_ALLOW_EXTERNAL_ACCESS=true`)

- **Docker Security Hardening** (PR #165) - Enhanced container security:
  - Non-root user execution (`node` user)
  - Read-only root filesystem
  - Dropped all Linux capabilities (`cap_drop: ALL`)
  - No privilege escalation (`no-new-privileges`)
  - Resource limits (CPU/memory) to prevent DoS
  - Proper signal handling with `dumb-init`
  - New `Dockerfile.prebuilt` for environments with limited Docker memory

- **New Configuration Options** - Environment variables for security control:
  - `SPEC_WORKFLOW_BIND_ADDRESS` - IP address to bind to (default: `127.0.0.1`)
  - `SPEC_WORKFLOW_ALLOW_EXTERNAL_ACCESS` - Explicit opt-in for network exposure
  - `SPEC_WORKFLOW_RATE_LIMIT_ENABLED` - Enable/disable rate limiting
  - `SPEC_WORKFLOW_CORS_ENABLED` - Enable/disable CORS protection

- **Health Check Endpoint** - New `/api/test` endpoint for monitoring dashboard availability

- **Docker Test Script** - Comprehensive `containers/test-docker.sh` script to validate security configurations

### Changed
- Docker Compose now defaults to localhost-only port binding (`127.0.0.1:5000:5000`)
- Dashboard displays security configuration status on startup
- Improved error messages for security configuration issues

### Fixed
- **Task Notification System Not Working** - Fixed task completion and in-progress notifications not appearing. The notification system now uses WebSocket event data directly instead of making separate API calls, eliminating race conditions and timing issues that prevented notifications from triggering.

- **Templates Shipped with CRLF Line Endings** (fixes #166) - Fixed issue where template files were shipped with Windows-style CRLF line endings, causing git to detect them as modified on Linux/WSL/macOS systems:
  - Updated `.gitattributes` to enforce LF line endings for markdown files (`*.md text eol=lf`)
  - Modified `scripts/copy-static.cjs` to normalize line endings to LF during the build process
  - Converted all template files in `src/markdown/templates/` from CRLF to LF
  - Templates are now cross-platform compatible and won't trigger spurious git changes

- **Self-Healing Project Registry** (fixes #164) - Fixed rapid project add/remove cycles when Claude Code recycles MCP processes:
  - **Multi-Instance Support** - Projects now track multiple MCP server instances (PIDs) simultaneously, allowing unlimited concurrent sessions per project
  - **Self-Healing Registration** - When an MCP server starts, it automatically cleans up dead PIDs from crashed sessions and reuses the project slot
  - **PID-Specific Cleanup** - MCP servers now only unregister their own instance on shutdown, leaving other active instances intact
  - **Removed Aggressive Cleanup** - Dashboard no longer runs periodic 30-second cleanup; MCP servers manage their own lifecycle
  - **PID Visibility** - Project dropdown now shows PID for single instances or instance count for multiple instances

- **Dashboard Disconnection During Approval Process** (fixes #162) - Fixed critical stability issue where dashboard WebSocket connections would disconnect when AI clients (e.g., Codex CLI) modified documents during the approval workflow:
  - **Approval Storage Debouncing** - Added 500ms debounce for approval file change events to prevent event flooding when approvals are rapidly created/modified
  - **Spec Broadcast Debouncing** - Added 300ms debounce for spec update broadcasts to coalesce rapid file changes into a single UI update
  - **WebSocket Heartbeat Monitoring** - Added ping/pong heartbeat mechanism to detect and clean up stale connections proactively
  - **File Watcher Debouncing** - Implemented 500ms debounce for spec file change events to prevent event flooding during rapid document modifications
  - **File Stability Detection** - Added file size stability checking before processing changes, preventing partial file reads during write operations
  - **Graceful Connection Cleanup** - Improved error handling in broadcast methods with scheduled cleanup to avoid modifying collections during iteration
  - **Exponential Backoff Reconnection** - Frontend WebSocket now uses exponential backoff (1s to 30s) for reconnection attempts instead of fixed 2s intervals
  - **Clean Disconnect Handling** - WebSocket client no longer attempts reconnection on clean close events (codes 1000, 1001)

## [2.1.0] - 2025-12-03

### Fixed
- **Unsaved Changes Modal Translations** - Added missing translations for the unsaved changes confirmation modal in Steering and Spec document editors across all 11 supported languages (Arabic, German, English, Spanish, French, Italian, Japanese, Korean, Portuguese, Russian, Chinese)
- **Improved Diff Visibility in Changes Tab** (fixes #158) - Fixed issue where adding a single line would cause all subsequent text to appear as changed:
  - Replaced naive index-based line comparison with proper `diffLines` algorithm from the `diff` library
  - Now correctly identifies only the actual changed lines, not positional differences
  - Provides accurate visual diff representation matching user expectations

### Added
- **MDX Editor Integration** - Replaced basic markdown textareas with a full-featured rich text editor powered by MDXEditor:
  - **Rich Text Editing** - WYSIWYG editing experience with live preview for markdown content
  - **Toolbar Controls** - Full toolbar with formatting options (bold, italic, underline, headings, lists, links, tables, code blocks)
  - **Source Mode Toggle** - Switch between rich text and raw markdown source editing with a single click
  - **Code Block Support** - Syntax-highlighted code blocks with CodeMirror integration and language selector dropdown
  - **Mermaid Diagram Support** - Render Mermaid diagrams directly in the editor with live preview
  - **Dark Mode Support** - Complete dark theme styling for all editor components including:
    - Editor content area and toolbar
    - Source mode (CodeMirror) with proper syntax highlighting
    - Code blocks with themed gutters, line numbers, and selection
    - Dropdown menus and language selectors (scrollable with custom scrollbars)
    - Popups and dialogs
  - **Keyboard Shortcuts** - Ctrl+S to save, standard text formatting shortcuts
  - **Auto-save Status** - Visual indicators for saving, saved, and unsaved changes states
  - **Character/Line Count** - Real-time statistics in the editor footer
  - Applied to both Steering Documents and Spec Documents editing modals

### Changed
- Steering document modals now show the editor even for empty/new documents, allowing users to create content directly

## [2.0.11] - 2025-11-28

### Changed
- **Flexible Approval Deletion** (PR #119) - Modified approval deletion logic to allow deleting approvals in any non-pending status:
  - Can now delete approvals with status: `approved`, `rejected`, or `needs-revision`
  - Only `pending` approvals are blocked from deletion (still awaiting review)
  - Improves flexibility for cleanup operations while preventing accidental deletion of approvals still awaiting review
  - Updated error messages and next steps guidance to clarify the new behavior
  - Updated documentation in TOOLS-REFERENCE.md and api-reference.md

## [2.0.10] - 2025-11-26

### Added
- **Claude Code Plugin Support** (PR #121) - Added official Claude Code plugin configuration for easy installation from the Claude marketplace:
  - Two plugin variants available: `spec-workflow-mcp` (base) and `spec-workflow-mcp-with-dashboard` (auto-starts dashboard)
  - Plugins use `@latest` tag for automatic updates to newest releases
  - Added `npm run sync:plugin-version` script to keep plugin versions in sync with package.json
  - Added `npm run check:plugin-version` for CI validation of version consistency
- **`--no-open` Flag for Dashboard** (PR #147, fixes #145) - Added new command-line flag to prevent automatic browser opening when starting the dashboard:
  - Use `spec-workflow-mcp --dashboard --no-open` to start the dashboard without launching the browser
  - Useful in restricted Windows environments where firewall or antivirus software blocks browser launches from processes
  - Prevents "failed to start dashboard: spawn EPERM" errors for users without administrator privileges
  - Dashboard URL is still printed to console so users can manually navigate to it
- **Sandbox Environment Support** (fixes #144) - Added `SPEC_WORKFLOW_HOME` environment variable to support sandboxed MCP clients like Codex CLI:
  - Allows overriding the default global state directory (`~/.spec-workflow-mcp`) to a writable location
  - Essential for sandboxed environments where `$HOME` is read-only (e.g., Codex CLI with `sandbox_mode=workspace-write`)
  - Supports both absolute paths and relative paths (resolved against current working directory)
  - Added helpful error messages when permission errors occur, suggesting the `SPEC_WORKFLOW_HOME` workaround
  - Updated Docker configuration to use `SPEC_WORKFLOW_HOME` by default
  - Usage: `SPEC_WORKFLOW_HOME=/workspace/.spec-workflow-mcp npx spec-workflow-mcp /workspace`

### Fixed
- **Archived Specs Display Content Correctly** (PR #146) - Fixed critical bug where archived specs were not displaying content correctly in the dashboard:
  - Added new API endpoint `/api/projects/:projectId/specs/:name/all/archived` that reads documents from the archive path (`.spec-workflow/archive/specs/{name}/`) instead of the active specs path. This was missed during the multi-project dashboard implementation.
- **Tasks.md Format Validation** (fixes #151) - Added validation to ensure tasks.md follows the required format before approval:
  - New `task-validator.ts` module validates checkbox format (`- [ ]`), task IDs, and metadata delimiters
  - Validation runs automatically when requesting approval for tasks.md files
  - Blocks approval if format errors are found, with detailed error messages and fix suggestions
  - Prevents dashboard from failing to track task status due to malformed task files
  - Warnings for missing underscore delimiters on metadata fields (`_Requirements:_`, `_Leverage:_`, `_Prompt:_`)

## [2.0.9] - 2025-11-19

### Fixed
- **Republished Clean Package** - Version 2.0.8 accidentally included uncommitted frontend changes. This version contains only the committed code from PR #143.

## [2.0.8] - 2025-11-18

### Fixed
- **Dashboard "No Projects Available" Error After Spec Edits** (PR #143, fixes #142) - Fixed critical bug where editing spec documents caused the dashboard to show "No Projects Available" and the MCP client to report "Transport closed" errors:
  - Added error handling to async event handlers in `multi-server.ts` that were causing unhandled promise rejections
  - Added error handlers to all `chokidar` file watchers to prevent watcher crashes
  - Improved error logging with contextual messages for easier debugging
  - System now gracefully handles transient errors during file operations instead of crashing
  - WebSocket connections remain stable during spec document edits
  - No session reload required after editing spec documents
  - Added 7 comprehensive tests to verify watcher error handling and prevent regressions

## [2.0.7] - 2025-11-10

### BREAKING CHANGES
- **Removed `get-implementation-logs` tool** - This tool is no longer available. AI agents should use native tools (grep/ripgrep) and Read to search implementation logs instead.

### Fixed
- **Volume Control Regression** (PR #141) - Fixed critical volume control regression from NotificationProvider context split through 6 progressive commits:
  1. Fixed volume icon always showing as muted by updating VolumeControl component to use both `useNotifications()` (actions) and `useNotificationState()` (state)
  2. Fixed stale closure bug where `handleTaskUpdate` callback had stale reference to `playNotificationSound`, and changed volume/sound settings storage from sessionStorage to localStorage for persistence
  3. Made audio fade-out proportional to volume level instead of fixed value
  4. Fixed Web Audio API gain timing issues with direct value assignment and linear ramping
  5. **Replaced Web Audio API with Howler.js** - After 4 failed attempts to fix volume control with raw Web Audio API, switched to industry-standard Howler.js library (546k weekly downloads, MDN-recommended) for reliable, simple audio playback with real MP3 files
  6. **Fixed sound not playing at all** - Integrated `playNotificationSound()` into `showNotification()` function so all notifications (task completion, status changes, approvals) automatically play sound at user-configured volume level
- **Dashboard Task Status Refresh** (PR #140) - Fixed critical "page reload" issue when updating task status:
  - Removed redundant `reloadAll()` call causing unnecessary full page refreshes
  - **Split ApiProvider context** into ApiDataContext (data) and ApiActionsContext (stable functions) to prevent unnecessary re-renders when data updates
  - Added deep equality checks in websocket handlers before updating state
  - Improved task list comparison from index-based to Map-based for robustness
  - Result: Task status updates are now smooth and instant without scroll position loss or page disruption
- **Docker Implementation** (PR #135) - Fixed Docker build failure and updated configuration:
  - Removed invalid `COPY --from=builder /app/src/locales` command (locales are bundled in dashboard build)
  - Updated Dockerfile to build from local source instead of git clone
  - Fixed docker-compose.yml build context and port mappings (3000 → 5000)
  - Added comprehensive documentation in `containers/README.md` and `containers/DOCKER_USAGE.md`
  - Added `.dockerignore`, `containers/.env.example`, and updated `containers/example.mcp.json`

### Changed
- **Implementation Logs Format Migration** (PRs #136, #137, #138) - Logs are now stored as individual markdown files instead of a single JSON file for improved scalability and direct agent accessibility.
  - Old format: `.spec-workflow/specs/{spec-name}/implementation-log.json`
  - New format: `.spec-workflow/specs/{spec-name}/Implementation Logs/*.md`
- Implementation logs are automatically migrated from JSON to markdown format on server startup.
- Updated all documentation and prompts to guide agents to use grep/ripgrep commands to search implementation logs.
- Updated VSCode extension file watcher to monitor markdown files in Implementation Logs directories.
- Updated dashboard and multi-server API endpoints to work with the new markdown format.
- Added validation for taskId and idValue in markdown log parser to match VSCode extension behavior.

### Added
- **Automatic Migration System** - New `ImplementationLogMigrator` utility class handles automatic conversion of existing JSON logs to markdown format.
- **Migration Logging** - Migration process is logged to `~/.spec-workflow-mcp/migration.log` for debugging and transparency.
- **Howler.js Audio Library** - Added howler@2.2.4 dependency for reliable, cross-browser notification sounds with proper volume control.

### Improved
- **Agent Discovery** - AI agents can now directly grep implementation logs without special tool calls, making discovery faster and more intuitive.
- **Log Readability** - Markdown format is more human-readable and can be directly edited if needed.
- **Scalability** - Individual markdown files prevent performance degradation when dealing with thousands of implementation logs.
- **Dashboard Performance** - Context splitting and deep equality checks prevent unnecessary re-renders, making the dashboard significantly more responsive.
- **Audio Quality** - Notification sounds now use real MP3 files (via Howler.js) instead of synthetic oscillator beeps for better user experience.

## [2.0.6] - 2025-11-08

### Changed
- Removed creation of `config.example.toml` file during workspace initialization as it is no longer needed or used.

## [2.0.5] - 2025-11-08

### Fixed
- Fixed tools not respecting the project directory specified at server startup. Tools now use the server context's `projectPath` by default instead of requiring it as a mandatory argument.
- AI agents no longer need to pass `projectPath` to tools, preventing files from being created in the wrong directory (e.g., current working directory instead of the configured project directory).
- Updated `spec-status`, `get-implementation-logs`, `log-implementation`, and `approvals` tools to use context fallback pattern.
- Made `projectPath` optional in all tool input schemas while maintaining backward compatibility for explicit overrides.

## [2.0.4] - 2025-11-08

### Fixed
- Fixed dashboard startup failure with "Unexpected end of JSON input" error on macOS/Linux when configuration files were empty or corrupted.
- Added proper JSON parsing error handling to catch `SyntaxError` in addition to `ENOENT` errors.
- Implemented automatic initialization of JSON files with valid default content on first use.
- Added automatic backup of corrupted configuration files before overwriting.
- Improved error logging to identify which file is causing parse errors and where backups are stored.

## [2.0.3]

### Changed
- Updated all MCP tool responses to respond in TOON format instead of JSON for token savings and effeciency. (More Info: https://github.com/toon-format/toon)

## [2.0.2] - 2025-11-06

### Changed
- Improved the get-implementation-logs tool description and instructions to help agents understand how to use the tool.
- Removed deprecated --AutoStartDashboard flag
- Removed config.toml support as it is no longer needed.
- Removed some legacy code related to the single project dashboard implementation. (not required anymore)
- Removed Ephemeral port support as it is no longer needed. Dashboard starts on port 5000 by default if a --port is not specified.

## [2.0.1] - 2025-11-06

### Fixed
- Fixed a Critical bug where approval records were not being saved correctly on approval and blocking the full process.
- Fixed a bug with dropdowns in the dashboard causing unecassary horizontal scrollbars.
- Fixed a bug where diff viewer for approvals was not working.

## [2.0.0] - 2025-11-03

### Added
- Added NEW Unified Multi-Project Dashboard Implementation!
- 'ESC' key now closes all dialogs and modals in the dashboard.
- Implementation Log functionality added to the dashboard for each spec, AI Agents will now log detailed information about the implementation of each task. This information is then used by future AI agents to discover existing code and avoid duplication / mistakes when implementing new tasks especially when each task is dependant on the previous task.

### Changed
- Re-designed the dashboard to be more user friendly and intuitive.
  - Added a new sidebar menu for the dashboard instead of header navigation.


### Announcement
- Deprecated the `--AutoStartDashboard` flag as it is no longer needed.

## [1.0.1] - 2025-09-24

### Changed
- Removed references to a headless mode that would confuse confusion for the agent in rare instances where the user would only start the dashboard after beginning the spec workflow.
- Some UI / UX improvements to the dashboard.

### Fixed
- Fixed a bug where users couldnt start multiple instances of the Dashboard within the same project.
- Some UI / UX fixes to the dashboard, mainly around locale and missing translations.

### Added
- Added NEW Diff Viewer to the dashboard for approvals!
- Added NEW Kanban View to the dashboard for tasks!

## [1.0.0] - 2025-09-13

**NOTE: This version brings major architectural changes to the project. However they are non breaking changes.**

### Changes
- Replaced various filesystem binded tools with elaborate instructions and changes to the workflow to allow AI agents to create documents and manage the project without the need for filesystem tools.
  **Its worth noting this change should improve the accuracy of AI agents following the workflow. Its important to also note this has only been tested with Claude Sonnet 4, Claude Opus 4.1 and GPT 5**
- I have added the ability to use custom spec / steering document templates which is aimed at allowing users to customize the documents to their own needs. This is aimed at Power Users but everyone is welcome to use it.
- Added dynamic year to the spec-workflow-guide tool to ensure the agent is using the current year for web search for more up to date information.

**There are no plans to revert back to the previous architecture. We have made this decision to improve the accuracy of AI agents following the workflow as well as improve the maintainability of the project. If you wish to use the old architecture, you can still do so by running an older version of the MCP server however please note that in the event of a change to the MCP working directory structure, the dashboard or VSCode extension will not work as expected.**


## [0.0.33] - 2025-09-10

### Added
- **TOML Configuration File Support** - The MCP server now supports configuration via TOML files
  - Default config location: `<project-dir>/.spec-workflow/config.toml`
  - All command-line parameters can now be configured in the TOML file
  - Supports `projectDir`, `port`, `autoStartDashboard`, `dashboardOnly`, and `lang` settings
  - Example configuration file provided at `.spec-workflow/config.example.toml`
  - Tilde (`~`) expansion for home directory paths in config files

- **Custom Config File Path** - New `--config` CLI flag for specifying custom config file locations
  - Supports both `--config path` and `--config=path` formats
  - Works with both relative and absolute paths
  - Useful for maintaining different configs for different environments (dev, staging, production)
  - Custom config files must exist or server will exit with error

  NOTE: For more information on the configuration file, please refer to the [README.md](README.md) file.

## [0.0.32] - 2025-09-10

### Fixed
- Removed localizations for MCP server tools as I have reason to believe they were causing confusion and issues with agents understanding the tools and their purposes as well as responses.
- Improved get-template-context tool description to include a note about the template structure must be adhered to at all times and the next step to use the template for the specific document.

## [0.0.31] - 2025-09-09

### Fixed
- Fixed "ReferenceError: t is not defined" errors in multiple components:
  - `SearchableSpecDropdown` in TasksPage (Task management dropdown)
  - `CommentModal` in VSCode extension (Comment editing interface)
  - `comment-modal.tsx` wrapper (Modal context provider)
  - `VolumeControl` in Dashboard (Notification volume controls)
  - `AlertModal` in Dashboard (Alert dialog component)
- Added missing translation keys across all 11 supported languages for:
  - Comment modal UI elements (`commentModal.*` keys)
  - Volume control tooltips (`volumeControl.*` keys)
  - Common modal buttons (`common.ok` key)
- Enhanced i18n documentation with comprehensive troubleshooting guide
- Improved error prevention with component template and validation steps

## [0.0.30] - 2025-09-09

### Fixed
- Fixed a bug where some translations were not being loaded correctly (Specifically for Approval / Annotations).
- Fixed a bug where some languages didnt have the correct translation keys.

## [0.0.29] - 2025-09-08

### Improved
- Improved localization support for all components.

### Added
- **Multi-Language Support Expansion** - Added comprehensive translations for 8 new languages
  - Spanish (es) 🇪🇸 translations for all components
  - Portuguese (pt) 🇧🇷 translations for all components
  - German (de) 🇩🇪 translations for all components
  - French (fr) 🇫🇷 translations for all components
  - Russian (ru) 🇷🇺 translations for all components
  - Italian (it) 🇮🇹 translations for all components
  - Korean (ko) 🇰🇷 translations for all components
  - Arabic (ar) 🇸🇦 translations for all components
  - Total of 24 new translation files across MCP server, dashboard, and VSCode extension
  - Updated language selectors in both dashboard and VSCode extension to include all new languages

### Enhanced
- **i18n Infrastructure** - Updated validation and build processes to support 11 total languages
  - Enhanced validation script to check all supported languages for consistency
  - Updated all i18n configurations to register new language resources
  - Added comprehensive i18n structure documentation explaining the three translation contexts

### Technical Changes
- Updated SUPPORTED_LANGUAGES arrays across all three components
- Added flag emoji representations for improved language selection UX
- Maintained backward compatibility with existing English, Japanese, and Chinese translations
- All Mustache template variables validated for consistency across all 11 languages

## [0.0.28] - 2025-09-08

### Added
- **AI Prompt Generation for Tasks** - Enhanced task management with structured AI prompts
  - Added `prompt` field to ParsedTask interface for custom AI guidance
  - Task parser now extracts `_Prompt:` metadata from tasks.md files
  - Updated tasks template with LLM guidance for generating structured prompts
  - Copy functionality in both VSCode extension and dashboard now uses AI prompts when available
  - Graceful fallback to default "work on this task" prompts for backward compatibility
  - Comprehensive localization support (English, Chinese, Japanese) for new prompt features
  - MCP server tools automatically include prompt field in all task responses
  - Added Prompt to UI for previewing the prompt for the task in a collapsible section

### Enhanced
- **Task Template** - Added AI instructions for generating structured prompts with Role | Task | Restrictions | Success format
- **Multi-language Support** - Extended localization with prompt-related keys for better user experience
- **UI/UX Improvements** - Copy buttons now provide context-aware prompts for improved AI agent guidance

### Fixed
- **Volume Slider Alignment** - Fixed misaligned volume slider dot in web dashboard
  - Corrected CSS styling to properly center the 16px slider thumb on the track
  - Reduced track height from 8px to 4px for better visual proportion
  - Added `margin-top: -6px` to webkit slider thumb for proper vertical centering
  - Fixed duplicate border property in Firefox slider styles
  - Ensures consistent alignment across all browsers (Chrome, Safari, Edge, Firefox)
- **Language Selector** - Added missing Chinese language option to web dashboard dropdown
  - Chinese translations were already present but not exposed in the language selector UI
  - Added Chinese option with appropriate flag emoji to SUPPORTED_LANGUAGES array

## [0.0.27] - 2025-09-08

### Added
- **Chinese (zh) Language Support** - Comprehensive Chinese translations for multi-language support
  - Complete Chinese translations for all MCP server tools and messages
  - Chinese translations for dashboard frontend interface
  - Chinese translations for VSCode extension webview components
  - Integration with existing i18n framework supporting dynamic language switching
  - Validation script updates to ensure Chinese translation consistency

## [0.0.26] - 2025-09-08

### Fixed
- **MCP Server Mode** - Prevent stdout contamination that caused JSON parsing errors in MCP clients
  - Replaced console.log with console.error for diagnostic messages
  - Ensures stdout is reserved exclusively for JSON-RPC protocol communication
  - Fixes issue #71 where MCP clients couldn't parse server responses

### Added
- **Tasks UI Filtering and Sorting** - Enhanced task management with advanced filtering and sorting capabilities
  - Status filtering options (All, Pending, In Progress, Completed) with real-time task counts
  - Multiple sorting options (Default Order, By Status, By Task ID, By Description)
  - Ascending/Descending sort order toggle for all sort options
  - Persistent user preferences using localStorage (per-specification basis)
  - Full i18n support with English and Japanese translations
  - Maintains compatibility with real-time WebSocket updates
  - Based on contribution from @qdhenry (PR #54, #74)
- **Docker Container Support** - Full containerization for easy deployment
  - Multi-stage Dockerfile for optimized container size
  - Docker Compose configuration for dashboard deployment
  - Support for both MCP server and dashboard modes
  - Volume mounting for `.spec-workflow` directory persistence
  - Comprehensive container documentation and examples
  - Based on contribution from @heavyengineer (PR #57, #73)
- **Internationalization (i18n) Framework** - Comprehensive multi-language support across all components
  - Backend i18n with async loading and LRU caching for MCP tools
  - Frontend i18n using react-i18next for dashboard interface
  - VSCode extension i18n support for webview components
  - Complete Japanese translations for all tools and UI elements
  - Dynamic import support for optimized bundle sizes
  - Environment variable validation for locale formats (supports en, ja, en-US, pt-BR patterns)
  - Build-time validation script ensuring translation consistency

### Technical Changes
- Implemented Mustache templating for safe string interpolation in translations
- Added LRU cache with 10MB memory limit and 1-hour TTL for performance
- Integrated locale file copying into build process for all components
- Added comprehensive i18n documentation guide with performance comparisons
- Created validation script for JSON syntax and template variable consistency
- Enhanced copy-static script to include locale directories
- Added support for VITE_I18N_DYNAMIC environment variable for lazy loading

### Improved
- Reduced initial bundle size with optional dynamic translation loading
- Better error handling with locale-specific fallback mechanisms
- Production-ready error sanitization to prevent information disclosure

## [0.0.25] - 2025-09-07

### Added
- **MCP Prompts Support** - Implemented full Model Context Protocol prompts capability
  - Added 6 interactive prompts for spec-driven development workflows
  - `create-spec` - Interactive spec document creation with guided workflow
  - `create-steering-doc` - Create AI agent guidance documents
  - `manage-tasks` - Task management with list, complete, reset, and status actions
  - `request-approval` - Initiate formal approval workflows
  - `spec-status` - Get comprehensive project status overviews
  - `workflow-guide` - Interactive workflow guidance with best practices
- **Prompt Discovery** - MCP clients can now discover available prompts via `prompts/list`
- **Argument Support** - All prompts accept typed arguments for customization
- **Context Integration** - Prompts include project context, dashboard URLs, and tool recommendations

### Technical Changes
- Added `src/prompts/` module with prompt definitions and handlers
- Updated server capabilities to declare prompts support with `listChanged` flag
- Added `ListPromptsRequestSchema` and `GetPromptRequestSchema` handlers
- Each prompt generates contextual messages to guide AI assistants through workflows

## [0.0.24] - 2025-09-07

### Fixed
- Fixed get-approval-status tool to include comments in response data, enabling AI tools to access approval comments for better context understanding.

## [0.0.23] - 2025-08-27

### Improved
- Added correct tool definitions to the server capabilities.
- Refined spec-workflow-guide tool instructions condensing instructions by 50% whilst guarenteeing the same effectiveness.
- Added workflow mermaid flowcharts to the spec-workflow-guide tool to help agents visualize the workflow.
- Refined all the tool descriptions to remove ambiguity and make them more concise, additionally adding intrustions to each one to give the agent an idea of when to use the tool.

### Fixed
- Fixed Steering Doc workflow where the agent would attempt to provide all 3 documents in a single approval.
- Removed Steering guide from spec-workflow-guide tool and ensured steering-guide tool is called for steering document creation.
- Added direct support for steering documents in the request-approval tool as there wasnt direct support for it and the agents were just working around it.

### Misc
- Removed MCP resource definition as this was part of the initial developement workflow but was not required in the end.

## [0.0.22] - 2025-08-25

### Improved
- Dashboard browser tab now displays the actual project name (e.g., "spec-workflow-mcp Dashboard") instead of generic "Spec Dashboard (React)"
- Tab title dynamically updates based on the resolved project directory name for better identification when multiple dashboards are open

## [0.0.21] - 2025-08-25

### Fixed
- Fixed dashboard displaying "." as project name when using `--project-dir .` by resolving the path to show actual directory name

## [0.0.20] - 2025-08-22

### Added
- Added `--AutoStartDashboard` flag to automatically start and open dashboard when running MCP server
- Added `--port` parameter support for MCP server mode (previously only worked with `--dashboard` mode)
- Added comprehensive `--help` command with usage examples and parameter documentation
- Added validation for unknown command-line flags with helpful error messages

### Improved
- Enhanced shutdown behavior messaging for MCP server mode
- Removed duplicate console logging when using custom ports
- Updated README with AutoStartDashboard configuration examples for all MCP clients
- Clarified that MCP server lifecycle is controlled by the MCP client (not Ctrl+C)

### Fixed
- Fixed issue where browser would attempt to open twice with AutoStartDashboard
- Fixed duplicate "Using custom port" messages in console output

## [0.0.19] - 2025-08-21

### Fixed
- Fixed MCP server shutdown issues where server process would stay running after MCP client disconnects
- Added proper stdio transport onclose handler to detect client disconnection
- Added stdin monitoring for additional disconnect detection safety
- Enhanced stop() method with better error handling and cleanup sequence

## [0.0.18] - 2025-08-17

### Improvements
- Selected spec on tasks page is now persisted across page refreshes and now allows for deeplinking.

## [0.0.17] - 2025-08-17

### Bug Fixes
- Fixed a bug where request approval tool would fail when starting the MCP server without a projectdir. (wasnt really a bug as projectdir was recommended but I have made this more robust).

## [0.0.16] - 2025-08-15

### Bug Fixes
- Fixed a bug where the dashboard would not automatically update task status when the MCP tool was called and a refresh was required to view new status.

## [0.0.15] - 2025-08-15

### Improvements
- Moved to custom alert & prompt modals rather than window.alert and window.prompt. This should fix issues with dashboard showing prompts in VSCode Simple Browser
- Moved highlight color picker to the comment modal rather than having it in the comments list.

### New Features
- Added Notification Volume Slider.

## [0.0.14] - 2025-08-14

### Added
- Added a new 'refresh-tasks' tool to help align the task list with the current requirements and design. This is particularly useful if you make changes to the requirements / design docs mid integration.

### Misc
- Removed some legacy markdown files that were left over from initial development.

## [0.0.13] - 2025-08-13

### Added
- Added support for relative project paths and the use of tilde (~) in project paths. Below path formats are now supported:
    - npx -y @pimzino/spec-workflow-mcp ~/my-project
    - npx -y @pimzino/spec-workflow-mcp ./relative-path
    - npx -y @pimzino/spec-workflow-mcp /absolute/path

## [0.0.12] - 2025-08-11

### Fixed
- Fixed a bug with prose containers which would limit rendered content from fully displaying in the view modals.
- Fixed a bug with package version not showing in the header / mobile menu.

## [0.0.11] - 2025-08-11

### Fixed
- Page refresh on websocket updates. Pages will no longer reset on websocket updates.
- Dashboard accessibility improvements.

### Added
- Optimized dashboard for tablets.
- Users can now specify a custom port for the dashboard web server using the `--port` parameter. If not specified, an ephemeral port will be used.
- Added the ability to change task status directly from the task page in the dashboard.

## [0.0.10] - 2025-08-10

### Added
- **Initial Multi-Language Framework** - Established foundational support for internationalization
  - Set up i18n infrastructure to support future language translations
  - Implemented framework for dynamic language switching across components
  - Laid groundwork for comprehensive multi-language support later expanded in v0.0.26-0.0.29

### Fixed
- Fixed bug with spec steering page not displaying correctly on smaller screens (mobile devices).

## [0.0.9] - 2025-08-10

### Fixed
- Clipboard API wasnt working in HTTP contexts over LAN. Added fallback method using `document.execCommand('copy')` for browsers without clipboard API access.

### Changed
- Updated copy prompt to only include task id and spec name.
- Improved copy button feedback with visual success/error states and colored indicators.
- Dashboard --> Updated viewport to 80% screen width in desktop and 90% on mobile devices.

### Added
- Spec document editor directly in the dashboard.
- Spec archiving and unarchiving in the dashboard.
- Steering document page for creating, viewing and editing steering documents directly from the dashboard.


## [0.0.8] - 2025-08-09

### Updated
- Rebuilt the web dashboard with a mobile first responsive design bringing you the following improvements:
    - Responsive Design
    - Improved UI / UX
    - Improved Performance
    - Disconnected from MCP server - must be started manually
    - Can now run multiple MCP server instances for the same project on a single dashboard instance


**NOTE: This is a breaking change. The dashboard will no longer auto start and must be manually run. Please review the README for updated instructions.**

## [0.0.7] - 2025-08-08

### Fixed
- Fixed a bug with the task parser / manage-tasks tool refusing to find tasks.

### Updated
- Improved the task parser and created a task parser utility function to be shared across tools and UI.

## [0.0.6] - 2025-08-08

### Updated
- Refined the spec workflow guide to remove any ambiguity, made it more concise.
- Refined manage-tasks tool description.
- Refined request-approval tool description and next steps output.
- Refined create-spec-doc tool next steps output.

### Added
- Imporoved dashboard task parser and task counter to support Parent/Child task relationships otherwise known as subtasks.
    - Parent tasks if only including a name will be parsed as a Task Section Heading in the dashboard.
    - The parser should now be more flexible to handle tasks in various formats as long as they still follow the same checklist, task name, and status format at the very least.

## [0.0.5] - 2025-08-07

### Updated
- Refined spec workflow to include conditional web search for the design phase to ensure the agent is providing the best possible for all phases.

### Fixed
- Improved task progress cards to display all task information in the card.

## [0.0.4] - 2025-08-07

### Fixed
- Fixed clipboard copying functionality in dashboard for HTTP contexts (non-HTTPS environments)
- Added fallback clipboard method using `document.execCommand('copy')` for browsers without clipboard API access
- Improved copy button feedback with visual success/error states and colored indicators
- Enhanced mobile device compatibility for clipboard operations
- Removed development obsolete bug tracking functionality from dashboard frontend

## [0.0.3] - 2025-08-07

### Updated
- Updated README.md with example natural language prompts that will trigger the various tools.
- task-template.md updated to remove atomic task requirements and format guidelines and moved them to the spec workflow guide tool.
- Refined instructions for the agent to output the dashboard URL to the user.
- Removed the Steering Document Compliance section from tasks-template.md for simplification.

### Added
- I have added a session.json in the .spec-workflow directory that stores the dashboard URL and the process ID of the dashboard server. This allows the agent to retrieve the dashboard URL as well as the user if required. Note: This should help users one headless systems where the dashboard us unable to auto load, you can retrieve the session information from the json file.

### Fixed
- Misc fixes cause HEAP out of memory issues on the server causing the server to crash when running more than one instance.

### Added

## [0.0.2] - 2025-08-07

### Updated
- Updated README.md with showcase videos on youtube.
- Removed testing mcp.json file that was left over from initial development.

## [0.0.1] - 2025-08-07

### Added
- MCP server implementation with 13 tools for spec-driven development
- Sequential workflow enforcement (Requirements → Design → Tasks)
- Real-time web dashboard with WebSocket updates
- Document creation and validation tools
- Human-in-the-loop approval system
- Template system for consistent documentation
- Context optimization tools for efficient AI workflows
- Task management and progress tracking
- Cross-platform support (Windows, macOS, Linux)
- Support for major AI development tools (Claude Desktop, Cursor, etc.)
- Automatic project structure generation
- Dark mode dashboard interface
- GitHub issue templates
