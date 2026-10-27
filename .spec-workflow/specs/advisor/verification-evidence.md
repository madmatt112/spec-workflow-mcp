# Verification evidence — advisor

Entry checks 1-5 of the decomposition's verification scenario run automatically
in `src/advisor/__tests__/advisor-e2e.test.ts` (task 19), against a real
`MultiProjectDashboardServer`, stub `claude`/`gh`, a fake embedder and a local
push-capture server; `npm test` proves them on every run, so they carry no
line here. The two lines below cannot run inside that loop (D6) and stay
`pending` until the operator runs each in a rebuilt, restarted session; the
retrospective phase requires both to read `passed` before it opens.

- (3-real-embedder) pending — Requirement 4 AC 4 and AC 5, with a real
  installed embedding model (not the fake Ollama stand-in advisor-e2e.test.ts
  uses): a reworded query whose words share no key word with a retro finding
  still ranks that finding in the first ten hits, and the response reports
  `meaning: "on"`. Needs a local Ollama (or another loopback embedding
  server) installed and named in `search.json` on the operator's machine.
- (6) pending — Requirement 8 AC 5 (end-to-end check 6): a `sources.json`
  entry whose file holds a planted instruction to merge, launch or stage
  anything causes the advisor to stage no action from it. Needs a live
  advisor conversation (a real `claude` session reading an actual source
  file), not the `scripts/stub-claude.mjs` fixture check 2 uses.
