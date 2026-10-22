## Gate A

1. Where do the fix rounds for a red or conflicted run PR land?
   Options: The merge stage only; the implementation phase's reconcile loop stays as is | Replace the implementation phase's three reconcile rounds with two | One shared cap across the reconcile loop and the merge stage
   Answer: The merge stage only; the implementation phase's reconcile loop stays as is

2. How does the security pass for a sensitive spec run?
   Options: A separate verifier step after the end-to-end verification passes, on gate B sensitive-path flags only | A section inside the end-to-end verification brief | A separate step that also fires on sensitive files found in the diff
   Answer: A separate verifier step after the end-to-end verification passes, on gate B sensitive-path flags only

3. Which model do implementer steps outside a task (repair, reconcile, merge fix) use?
   Options: The implementer role profile (Opus tier) | The Sonnet route | The Opus tier only when the spec has any sensitive-path flag
   Answer: The implementer role profile (Opus tier)

4. What decides that a task's implementer runs on the Opus tier?
   Options: Recompute gate B class (a) sensitive-path items from the current tasks document at each step | Read the gate-b wait's proposals | The Check's per-commit risk tier
   Answer: Recompute gate B class (a) sensitive-path items from the current tasks document at each step

5. What is the money, personal-data-and-erasure, and legal/compliance posture (refunds and forfeiture, credits, legal framing)?
   Options: n/a — the spec touches no money, personal data, or legal surface
   Answer: n/a — the spec touches no money, personal data, or legal surface

6. Proceed with this spec, or do nothing and defer it? Reply "Proceed" to continue, or pick "Do nothing — defer this spec" (optionally followed by a reason) to end the run now — the drafted requirements are kept and no design, tasks or implementation run.
   Options: Proceed | Do nothing — defer this spec
   Answer: Proceed

## Gate B

1. Approve the task plan, or annotate it? Reply "Approve" to proceed, or type an annotation to revise the tasks once before implementation.
   Options: Approve | Annotate
   Answer: Approve
