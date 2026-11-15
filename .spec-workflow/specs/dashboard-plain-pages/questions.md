## Gate A

1. What state word does a spec with documents get when it is not live, closed, deferred or next?
   Options: Add a sixth word, "stopped", with the phase it stopped in | Keep five words and show it as "not started" | Show it as "next"
   Answer: Add a sixth word, "stopped", with the phase it stopped in

2. Do Specs and Deferrals group by spec store or by registered project?
   Options: One block per spec store (the two tradr projects share one) | One block per enabled project (same store listed twice)
   Answer: One block per spec store (the two tradr projects share one)

3. How is a run's utilisation per task measured for the fit line?
   Options: Per-run attribution: positive steps on log lines carrying the run's id | Window delta since the run started (counts other runs' spend)
   Answer: Per-run attribution: positive steps on log lines carrying the run's id

4. How is the 24 h burn computed from the usage log?
   Options: Sum of positive steps over the last 24 h; "not known yet" until the log reaches back 24 h | Plain difference of the two lines 24 h apart | Same over a shorter span with its length shown
   Answer: Sum of positive steps over the last 24 h; "not known yet" until the log reaches back 24 h

5. What is the money, personal-data-and-erasure, and legal/compliance posture?
   Options: n/a — the spec touches no money, personal data, or legal surface
   Answer: n/a — the spec touches no money, personal data, or legal surface

6. Proceed with this spec, or do nothing and defer it? Reply "Proceed" to continue, or pick "Do nothing — defer this spec" (optionally followed by a reason) to end the run now — the drafted requirements are kept and no design, tasks or implementation run.
   Options: Proceed | Do nothing — defer this spec
   Answer: Proceed

## Gate B

1. Approve the task plan, or annotate it? Reply "Approve" to proceed, or type an annotation to revise the tasks once before implementation.
   Options: Approve | Annotate
   Answer: Approve
