# Adversarial Analysis — harness-control-pane/design (v3) — verification of round-2 corrective pass

R2-1: addressed — launch() step 1 now check-and-sets the in-flight flag synchronously before any await (design.md:86), and admission (design.md:84) is reframed as advisory, naming launch step 1 as the atomic guard.
R2-2: addressed — C5's consumer line and C7's producer note both re-point/reset only on a launch-update that changes `logPath` (design.md:107, 125), so a within-run stop/exit/finalise leaves it unchanged.
R2-3: addressed — ruled out under the v3 Revision History line with the stated reason `word cap` (design.md:314).

VERIFIED: 3/3

## Deferred findings
- The R2-1 fix names no `LaunchError.step` value for a call that loses the in-flight check-and-set race (design.md:81, 90 lists only `'worktree' | 'worktree-setup' | 'spawn'`); the loser's error shape/handling at the route layer (409 vs 500) is unstated.
