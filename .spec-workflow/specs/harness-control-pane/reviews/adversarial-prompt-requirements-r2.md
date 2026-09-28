# Adversarial Review — harness-control-pane/requirements (v2)

Tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/requirements.md

## Execution context
- Workspace: /home/mcf/repo/spec-workflow-mcp
- Workflow root: /home/mcf/repo/spec-workflow-mcp

## Prior review context

This is review v2. Before attacking the target document:

1. Read the rolling memory file at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-memory-requirements.md (it may not exist yet — the file is created/updated by each v2+ review).
2. Read the latest prior analysis at /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements.md to understand what was found most recently.
3. Classify each finding you produce as one of:
   - **Novel**: not identified in any prior review.
   - **Compounding**: builds on or deepens a prior finding.
   - **Recurring**: same issue identified before but not yet resolved — escalate severity.
4. Focus on novel and compounding issues. Do not re-discover known findings unless they remain unresolved.
5. After completing your analysis, write an UPDATED memory file to /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-memory-requirements.md using this format:

```markdown
# Adversarial Review Memory — requirements
Last updated: <today's date> (after v2 review)

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

## Analysis approach

Before writing your analysis, read the target document. Then identify **3–6 specific topics, decisions, or sections** to attack — name actual headings, claims, or structures from the document. For each, list **3–5 directive bullets** grounded in the document's concrete content. Frame bullets as directives ("Challenge the claim that…", "Stress-test the assumption that…"), not questions. Do not write generic advice.

**Primary attack surface for this phase:** Completeness, ambiguity, scope

**Example attack angles to consider:** Missing user stories, unstated assumptions, scope creep risk, contradictions between stories, acceptance criteria that can't be tested

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Standing directives

- Ground every claim in the real codebase. Read the files the document cites before you judge them. A misstated artifact (wrong path, wrong line range, wrong signature, wrong behaviour) is an automatic MUST_FIX.
- Attack the deltas since the previous version first, then apply one fresh lens the prior rounds did not use.
- Rulings recorded in the document's Revision History are closed. Do not re-open them.
- Do not pad. MINOR-only findings do not keep the loop alive. A clean round is a valid result: show your work (what you checked and how) and say converged.
- Severity: MUST_FIX = contradiction, false claim about the codebase, unimplementable requirement, data or security hole. SHOULD_FIX = a real gap that causes rework or a wrong implementation. MINOR = wording, a value safely left to a later phase, nice-to-have.
- ESCALATE only when a human should look now: security, secrets, auth bypass, data loss, destructive migrations, money, billing, pricing, legal or compliance. Otherwise write `ESCALATE: none`.

## Verdict block

End the analysis file with exactly this block, values filled in:

```
VERDICT: converged | iterate
MUST_FIX: <n>
SHOULD_FIX: <n>
MINOR: <n>
DESIGN_READY: yes | no
ESCALATE: none | <one-line reason a human should look now>
```

`converged` requires MUST_FIX = 0 and SHOULD_FIX = 0.

## Output
Write your analysis to: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements-r2.md

## This round

- Read `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/codebase-context.md` first; it maps the code this document cites. Start your code reads from it.
- Version under review: v2.
- Machine-verified: `spec-lint` ran citation-path, citation-range, citation-unchecked, citation-bare, citation-identifier, mdx, caps-invalid, ears-shape, doc-words on v2 before the lint pass fixed anything, and the post-fix run is clean (0 findings). A rule with no finding listed here passed: verify meaning only for it. Re-verify only citations the v2 lint commit changed: the `## Lint commit` section below. Still open (error = MUST_FIX candidate, warning = your call, info = a note): none.
- Changes: the diff from the newest `docs(sdd): harness-control-pane requirements v1` commit to the working tree follows as `## Changes since <short sha>`, cut at 500 lines, with the `## Lint commit` diff after it.
- Read the Revision History line for v2 first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R1-<n>`, naming the round-1 finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-2 MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch; the label is guidance and does not change the round budget.
- Fix-induced re-check: when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix's diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.
- Note: v2 accepted all five round-1 findings (R1-1 ledger-format reconciliation, R1-2 websocket subscribe/message contract in AC 4.8/4.9/5.10, R1-3 provider-split AC 2.4, R1-4 provider-conditional AC 1.6, R1-5 read-only ordering AC 1.1), then a lint pass trimmed the body from 4032 to 3500 words to meet the cap and rewrote several citations. Attack whether the trim dropped any normative content or left a citation pointing at the wrong range, and whether the R1 fixes are internally consistent (for example AC 4.8's message list vs AC 4.9's "AC 4.8 messages" reference; AC 2.4's deepseek delivery path vs AC 2.6's merge; the AC 2.9 keys vs the scope-note boundary reconciliation).
- Fresh lens for this round: every cited artifact re-read at both ends of its range (the lint pass changed many citations; confirm each cited range still says what the AC claims).
- Closed by ruling, do not re-open: none.
- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.
- Rolling memory file: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-memory-requirements.md`. Read it first and rewrite it after your analysis, as the scaffold says.
- Code lives under `/home/mcf/repo/spec-workflow-mcp`; the spec store under `/home/mcf/repo/spec-workflow-mcp/.spec-workflow`. Use absolute paths. Project rules for reading code and running checks: `/home/mcf/repo/spec-workflow-mcp/.spec-workflow/agent-rules.md`.
- Do not edit the document or any file other than your analysis and the memory file.

## Code graph
Graph: `/home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json` (the code graph of the code root).
- `graphify explain "<symbol>" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one symbol and its edges. Use it first.
- `graphify path "A" "B" --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: the chain between two symbols.
- `graphify query "<terms>" --budget 800 --graph /home/mcf/repo/spec-workflow-mcp/graphify-out/graph.json`: one area; take the terms from the graph's labels.
Rule: run `explain` on a symbol before you open its code file, then read only the cited range to confirm it. Never use the graph for the spec store. When `explain` prints "No node matching", read the file as before. An `[INFERRED]` edge is never a citation. A citation in a document or the context file names a range you read.
A `file:line` from the graph is a hint to confirm, not a citation.

## Changes since 9bad645

````diff
diff --git a/.spec-workflow/specs/harness-control-pane/requirements.md b/.spec-workflow/specs/harness-control-pane/requirements.md
index c970433..f33d416 100644
--- a/.spec-workflow/specs/harness-control-pane/requirements.md
+++ b/.spec-workflow/specs/harness-control-pane/requirements.md
@@ -2,70 +2,70 @@
 
 ## Introduction
 
-This spec adds a Harness page and an Overview page to the existing dashboard: the Harness page sets up, launches, stops and watches one SDD run of one project, and the Overview page shows the harness work of every registered project and the operator to-do list on one screen. It is for the operator who today launches runs by hand with `continue the sdd process` or a `claude -p` script and watches them in the `--watch` TUI. It changes the supervisor skill so that it honours a per-run setup file, and it changes nothing in the ledger format or in the TUI renderer.
+This spec adds a Harness page and an Overview page to the existing dashboard: the Harness page sets up, launches, stops and watches one SDD run of one project; the Overview page shows every registered project's harness work and the operator to-do list on one screen. It replaces launching runs by hand with `continue the sdd process` or `claude -p` and watching them in the `--watch` TUI, and changes the supervisor skill to honour a per-run setup file. The only ledger change is two provenance keys on the `run.start` row of a run that applied the file (decomposition entry, spec-decomposition/decomposition.md:665-667); every other key and the TUI renderer are unchanged, and a run with no file writes the same `run.start`.
 
 ## Alignment with Product Vision
 
-The spec store has no steering documents, so this section aligns with the decomposition entry for spec 9. That entry puts the control pane last in the harness operations order because it renders what specs 8, 10 and 11 record: per-spawn tokens and models, the provider map and the task `tdd` block. The pane reuses the data layer the TUI already has, so the page and the TUI can never disagree about a run.
+The spec store has no steering documents, so this aligns with the decomposition entry for spec 9, which puts the control pane last: it renders what specs 8, 10 and 11 record (per-spawn tokens and models, the provider map, the task `tdd` block), reusing the TUI's data layer so the page and TUI cannot disagree about a run.
 
 ## Requirements
 
 ### Requirement 1 — Run setup
 
-**User Story:** As the operator, I want a page that lists the specs of a project and a form that sets up one run, so that I choose the models and options of a run without editing agent frontmatter or the agent rules.
+**User Story:** As the operator, I want a page listing a project's specs and a form to set up one run, so that I choose a run's models and options without editing agent frontmatter or the agent rules.
 
 #### Acceptance Criteria
 
-1. WHEN the operator opens the Harness page for a project THEN the system SHALL list the specs of that project's spec store in the order INDEX.md renders them (the categorization and routing of src/core/index-generator.ts:44-82), each with its current phase, and SHALL mark the spec that the routing names as active.
+1. WHEN the operator opens the Harness page for a project THEN the system SHALL list that project's specs in the order INDEX.md renders them, each with its current phase, and SHALL mark the spec the routing names as active. The page SHALL reuse the categorization, ordering, current-phase and routing logic of `src/core/index-generator.ts` through a read-only function, and SHALL NOT call the generator's INDEX.md write path (src/core/index-generator.ts:70-72).
 2. WHEN the Harness page lists the specs THEN the system SHALL NOT write INDEX.md or any other file in the spec store.
