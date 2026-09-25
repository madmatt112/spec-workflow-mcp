# Questions — graph-orientation

## Gate A

1. **Live checks may be deferred.** When a verification scenario needs a harness run in a rebuilt, restarted session, defer it as pending in verification-evidence.md, or block the PR until a restarted session runs it?
   - options: Defer the live half as pending evidence (recorded) · Block the PR until a restarted session runs them
   - answer: Defer the live half as pending evidence — Matthew: the agent-cache-ttl retro made the evidence file the rule; this spec only changes briefs and a usage column, so lower risk than last time.

2. **Graph freshness after refresh.** After a graph refresh that exits 0, do workers treat the graph as current at HEAD, even when graphify left the file (and its built-at commit) unchanged?
   - options: Trust the exit code: current at HEAD, 0 behind (recorded) · Keep counting from the file's built-at commit · Force a graph write on every refresh
   - answer: Trust the exit code: current at HEAD, 0 behind — Matthew: a refresh that succeeds means the graph is current.

3. **What counts as a graph call.** In the harness usage graph column, what counts as one graph call?
   - options: One Bash row naming explain, query or path (recorded) · Every row mentioning graphify · Each graphify invocation inside a row
   - answer: One Bash row naming explain, query or path — Matthew: the other two options also count reads of the raw graph files.

4. **Refresh failure.** When graphify update fails or times out, does the run write a ledger note and continue, or stop the phase?
   - options: Ledger note and continue (recorded) · Stop the phase
   - answer: Ledger note and continue — Matthew: the graph is only an index; a stale one just makes citations less reliable.

5. **Money, data and legal posture.** What is the posture on refunds and forfeiture, credits, personal data and erasure, and the legal/compliance framing?
   - options: n/a — the spec touches no money, personal data, or legal surface (recorded)
   - answer: n/a — the spec touches no money, personal data, or legal surface — Matthew: the spec touches none of them.
