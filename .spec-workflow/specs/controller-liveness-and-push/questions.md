## Gate A

1. What does the phone message carry from the wait?
   Options: The first line of the first question, plus kind, project and spec (supersedes the advisor spec's no-question-text rule) | Kind, project and spec only, as the advisor spec decided | The full question text
   Answer: The first line of the first question, plus kind, project and spec (supersedes the advisor spec's no-question-text rule)

2. Which config file drives the phone push?
   Options: notify.json replaces push.json; push.json is no longer read | Keep both targets | Read notify.json first, fall back to push.json
   Answer: notify.json replaces push.json; push.json is no longer read

3. What happens when a drive crashes inside the controller?
   Options: An error wait with retry/abandon, run goes waiting; Re-drive answers retry; a restart expires it and re-drives | An acknowledge-only wait with Re-drive as the only resume | No wait; the stalled flag only
   Answer: An error wait with retry/abandon, run goes waiting; Re-drive answers retry; a restart expires it and re-drives

4. Does the one-hour reminder survive a controller restart?
   Options: Yes: scheduled from the wait's created time, reminded ids recorded | An in-memory timer only | No reminder
   Answer: Yes: scheduled from the wait's created time, reminded ids recorded

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
