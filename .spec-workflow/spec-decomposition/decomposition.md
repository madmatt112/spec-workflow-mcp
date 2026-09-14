# Spec Decomposition — worktree execution context

## Why this document exists

`worktree-execution-context` was authored as a single spec covering twelve requirements and fourteen design components. Three rounds of adversarial review each closed the prior round's findings properly and each introduced new ones. Both lead findings of the third round were **cross-component** — defects invisible when reading any single component:

- `log-implementation`'s attribution write erasing the diff base recorded by the dashboard endpoint, because two components wrote one file with no stated merge semantics.
- A relative `SPEC_WORKFLOW_HOME` anchored to the workflow root, which is uncomputable at `server.ts:56`, equals the workspace under `--no-shared-worktree-specs`, and does not exist for the dashboard.

That is a size signal rather than a diligence signal. The work is decomposed into three specs whose boundaries are the seams those defects crossed.

## Decomposition principles applied

- **Vertical slices.** Each spec delivers a behaviour a user can observe, not a layer.
- **Independent value.** Spec 1 fixes the correctness defect on its own; 2 and 3 improve signal and cost but are not preconditions for it.
- **Traceable interaction surface.** Each spec is small enough that a reviewer can hold every cross-component path in view.
- **Dependency-ordered.** 2 and 3 both consume the workspace path that 1 introduces.

## Specs

### 1. `worktree-execution-context` — correct execution context (active)

Makes code-touching operations run against the worktree an agent is actually in, while `.spec-workflow` operations stay on the shared root.

Carries R1 (identity inference), R2 (explicit override), R3 (typed two-root `ToolContext`), R4 (`review-task` root split and file partitioning), R6 (runners carry both roots), plus verifiability and migration for that surface.

**Independently valuable:** on its own this stops a task review from diffing and typechecking the wrong checkout — the defect the whole effort exists to fix.

**End-to-end verification.** Create a repository with two linked worktrees sharing one `.spec-workflow`, start an MCP server in each, then confirm all six:

1. Both worktrees appear as **distinct projects** in the dashboard, sharing one spec list — and both appear when the two servers are started **simultaneously**, which is what exercises the registry lock.
2. A task review triggered from worktree A diffs **A's** files and not B's, and typechecks A's tree — asserted on the compiled file list, not just the reported `tsconfigPath`.
3. A task whose implementation log records **bare relative filenames** produces a non-empty diff from a worktree. This is the regression guard for the deleted path pre-resolution.
4. An adversarial review triggered from a worktree **locates its target document** (it reads from the shared root while the runner spawns in the worktree).
5. A review whose logged paths all fail to resolve reports **no reviewable files and does not return a pass**.
6. **Non-worktree parity:** a single-checkout project with no path argument produces the same file sets, containment decisions, `tsconfigPath` and `projectId` as before the change — except where `realpath` differs from `resolve`, which is a documented migration consequence.

Plus the full check suite: `npm run build` (bare `tsc` over `src/**/*`), `npm test`, `npm run test:e2e:worktree` — confirming from the run output that **both** worktree suites executed, since the config's `testMatch` previously pinned only one.

### 2. `worktree-review-signals` — what the reviewer is told (deferred)

Everything concerning the accuracy of the signal a reviewing agent receives: the diff base, typecheck honesty, workspace attribution, and the disclosure channel that carries all three into the prompt.

Carries R5 (per-task diff base), R7 (typecheck degrades honestly), R8 (attribution), R9 (disclosures reach the reviewing agent).

**Depends on 1** for `ToolContext.workspacePath` and the file partition. **Deferred** because its components share one on-disk store and one disclosure object, which is exactly the coupling that produced the third round's lead finding; it deserves its own requirements pass rather than inheriting a design written under a larger scope.

**End-to-end verification (to be refined in its own requirements phase).** A task started and committed on a worktree branch produces a diff covering the committed work; a worktree with unresolvable dependencies reports a typecheck that is unavailable rather than a flood of fabricated module errors; a review of work logged in worktree A but triggered from B reports a workspace mismatch and still produces a verdict.

### 3. `worktree-dashboard-concurrency` — cost and safety under N worktrees (deferred)

Keeps the dashboard's work constant in the number of worktrees, and makes concurrent writes to shared state safe.

Carries R10 (shared per-workflow-root components) and the remainder of R11 — locking for the four shared-root files other than the registry, the staleness and atomic-break mechanics, and the global-directory location question.

**Depends on 1** for per-worktree identity, which is what makes N registry entries and N component sets exist at all. **Deferred** because what remains prevents duplication and contention that only become visible once 1 has shipped.

