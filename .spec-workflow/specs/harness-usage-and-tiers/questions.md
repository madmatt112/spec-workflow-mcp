# Questions — harness-usage-and-tiers

## Gate A

Receipt written by the supervisor (run run-20260919-143236) before asking. Decisions are
ranked most direction-setting first; the first option of each is the recorded choice.
D1, D4 and D7 are implementation mechanics (recording sites, storage layout, return
transport): the agents decided them and they were not put to the human.

### D9 Tier change delivery

question: Is the Opus 4.8 tier change verified and documented, or re-applied?
options:
1. Verify and document it; treat 599bdca as the delivery (the agent files already say Opus 4.8 high; only docs and the ledger table disagree)
2. Re-edit the five agent files
answer:

### D1 Orchestrator ledger rows

question: Who writes the orchestrator's spawn.usage and spawn.end rows?
options:
1. The supervisor writes spawn.usage (agent, role, result); the hook writes the orchestrator's spawn.end
2. Keep the supervisor's spawn.end and have the hook skip orchestrators (no orchestrator usage, against the entry)
3. Both write spawn.end (the second row finds no open node at src/watch/ledger.ts:241 and its result is lost)
answer:

### D5 usage run scope

question: Which runs does usage sum for a ledger?
options:
1. Every run in the ledger, flat
2. The last run only, as --watch does
3. One table per run
answer:

### D4 Profile packaging

question: Where do the model profiles live at runtime?
options:
1. Ship inside dist/; ledger.ts resolves them relative to its own module, empty table on absence
2. Import through resolveJsonModule from harness/ (outside rootDir ./src)
3. Read from the working directory
answer:

### D7 usage return shape

question: What does usage return?
options:
1. Text in message and numbers in data
2. Text only
3. JSON only
answer:
