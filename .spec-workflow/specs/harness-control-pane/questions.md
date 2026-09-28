# Questions — harness-control-pane

## Gate A

1. **Override reach** — How far do the per-run model overrides in the setup file reach?
   - options: All roles: the supervisor passes worker overrides to each orchestrator in its launch prompt | Orchestrators only | The supervisor only
   - answer: All roles: the supervisor passes worker overrides to each orchestrator in its launch prompt (approved by Matthew)

2. **Run lifetime** — Does a run launched from the page survive a dashboard restart?
   - options: Yes: detached, output to a log file, a launch record lets the page reattach and stop it | No: killed when the dashboard stops, like the adversarial runner | Tied to the dashboard with no log file
   - answer: Yes: detached, output to a log file, a launch record lets the page reattach and stop it (approved by Matthew)

3. **Launch spec** — Which spec can the page launch, and what does the supervisor do with a setup file for another spec?
   - options: Only the routed active spec; the supervisor ignores a file for another spec with a warning | Any spec; the setup file overrides routing | Any spec; the supervisor refuses a mismatched file
   - answer: Only the routed active spec; the supervisor ignores a file for another spec with a warning (approved by Matthew)

4. **Stop cleanup** — Who writes run.end and removes the pointer line when the operator stops a run?
   - options: The dashboard, after the child exits | Rely on the supervisor | Leave it for the next run to find
   - answer: The dashboard, after the child exits (implementation mechanic — agent-decided, not asked)

5. **Posture** — Top-level money, personal-data-and-erasure, and legal/compliance posture?
   - options: n/a — the spec touches no money, personal data, or legal surface
   - answer: n/a — the spec touches no money, personal data, or legal surface (single option — not asked)