-3. WHEN the HANDOFF routing header names the active spec THEN the system SHALL show the live phase, state and last result that the header carries for that spec.
-4. WHEN the Harness page renders the run form THEN the system SHALL show one row per agent in the build's agent profiles (thirteen agents at harness/agent-profiles.json:1-80) plus one row for the supervisor, each with a model field pre-filled with the declared model, and the declared effort shown read-only with the reason "effort is per agent, not per run".
-5. WHEN the run form renders THEN the system SHALL pre-fill the supervisor model field with `claude-opus-5-5`, and SHALL show the supervisor effort as `high`, read-only.
-6. IF a model field holds a value that is neither a model alias the design lists nor a full model id that starts with `claude-` THEN the system SHALL refuse to save the form and SHALL name the field and the value.
-7. WHEN the run form renders THEN the system SHALL show a provider field only for the roles the provider validator allows (reviewer, checker and reviser, per harness/skills/sdd-continue/references/sdd-providers.sh:21-29), pre-filled from the project's provider map in the agent rules, or `anthropic` when the map is absent.
+3. WHEN the HANDOFF routing header names the active spec THEN the system SHALL show the live phase, state and last result the header carries for that spec.
+4. WHEN the Harness page renders the run form THEN the system SHALL show one row per agent in the build's agent profiles (thirteen agents at harness/agent-profiles.json:1-80) plus one supervisor row, each with a model field pre-filled with the declared model and the declared effort shown read-only.
+5. WHEN the run form renders THEN the system SHALL pre-fill the supervisor model field with `claude-opus-5-5` and SHALL show the supervisor effort as `high`, read-only.
+6. Model-field validation SHALL be provider-conditional: IF an `anthropic` role holds a model that is neither a model alias the design lists nor a full id starting with `claude-`, OR a `deepseek` role holds a model that is not one of the two DeepSeek models the validator allows (harness/skills/sdd-continue/references/sdd-providers.sh:28-29), THEN the system SHALL refuse to save and SHALL name the field and value. A `claude-` id or alias is valid only on an anthropic role, a DeepSeek model only on a deepseek role.
+7. WHEN the run form renders THEN the system SHALL show a provider field only for the roles the validator allows (reviewer, checker and reviser, harness/skills/sdd-continue/references/sdd-providers.sh:21-29), pre-filled from the project's provider map, or `anthropic` when the map is absent.
 8. IF the operator sets a role's provider to `deepseek` THEN the system SHALL require one of the two DeepSeek models the validator allows as that role's model.
-9. WHEN the run form renders THEN the system SHALL show a worktree choice (yes or no) and a gates choice (block or record), pre-filled from the project's agent rules (`worktree-per-change` and `gates` keys), else `no` and `block`.
-10. WHEN the run form renders THEN the system SHALL offer only the spec the routing names as active as the run's spec; IF the routing names no active spec THEN the system SHALL disable the form and SHALL show the routing reason.
-11. WHEN the operator saves the form THEN the system SHALL write `.spec-workflow/harness-run.json` in the project's spec store with the spec, the time written, the supervisor model, the model and provider per role, the worktree choice and the gates choice.
+9. WHEN the run form renders THEN the system SHALL show a worktree choice (yes or no) and a gates choice (block or record), pre-filled from the agent rules (`worktree-per-change` and `gates` keys), else `no` and `block`.
+10. WHEN the run form renders THEN the system SHALL offer only the routed active spec as the run's spec; IF the routing names no active spec THEN the system SHALL disable the form and show the routing reason.
+11. WHEN the operator saves the form THEN the system SHALL write `.spec-workflow/harness-run.json` in the spec store with the spec, the time written, the supervisor model, the model and provider per role, the worktree choice and the gates choice.
 12. WHEN a role's saved values equal its declared defaults THEN the system SHALL omit that role from the file.
 
 ### Requirement 2 — The supervisor honours the setup file
 
-**User Story:** As the operator, I want the supervisor to apply the saved setup to one run, so that a run launched from the page or from a terminal uses the models and options I chose.
+**User Story:** As the operator, I want the supervisor to apply the saved setup, so that a run launched from the page or a terminal uses the models and options I chose.
 
 #### Acceptance Criteria
 
 1. WHEN the supervisor starts a run and the spec store holds a `harness-run.json` whose spec is the active spec THEN the supervisor SHALL apply it and SHALL print one line naming the file and the time it was written.
 2. IF the spec store holds a `harness-run.json` whose spec is not the active spec THEN the supervisor SHALL print one warning line naming both specs and SHALL run as if the file did not exist.
 3. WHEN the file sets a model for an orchestrator THEN the supervisor SHALL pass that model as the Agent tool's `model` parameter on each spawn of that orchestrator, in place of the no-model spawn of harness/skills/sdd-continue/SKILL.md:226-228.
-4. WHEN the file sets a model for a worker role THEN the supervisor SHALL pass the worker overrides to each orchestrator in its launch prompt, and each orchestrator SHALL pass the matching `model` parameter on each Agent-tool spawn of that role.
-5. WHEN the model pre-flight checks an orchestrator whose model the file overrides THEN the supervisor SHALL expect the overridden model and not the declared one.
-6. WHEN the file sets a provider for a role THEN the supervisor SHALL merge it over the agent rules' provider map, SHALL validate the merged map with the same rules as the provider preflight (eligible roles, allowed providers, allowed models, required key exported), and SHALL refuse the run before any ledger row on a failed validation, as harness/skills/sdd-continue/SKILL.md:85-96 does.
+4. WHEN the file sets a model for a worker role THEN the supervisor SHALL pass the worker overrides to each orchestrator in its launch prompt, and each orchestrator SHALL deliver the override by the role's provider: an anthropic worker gets the `model` parameter on each Agent-tool spawn; a deepseek worker, which runs as `bash <LAUNCHER> <agent> "<launch message>"` not through the Agent tool (harness/skills/sdd-document-phase/SKILL.md:24-34), gets the overridden model only in the merged provider map (`<agent>:deepseek:<model>`, harness/skills/sdd-continue/references/sdd-providers.sh:72-74), never as an Agent-tool parameter.
+5. WHEN the model pre-flight checks an orchestrator whose model the file overrides THEN the supervisor SHALL expect the overridden model, not the declared one.
+6. WHEN the file sets a provider for a role THEN the supervisor SHALL merge that role's provider and, for a deepseek role, its model over the agent rules' provider map, SHALL validate the merged map with the provider preflight's rules, and SHALL refuse the run before any ledger row on a failed validation, as harness/skills/sdd-continue/SKILL.md:85-96 does.
 7. WHEN the file sets the gates choice THEN the supervisor SHALL use it in place of the agent rules' `gates` key for both gates of this run.
 8. WHEN the file sets worktree to yes THEN the supervisor SHALL apply the worktree rule of harness/skills/sdd-continue/SKILL.md:336-345 as if the agent rules required it; WHEN it sets no THEN the supervisor SHALL NOT enter a worktree.
 9. WHEN the supervisor writes `run.start` for a run that applied the file THEN the row SHALL carry an `overrides` key listing each overridden role and its model and provider, and SHALL carry `setup=harness-run`.
 10. WHEN a run that applied the file ends THEN the supervisor SHALL delete the file at the same step that writes `run.end` and removes the pointer line.
-11. WHEN a run starts with no `harness-run.json` in the spec store THEN the supervisor SHALL behave exactly as today, and the `run.start` row SHALL carry no `overrides` or `setup` key.
+11. WHEN a run starts with no `harness-run.json` THEN the supervisor SHALL behave exactly as today, and the `run.start` row SHALL carry no `overrides` or `setup` key.
 
 ### Requirement 3 — Launch and stop
 
-**User Story:** As the operator, I want to launch and stop a run from the page, so that I do not need a terminal to drive a headless run.
+**User Story:** As the operator, I want to launch and stop a run from the page, so that I need no terminal to drive a headless run.
 
 #### Acceptance Criteria
 
-1. WHEN the operator presses Launch THEN the system SHALL save the form as Requirement 1 AC 11 describes with the gates choice set to record, and SHALL then spawn `claude -p` with the prompt `continue the sdd process`, the supervisor model, effort `high` and the other flags of the documented headless command (docs/SDD-HARNESS.md:244-248).
-2. WHEN the system spawns the run THEN it SHALL use the child-process pattern of src/dashboard/adversarial-runner.ts:156-220: a scrubbed git environment, `cwd` the project checkout (or the worktree of AC 3), and the workspace and shared-root variables set on the environment.
-3. WHEN the operator launches with worktree `yes` THEN the system SHALL create a git worktree of the project checkout on branch `feat/` plus the spec name, or reuse it when it exists, SHALL run the agent rules' `worktree-setup` command once in a newly created worktree, and SHALL spawn the child with that worktree as `cwd`.
-4. WHEN the child is spawned THEN the system SHALL spawn it detached in its own process group, SHALL write its stdout and stderr to a log file outside the repository, and SHALL record the pid, the process group, the project, the spec, the log path and the launch time in a launch record outside the repository.
+1. WHEN the operator presses Launch THEN the system SHALL save the form as Requirement 1 AC 11 describes with the gates choice set to record, and SHALL spawn `claude -p` with the prompt `continue the sdd process`, the supervisor model, effort `high` and the other flags of the documented headless command (docs/SDD-HARNESS.md:244-248).
+2. WHEN the system spawns the run THEN it SHALL use the child-process pattern of src/dashboard/adversarial-runner.ts:156-220: a scrubbed git environment, `cwd` the project checkout (or the AC 3 worktree), and the workspace and shared-root variables on the environment.
+3. WHEN the operator launches with worktree `yes` THEN the system SHALL create a git worktree of the checkout on branch `feat/` plus the spec name (or reuse it), SHALL run the agent rules' `worktree-setup` command once in a new worktree, and SHALL spawn the child with that worktree as `cwd`.
+4. WHEN the child is spawned THEN the system SHALL spawn it detached in its own process group, SHALL write its stdout and stderr to a log file outside the repository, and SHALL record the pid, process group, project, spec, log path and launch time in a launch record outside the repository.
 5. WHEN the child writes output THEN the system SHALL stream the new log lines to that project's open Harness pages over the existing websocket.
