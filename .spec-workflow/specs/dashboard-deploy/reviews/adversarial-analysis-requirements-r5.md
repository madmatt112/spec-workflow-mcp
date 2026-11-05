# Narrow check — dashboard-deploy/requirements v5

S-1: addressed — R5 AC1 now takes the deploy lock first, re-reads the record and acts only on that re-read (stopping the unit if `unitStarted` is true or a unit is live) before releasing, and R1 AC4's re-read→persist→spawn runs under the same lock with a skip when `unitStarted` is already set; R5 AC2's added paragraph walks both race orderings (cancel-first finds no record so the tick starts nothing; tick-first finds `unitStarted` true so cancel stops the completed spawn), closing the pre-lock-read interleave the finding described. v5 Revision History records this as M-1 — fixed (MUST_FIX).

VERIFIED: 1/1

## Deferred findings

(none)
