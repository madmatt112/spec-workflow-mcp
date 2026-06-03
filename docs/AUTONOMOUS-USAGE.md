# Autonomous & Non-Interactive Usage

The stock workflow assumes a human watching the dashboard: the agent writes a
document, requests approval, and **waits** for a person to approve it before moving
on. The tools' returned instructions are written for that flow.

You can also drive the server **autonomously** — an agent (or a fleet of subagents)
running non-interactively, making every call itself, with a human checking in only at
phase boundaries or not at all. This page documents what that mode requires, which
stock instructions you must override, and which tool constraints are real versus
advisory.

> The patterns here are drawn from a working autonomous harness — a set of
> "spec-loop" prompts that run a per-phase adversarial-convergence loop on top of
> this server. They are referenced throughout as a **worked example**, not as
> something shipped in this repo.

## The two operating modes

| | Interactive (stock) | Autonomous |
|---|---|---|
| Who approves | A human, in the dashboard | Either a human at phase boundaries, or no one |
| Who runs the review | A dashboard-triggered fresh-context agent | A subagent the harness spawns itself |
| Waiting | The agent polls and waits for approval | The agent does not block on dashboard state |
| "Done" signal | Human approval | A caller-defined convergence verdict |

The server has **no dedicated autonomous code path**. Autonomy is achieved by the
caller *overriding* specific stock instructions, all of which are listed below.

---

## Enforced vs advisory

This is the single most important distinction for an autonomous caller: what the
tools actually reject versus what is merely guidance in a returned string. (Verified
against the handlers in `src/tools/` and `src/dashboard/approval-storage.ts`.)

**Enforced in code** — the call fails (`success: false`) if you violate these:

- `approvals` `request`: `filePath` must be relative; absolute paths and `..`
  traversal are rejected. `.md` files must pass MDX validation; `tasks.md` must pass
  structural validation.
- `approvals` `delete`: you **cannot** delete an approval whose status is still
  `pending` (`BLOCKED`).
- `log-implementation`: the `artifacts` field is required.
- `review-task` `record`: requires a prior `prepare`; the task and an implementation
  log must exist; verdict/findings must be consistent.

**Advisory only** — text in the returned strings, *not* enforced. An autonomous
caller can safely override these:

- **"Delete the prior approval before submitting the next."** Not enforced —
  `createApproval` writes a fresh record every call with no uniqueness check.
  **Coexisting pending approvals are allowed.** You may submit a new version's
  approval without deleting the previous one.
- **`BLOCKED` / `mustWait` / `canProceed:false` / `blockNext`** on `status`
  responses. These are flags and phrasing, not execution gates — the server does not
  block any subsequent tool call. Log them and continue.
