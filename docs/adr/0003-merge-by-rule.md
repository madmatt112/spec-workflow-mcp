---
status: accepted
---
# A green pull request is merged by rule, not by a click

Decided 2026-10-09, reversing the 2026-10-02 dashboard decision that the merge button is the
operator's alone. Since 2026-09-24 the overwatch session had merged every harness PR by a
fixed rule (CI green, mergeable, no attribution trailers, the repository's merge method) and
nothing went wrong. The harness now applies that rule in code and merges without a wait. A
project can set "ask me first", which turns the merge into a wait instead.

## Consequences

- An agent still never merges: the rule runs in the controller, which is not a model.
- "Never merged by an agent" in the keep list means the LLM roles; it does not forbid this.
- Amended 2026-10-10 after the adversarial review: the harness's own repository defaults to
  "ask me first", because a green build there proves the tests pass, not that the controller
  boots, and a bad merge takes down every project's control plane. The 2026-09-24 record was
  a human reviewing each diff, not a blind rule.
- Amended 2026-10-14 after the second fixture run: "CI green" is read from the GitHub
  Actions workflow runs and the commit statuses of the PR's head sha, not from the PR's
  check rollup. A fine-grained personal access token cannot read check runs on a private
  repository (GitHub offers it no Checks permission), and that is the only token the
  controller has. A head younger than five minutes with no run yet, in a checkout that has
  workflow files, counts as pending. A PR whose state the token cannot read at all is an
  `error` wait, never a silent re-check.
- Amended 2026-10-15 after the third fixture run: a PR that fails the rule while nothing
  is in flight (a red check, a conflict, a wrong head branch, an attribution trailer) is
  an `error` wait as well; the controller re-checks only while a run, a status or
  mergeability is still pending. The run had sat two hours in `merging`, with no visible
  reason, on a `Co-Authored-By` trailer the test author wrote into one commit.