-6. WHEN the supervisor appends its pointer line and `run.start` THEN the system SHALL add the run id to the launch record and SHALL show it on the page.
-7. IF the pointer file (`${XDG_STATE_HOME:-~/.local/state}/sdd/active-run`) holds a line whose spec dir is inside this project's spec store THEN the system SHALL refuse a launch with HTTP 409 and SHALL name the live run id.
+6. WHEN the supervisor appends its pointer line and `run.start` THEN the system SHALL add the run id to the launch record and show it on the page.
+7. IF the pointer file (`${XDG_STATE_HOME:-~/.local/state}/sdd/active-run`) holds a line whose spec dir is inside this project's spec store THEN the system SHALL refuse a launch with HTTP 409 and name the live run id.
 8. IF the project has a live dashboard launch record whose process still exists THEN the system SHALL refuse a launch with HTTP 409 even before the pointer line appears.
 9. WHEN the operator presses Stop THEN the system SHALL send SIGTERM to the child's process group, and SHALL send SIGKILL to the group if it still exists ten seconds later.
-10. WHEN a stopped child has exited THEN the system SHALL append a `run.end` row with status `stopped from the dashboard` to the spec's ledger when the run has a `run.start` and no `run.end`, SHALL remove only this run's line from the pointer file, SHALL delete `harness-run.json`, and SHALL show the run as stopped.
+10. WHEN a stopped child has exited THEN the system SHALL append a `run.end` row with status `stopped from the dashboard` when it has a `run.start` and no `run.end`, SHALL remove only this run's line from the pointer file, SHALL delete `harness-run.json`, and SHALL show the run as stopped.
 11. WHEN the child exits on its own THEN the system SHALL NOT write `run.end` or touch the pointer file, and SHALL show the exit code.
 12. WHEN the dashboard process stops or restarts THEN the system SHALL leave a launched run running, and after a restart SHALL read the launch record back so the page shows the run, its log and a working Stop.
-13. WHEN the system removes a pointer line THEN it SHALL rewrite the file without the line and SHALL delete the file when no line remains, the same rule as the supervisor's deregister step (harness/skills/sdd-continue/SKILL.md:488-500).
+13. WHEN the system removes a pointer line THEN it SHALL rewrite the file without the line and delete the file when no line remains, the same rule as the supervisor's deregister step (harness/skills/sdd-continue/SKILL.md:488-500).
 
 ### Requirement 4 — Live view
 
@@ -73,38 +73,41 @@ The spec store has no steering documents, so this section aligns with the decomp
 
 #### Acceptance Criteria
 
-1. WHEN a Harness page is open for a project THEN the system SHALL watch the active spec's event ledger, activity file, `tasks.md` and HANDOFF with the same chokidar options as src/watch/index.ts:101-104.
-2. WHEN a watched file changes THEN the system SHALL build the run model with the existing model builder of src/watch/ledger.ts:243-457 and SHALL push it to that project's websocket clients within five seconds of the append.
-3. WHEN the page receives a run model THEN it SHALL render the run header (spec, code root, worktree, run id, uptime, tokens, providers), the phase rows, the live phase, the spawn tree with role, declared and actual model, provider and tokens, the round rows, the task picks and the ticker, without a page reload.
-4. WHEN the run is in the implementation phase THEN the page SHALL show each task row with its latest review verdict and `tdd` block from the existing task-review summary route (src/dashboard/multi-server.ts:1965-1989).
+1. WHEN a Harness page is open for a project THEN the system SHALL watch the active spec's event ledger, activity file, `tasks.md` and HANDOFF with the chokidar options of src/watch/index.ts:101-104.
+2. WHEN a watched file changes THEN the system SHALL build the run model with the existing model builder of src/watch/ledger.ts:243-457 and push it to that project's websocket clients within five seconds of the append.
+3. WHEN the page receives a run model THEN it SHALL render, without a reload, the run header (spec, code root, worktree, run id, uptime, tokens, providers), the phase rows, the live phase, the spawn tree (role, declared and actual model, provider and tokens), the round rows, the task picks and the ticker.
+4. WHEN the run is in the implementation phase THEN the page SHALL show each task row with its latest review verdict and `tdd` block from the task-review summary route (src/dashboard/multi-server.ts:1965-1989).
 5. WHEN the spec directory holds `questions.md` THEN the page SHALL show its gate A and gate B sections as recorded, read-only, with no control that answers them.
 6. WHEN a spawn has no tokens or the build has no agent profiles THEN the page SHALL render the row without them.
-7. WHEN no Harness page of a project is open THEN the system SHALL NOT keep a harness watcher running for that project.
+7. WHEN no Harness page of a project is open THEN the system SHALL NOT keep a harness watcher running for that project (keyed on the harness-subscriber count of AC 4.8, not `connection.projectId`).
+8. WHEN a Harness page opens for a project THEN it SHALL send a subscribe message whose `type` names the harness view, distinct from the Specs page's `subscribe`, so the server can tell the two apart on one `projectId` — the existing socket binds each connection to a single `connection.projectId` and knows only the `subscribe`, `initial` and `projects-update` messages (src/dashboard/multi-server.ts:205-294) — and SHALL key the AC 4.7 watcher lifecycle on the harness-subscriber count for that project.
+9. WHEN the server pushes to a Harness page THEN each message SHALL carry a type field the page demultiplexes, distinct from the AC 4.8 messages: one for the run model, one for a batch of new log lines, one for the gate sections; the run-model and gate pushes SHALL reach only that project's harness subscribers via the existing `broadcastToProject` (src/dashboard/multi-server.ts:2139-2151).
 
 ### Requirement 5 — Overview page
 
-**User Story:** As the operator, I want one page that shows the harness work of every project on the machine and my to-do list, so that I see what waits on me without opening each project.
+**User Story:** As the operator, I want one page showing every project's harness work and my to-do list, so that I see what waits on me without opening each project.
 
 #### Acceptance Criteria
 
-1. WHEN the operator opens the Overview page THEN the system SHALL list every project in the dashboard's project registry, each with its active spec, live phase, the newest `phase.*` or gate-related ledger row of the current run, the run id from the pointer file, and the age of the newest ledger row.
+1. WHEN the operator opens the Overview page THEN the system SHALL list every project in the dashboard's registry, each with its active spec, live phase, the current run's newest `phase.*` or gate-related ledger row, the run id from the pointer file, and the newest row's age.
 2. IF a project has no pointer line THEN the system SHALL show it as idle, with the active spec from its HANDOFF routing header and the age of that spec's newest ledger row when a ledger exists.
 3. WHEN the newest `phase.end` of a project's current run has result `gate-a`, `retro-ready` or `escalate` and no later `phase.start` exists THEN the system SHALL mark that project "waiting".
 4. WHEN a `phase.end` row with result `gate-a` is appended to a watched ledger THEN the Overview page SHALL show that project as "waiting" within five seconds, without a reload.
-5. WHEN the Overview page is open THEN the system SHALL read the `todos` array of `${XDG_STATE_HOME:-~/.local/state}/sdd/overwatch-hud.json` and SHALL show each item's title, owner, blocks, note, since, priority and done state, open items first.
+5. WHEN the Overview page is open THEN the system SHALL read the `todos` array of `${XDG_STATE_HOME:-~/.local/state}/sdd/overwatch-hud.json` and show each item's title, owner, blocks, note, since, priority and done state, open items first.
 6. WHEN the HUD file changes THEN the system SHALL push the new list over the existing websocket and the page SHALL update without a reload.
 7. IF the HUD file is missing, unreadable or has no `todos` array THEN the system SHALL show an empty list and no error.
 8. WHEN the Overview page is open THEN it SHALL offer no control that edits the HUD file, launches a run or stops a run.
 9. WHEN the Overview page is open THEN the system SHALL watch each registered project's pointer-named ledger and the HUD file with one watcher set shared by all Overview clients, and SHALL close it when the last Overview client leaves.
+10. WHEN the Overview page opens THEN it SHALL send a subscribe message whose `type` names the overview view (all projects), which the single-`projectId` socket of AC 4.8 has no equivalent for; the server SHALL key the AC 5.9 shared watcher set on the overview-subscriber count and push overview rows and the todos list only to them, each with a distinct type field.
 
 ### Requirement 6 — Compatibility and checks
 
-**User Story:** As the maintainer, I want the new pages to leave the TUI and terminal runs as they are, so that nothing I rely on today changes.
+**User Story:** As the maintainer, I want the new pages to leave the TUI and terminal runs unchanged, so that nothing I rely on today changes.
 
 #### Acceptance Criteria
 
 1. WHEN this spec lands THEN src/watch/render.ts SHALL be unchanged, and the model builder's output for a given input SHALL be unchanged.
