## Gate A

1. Pause applies to a queued run that has not started
   Options: apply it (paused at once, never started until Resume) | refuse it with a 409 | leave a queued run to start and pause later
   Answer: apply it (paused at once, never started until Resume)

2. Pause on a waiting run keeps the wait open and parks the run when the wait is answered
   Options: keep the wait answerable and park on the answer | refuse the pause while a wait is open | close or expire the wait
   Answer: keep the wait answerable and park on the answer

3. Pause on a usage-paused run replaces the reason with operator and drops the resume time
   Options: replace the reason | refuse with a 409 | keep the usage reason and ignore the pause
   Answer: replace the reason

4. Resume while a pause is still pending withdraws the request
   Options: withdraw it | answer 409 not-paused until the run parks | make the operator wait and then resume
   Answer: withdraw it

5. Resume reuses the existing resume route and branches on the pause reason
   Options: reuse the route | add a separate operator-resume route
   Answer: reuse the route

6. Proceed with this spec, or do nothing and defer it? Reply "Proceed" to continue, or pick "Do nothing — defer this spec" (optionally followed by a reason) to end the run now — the drafted requirements are kept and no design, tasks or implementation run.
   Options: Proceed | Do nothing — defer this spec
   Answer: Proceed
