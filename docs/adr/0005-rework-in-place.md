---
status: accepted
---
# Rework in place: the controller is a module of the dashboard server

Decided 2026-10-10 after the code map (`docs/foundation-review-codemap.md`). About two
thirds of the server is deterministic mechanics with tests (parsers, approvals, the review
gate, lint, worktree roots, ledger, launcher, shell); the control plane is skill prose plus a
launcher. A new repository would copy the two thirds, lose the history and buy a name. So
the controller (ADR 0004) is built inside the dashboard server process, which already is the
long-lived process with the watchers and the HTTP surface. It writes the same spec-store,
approvals and ledger formats, so `--watch` and the shell keep working while the prose
control plane is replaced phase by phase.

## Consequences

- Order: freeze the roadmap, delete the legacy code, give the controller the outer loop
  together with the document loop, then implementation, then retro and close-out, re-plan
  the roadmap on what remains. (Amended 2026-10-10: documents before implementation, because
  the document loop proves the step mechanism with no irreversible git; and no bridge code
  in the supervisor, which already stops where the controller needs it for the other
  phases.)
- The name and package stay for now.
- The legacy and controller work are done by hand in briefed sessions until the controller
  has run one phase end to end; the harness dogfoods itself from there.
