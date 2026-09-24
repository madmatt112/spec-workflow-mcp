# Questions — agent-cache-ttl

## Gate A

1. **Live checks may be deferred.** When the gate session still runs the old harness, defer the live scenarios (1),(2),(3),(5) as a verification deferral, or block the PR until a restarted session runs them?
   - options: Defer the live half with a verification deferral (recorded) · Block the PR until a restarted session runs them
   - answer: Block the PR until a restarted session runs them (Matthew, 2026-09-24)

2. **Gap rewrite rule.** How is a gap rewrite timed: call time as the earliest line timestamp of a message id (gap over 300 s, write over half the previous prefix), or another timing?
   - options: Earliest line timestamp per message id (recorded) · Last line timestamp per message id · Gap measured from the end of the previous call
   - answer: Earliest line timestamp per message id — not asked: implementation mechanic, decided by the agents

3. **Report cells without data.** In harness usage, how do spawns without the new cache keys and DeepSeek spawns show?
   - options: Count as unknown (unknown or +N unknown), DeepSeek as a dash (recorded) · Print zero · Drop the spawn from the cache columns
   - answer: Count as unknown, DeepSeek as a dash — not asked: implementation mechanic, decided by the agents

4. **Override value format.** How does run.start record a cache override?
   - options: One key holding setting name and value (recorded) · A bare lifetime such as 5m · Two keys: source and value
   - answer: One key holding setting name and value — not asked: implementation mechanic, decided by the agents

5. **Partial cache split.** When some transcript calls lack the cache_creation split, what does the hook write?
   - options: All three fields unknown (recorded) · Sum the calls that have the split · Unknown for the two write fields only
   - answer: All three fields unknown — not asked: implementation mechanic, decided by the agents
