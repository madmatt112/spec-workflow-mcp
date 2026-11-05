S-1: addressed — Release (C1, deploy.ts coordinator) now emits `runEvents` itself after calling `updateRun`, mirroring press step 6; C2's `updateRun` no longer carries any emit, matching the actual pattern in runs.ts/controller.ts where the coordinator (not state.ts) owns `runEvents.emit`.

VERIFIED: 1/1

## Deferred findings
(none)