-2. WHEN `--watch` runs on the same store as an open Harness page THEN both SHALL show the same phase rows, spawn rows, rounds and ticker lines for the same ledger.
+2. WHEN `--watch` runs on the same store as an open Harness page THEN both SHALL show the same phase rows, spawn rows, rounds and ticker lines.
 3. WHEN a run starts from a terminal with no `harness-run.json` THEN its ledger SHALL have the same event types and keys per row as a run before this spec.
 4. WHEN the Harness page or the Overview page renders at a viewport width of 375 CSS pixels THEN every control and every row SHALL be reachable without horizontal page scroll.
 5. WHEN the spec is complete THEN `npx tsc --noEmit`, `npm run build` and `npm test` SHALL pass.
@@ -118,36 +121,45 @@ The spec store has no steering documents, so this section aligns with the decomp
 ### Security
 - Secrets SHALL never pass through the page, the form, the setup file or the launch record; the child inherits the dashboard's environment.
 - The launch and stop routes SHALL sit behind the dashboard's existing binding, rate-limit and audit hooks, the same as the adversarial review routes that already spawn `claude`.
-- The launch route SHALL accept only a spec name that exists in the project's spec store and model values that pass Requirement 1 AC 6; it SHALL never pass form text to a shell.
+- The launch route SHALL accept only a spec name that exists in the spec store and model values that pass Requirement 1 AC 6; it SHALL never pass form text to a shell.
 
 ### Reliability
 - The dashboard SHALL run the harness only as a child process, never in-process, so a crashed run cannot stop the dashboard.
 
 ## Decisions taken in this document
 
-- D1 — The Overview to-do list reads the todos array of the Overwatch HUD file under the sdd state directory: options were the HUD todos array only, the HUD todos and operations arrays, a separate overwatch-todos file as the decomposition entry named; chosen because the decomposition's file does not exist, the HUD file does, and its operations array repeats what the ledgers already say.
-- D2 — The dashboard writes the run end row and removes the pointer line after a stop: options were the dashboard does it after the child exits, rely on the supervisor, leave it for the next run to find; chosen because the supervisor writes run end only at its own status step, which a signalled headless process never reaches.
-- D3 — The setup file's model overrides reach worker roles too, through the orchestrator launch prompt: options were all roles through the launch prompt, orchestrators only, the supervisor only; chosen because the form lists every role and a worker-only change (for example the reviewer on Sonnet) is the most likely override.
-- D4 — A launched run is detached, logs to a file and survives a dashboard restart: options were detached with a log file and a launch record, a child killed on dashboard stop like the adversarial runner, a child tied to the dashboard with no log; chosen because a run lasts hours and the dashboard restarts after every build.
-- D5 — Only the routed active spec is launchable, and the supervisor ignores a setup file for another spec: options were routed spec only with a warning on mismatch, any spec with the file overriding routing, any spec with the supervisor refusing a mismatch; chosen because routing encodes dependency order and a stale file must not block terminal runs.
-- D6 — A launch from the page always writes gates as record; the form's gates choice applies to terminal runs: options were forced record on launch, honour the form on launch; chosen because a headless run has no AskUserQuestion and would fall to record anyway.
-- D7 — Waiting means the newest phase end of the current run is gate A, retro-ready or escalate with no later phase start: options were those three results, gate A only, any run end; chosen because those are the three points where a human answer is due.
-- D8 — The pointer file and the HUD file resolve under the XDG state home, defaulting to the local state directory: options were the XDG rule the hook uses, a fixed home path; chosen because the activity hook and the supervisor already use the XDG rule, and tests can point it at a fixture.
-- D9 — The provider field shows only for the three eligible roles and the merged map passes the existing preflight: options were three roles with the same validation, every role, a separate validator; chosen because the provider validator refuses any other role.
-- D10 — Launch and stop use the dashboard's existing binding and security hooks with no extra localhost rule: options were the existing hooks, localhost-only launch; chosen because the adversarial routes already spawn a permission-skipping agent under the same hooks.
-- D11 — The dashboard does not commit the ledger after a stop: options were leave it uncommitted for the next run's commit, commit from the dashboard; chosen because the dashboard makes no git commits today.
-- D12 — Stop signals the process group, then kills it after ten seconds: options were group SIGTERM then SIGKILL, SIGTERM to the pid only; chosen because a DeepSeek launcher or tool child must not outlive the run.
-- D13 — The supervisor model field is pre-filled with the Opus 5.5 full id and its effort is fixed at high: options were the full id, the opus alias, a free field with no default; chosen because the supervisor preflight refuses anything below Opus 5.5 or Fable 5.1 and the documented headless command uses high effort.
-- D14 — Task rows show the tdd block from the existing task-review summary route: options were read that route, add a tdd field to the run model, leave tdd off the page; chosen because the build order says this spec renders the tdd block and the boundary notes forbid a new ledger field.
-- D15 — The setup file holds overrides only: options were overrides only, the full role table; chosen because a later declared-model change still takes effect.
+- D1 — The Overview to-do list reads the HUD file's todos array: over HUD-plus-operations or a separate overwatch-todos file; chosen because that file does not exist and operations repeats the ledgers.
+- D2 — The dashboard writes run-end and removes the pointer line on a stop: over relying on the supervisor; chosen because the supervisor writes run-end only at its status step, unreachable by a signalled process.
+- D3 — Overrides reach worker roles through the orchestrator launch prompt: over orchestrators-only or supervisor-only; chosen because a worker-only change is the likeliest override.
+- D4 — A launched run is detached, logged to a file and survives a dashboard restart: over a child killed on dashboard stop; chosen because a run lasts hours and the dashboard restarts after each build.
+- D5 — Only the routed active spec is launchable; a setup file for another spec is ignored: over any-spec-overriding-routing or a refused mismatch; chosen because routing encodes dependency order and a stale file must not block terminal runs.
+- D6 — A page launch forces gates to record; the form's gates choice applies to terminal runs: over honouring the form on launch; chosen because a headless run has no AskUserQuestion.
+- D7 — Waiting means the current run's newest phase end is gate A, retro-ready or escalate with no later phase start: over gate A only or any run end; chosen because those are where a human answer is due.
+- D8 — The pointer and HUD files resolve under the XDG state home: over a fixed home path; chosen because the hook and supervisor already use it and tests can point it at a fixture.
+- D9 — The provider field shows only for the three eligible roles and the merged map passes the existing preflight: over every role or a separate validator; chosen because the validator refuses any other role.
+- D10 — Launch and stop use the dashboard's existing binding and security hooks: over a localhost-only rule; chosen because the adversarial routes already spawn a permission-skipping agent under them.
+- D11 — The dashboard does not commit the ledger after a stop: over committing from the dashboard; chosen because the dashboard makes no git commits today.
+- D12 — Stop signals the process group, then kills it after ten seconds: over SIGTERM to the pid only; chosen because a launcher or tool child must not outlive the run.
+- D13 — The supervisor model field pre-fills the Opus 5.5 full id with effort fixed at high: over the alias or a free field; chosen because the preflight refuses anything below Opus 5.5 or Fable 5.1 and the headless command uses high effort.
+- D14 — Task rows show the tdd block from the existing task-review summary route: over adding a run-model tdd field or leaving tdd off; chosen because the build order says this spec renders (not records) the tdd block — spec 11 owns it (boundary note, spec-decomposition/decomposition.md:759-761) — and the route (src/dashboard/multi-server.ts:1965-1989) already returns it.
+- D15 — The setup file holds overrides only: over the full role table; chosen because a later declared-model change still takes effect.
 
 ## Scope notes
 
-- Gates answered from the pane stay out, as the decomposition entry decides; the page shows the recorded answers read-only.
-- Effort per role stays read-only, as the decomposition entry decides.
+- Gates answered from the pane stay out (decomposition); the page shows the recorded answers read-only.
+- Effort per role stays read-only (decomposition).
 - The Overview page does not read the HUD operations array (D1); a later spec may add it.
-- The decomposition entry's reliance on "the supervisor's existing interrupt handling" for run end is replaced by D2, because no such handling exists for a signalled process.
+- D2 replaces the decomposition's "existing interrupt handling" for run end; no such handling exists for a signalled process.
+- The two `run.start` provenance keys of AC 2.9 are the spec-9 deliverable that "records the overrides on `run.start`" (decomposition entry, spec-decomposition/decomposition.md:665-667, 711). The boundary note "it adds no ledger field" (spec-decomposition/decomposition.md:753-754) scopes per-spawn usage to spec 8, not this: spec 9 adds no per-spawn field and no `RunModel` field, and only the file case changes `run.start` (AC 2.11).
 
 ## Revision History
 
 - **v1** (2026-09-28) — Initial draft.
+- **v2** (2026-09-28) — Round-1 adversarial review dispositions:
+  - R1-1 (accepted) — Resolved the ledger-format contradiction: the Introduction and a new scope note now state that a run which applied the file adds two provenance keys to `run.start`, which the decomposition's spec-9 deliverable authorizes; D14's false clause "the boundary notes forbid a new ledger field" is deleted and replaced with the real reason (the tdd route already returns the block).
+  - R1-2 (accepted) — Added AC 4.8, 4.9 and 5.10 defining the harness- and overview-view subscribe messages, the per-payload message types, and the subscriber-count the server keys each watcher lifecycle on, over the single-project socket.
+  - R1-3 (accepted) — AC 2.4 split by provider: Agent-tool model for anthropic workers, merged provider map plus launcher for deepseek workers; AC 2.6 now merges a deepseek role's model too.
+  - R1-4 (accepted) — AC 1.6 made provider-conditional so a DeepSeek model is not rejected on a deepseek role.
+  - R1-5 (accepted) — AC 1.1 now reuses the read-only ordering/routing logic without the generator's INDEX.md write.
+  - Minors (rejected) — the waiting-state imprecision is self-correcting; the launch flag list and the log/launch-record paths are design-phase details the analysis marks non-blocking.
+  - **Lint pass.** 13 fixed; rejected: none.
````

