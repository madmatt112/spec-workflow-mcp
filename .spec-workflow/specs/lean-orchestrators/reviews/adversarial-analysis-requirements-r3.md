R2-1: addressed — Req 1.5 defines "input W" as all non-output terms (input + 1.25·cw5m + 2·cw1h + 0.1·read, not the `input` field alone), states `base` sizing as the first call's context tokens minus visible chars/3.5 (no tokenizer), and names the probe as the normative algorithm.
R2-2: addressed — Req 6.7 extends the already-landed check to the retro-log append (detected by a run-id marker grep, explicitly not a `task <N>` match that a `ruling` entry would also hit) and declares the HANDOFF State row a rewrite idempotent by overwrite; citations at SKILL.md:250-256 (retro-log append) and :256-257 (HANDOFF rewrite) confirmed.

VERIFIED: 2/2

## Deferred findings
- Req 1.5's `base` formula is residual tokens over visible characters/3.5 but does not restate which call ("the first call") this is scoped to (first call of the spawn vs. first call overall); likely clear from context but worth a second look if ambiguity surfaces in design.
