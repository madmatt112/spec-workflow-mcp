# Tools Reference

Complete reference for the MCP tools provided by Spec Workflow MCP.

The server registers **11 tools** (see `src/tools/index.ts`). This document is the
canonical reference for all of them. For the autonomous / non-interactive usage
patterns these tools support (and the constraints you can safely override when no
human is in the loop), see [AUTONOMOUS-USAGE.md](AUTONOMOUS-USAGE.md).

> **Workflow model.** Spec documents are written by the **agent reading the
> templates from `.spec-workflow/templates/` and writing the spec files directly**
> with its own file tools. There is no `create-spec-doc` / `get-template-context` /
> `manage-tasks` tool — task status is changed by editing `tasks.md` markers
> (`[ ]` pending, `[-]` in-progress, `[x]` completed). The tools below provide
> guidance, approval, status, review, and bookkeeping around that core loop.

## Tool index

| Tool | Purpose | Phase |
|------|---------|-------|
| [`spec-workflow-guide`](#spec-workflow-guide) | Load the full workflow methodology | Always first |
| [`steering-guide`](#steering-guide) | Load steering-doc methodology | Optional (steering) |
| [`decomposition-guide`](#decomposition-guide) | Load spec-decomposition methodology | Decomposition |
| [`approvals`](#approvals) | Request / check / delete dashboard approvals | Every phase boundary |
| [`spec-status`](#spec-status) | Progress overview for a spec | Any time |
| [`adversarial-review`](#adversarial-review) | Scaffold an independent critique of a document | Optional, per phase |
| [`adversarial-response`](#adversarial-response) | Get instructions to respond to a critique | Optional, per phase |
| [`deferrals`](#deferrals) | Track decisions deferred across specs | Cross-phase / cross-spec |
| [`log-implementation`](#log-implementation) | Record what a task implemented | Implementation |
| [`review-task`](#review-task) | Review a task's implementation against its spec | Implementation |
| [`get-task-review`](#get-task-review) | Retrieve stored task-review findings | Implementation |

Origin note: `spec-workflow-guide`, `steering-guide`, `spec-status`, `approvals`,
and `log-implementation` are inherited from upstream (Pimzino). `decomposition-guide`,
`adversarial-review`, `adversarial-response`, `deferrals`, `review-task`, and
`get-task-review` are **additions in this fork** — see [WORKFLOW.md](WORKFLOW.md).

---

## spec-workflow-guide

**Purpose**: Loads the complete workflow methodology. Call this **first** whenever a
user requests spec creation or feature development.

**Parameters**: none.

**Returns**: `data.guide` (the full markdown workflow), `data.dashboardUrl`, and
`data.dashboardAvailable` (`true` only if a dashboard URL is registered — see
[AUTONOMOUS-USAGE.md](AUTONOMOUS-USAGE.md) for what `false` means), plus a
`nextSteps` array.

The returned guide is authoritative and defines the phase sequence
**Decomposition → Requirements → Design → Tasks → Implementation**, the per-phase
approval cycle, and the hard rules below. Treat the guide as the source of truth;
this doc summarizes it.

**Key rules from the guide** (`src/tools/spec-workflow-guide.ts`):
- "Create ONE spec at a time." Feature names are kebab-case.
- Verbal approval is **never** accepted — approval status must be read from the
  dashboard/VS Code extension via `approvals` (`action: status`).
- After each document, request approval, poll, and **delete the approval before
  proceeding** to the next phase.

---

## steering-guide

**Purpose**: Loads the methodology for creating the three steering documents
(`product.md`, `tech.md`, `structure.md`). Call **only** when the user explicitly
asks for steering docs — it is not part of the standard per-spec flow.

**Parameters**: none.

**Returns**: `data.guide`, `data.dashboardUrl`, `nextSteps`.

Each steering doc goes through the same request → poll → delete approval cycle as a
spec document. Once steering docs exist, the workflow begins with **Decomposition**.

---

## decomposition-guide

> **Fork addition.** Not present upstream.

**Purpose**: Loads the spec-decomposition methodology — principles for breaking a
project (described by its steering docs) into a complete, ordered set of specs. This
is a **required step before the first spec** when steering docs exist.

**Parameters**: none.

**Returns**: `data.guide` (the decomposition methodology), `data.dashboardUrl`, and
`nextSteps` directing you to read the steering docs, apply the methodology, surface
open questions, and save the result to
`.spec-workflow/spec-decomposition/decomposition.md`.

The decomposition document is itself approvable — submit it via `approvals` with
`category: 'decomposition'`.

---

## approvals

**Purpose**: Manage dashboard approval requests. One tool, three actions.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | `'request' \| 'status' \| 'delete'` | Yes | The operation |
| `projectPath` | string | No | Project root (defaults to server context) |
| `approvalId` | string | for `status`/`delete` | The approval ID |
| `title` | string | for `request` | Brief title of what needs approval |
| `filePath` | string | for `request` | Path to the file, **relative to project root** |
| `type` | `'document' \| 'action'` | for `request` | Approval type |
| `category` | `'spec' \| 'steering' \| 'decomposition'` | for `request` | Approval category |
| `categoryName` | string | for `request` | Spec name, or `"steering"` for steering docs |

> Only pass `filePath` for requests — the dashboard reads the file itself. **Never**
> send document content.

**What is enforced in code** (handler returns `success: false`):
- `filePath` must be relative; absolute paths and `..` traversal are rejected.
- `.md` files are MDX-validated; `tasks.md` is structurally validated. Invalid
  content blocks the request.
- `delete` of a **pending** approval is hard-blocked (`BLOCKED: Cannot delete -
  status is "pending"`).

**What is advisory only** (returned as text, *not* enforced):
- "Delete the prior approval before submitting the next." `createApproval` mints a
  new id every call with no uniqueness check, so **coexisting approvals are
  permitted** by the tool.
- The `BLOCKED` / `mustWait` / `canProceed:false` flags on `status` responses are
  guidance, not execution gates — the server does not block subsequent tool calls.
- "Verbal approval is never accepted." This is a workflow rule the agent is asked to
  honor; the tool cannot force it.

See [AUTONOMOUS-USAGE.md](AUTONOMOUS-USAGE.md#enforced-vs-advisory) for the full
enforced-vs-advisory breakdown an autonomous caller needs.

**`status` response flags**: `isCompleted`, `canProceed` (`status === 'approved'`),
`mustWait`, `blockNext`, plus `nextSteps` and any dashboard reviewer comments
(surfaced individually for `needs-revision`).

**Revision cycle**: on `needs-revision` or after an adversarial response — update the
document, **delete** the old approval (`action: delete`, which now succeeds because
the status left `pending`), then `request` a new one with the **same `filePath`**.

---

## spec-status

**Purpose**: Progress overview for one spec. Call when resuming work or checking
completion.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `specName` | string | Yes | Spec name |
| `projectPath` | string | No | Project root (defaults to server context) |

**Returns**: `currentPhase`, `overallStatus`, per-phase detail with `approved`
flags, `taskProgress`, and best-effort `logCoverage` / `reviewCoverage` for completed
tasks. It will **warn** when completed tasks are missing implementation logs or
reviews, and its `nextSteps` reiterate the log → review → mark-complete ordering.

After viewing status, read `tasks.md` directly for the task markers.

---

## adversarial-review

> **Fork addition.** Not present upstream.

**Purpose**: Scaffold an independent, oppositional critique of a document
(requirements / design / tasks / a steering doc / the decomposition). The tool does
**not** run the review — it writes a self-contained prompt to disk for a
fresh-context subagent to execute.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `specName` | string | Yes | Spec name (kebab-case), `"steering"`, or `"decomposition"` |
| `phase` | string | Yes | Document to target: `requirements` / `design` / `tasks`; `product` / `tech` / `structure`; or `decomposition` |
| `filePath` | string | No | Relative path to the target (for steering docs outside the steering dir) |
| `projectPath` | string | No | Project root |

**Returns** (`data`): `version`, `targetFile`, `promptOutputPath`,
`analysisOutputPath`, `memoryFilePath`, the `methodology`, and context doc lists,
plus `nextSteps`.

**Critical behavior** — this trips up callers:
- **The tool pre-creates the prompt file at `promptOutputPath`.** To tailor it you
  must Read it first, then overwrite it (a blind write fails with a "file has not
  been read yet" error). Then launch a fresh subagent with *exactly*:
  `Read and execute the instructions in <promptOutputPath>` — put any extra
  directives **inside** the prompt file, not in the launch message.
- **Rolling memory.** For v2+ reviews the scaffold reads/writes
  `.spec-workflow/specs/<name>/reviews/adversarial-memory-<phase>.md` and asks the
  reviewer to classify findings as **Novel / Compounding / Recurring** (recurring →
  *escalate* severity). This cumulative context is what makes a clean later round
  meaningful.
- **Versioning is unbounded.** `getNextVersion` returns `maxVersion + 1` with no cap
  — files render `v1`, `-r2`, `-r3`, … Any version ceiling (e.g. the v6 cap in the
  loop prompts) is **caller policy, not server behavior**.
- **No convergence verdict.** The deliverables are "top risks / what's missing /
  conclusions to challenge." There is no built-in "converged" / "done" signal — if
  you want iterate-until-clean, you supply that gate (see
  [AUTONOMOUS-USAGE.md](AUTONOMOUS-USAGE.md#iterate-to-converge)).

The methodology can be overridden per project via the `reviewMethodology` key in
`.spec-workflow/adversarial-settings.json` (see [CONFIGURATION.md](CONFIGURATION.md)).

---

## adversarial-response

> **Fork addition.** Not present upstream.

**Purpose**: Locate the latest adversarial analysis for a phase and return structured
instructions for responding to its findings.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `specName` | string | Yes | Spec name, `"steering"`, or `"decomposition"` |
| `phase` | string | Yes | Document that was reviewed |
| `version` | number | No | Specific analysis version (defaults to latest) |
| `projectPath` | string | No | Project root |

**Returns** (`data`): `analysisFile`, `targetFile`, `version`, the
`responseMethodology`, and `nextSteps`.

**Stock instructions assume a human in the loop** — the returned methodology says to
*present the assessment to the user, not change the document until the user confirms,*
then *delete the old approval and resubmit*. For autonomous operation the agent makes
these calls itself; see
[AUTONOMOUS-USAGE.md](AUTONOMOUS-USAGE.md#adversarial-response-non-interactive) for
the non-interactive override.

Per-finding format: Finding → Assessment (Agree / Partially Agree / Disagree) →
Reasoning → Proposed action. The methodology can be overridden via the
`responseMethodology` key in `adversarial-settings.json`.

---

## deferrals

> **Fork addition.** Not present upstream.

**Purpose**: Record decisions that were explicitly deferred during spec work.
Deferrals are **project-level artifacts that persist across specs** — the channel for
surfacing "this affects a future spec" discoveries.

**Parameters** (by `action`):

| Action | Required | Notable optional |
|--------|----------|-------------------|
| `add` | `title`, `context`, `decision`, `revisitTrigger` | `originSpec`, `originPhase` (`requirements`/`design`/`tasks`/`implementation`), `tags`, `supersedes`, `revisitCriteria` |
| `list` | — | `status` (`deferred`/`resolved`/`superseded`), `originSpec`, `tag` |
| `get` | `id` | — |
| `resolve` | `id`, `resolution` | `resolvedInSpec` |
| `update` | `id` | `title`, `revisitTrigger`, `tags`, `context`, `decision`, `revisitCriteria` |
| `delete` | `id` | (fails if another deferral references it) |

`supersedes` auto-marks the older deferral as `superseded`. The workflow guide
instructs agents to run `deferrals` (`action: list`) at the **start of
implementation** and resolve any that the current spec addresses. Returns are terse
status messages — the lifecycle guidance lives in the workflow guide, not here.

---

## log-implementation

**Purpose**: Record what a task implemented. This builds a searchable knowledge base
future agents grep before writing new code.

**Parameters** (abbreviated — see the tool's own description for the full
`artifacts` schema): `specName`, `taskId`, `summary`, **`artifacts`** (required —
`apiEndpoints`, `components`, `functions`, `dataModels`, etc.), plus optional
context fields.

**Enforced**: the `artifacts` field is **required** — a missing/empty `artifacts`
returns `success: false`. This is a hard gate: a task without an implementation log
is not considered complete, and you must not flip `[-]` → `[x]` until
`log-implementation` returns success.

**Returns**: success message and `nextSteps` pointing to a code review (do **not**
self-review) and then marking the task complete.

---

## review-task

> **Fork addition.** Not present upstream.

**Purpose**: Review a task's implementation against its spec, then persist the
findings. Works for in-progress `[-]` and already-completed `[x]` tasks; reviewing
does not change task status.

**Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | `'prepare' \| 'record'` | Yes | Two-step flow |
| `specName` | string | Yes | Spec name |
| `taskId` | string | Yes | e.g. `"1"`, `"1.2"`, `"3.1.4"` |
| `verdict` | `'pass' \| 'fail' \| 'findings'` | for `record` | pass = clean; fail = ≥1 critical; findings = warnings/info only |
| `summary` | string | for `record` | Brief outcome |
| `findings` | array | for `record` | `{severity, title, file, line, description, taskRequirement, category}` |
| `projectPath` | string | No | Project root |

**Flow**: `prepare` (gathers task context + an implementation-log summary and
returns a skeptical-reviewer methodology, and writes a marker) → read the
implementation files → evaluate → `record`.

**Enforced**: `record` requires a prior `prepare`; the task and an implementation log
must exist; verdict/findings consistency is checked. On a `fail` verdict, `nextSteps`
say do not mark the task `[x]` until critical findings are resolved.

**Who calls it**: The workflow guide steers the implementing agent to **not** call
`review-task` directly — it expects a *dashboard-triggered fresh-context reviewer* to
call it, with the implementer retrieving results via `get-task-review`. **With no
dashboard, an autonomous caller must call `review-task` itself** (prepare → record).
See [AUTONOMOUS-USAGE.md](AUTONOMOUS-USAGE.md#task-review-headless).

> Note: `review-task`'s methodology tells reviewers **not** to escalate severity for
> recurring findings — the opposite of `adversarial-review`'s rule. This is
> intentional (code review vs. architecture review), but worth knowing.

---

## get-task-review

> **Fork addition.** Not present upstream.

**Purpose**: Retrieve the stored findings from a completed task review (dashboard- or
CLI-triggered, or one recorded via `review-task`).

**Parameters**: `specName` (req), `taskId` (req), `version` (optional, defaults to
latest), `projectPath` (optional).

**Returns**: `verdict`, `summary`, structured `findings`, and verdict-dependent
`nextSteps`. If no review exists it returns a message telling you to run one first —
`get-task-review` only **reads**; it never produces a review.

---

## Common patterns

**Per-phase loop** (requirements / design / tasks):
1. Read the template, write the document.
2. (Optional) `adversarial-review` → fresh subagent → `adversarial-response` →
   revise → resubmit, repeated until clean (caller-defined convergence).
3. `approvals` `request` → poll `status` → on approval, `delete` → next phase.

**Per-task loop** (implementation):
1. Mark `[ ]` → `[-]` in `tasks.md`.
2. Implement; call `log-implementation` (artifacts required).
3. Review: dashboard reviewer + `get-task-review`, or `review-task` directly when
   headless.
4. On a passing review, mark `[-]` → `[x]`.
5. Use `deferrals` to capture cross-spec discoveries.

**Error shape**: tools return `{ success: false, message }` on failure.

## Related documentation

- [WORKFLOW.md](WORKFLOW.md) — the phase lifecycle end to end
- [AUTONOMOUS-USAGE.md](AUTONOMOUS-USAGE.md) — non-interactive / headless operation
- [USER-GUIDE.md](USER-GUIDE.md) — driving the workflow as a user
- [CONFIGURATION.md](CONFIGURATION.md) — adversarial-settings and server config