## Lint commit f15d391

````diff
diff --git a/.spec-workflow/specs/harness-control-pane/requirements.md b/.spec-workflow/specs/harness-control-pane/requirements.md
index 940cdb3..f33d416 100644
--- a/.spec-workflow/specs/harness-control-pane/requirements.md
+++ b/.spec-workflow/specs/harness-control-pane/requirements.md
@@ -2,70 +2,70 @@
 
 ## Introduction
 
-This spec adds a Harness page and an Overview page to the existing dashboard: the Harness page sets up, launches, stops and watches one SDD run of one project, and the Overview page shows the harness work of every registered project and the operator to-do list on one screen. It is for the operator who today launches runs by hand with `continue the sdd process` or a `claude -p` script and watches them in the `--watch` TUI. It changes the supervisor skill so that it honours a per-run setup file. The only ledger change is that a run which applied the file adds two provenance keys to its `run.start` row (`overrides` and `setup`), which is the spec-9 deliverable that records the overrides on `run.start` (decomposition entry, spec-decomposition/decomposition.md:667); the row set, every other key and the TUI renderer are unchanged, and a run with no file writes the same `run.start` as today.
+This spec adds a Harness page and an Overview page to the existing dashboard: the Harness page sets up, launches, stops and watches one SDD run of one project; the Overview page shows every registered project's harness work and the operator to-do list on one screen. It replaces launching runs by hand with `continue the sdd process` or `claude -p` and watching them in the `--watch` TUI, and changes the supervisor skill to honour a per-run setup file. The only ledger change is two provenance keys on the `run.start` row of a run that applied the file (decomposition entry, spec-decomposition/decomposition.md:665-667); every other key and the TUI renderer are unchanged, and a run with no file writes the same `run.start`.
 
 ## Alignment with Product Vision
 
-The spec store has no steering documents, so this section aligns with the decomposition entry for spec 9. That entry puts the control pane last in the harness operations order because it renders what specs 8, 10 and 11 record: per-spawn tokens and models, the provider map and the task `tdd` block. The pane reuses the data layer the TUI already has, so the page and the TUI can never disagree about a run.
+The spec store has no steering documents, so this aligns with the decomposition entry for spec 9, which puts the control pane last: it renders what specs 8, 10 and 11 record (per-spawn tokens and models, the provider map, the task `tdd` block), reusing the TUI's data layer so the page and TUI cannot disagree about a run.
 
 ## Requirements
 
 ### Requirement 1 — Run setup
 
-**User Story:** As the operator, I want a page that lists the specs of a project and a form that sets up one run, so that I choose the models and options of a run without editing agent frontmatter or the agent rules.
+**User Story:** As the operator, I want a page listing a project's specs and a form to set up one run, so that I choose a run's models and options without editing agent frontmatter or the agent rules.
 
 #### Acceptance Criteria
 
-1. WHEN the operator opens the Harness page for a project THEN the system SHALL list the specs of that project's spec store in the order INDEX.md renders them, each with its current phase, and SHALL mark the spec that the routing names as active. The page SHALL reuse the categorization, ordering, current-phase and routing logic of `src/core/index-generator.ts` (`deriveSpecStatus`, the class's `categorize`, and the exported `deriveRouting`) through a read-only function that produces the order without INDEX.md's write side effect; it SHALL NOT call `IndexGenerator.generate()`, which `mkdir`s and `fs.writeFile`s INDEX.md (src/core/index-generator.ts:70-72). Exposing a pure order/status function, or reimplementing the private ordering, is part of this work.
+1. WHEN the operator opens the Harness page for a project THEN the system SHALL list that project's specs in the order INDEX.md renders them, each with its current phase, and SHALL mark the spec the routing names as active. The page SHALL reuse the categorization, ordering, current-phase and routing logic of `src/core/index-generator.ts` through a read-only function, and SHALL NOT call the generator's INDEX.md write path (src/core/index-generator.ts:70-72).
 2. WHEN the Harness page lists the specs THEN the system SHALL NOT write INDEX.md or any other file in the spec store.
-3. WHEN the HANDOFF routing header names the active spec THEN the system SHALL show the live phase, state and last result that the header carries for that spec.
-4. WHEN the Harness page renders the run form THEN the system SHALL show one row per agent in the build's agent profiles (thirteen agents at harness/agent-profiles.json:1-80) plus one row for the supervisor, each with a model field pre-filled with the declared model, and the declared effort shown read-only with the reason "effort is per agent, not per run".
-5. WHEN the run form renders THEN the system SHALL pre-fill the supervisor model field with `claude-opus-5-5`, and SHALL show the supervisor effort as `high`, read-only.
-6. Model-field validation SHALL be provider-conditional: IF a role whose provider is `anthropic` holds a model value that is neither a model alias the design lists nor a full model id that starts with `claude-`, OR a role whose provider is `deepseek` holds a model value that is not one of the two DeepSeek models the validator allows (harness/skills/sdd-continue/references/sdd-providers.sh:29), THEN the system SHALL refuse to save the form and SHALL name the field and the value. A `claude-` id or alias is valid only on an anthropic role, and a DeepSeek model only on a deepseek role.
-7. WHEN the run form renders THEN the system SHALL show a provider field only for the roles the provider validator allows (reviewer, checker and reviser, per harness/skills/sdd-continue/references/sdd-providers.sh:21-29), pre-filled from the project's provider map in the agent rules, or `anthropic` when the map is absent.
+3. WHEN the HANDOFF routing header names the active spec THEN the system SHALL show the live phase, state and last result the header carries for that spec.
+4. WHEN the Harness page renders the run form THEN the system SHALL show one row per agent in the build's agent profiles (thirteen agents at harness/agent-profiles.json:1-80) plus one supervisor row, each with a model field pre-filled with the declared model and the declared effort shown read-only.
+5. WHEN the run form renders THEN the system SHALL pre-fill the supervisor model field with `claude-opus-5-5` and SHALL show the supervisor effort as `high`, read-only.
+6. Model-field validation SHALL be provider-conditional: IF an `anthropic` role holds a model that is neither a model alias the design lists nor a full id starting with `claude-`, OR a `deepseek` role holds a model that is not one of the two DeepSeek models the validator allows (harness/skills/sdd-continue/references/sdd-providers.sh:28-29), THEN the system SHALL refuse to save and SHALL name the field and value. A `claude-` id or alias is valid only on an anthropic role, a DeepSeek model only on a deepseek role.
+7. WHEN the run form renders THEN the system SHALL show a provider field only for the roles the validator allows (reviewer, checker and reviser, harness/skills/sdd-continue/references/sdd-providers.sh:21-29), pre-filled from the project's provider map, or `anthropic` when the map is absent.
 8. IF the operator sets a role's provider to `deepseek` THEN the system SHALL require one of the two DeepSeek models the validator allows as that role's model.
-9. WHEN the run form renders THEN the system SHALL show a worktree choice (yes or no) and a gates choice (block or record), pre-filled from the project's agent rules (`worktree-per-change` and `gates` keys), else `no` and `block`.
-10. WHEN the run form renders THEN the system SHALL offer only the spec the routing names as active as the run's spec; IF the routing names no active spec THEN the system SHALL disable the form and SHALL show the routing reason.
-11. WHEN the operator saves the form THEN the system SHALL write `.spec-workflow/harness-run.json` in the project's spec store with the spec, the time written, the supervisor model, the model and provider per role, the worktree choice and the gates choice.
+9. WHEN the run form renders THEN the system SHALL show a worktree choice (yes or no) and a gates choice (block or record), pre-filled from the agent rules (`worktree-per-change` and `gates` keys), else `no` and `block`.
+10. WHEN the run form renders THEN the system SHALL offer only the routed active spec as the run's spec; IF the routing names no active spec THEN the system SHALL disable the form and show the routing reason.
+11. WHEN the operator saves the form THEN the system SHALL write `.spec-workflow/harness-run.json` in the spec store with the spec, the time written, the supervisor model, the model and provider per role, the worktree choice and the gates choice.
 12. WHEN a role's saved values equal its declared defaults THEN the system SHALL omit that role from the file.
 
 ### Requirement 2 — The supervisor honours the setup file
 
-**User Story:** As the operator, I want the supervisor to apply the saved setup to one run, so that a run launched from the page or from a terminal uses the models and options I chose.
+**User Story:** As the operator, I want the supervisor to apply the saved setup, so that a run launched from the page or a terminal uses the models and options I chose.
 
 #### Acceptance Criteria
 
 1. WHEN the supervisor starts a run and the spec store holds a `harness-run.json` whose spec is the active spec THEN the supervisor SHALL apply it and SHALL print one line naming the file and the time it was written.
 2. IF the spec store holds a `harness-run.json` whose spec is not the active spec THEN the supervisor SHALL print one warning line naming both specs and SHALL run as if the file did not exist.
 3. WHEN the file sets a model for an orchestrator THEN the supervisor SHALL pass that model as the Agent tool's `model` parameter on each spawn of that orchestrator, in place of the no-model spawn of harness/skills/sdd-continue/SKILL.md:226-228.
