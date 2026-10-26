---
status: accepted
---
# The advisor is never in the path of a run

Decided 2026-10-10. The operator wants a model to talk to that knows every project the
harness manages, the harness itself, and other context the operator names (their website,
writing, other systems), for coordination and for finding patterns a single run cannot see.
The overwatch session did some of this, but runs depended on it and it burned tokens while
idle. So the advisor is one role with two entries (a conversation, or a one-shot second
opinion on a wait), and three guarantees: the controller never calls it except when the
operator presses "second opinion", no run ever waits for it, and it is alive only during a
conversation or a one-shot. Its actions (launch, answer, merge, file a deferral, add a
decomposition entry) go through the controller's own API, only on the operator's explicit
word in the conversation, and are recorded as done by the advisor on the operator's behalf.

## Consequences

- A standing "watch X and tell me" is not part of the role. If wanted later it is a scheduled
  one-shot through the controller, never a resident session.
- The advisor's notebook is its own; the controller never reads it.
- Amended 2026-10-26 after the advisor design session: the advisor also does the
  coordination work that a standing session did from 2026-10-15 to 2026-10-26 (picks on
  waits, reviewing run PRs, fixing harness bugs that runs hit), but only inside a
  conversation the operator opens. Writing a fix, testing it and opening its PR are
  ordinary coding work; merging it and deploying it are staged actions. With no session
  between conversations, the controller sends a phone push for every new wait (plain
  code, no model). Picks on a wait stay on press ("second opinion"), so the guarantee that
  the controller never calls the advisor without the operator holds.
