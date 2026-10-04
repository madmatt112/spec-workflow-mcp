# Agent rules — lean-fixture

Throwaway rules for the lean-orchestrators end-to-end fixture (Requirement 8).
The fixture code root is already its own git repo, so no worktree is entered;
the live run is headless (`claude -p`), so both human gates fall to `record`
and never stall.

worktree-per-change: not required
gates: record
tdd-test-command: node --test {files}

## Checks

- Any change under `src/`: `node --test`.