- **"Verbal approval is never accepted; poll until approved."** The tool cannot force
  a human to approve. An autonomous loop that is not waiting on a human should not
  poll a status that will never change (see [headless](#headless-operation)).

---

## adversarial-review mechanics

Two non-obvious behaviors that an autonomous caller hits immediately:

### The prompt file is pre-created

`adversarial-review` **writes a scaffolded prompt to `promptOutputPath` itself**. If
you try to overwrite it with your tailored prompt without reading it first, your file
tool fails with a *"file has not been read yet"* error. The fix:

1. Call `adversarial-review`.
2. **Read** `promptOutputPath`.
3. **Overwrite** it with your tailored prompt.
4. Launch a fresh-context subagent with *exactly*:
   `Read and execute the instructions in <promptOutputPath>`

Put any extra directives (e.g. "verify claims against source", "read CLAUDE.md
first") **inside the prompt file**, never in the launch message — the methodology
deliberately keeps the launch message contextless so the review stays independent.

### Rolling memory for v2+

<a id="rolling-memory"></a>
For the second review onward, the scaffold reads and updates a rolling memory file:

```
.spec-workflow/specs/<name>/reviews/adversarial-memory-<phase>.md
```

It carries cumulative findings and "focus next on…" guidance across rounds, and asks
the reviewer to classify each finding as **Novel** (new), **Compounding** (deepens a
prior one), or **Recurring** (seen before, unresolved — *escalate* severity). Maintain
this file between rounds so a clean later round means "survived a fresh angle," not
"re-ran the last one."

---

## Iterate to converge

The server has **no native concept of convergence or a "this document is done"
verdict**, and no version cap. `adversarial-review` versions are unbounded
(`getNextVersion` returns `maxVersion + 1`). The stock flow implies a single pass:
write → review → approve.

If you want **iterate-until-clean**, you supply the gate yourself. The worked-example
loop does this by:

- Requiring every review subagent to end with a machine-readable verdict block, e.g.
  `VERDICT: converged | iterate` plus `MUST_FIX` / `SHOULD_FIX` / `MINOR` counts.
- Treating `MUST_FIX = 0 AND SHOULD_FIX = 0` from a **fresh** reviewer as converged.
- Imposing its own **hard cap (v6)** — a caller policy, since the server enforces no
  ceiling.
- Detecting a **standoff** (the same finding recurs as `MUST_FIX` and is rejected
  across two rounds) and escalating to a human.

The key design point: convergence is judged by a *fresh, grounded reviewer*, not
self-declared by the author agent. None of this is server behavior — it is policy you
layer on top.

---

## adversarial-response (non-interactive)

The `responseMethodology` returned by `adversarial-response` is written for a human:

> "Present the full assessment to the user. Do not make changes to the document until
> the user confirms… Delete the existing approval… Create a new approval."

In autonomous mode there is no user to present to. Override it as follows:

- **Assess each finding on its merits yourself** — Agree / Partially Agree / Disagree,
  with reasoning — and decide what to change. Do not ask for input.
- **Record each disposition** in a per-version revision-history section of the
  document. This is both the audit trail and the standoff-detection signal.
- **Write the revised document in place** (same path) as the next version and submit a
  **new** approval. You need not delete the prior approval or wait for it to leave
  `pending` (coexisting approvals are allowed — see
  [enforced vs advisory](#enforced-vs-advisory)).

---

## Task review (headless)

There are two task-review tools and the choice depends on whether a dashboard is
running:

- **With a dashboard**: a human clicks *Review* on the Tasks page, which spawns a
  fresh-context agent that calls `review-task` itself; the implementing agent then
  calls **`get-task-review`** to read the findings. The workflow guide tells the
  implementing agent "you do NOT call `review-task` directly."
- **Headless / no dashboard**: nobody will trigger that reviewer. The autonomous
  caller must **call `review-task` itself** (`prepare` → read files → `record`).
  `get-task-review` only *reads* an existing review — it never produces one.

To preserve independence, have a subagent that did **not** write the code run the
review. The worked-example implementation loop does exactly this: a separate review
subagent reports `VERDICT: pass | fix-required`, with `get-task-review` used only as
an optional adjunct if a dashboard review happens to exist.

---

## Headless operation

`spec-workflow-guide` returns `data.dashboardAvailable` (`true` only when a dashboard
URL is registered). **No tool changes its behavior based on this flag** — there is no
graceful headless degradation. When no dashboard is running:

- The guides fall back to advisory text ("Please start the dashboard with…").
- The approval gate still insists on dashboard/VS-Code approval, which a headless
  agent cannot satisfy in-band.

So a genuinely headless loop must **not wait** on approval state. Concretely, the
worked-example loops:

- never block on a dashboard action, approval change, or user input;
- treat `BLOCKED` / `canProceed:false` / `mustWait` as informational and continue;
- do not poll for state that only a human could change;
- replace the dashboard-triggered task review with an agent-driven one
  ([above](#task-review-headless)).

If you keep a human at phase boundaries (the recommended middle ground), the human
approves the converged document in the dashboard between runs, and the next run reads
that `approved` status once during orientation before advancing. Note the ambiguity:
because callers clean up approval records, an **absent** record must be treated as
*not approved* (it could be a deleted pending request), so leave an approved record in
place until the next phase has actually started.

> Headless caveat for MCP clients: interactively-authenticated MCP servers may be
> unavailable in cron/CI contexts. Ensure the spec-workflow server is reachable in
> the environment the loop runs in.

---

## Cross-spec feedback with deferrals

Autonomous loops run many specs back to back, so out-of-band discoveries need a
durable home. Use `deferrals` (a project-level store that persists across specs):

- During implementation, record anything that affects a **future** spec with
  `action: add`, `originPhase: implementation`, and tags.
- At the **start** of each spec's implementation, `deferrals` `action: list` and
  resolve any the current spec addresses.
- Surface still-open deferrals to a human at phase boundaries — they are the backlog
  the loop itself cannot close.

See [TOOLS-REFERENCE.md](TOOLS-REFERENCE.md#deferrals) for the full action list.

---

## Checklist for an autonomous harness

- [ ] Load `spec-workflow-guide` first; check `dashboardAvailable`.
- [ ] Read-then-overwrite the `adversarial-review` prompt file; launch the subagent
      with the exact contextless message.
- [ ] Maintain the rolling memory file for v2+ reviews.
- [ ] Define your own convergence verdict and version cap; don't expect the server to.
- [ ] Override `adversarial-response`'s "present to user / wait" instructions.
- [ ] Don't delete-before-resubmit or block on `BLOCKED` — both are advisory.
- [ ] Call `review-task` directly when headless; use `get-task-review` to read.
- [ ] Capture cross-spec discoveries via `deferrals`; surface open ones to a human.

## Related documentation

- [TOOLS-REFERENCE.md](TOOLS-REFERENCE.md) — per-tool parameters and returns
- [WORKFLOW.md](WORKFLOW.md) — the phase lifecycle
- [CONFIGURATION.md](CONFIGURATION.md) — `adversarial-settings.json`
