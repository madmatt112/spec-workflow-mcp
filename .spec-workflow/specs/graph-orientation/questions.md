# Questions — graph-orientation

## Gate A

1. **Live checks may be deferred.** When a verification scenario needs a harness run in a rebuilt, restarted session, defer it as pending in verification-evidence.md, or block the PR until a restarted session runs it?
   - options: Defer the live half as pending evidence (recorded) · Block the PR until a restarted session runs them
   - answer:

2. **Graph freshness after refresh.** After a graph refresh that exits 0, do workers treat the graph as current at HEAD, even when graphify left the file (and its built-at commit) unchanged?
   - options: Trust the exit code: current at HEAD, 0 behind (recorded) · Keep counting from the file's built-at commit · Force a graph write on every refresh
   - answer:

3. **What counts as a graph call.** In the harness usage graph column, what counts as one graph call?
   - options: One Bash row naming explain, query or path (recorded) · Every row mentioning graphify · Each graphify invocation inside a row
   - answer:

4. **Refresh failure.** When graphify update fails or times out, does the run write a ledger note and continue, or stop the phase?
   - options: Ledger note and continue (recorded) · Stop the phase
   - answer:

5. **Money, data and legal posture.** What is the posture on refunds and forfeiture, credits, personal data and erasure, and the legal/compliance framing?
   - options: n/a — the spec touches no money, personal data, or legal surface (recorded)
   - answer:
