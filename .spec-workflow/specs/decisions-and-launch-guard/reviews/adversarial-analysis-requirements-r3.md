# Narrow check — decisions-and-launch-guard/requirements v3

S-1: addressed — v3 Req 10 AC1 reserves `danger` for `isStalled`, maps a healthy run's `runDot` amber/red to `warning` and green/grey to `neutral`; AC2 now says age alone never forces danger and a 15-min activity gap on a healthy run is `warning`, matching `board.ts` (`runDot` red at >=15 min, `isStalled` false while `driven`); AC3 states stalled -> danger. R2-1 recorded under v3 Revision History.

VERIFIED: 1/1

## Deferred findings

None.
