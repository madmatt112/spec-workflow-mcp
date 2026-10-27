# spec-workflow-mcp

The harness: an unattended delivery pipeline that takes a spec from queued to closed on an
operator's repositories, and stops only when it needs the operator.

## Language

**Operator**:
The one person who runs the harness, answers its waits and merges its work.
_Avoid_: user, human, Matthew (in documents)

**Project**:
A code repository the harness works on, together with its spec store.
_Avoid_: repo (when the spec store is meant too), workspace

**Spec**:
One unit of delivery: requirements, design, tasks, implementation with a pull request,
retrospective and close-out. Its documents are artifacts of a run, not the product.
_Avoid_: feature, ticket, story

**Spec store**:
The directory of a project's spec artifacts, kept in git next to the code or in its own
repository.
_Avoid_: workflow root, .spec-workflow (in prose)

**Run**:
The harness working one spec, from launch until the spec is closed. One thing to the
operator, even when several processes carry it.
_Avoid_: session, job, process

**Step**:
One role doing one job, as one headless process the controller spawns: draft the
requirements, review the design, implement a task, verify a task. A run is carried out as
a sequence of steps.
_Avoid_: agent (that is the role), subagent, spawn, turn

**Wait**:
A run's request for the operator's decision or attention. The only way a run speaks to the
operator.
_Avoid_: question, prompt, notification (that is how a wait is delivered, not the wait)

**Gate**:
A wait with a fixed set of questions, each with the run's recommended pick.
_Avoid_: checkpoint, approval

**Check**:
The deterministic test of one commit against the task or item it claims to do: the files it
may touch, its size, the project's check commands, and the risk tier that follows. Code
runs it; nobody answers it.
_Avoid_: review gate, gate (a Gate is a wait)

**Eval case**:
One harness role given a frozen brief and a fixed repository state, with code that decides
whether the role behaved as required. Each case comes from a failure the harness had.
_Avoid_: test (a test belongs to a project), scenario, benchmark

**Controller**:
The always-on part of the harness that holds the queue, starts and resumes runs, watches
capacity, and merges by rule. Code, never a model.
_Avoid_: supervisor, overwatch, daemon, orchestrator

**Launch**:
The operator putting a spec on the queue. The controller starts the run when it has capacity.
_Avoid_: start, kick off, spawn

**Slot**:
One of the controller's concurrent run positions. The controller carries a run only while
it holds a slot; a launched run with no slot waits in the queue.
_Avoid_: thread, worker, lane

**Window**:
A usage limit the subscription enforces over a rolling period, reported as how full it is
and when it resets. The controller holds runs back while a window is near full.
_Avoid_: quota, rate limit, budget, token cap

**Advisor**:
The model the operator talks to about any or all projects, the harness itself, and the
sources the operator names; also the one-shot second opinion on a wait. Alive only while
the operator uses it. Nothing in a run depends on it.
_Avoid_: overwatch, reviewer (that is a worker role), assistant

**State of the world**:
The controller's compiled view of every project, run, wait, open spec, PR and deferral:
a short summary the advisor reads at hello, the tallies of cost, failures and findings
over time, and the searchable records behind them. Code builds it; no one writes it by
hand.
_Avoid_: HUD, handoff, digest, dashboard (that shows it; it is not it)

**Second opinion**:
The advisor's picks on one wait, asked for by the operator and attached to the wait. A run
never asks for one and never waits for one.
_Avoid_: review, advice (too loose), recommendation (that is the wait's own pick)

**Staged action**:
Something the advisor wants done that changes shared state, such as a merge, a deploy, a
launch or a wait answer. It waits in the dashboard with the advisor's reason and happens
only when the operator confirms it there.
_Avoid_: pending action, proposal, request

**Source**:
A named thing outside the harness the operator wants the advisor to know: a repository, a
folder, a site, a system's MCP server, with one line saying what it is.
_Avoid_: context (too broad), connector

**Notebook**:
The advisor's own record of its conversations: one file per thread in the harness home,
with an index. Prose the advisor writes; the controller never reads it.
_Avoid_: memory, journal

**Push**:
One phone notification the harness sends for a new wait, naming only its kind, project
and spec.
_Avoid_: ping, alert

**Harness**:
The whole product: what launches runs, carries them, shows them, and takes the operator's
answers.
_Avoid_: SWM, the plugin, the server (those are parts)
