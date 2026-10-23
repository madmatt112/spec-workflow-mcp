# Design — eval-drafter-test-seam-label

## Component 1 — seam provider

Exports `callSeam(input)` (Requirement 1 AC1). Its own test file drives every branch of
`callSeam` directly.

## Component 2 — seam consumer

Calls `callSeam(input)` from Component 1 to validate its own input (Requirement 2 AC1).
Component 2's tests exercise `callSeam`'s branches again, indirectly, through the
consumer's call — they cover Component 1's behaviour, not new behaviour of their own.
