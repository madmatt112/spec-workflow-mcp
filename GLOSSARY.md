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

**Wait**:
A run's request for the operator's decision or attention. The only way a run speaks to the
operator.
_Avoid_: question, prompt, notification (that is how a wait is delivered, not the wait)

**Gate**:
A wait with a fixed set of questions, each with the run's recommended pick.
_Avoid_: checkpoint, approval

**Controller**:
The always-on part of the harness that holds the queue, starts and resumes runs, watches
capacity, and merges by rule. Code, never a model.
_Avoid_: supervisor, overwatch, daemon, orchestrator

**Launch**:
The operator putting a spec on the queue. The controller starts the run when it has capacity.
_Avoid_: start, kick off, spawn

**Advisor**:
The model the operator talks to about any or all projects, the harness itself, and the
sources the operator names; also the one-shot second opinion on a wait. Alive only while
the operator uses it. Nothing in a run depends on it.
_Avoid_: overwatch, reviewer (that is a worker role), assistant

**State of the world**:
The controller's compiled view of every project, run, wait, open spec, PR and deferral,
which the advisor reads at hello. Code builds it; no one writes it by hand.
_Avoid_: HUD, handoff, digest, dashboard (that shows it; it is not it)

**Source**:
A named thing outside the harness the operator wants the advisor to know: a repository, a
folder, a site, a system's MCP server, with one line saying what it is.
_Avoid_: context (too broad), connector

**Harness**:
The whole product: what launches runs, carries them, shows them, and takes the operator's
answers.
_Avoid_: SWM, the plugin, the server (those are parts)
