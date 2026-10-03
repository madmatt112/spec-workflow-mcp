# Questions — lean-orchestrators

## Gate A

1. **Impl lifetime** — How many tasks should one implementation orchestrator spawn work before the supervisor restarts it?
   - options: 5 tasks per spawn (recorded) · 20 tasks per spawn as today · 10 tasks per spawn · one task per spawn
   - answer: 5 tasks per spawn (Matthew, approve)

2. **Breakdown source** — Where should the per-source breakdown of orchestrator W be computed?
   - options: the usage action reads orchestrator transcripts on request (recorded) · the activity hook writes per-source rows at subagent stop · a standalone script outside the server
   - answer: not asked — implementation mechanic; recorded choice stands: the usage action reads orchestrator transcripts on request

3. **Bookkeeping** — Where should the batched orchestrator bookkeeping (ledger rows, checkbox, retro entry, HANDOFF row, commit) live?
   - options: per-run shell scripts written beside the event script (recorded) · new server actions that write the ledger and commit · leaving the calls as they are
   - answer: not asked — implementation mechanic; recorded choice stands: per-run shell scripts written beside the event script

4. **Orch model** — Should this spec change or trial a cheaper orchestrator model?
   - options: defer to a retro decision (recorded) · try Sonnet on the fixture run through the per-role override · switch the default now
   - answer: defer to a retro decision (Matthew, approve)

5. **Posture** — What is the money, personal-data-and-erasure, and legal/compliance posture (refunds and forfeiture, credits, legal framing) for this spec?
   - options: n/a — the spec touches no money, personal data, or legal surface (recorded)
   - answer: not asked — single option; recorded choice stands: n/a
