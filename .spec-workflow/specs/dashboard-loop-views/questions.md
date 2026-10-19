## Gate A

1. Where does the Run page PR panel get its CI state, mergeable and verdict?
   Options: The merge rule's own read, saved on the run record by the controller | A dashboard-side poll of GitHub | A new ledger row per read
   Answer: The merge rule's own read, saved on the run record by the controller

2. How is W per task defined for a closed spec?
   Options: Whole-spec weighted W over every run, divided by the tasks file's task count | Implementation-phase W only | Division by task-done ledger rows
   Answer: Whole-spec weighted W over every run, divided by the tasks file's task count

3. Where does each repository's W-per-task baseline come from?
   Options: A new per-repository agent-rules key (baseline-w-per-task) | The median of the repository's earlier closed specs | The first closed spec | A value derived from the per-spec baseline key
   Answer: A new per-repository agent-rules key (baseline-w-per-task)

4. What values can a deferral's owner take, and what do existing records read as?
   Options: Optional, exactly matthew or harness, no default | Default absent records to harness | Make owner required on add
   Answer: Optional, exactly matthew or harness, no default

5. What is the money, personal-data-and-erasure, and legal/compliance posture (refunds and forfeiture, credits, legal framing)?
   Options: n/a — the spec touches no money, personal data, or legal surface | A posture review
   Answer: n/a — the spec touches no money, personal data, or legal surface

## Gate B

1. Approve the task plan, or annotate it? Reply "Approve" to proceed, or type an annotation to revise the tasks once before implementation.
   Options: Approve | Annotate
   Answer: Approve
