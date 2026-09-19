# Verification — harness-usage-and-tiers/design v3, Round 2 items

R2-1: addressed — v3's Revision History and Component 7 state the retro edit retains `phase.start phase=retrospective` (line 35) and `phase.end phase=retrospective result=retro-ready` (lines 39-40) in `harness/skills/sdd-retrospective/SKILL.md`, confining the replacement to the spawn-write clause between them; both line numbers match the real file.
R2-2: addressed — v3 pins the `s.endedAt !== undefined` guard onto the `agent.stop` fill's condition at `src/watch/ledger.ts:308`, which matches the real code (`} else if (a.event === 'agent.stop' && typeof a.tokens === 'number' && s.tokens === undefined) {`), keeping a running node from ever carrying tokens.

VERIFIED: 2/2

## Deferred findings
- design.md line 78 and the v3 Revision History describe the agent.stop fill as "inside the join spanning lines 305 to 311"; the real join (the double loop plus its event-type branches) runs `src/watch/ledger.ts:293-314` per `codebase-context.md`, so the join's own span is mis-cited even though the guarded-fill line (308) itself is correct.
