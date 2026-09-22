R3-1: addressed — Req 6 crit 2 now runs preflight (a) with `--model claude-opus-4-8` (the launcher's own alias, not `deepseek-v4-pro`), gives `message.model` one gating expectation (`deepseek-v4-pro` or the alias echoed back; anything else fails (a)), and Req 7 crit 1 now checks `spawn.start` against the map name and `spawn.end` against that recorded `message.model` string separately, so the forced spawn.start/spawn.end equality assumption is gone.
R3-2: addressed — Req 6 crit 2's pass gate now also requires a deterministically located, digit-parsed transcript and the `message.model` check (not just file-exists + verdict block), and Req 6 crit 5 names a consequence for each launcher-critical probe (auth, `--agents` keys, transcript locator, child hooks, effort); D7/D8 restated to match.

VERIFIED: 2/2

## Deferred findings
- Req 6 crit 5's auth-path clause ("`ANTHROPIC_AUTH_TOKEN` alone authenticates the child ... — (a) runs under that environment, so no fails (a)") is grammatically garbled; the intended rule (a "no" answer fails (a)) is inferable but the sentence itself doesn't parse cleanly.