**End-to-end verification (to be refined in its own requirements phase).** With three worktrees registered on one workflow root, the dashboard constructs one spec watcher rather than three and a scheduled cleanup pass runs once rather than three times; removing one project leaves the survivors' watcher alive; a relative `SPEC_WORKFLOW_HOME` is rejected at startup with an error naming the absolute form.

**Correction after design review v4.** The original wording — "nothing in it is a correctness fix for the reviewing path" — was wrong for one item. Spec 1 gives each worktree a distinct `projectId`, which converts `registerProject`'s read-modify-write from a benign convergence into a **lost-registration race**: two agents starting together each read the registry without the other, and the second write erases the first, so one worktree never appears in the dashboard and none of spec 1's route contracts can fire for it. Spec 1 creates that contention and no user configuration avoids it, so **a minimal registry lock moved into spec 1** (its Requirement 6). Everything else stayed here.

One further dependency runs the other way and is recorded rather than moved: `getGlobalDir()` resolves a relative `SPEC_WORKFLOW_HOME` against `process.cwd()`, so per-worktree agents each get their own registry and the dashboard sees none of them. Spec 1's headline observable is unreachable in that configuration. This spec owns the anchor; spec 1 records the dependency in its Scope section.

## Harness efficiency specs

Step 2 of `docs/harness-efficiency-plan.md` (R1, R2, R5 of the Harness Spend Review). Three
server-side tools that take work off the LLM roles of the SDD harness. Each is a vertical
slice: a tool, the skill change that calls it, and the docs. Step 0's facts are settled in
`docs/step-0-answers.md`; do not re-check them.

### 4. `review-gate` — deterministic gate before any LLM verifier (active)

**Delivers.** A `review-task` action `gate` that runs what `prepare` runs today (typecheck,
hygiene, diff stats) plus the task's named checks (scoped tests, lint on touched files, each
as its own command), scores risk from the diff, and returns `gate: pass | fail`,
`risk: low | high` and the reasons. It can record a verdict of its own (`reviewer: gate`) so
the dashboard and `spec-status` still see every task reviewed. The implementation and
close-out skills call it first: gate fail ⇒ one implementer fix round with the gate's output
and no verifier; pass with risk low ⇒ record `pass`, tick the task; pass with risk high ⇒
spawn `sdd-verifier` with the gate's results in its brief and the instruction not to re-run
them. In close-out, `store` and `home` items never get an LLM verifier (the gate checks the
diff exists and touches only the named files); `harness` and `code` items go through the
gate.

**Decided.** Conservative default: risk is high whenever any sensitive path is touched, more
than about 200 changed lines, or a task that names tests changed no test file. The sensitive
path list (API routes, schemas, migrations, auth, config, billing) lives in the project's
`agent-rules.md` under a machine-read heading, next to the forbidden-terms list that already
works that way; with no list, every path is sensitive. The end-to-end verification at the
completion gate and the PR checks gate stay as they are.

**End-to-end verification.** A fixture spec with three tasks and an `agent-rules.md` naming
one sensitive path: (1) a task that edits only a Markdown file returns `pass`, risk low, and
`get-task-review` shows a recorded verdict with `reviewer: gate`; (2) a task that touches the
sensitive path returns risk high, and the implementation skill's verifier brief for it carries
the gate's results; (3) a task whose named check fails returns `gate: fail` with the failing
command's one-line result and no verdict recorded. Then `spec-status` shows all three tasks
reviewed once they complete, and `npm test` is green.

**Depends on** nothing in this document. Independent of 5 and 6.

### 5. `spec-lint` — machine checks before every review round (active)

**Delivers.** A `spec-lint` tool that checks one spec document and reports findings with file
and line: every `path:line` and `path:a-b` citation resolves under the code root and the range
is inside the file, and when the sentence names an identifier it appears in the range; the MDX
bare-bracket check the approval already runs; EARS shape for acceptance criteria; tasks shape
(numbered, `_Prompt` closed with `_`, `_Requirements` ids that exist in `requirements.md`);
word counts against the caps (requirements 3,500, design 4,000, task block 150 plus prompt);
and, for tasks, coverage: every design component appears in some task, and a task that uses an
artefact a later task creates names its bridge. The document skill runs it after every drafter
or reviser write; findings go to `sdd-reviser` before the reviewer is spawned, and the round
prompt then says citations and structure are machine-verified, verify meaning only. The round
prompt also carries the document's diff since the last checkpoint commit.