-4. WHEN the file sets a model for a worker role THEN the supervisor SHALL pass the worker overrides to each orchestrator in its launch prompt, and each orchestrator SHALL deliver the override by the role's provider: for an anthropic worker it SHALL pass the matching `model` parameter on each Agent-tool spawn of that role; for a deepseek worker, which is not spawned through the Agent tool but as `bash <LAUNCHER> <agent> "<launch message>"` (harness/skills/sdd-document-phase/SKILL.md:24-34), the overridden model SHALL travel only in the merged provider map (`<agent>:deepseek:<model>`, harness/skills/sdd-continue/references/sdd-providers.sh:72-74) that AC 2.6 builds and the launcher reads, never as an Agent-tool parameter.
-5. WHEN the model pre-flight checks an orchestrator whose model the file overrides THEN the supervisor SHALL expect the overridden model and not the declared one.
-6. WHEN the file sets a provider for a role THEN the supervisor SHALL merge that role's provider and, for a `deepseek` role, its model over the agent rules' provider map, SHALL validate the merged map with the same rules as the provider preflight (eligible roles, allowed providers, allowed models, required key exported), and SHALL refuse the run before any ledger row on a failed validation, as harness/skills/sdd-continue/SKILL.md:85-96 does.
+4. WHEN the file sets a model for a worker role THEN the supervisor SHALL pass the worker overrides to each orchestrator in its launch prompt, and each orchestrator SHALL deliver the override by the role's provider: an anthropic worker gets the `model` parameter on each Agent-tool spawn; a deepseek worker, which runs as `bash <LAUNCHER> <agent> "<launch message>"` not through the Agent tool (harness/skills/sdd-document-phase/SKILL.md:24-34), gets the overridden model only in the merged provider map (`<agent>:deepseek:<model>`, harness/skills/sdd-continue/references/sdd-providers.sh:72-74), never as an Agent-tool parameter.
+5. WHEN the model pre-flight checks an orchestrator whose model the file overrides THEN the supervisor SHALL expect the overridden model, not the declared one.
+6. WHEN the file sets a provider for a role THEN the supervisor SHALL merge that role's provider and, for a deepseek role, its model over the agent rules' provider map, SHALL validate the merged map with the provider preflight's rules, and SHALL refuse the run before any ledger row on a failed validation, as harness/skills/sdd-continue/SKILL.md:85-96 does.
 7. WHEN the file sets the gates choice THEN the supervisor SHALL use it in place of the agent rules' `gates` key for both gates of this run.
 8. WHEN the file sets worktree to yes THEN the supervisor SHALL apply the worktree rule of harness/skills/sdd-continue/SKILL.md:336-345 as if the agent rules required it; WHEN it sets no THEN the supervisor SHALL NOT enter a worktree.
 9. WHEN the supervisor writes `run.start` for a run that applied the file THEN the row SHALL carry an `overrides` key listing each overridden role and its model and provider, and SHALL carry `setup=harness-run`.
 10. WHEN a run that applied the file ends THEN the supervisor SHALL delete the file at the same step that writes `run.end` and removes the pointer line.
-11. WHEN a run starts with no `harness-run.json` in the spec store THEN the supervisor SHALL behave exactly as today, and the `run.start` row SHALL carry no `overrides` or `setup` key.
+11. WHEN a run starts with no `harness-run.json` THEN the supervisor SHALL behave exactly as today, and the `run.start` row SHALL carry no `overrides` or `setup` key.
 
 ### Requirement 3 — Launch and stop
 
-**User Story:** As the operator, I want to launch and stop a run from the page, so that I do not need a terminal to drive a headless run.
+**User Story:** As the operator, I want to launch and stop a run from the page, so that I need no terminal to drive a headless run.
 
 #### Acceptance Criteria
 
-1. WHEN the operator presses Launch THEN the system SHALL save the form as Requirement 1 AC 11 describes with the gates choice set to record, and SHALL then spawn `claude -p` with the prompt `continue the sdd process`, the supervisor model, effort `high` and the other flags of the documented headless command (docs/SDD-HARNESS.md:244-248).
-2. WHEN the system spawns the run THEN it SHALL use the child-process pattern of src/dashboard/adversarial-runner.ts:156-220: a scrubbed git environment, `cwd` the project checkout (or the worktree of AC 3), and the workspace and shared-root variables set on the environment.
-3. WHEN the operator launches with worktree `yes` THEN the system SHALL create a git worktree of the project checkout on branch `feat/` plus the spec name, or reuse it when it exists, SHALL run the agent rules' `worktree-setup` command once in a newly created worktree, and SHALL spawn the child with that worktree as `cwd`.
-4. WHEN the child is spawned THEN the system SHALL spawn it detached in its own process group, SHALL write its stdout and stderr to a log file outside the repository, and SHALL record the pid, the process group, the project, the spec, the log path and the launch time in a launch record outside the repository.
+1. WHEN the operator presses Launch THEN the system SHALL save the form as Requirement 1 AC 11 describes with the gates choice set to record, and SHALL spawn `claude -p` with the prompt `continue the sdd process`, the supervisor model, effort `high` and the other flags of the documented headless command (docs/SDD-HARNESS.md:244-248).
+2. WHEN the system spawns the run THEN it SHALL use the child-process pattern of src/dashboard/adversarial-runner.ts:156-220: a scrubbed git environment, `cwd` the project checkout (or the AC 3 worktree), and the workspace and shared-root variables on the environment.
+3. WHEN the operator launches with worktree `yes` THEN the system SHALL create a git worktree of the checkout on branch `feat/` plus the spec name (or reuse it), SHALL run the agent rules' `worktree-setup` command once in a new worktree, and SHALL spawn the child with that worktree as `cwd`.
+4. WHEN the child is spawned THEN the system SHALL spawn it detached in its own process group, SHALL write its stdout and stderr to a log file outside the repository, and SHALL record the pid, process group, project, spec, log path and launch time in a launch record outside the repository.
 5. WHEN the child writes output THEN the system SHALL stream the new log lines to that project's open Harness pages over the existing websocket.
-6. WHEN the supervisor appends its pointer line and `run.start` THEN the system SHALL add the run id to the launch record and SHALL show it on the page.
-7. IF the pointer file (`${XDG_STATE_HOME:-~/.local/state}/sdd/active-run`) holds a line whose spec dir is inside this project's spec store THEN the system SHALL refuse a launch with HTTP 409 and SHALL name the live run id.
+6. WHEN the supervisor appends its pointer line and `run.start` THEN the system SHALL add the run id to the launch record and show it on the page.
+7. IF the pointer file (`${XDG_STATE_HOME:-~/.local/state}/sdd/active-run`) holds a line whose spec dir is inside this project's spec store THEN the system SHALL refuse a launch with HTTP 409 and name the live run id.
 8. IF the project has a live dashboard launch record whose process still exists THEN the system SHALL refuse a launch with HTTP 409 even before the pointer line appears.
 9. WHEN the operator presses Stop THEN the system SHALL send SIGTERM to the child's process group, and SHALL send SIGKILL to the group if it still exists ten seconds later.
-10. WHEN a stopped child has exited THEN the system SHALL append a `run.end` row with status `stopped from the dashboard` to the spec's ledger when the run has a `run.start` and no `run.end`, SHALL remove only this run's line from the pointer file, SHALL delete `harness-run.json`, and SHALL show the run as stopped.
+10. WHEN a stopped child has exited THEN the system SHALL append a `run.end` row with status `stopped from the dashboard` when it has a `run.start` and no `run.end`, SHALL remove only this run's line from the pointer file, SHALL delete `harness-run.json`, and SHALL show the run as stopped.
 11. WHEN the child exits on its own THEN the system SHALL NOT write `run.end` or touch the pointer file, and SHALL show the exit code.
 12. WHEN the dashboard process stops or restarts THEN the system SHALL leave a launched run running, and after a restart SHALL read the launch record back so the page shows the run, its log and a working Stop.
-13. WHEN the system removes a pointer line THEN it SHALL rewrite the file without the line and SHALL delete the file when no line remains, the same rule as the supervisor's deregister step (harness/skills/sdd-continue/SKILL.md:488-500).
+13. WHEN the system removes a pointer line THEN it SHALL rewrite the file without the line and delete the file when no line remains, the same rule as the supervisor's deregister step (harness/skills/sdd-continue/SKILL.md:488-500).
 
 ### Requirement 4 — Live view
 
@@ -73,41 +73,41 @@ The spec store has no steering documents, so this section aligns with the decomp
 
 #### Acceptance Criteria
 
