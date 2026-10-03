R3-1: addressed — Testing Strategy (design.md:235) now adds "a render() snapshot per distinct rendered output (each kind's variant and phase/D branches)" in place of one-per-kind, matching the v4 Revision History line (design.md:274).
R3-2: addressed — C6's implementer row (design.md:111) and C9 (design.md:182,185) now name the test-author block's `files` key as the producer and state "On a marked task the implementer's authorFiles is the test-author block's files and authorReport is that block, verbatim," matching the v4 Revision History line (design.md:275).

VERIFIED: 2/2

## Deferred findings
- design.md:185's passthrough sentence still lists only `findings`, `folds`, `notes`, `re-decided` as the unread-passthrough set; the new `authorFiles`/`authorReport` wire is stated as a separate sentence rather than folded into that list, so a reader skimming only the enumerated list could still miss it.