**Decided.** The lint is additive: it never approves or rejects a document on its own, and a
finding it cannot classify is reported as `info`. Caps are tool defaults matching the
templates; a project overrides them in `agent-rules.md`. Citation checks read the code root
the server already resolves (`ToolContext`), not a path in the document.

**End-to-end verification.** A fixture spec whose requirements carry one broken citation, one
bare angle bracket, one non-EARS criterion and 200 words over the cap, and whose tasks carry
one unclosed `_Prompt`, one `_Requirements` id that does not exist and one design component no
task names: the tool reports each of the seven with its line and nothing else; a clean fixture
reports zero findings. A document-phase run on the fixture shows the reviser brief with the
lint findings before round 1 and the round-1 prompt containing the diff since the v1
checkpoint. `npm test` is green.

**Depends on** nothing in this document. Independent of 4 and 6.

### 6. `harness-bookkeeping` — orient, briefs and events done by tooling (active)

**Delivers.** Two tools and two hook changes that let the orchestrators only route. `harness
orient` returns, for any spec and phase, the state the skill's Step 0 computes today (document
version D, latest analysis A, last verdict, post-cap marker, tasks done and open, the next step
to take) in one call. `harness brief` writes a brief from a named template with the values
filled; for an implementer brief it extracts the task block with the server's tasks parser.
The plugin's `PreToolUse` hook writes `spawn.start` from the brief path in an Agent prompt (the
path names the role) and `SubagentStop` writes `spawn.end`; the orchestrator keeps writing
only `round`, `task.pick`, `task.done`, `note` and `phase.*`, plus one usage event per spawn
with the token count from the Agent result. The watch renderer merges the two files as it does
today. The HANDOFF `## Phase log` table is rendered from `harness-events.jsonl` the way
`spec-index` renders INDEX, and the supervisor stops hand-writing rows. Budgets in the skills
assume the smaller orchestrator context (20 tasks, all items of a class).

**Decided.** `SubagentStop` carries no usage (`docs/step-0-answers.md`, answer 2), so tokens
stay an orchestrator-written event; the renderer sums them per spawn. Both tools live in the
server, not a plugin CLI, because the parsers, `spec-status` and the approvals snapshots are
there. `--watch` must keep working with ledgers written before this spec, and old HANDOFF
tables are left as they are: rendering starts at the first `phase.start` in the ledger.

**End-to-end verification.** (1) `harness orient` against a fixture spec at each of five
states (no document, mid-review, post-cap without narrow check, implementation with a `[-]`
task, close-out with open items) returns the step the corresponding skill's Step 0 chooses.
(2) `harness brief` for task 3 of the fixture writes a file whose task block equals the parser's
block for task 3, byte for byte. (3) A session with the hooks installed, spawning one `sdd-*`
agent with a brief path in its prompt, appends `spawn.start` and `spawn.end` with the right
role and no orchestrator call. (4) `--watch --once` on a copy of the `tags-and-setups` and
`calendar-and-breakdowns` ledgers from `tradr-hosted` renders every phase, spawn and token
total it renders today. (5) The phase-log renderer, run on `calendar-and-breakdowns`' ledger,
produces the rows its hand-written table holds for phases that ran under a ledger.

**Depends on** nothing in this document for correctness. **Last** because it changes every
skill and the hooks; 4 and 5 land first so their skill changes are not rewritten twice.

## Build order

1 → (2 and 3 in either order). 2 and 3 are independent of each other.

4 → 5 → 6 in that order. Each is independently shippable and gets its own release; 6 is last
because it changes every skill and the hooks. Do not start the plan's step 3 before 6 is
released.

## Boundary notes

- **`TaskStateStore` belongs to 2, not 1.** Spec 1 records nothing per task.
- **The registry's *location* belongs to 3**, with its *content* (per-worktree identity, realpath normalization) in 1. Spec 1 registers correctly; spec 3 makes concurrent registration safe and decides where the global directory lives.
- **Typecheck root selection is in 1** (it must run in the workspace); **typecheck honesty is in 2** (whether its output can be trusted). The split is deliberate: 1 makes it run in the right place, 2 makes it tell the truth about whether it ran.
- **The execution-context disclosure object is in 2.** Spec 1 emits no new reviewer-facing channel.

## Open question deferred to spec 2

R7 AC 6 requires new typecheck `unavailable` reasons to be added to a byte-pinned methodology constant whose drift test compares against a different spec's gitignored requirements file. That criterion moves to spec 2 and is to be amended there, with the resulting divergence recorded as a deferred decision against `tighter-reviews`.