-1. WHEN a Harness page is open for a project THEN the system SHALL watch the active spec's event ledger, activity file, `tasks.md` and HANDOFF with the same chokidar options as src/watch/index.ts:101-104.
-2. WHEN a watched file changes THEN the system SHALL build the run model with the existing model builder of src/watch/ledger.ts:243-457 and SHALL push it to that project's websocket clients within five seconds of the append.
-3. WHEN the page receives a run model THEN it SHALL render the run header (spec, code root, worktree, run id, uptime, tokens, providers), the phase rows, the live phase, the spawn tree with role, declared and actual model, provider and tokens, the round rows, the task picks and the ticker, without a page reload.
-4. WHEN the run is in the implementation phase THEN the page SHALL show each task row with its latest review verdict and `tdd` block from the existing task-review summary route (src/dashboard/multi-server.ts:1965-1989).
+1. WHEN a Harness page is open for a project THEN the system SHALL watch the active spec's event ledger, activity file, `tasks.md` and HANDOFF with the chokidar options of src/watch/index.ts:101-104.
+2. WHEN a watched file changes THEN the system SHALL build the run model with the existing model builder of src/watch/ledger.ts:243-457 and push it to that project's websocket clients within five seconds of the append.
+3. WHEN the page receives a run model THEN it SHALL render, without a reload, the run header (spec, code root, worktree, run id, uptime, tokens, providers), the phase rows, the live phase, the spawn tree (role, declared and actual model, provider and tokens), the round rows, the task picks and the ticker.
+4. WHEN the run is in the implementation phase THEN the page SHALL show each task row with its latest review verdict and `tdd` block from the task-review summary route (src/dashboard/multi-server.ts:1965-1989).
 5. WHEN the spec directory holds `questions.md` THEN the page SHALL show its gate A and gate B sections as recorded, read-only, with no control that answers them.
 6. WHEN a spawn has no tokens or the build has no agent profiles THEN the page SHALL render the row without them.
-7. WHEN no Harness page of a project is open THEN the system SHALL NOT keep a harness watcher running for that project (keyed on the harness-subscriber count of AC 4.8, not on `connection.projectId`).
-8. WHEN a Harness page opens for a project THEN it SHALL send a subscribe message whose `type` names the harness view, distinct from the Specs page's `subscribe`, so the server can tell a Harness subscriber from a Specs subscriber that share one `projectId` — the existing socket binds a connection to a single `connection.projectId` and knows only the `subscribe`, `initial` and `projects-update` messages (src/dashboard/multi-server.ts:205-294) — and the server SHALL key the AC 4.7 watcher lifecycle on the count of harness subscribers for that project.
-9. WHEN the server pushes to a Harness page THEN each message SHALL carry a `type` the page demultiplexes, distinct from `initial` and `projects-update`: one for the run model (AC 4.2), one for a batch of new log lines (Requirement 3 AC 5), and one for the gate sections (AC 4.5); the run-model and gate pushes SHALL reach only that project's harness subscribers, sent with the existing `broadcastToProject` (src/dashboard/multi-server.ts:2139-2151).
+7. WHEN no Harness page of a project is open THEN the system SHALL NOT keep a harness watcher running for that project (keyed on the harness-subscriber count of AC 4.8, not `connection.projectId`).
+8. WHEN a Harness page opens for a project THEN it SHALL send a subscribe message whose `type` names the harness view, distinct from the Specs page's `subscribe`, so the server can tell the two apart on one `projectId` — the existing socket binds each connection to a single `connection.projectId` and knows only the `subscribe`, `initial` and `projects-update` messages (src/dashboard/multi-server.ts:205-294) — and SHALL key the AC 4.7 watcher lifecycle on the harness-subscriber count for that project.
+9. WHEN the server pushes to a Harness page THEN each message SHALL carry a type field the page demultiplexes, distinct from the AC 4.8 messages: one for the run model, one for a batch of new log lines, one for the gate sections; the run-model and gate pushes SHALL reach only that project's harness subscribers via the existing `broadcastToProject` (src/dashboard/multi-server.ts:2139-2151).
 
 ### Requirement 5 — Overview page
 
-**User Story:** As the operator, I want one page that shows the harness work of every project on the machine and my to-do list, so that I see what waits on me without opening each project.
+**User Story:** As the operator, I want one page showing every project's harness work and my to-do list, so that I see what waits on me without opening each project.
 
 #### Acceptance Criteria
 
-1. WHEN the operator opens the Overview page THEN the system SHALL list every project in the dashboard's project registry, each with its active spec, live phase, the newest `phase.*` or gate-related ledger row of the current run, the run id from the pointer file, and the age of the newest ledger row.
+1. WHEN the operator opens the Overview page THEN the system SHALL list every project in the dashboard's registry, each with its active spec, live phase, the current run's newest `phase.*` or gate-related ledger row, the run id from the pointer file, and the newest row's age.
 2. IF a project has no pointer line THEN the system SHALL show it as idle, with the active spec from its HANDOFF routing header and the age of that spec's newest ledger row when a ledger exists.
 3. WHEN the newest `phase.end` of a project's current run has result `gate-a`, `retro-ready` or `escalate` and no later `phase.start` exists THEN the system SHALL mark that project "waiting".
 4. WHEN a `phase.end` row with result `gate-a` is appended to a watched ledger THEN the Overview page SHALL show that project as "waiting" within five seconds, without a reload.
-5. WHEN the Overview page is open THEN the system SHALL read the `todos` array of `${XDG_STATE_HOME:-~/.local/state}/sdd/overwatch-hud.json` and SHALL show each item's title, owner, blocks, note, since, priority and done state, open items first.
+5. WHEN the Overview page is open THEN the system SHALL read the `todos` array of `${XDG_STATE_HOME:-~/.local/state}/sdd/overwatch-hud.json` and show each item's title, owner, blocks, note, since, priority and done state, open items first.
 6. WHEN the HUD file changes THEN the system SHALL push the new list over the existing websocket and the page SHALL update without a reload.
 7. IF the HUD file is missing, unreadable or has no `todos` array THEN the system SHALL show an empty list and no error.
 8. WHEN the Overview page is open THEN it SHALL offer no control that edits the HUD file, launches a run or stops a run.
 9. WHEN the Overview page is open THEN the system SHALL watch each registered project's pointer-named ledger and the HUD file with one watcher set shared by all Overview clients, and SHALL close it when the last Overview client leaves.
-10. WHEN the Overview page opens THEN it SHALL send a subscribe message whose `type` names the overview view (all projects), since the existing socket binds a connection to a single `connection.projectId` and has no all-projects subscription (src/dashboard/multi-server.ts:205-294); the server SHALL key the AC 5.9 shared watcher set on the count of overview subscribers and SHALL push overview rows and the todos list only to them, each with a distinct `type` the page demultiplexes (overview rows, todos list), distinct from `initial` and `projects-update`.
+10. WHEN the Overview page opens THEN it SHALL send a subscribe message whose `type` names the overview view (all projects), which the single-`projectId` socket of AC 4.8 has no equivalent for; the server SHALL key the AC 5.9 shared watcher set on the overview-subscriber count and push overview rows and the todos list only to them, each with a distinct type field.
 
 ### Requirement 6 — Compatibility and checks
 
-**User Story:** As the maintainer, I want the new pages to leave the TUI and terminal runs as they are, so that nothing I rely on today changes.
+**User Story:** As the maintainer, I want the new pages to leave the TUI and terminal runs unchanged, so that nothing I rely on today changes.
 
 #### Acceptance Criteria
 
 1. WHEN this spec lands THEN src/watch/render.ts SHALL be unchanged, and the model builder's output for a given input SHALL be unchanged.
-2. WHEN `--watch` runs on the same store as an open Harness page THEN both SHALL show the same phase rows, spawn rows, rounds and ticker lines for the same ledger.
+2. WHEN `--watch` runs on the same store as an open Harness page THEN both SHALL show the same phase rows, spawn rows, rounds and ticker lines.
 3. WHEN a run starts from a terminal with no `harness-run.json` THEN its ledger SHALL have the same event types and keys per row as a run before this spec.
 4. WHEN the Harness page or the Overview page renders at a viewport width of 375 CSS pixels THEN every control and every row SHALL be reachable without horizontal page scroll.
 5. WHEN the spec is complete THEN `npx tsc --noEmit`, `npm run build` and `npm test` SHALL pass.
@@ -121,44 +121,45 @@ The spec store has no steering documents, so this section aligns with the decomp
 ### Security
 - Secrets SHALL never pass through the page, the form, the setup file or the launch record; the child inherits the dashboard's environment.
 - The launch and stop routes SHALL sit behind the dashboard's existing binding, rate-limit and audit hooks, the same as the adversarial review routes that already spawn `claude`.
-- The launch route SHALL accept only a spec name that exists in the project's spec store and model values that pass Requirement 1 AC 6; it SHALL never pass form text to a shell.
+- The launch route SHALL accept only a spec name that exists in the spec store and model values that pass Requirement 1 AC 6; it SHALL never pass form text to a shell.
 
 ### Reliability
 - The dashboard SHALL run the harness only as a child process, never in-process, so a crashed run cannot stop the dashboard.
 
 ## Decisions taken in this document
 
