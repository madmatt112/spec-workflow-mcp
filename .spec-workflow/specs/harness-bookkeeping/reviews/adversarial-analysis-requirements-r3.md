# Narrow check — harness-bookkeeping/requirements v3

R2-1: addressed — AC 4.2 now names the ticker surface (`ledger.ts:296-315` → `render.ts:171`) and requires a `spawn.usage` ticker branch carrying precise role, result and tokens.
R2-2: addressed — 5.4 adds a not-live guard (`run.end`/prior run, `!runEnd`), pins the row's state as the `phase.start` entry snapshot, emits no row for a live phase, and drops the false "supervisor's row" framing as a distinct mechanism 5.2 retires.
R2-3: addressed — 5.1 adds the shared-table preservation clause: keep rows whose `Spec` cell is another spec, regenerate/replace only this spec's rows (`ledger.ts:145-157`, filter at `:157`).
R2-4: addressed — new AC 3.7 states the hook keeps its `tool`/`agent.start`/`agent.stop` activity writes to `harness-activity.jsonl` (feeding the live badge and token fallback) and additionally writes ledger-shaped `spawn.start`/`spawn.end` to `harness-events.jsonl`, a file it does not open today.

VERIFIED: 4/4

## Deferred findings
- None.