-- D1 — The Overview to-do list reads the todos array of the Overwatch HUD file under the sdd state directory: options were the HUD todos array only, the HUD todos and operations arrays, a separate overwatch-todos file as the decomposition entry named; chosen because the decomposition's file does not exist, the HUD file does, and its operations array repeats what the ledgers already say.
-- D2 — The dashboard writes the run end row and removes the pointer line after a stop: options were the dashboard does it after the child exits, rely on the supervisor, leave it for the next run to find; chosen because the supervisor writes run end only at its own status step, which a signalled headless process never reaches.
-- D3 — The setup file's model overrides reach worker roles too, through the orchestrator launch prompt: options were all roles through the launch prompt, orchestrators only, the supervisor only; chosen because the form lists every role and a worker-only change (for example the reviewer on Sonnet) is the most likely override.
-- D4 — A launched run is detached, logs to a file and survives a dashboard restart: options were detached with a log file and a launch record, a child killed on dashboard stop like the adversarial runner, a child tied to the dashboard with no log; chosen because a run lasts hours and the dashboard restarts after every build.
-- D5 — Only the routed active spec is launchable, and the supervisor ignores a setup file for another spec: options were routed spec only with a warning on mismatch, any spec with the file overriding routing, any spec with the supervisor refusing a mismatch; chosen because routing encodes dependency order and a stale file must not block terminal runs.
-- D6 — A launch from the page always writes gates as record; the form's gates choice applies to terminal runs: options were forced record on launch, honour the form on launch; chosen because a headless run has no AskUserQuestion and would fall to record anyway.
-- D7 — Waiting means the newest phase end of the current run is gate A, retro-ready or escalate with no later phase start: options were those three results, gate A only, any run end; chosen because those are the three points where a human answer is due.
-- D8 — The pointer file and the HUD file resolve under the XDG state home, defaulting to the local state directory: options were the XDG rule the hook uses, a fixed home path; chosen because the activity hook and the supervisor already use the XDG rule, and tests can point it at a fixture.
-- D9 — The provider field shows only for the three eligible roles and the merged map passes the existing preflight: options were three roles with the same validation, every role, a separate validator; chosen because the provider validator refuses any other role.
-- D10 — Launch and stop use the dashboard's existing binding and security hooks with no extra localhost rule: options were the existing hooks, localhost-only launch; chosen because the adversarial routes already spawn a permission-skipping agent under the same hooks.
-- D11 — The dashboard does not commit the ledger after a stop: options were leave it uncommitted for the next run's commit, commit from the dashboard; chosen because the dashboard makes no git commits today.
-- D12 — Stop signals the process group, then kills it after ten seconds: options were group SIGTERM then SIGKILL, SIGTERM to the pid only; chosen because a DeepSeek launcher or tool child must not outlive the run.
-- D13 — The supervisor model field is pre-filled with the Opus 5.5 full id and its effort is fixed at high: options were the full id, the opus alias, a free field with no default; chosen because the supervisor preflight refuses anything below Opus 5.5 or Fable 5.1 and the documented headless command uses high effort.
-- D14 — Task rows show the tdd block from the existing task-review summary route: options were read that route, add a tdd field to the run model, leave tdd off the page; chosen because the build order says this spec renders (not records) the tdd block — spec 11 owns the `tdd` block itself (decomposition boundary note, spec-decomposition/decomposition.md:759-761) — and the route (src/dashboard/multi-server.ts:1965-1989) already returns it, so no run-model field is added.
-- D15 — The setup file holds overrides only: options were overrides only, the full role table; chosen because a later declared-model change still takes effect.
+- D1 — The Overview to-do list reads the HUD file's todos array: over HUD-plus-operations or a separate overwatch-todos file; chosen because that file does not exist and operations repeats the ledgers.
+- D2 — The dashboard writes run-end and removes the pointer line on a stop: over relying on the supervisor; chosen because the supervisor writes run-end only at its status step, unreachable by a signalled process.
+- D3 — Overrides reach worker roles through the orchestrator launch prompt: over orchestrators-only or supervisor-only; chosen because a worker-only change is the likeliest override.
+- D4 — A launched run is detached, logged to a file and survives a dashboard restart: over a child killed on dashboard stop; chosen because a run lasts hours and the dashboard restarts after each build.
+- D5 — Only the routed active spec is launchable; a setup file for another spec is ignored: over any-spec-overriding-routing or a refused mismatch; chosen because routing encodes dependency order and a stale file must not block terminal runs.
+- D6 — A page launch forces gates to record; the form's gates choice applies to terminal runs: over honouring the form on launch; chosen because a headless run has no AskUserQuestion.
+- D7 — Waiting means the current run's newest phase end is gate A, retro-ready or escalate with no later phase start: over gate A only or any run end; chosen because those are where a human answer is due.
+- D8 — The pointer and HUD files resolve under the XDG state home: over a fixed home path; chosen because the hook and supervisor already use it and tests can point it at a fixture.
+- D9 — The provider field shows only for the three eligible roles and the merged map passes the existing preflight: over every role or a separate validator; chosen because the validator refuses any other role.
+- D10 — Launch and stop use the dashboard's existing binding and security hooks: over a localhost-only rule; chosen because the adversarial routes already spawn a permission-skipping agent under them.
+- D11 — The dashboard does not commit the ledger after a stop: over committing from the dashboard; chosen because the dashboard makes no git commits today.
+- D12 — Stop signals the process group, then kills it after ten seconds: over SIGTERM to the pid only; chosen because a launcher or tool child must not outlive the run.
+- D13 — The supervisor model field pre-fills the Opus 5.5 full id with effort fixed at high: over the alias or a free field; chosen because the preflight refuses anything below Opus 5.5 or Fable 5.1 and the headless command uses high effort.
+- D14 — Task rows show the tdd block from the existing task-review summary route: over adding a run-model tdd field or leaving tdd off; chosen because the build order says this spec renders (not records) the tdd block — spec 11 owns it (boundary note, spec-decomposition/decomposition.md:759-761) — and the route (src/dashboard/multi-server.ts:1965-1989) already returns it.
+- D15 — The setup file holds overrides only: over the full role table; chosen because a later declared-model change still takes effect.
 
 ## Scope notes
 
-- Gates answered from the pane stay out, as the decomposition entry decides; the page shows the recorded answers read-only.
-- Effort per role stays read-only, as the decomposition entry decides.
+- Gates answered from the pane stay out (decomposition); the page shows the recorded answers read-only.
+- Effort per role stays read-only (decomposition).
 - The Overview page does not read the HUD operations array (D1); a later spec may add it.
-- The decomposition entry's reliance on "the supervisor's existing interrupt handling" for run end is replaced by D2, because no such handling exists for a signalled process.
-- The `run.start` row of a run that applied the setup file carries two provenance keys (`overrides` and `setup`, AC 2.9); this is the spec-9 deliverable that "records the overrides on `run.start`" (decomposition entry, spec-decomposition/decomposition.md:667, 711). Boundary note spec-decomposition/decomposition.md:754 ("it adds no ledger field") scopes per-spawn usage to spec 8: spec 9 adds no per-spawn usage field and no field to `RunModel`. These two provenance keys are the only ledger change, and only for the file case (AC 2.11 keeps the no-file `run.start` as today).
+- D2 replaces the decomposition's "existing interrupt handling" for run end; no such handling exists for a signalled process.
+- The two `run.start` provenance keys of AC 2.9 are the spec-9 deliverable that "records the overrides on `run.start`" (decomposition entry, spec-decomposition/decomposition.md:665-667, 711). The boundary note "it adds no ledger field" (spec-decomposition/decomposition.md:753-754) scopes per-spawn usage to spec 8, not this: spec 9 adds no per-spawn field and no `RunModel` field, and only the file case changes `run.start` (AC 2.11).
 
 ## Revision History
 
 - **v1** (2026-09-28) — Initial draft.
 - **v2** (2026-09-28) — Round-1 adversarial review dispositions:
-  - R1-1 (accepted) — Resolved the ledger-format contradiction: the Introduction and a new scope note now state that a run which applied the file adds `overrides`/`setup` to `run.start`, which the decomposition's spec-9 deliverable authorizes (decomposition.md:667, 711); D14's false clause "the boundary notes forbid a new ledger field" is deleted and replaced with the real reason (the tdd route already returns the block).
-  - R1-2 (accepted) — Added AC 4.8, 4.9 and 5.10 defining the harness- and overview-view subscribe messages, the per-payload message `type`s, and the subscriber-count the server keys each watcher lifecycle on, over the single-`projectId` socket (multi-server.ts:205-294, 2139-2151).
-  - R1-3 (accepted) — AC 2.4 split by provider: Agent-tool `model` for anthropic workers, merged provider map + launcher for deepseek workers (SKILL.md:24-34, sdd-providers.sh:72-74); AC 2.6 now merges a deepseek role's model too.
-  - R1-4 (accepted) — AC 1.6 made provider-conditional so a DeepSeek model is not rejected on a deepseek role (sdd-providers.sh:29).
-  - R1-5 (accepted) — AC 1.1 now reuses the read-only ordering/routing logic without `generate()`'s INDEX.md write (index-generator.ts:70-72).
-  - Minors (rejected) — AC 5.3/D7 "waiting" imprecision is self-correcting and harmless; the launch flag list and the log/launch-record paths are design-phase details the analysis marks non-blocking.
+  - R1-1 (accepted) — Resolved the ledger-format contradiction: the Introduction and a new scope note now state that a run which applied the file adds two provenance keys to `run.start`, which the decomposition's spec-9 deliverable authorizes; D14's false clause "the boundary notes forbid a new ledger field" is deleted and replaced with the real reason (the tdd route already returns the block).
+  - R1-2 (accepted) — Added AC 4.8, 4.9 and 5.10 defining the harness- and overview-view subscribe messages, the per-payload message types, and the subscriber-count the server keys each watcher lifecycle on, over the single-project socket.
+  - R1-3 (accepted) — AC 2.4 split by provider: Agent-tool model for anthropic workers, merged provider map plus launcher for deepseek workers; AC 2.6 now merges a deepseek role's model too.
+  - R1-4 (accepted) — AC 1.6 made provider-conditional so a DeepSeek model is not rejected on a deepseek role.
+  - R1-5 (accepted) — AC 1.1 now reuses the read-only ordering/routing logic without the generator's INDEX.md write.
+  - Minors (rejected) — the waiting-state imprecision is self-correcting; the launch flag list and the log/launch-record paths are design-phase details the analysis marks non-blocking.
+  - **Lint pass.** 13 fixed; rejected: none.
````
