# Adversarial Analysis — worktree-review-signals/design (v3), Round 3 verification

- R2-1: addressed — v3 gives `runGit`'s `ExecFileOptions` (task-diff.ts:52-56, confirmed) a 10 s timeout (Component 2, line 64), states the degraded outcome (`ok: false` feeding `head-degraded`/rejected diff) at both the prepare call site (Component 4, line 87) and the status route (Component 6, line 127), and adds Error Handling item 9 (line 240); Revision History records it Accepted (SHOULD_FIX).
- R2-2: addressed — v3 widens the gitignore entry to the glob `.spec-workflow/specs/*/task-state.json*` (Data Models line 196, Decision 19 line 278), verified against the real `uniqueTempPath` (registry-lock.ts:52-54) and stale-aside (registry-lock.ts:208) patterns and the existing `.gitignore:150` precedent; adds Error Handling item 10 (line 241) naming the store-write-throws path, verified against the real `try { await fn(); } finally { await releaseLock(...); }` at registry-lock.ts:385-390 (no catch, so a throw from `fn` propagates while the lock still releases); Revision History records it Accepted (SHOULD_FIX).

VERIFIED: 2/2

## Deferred findings

(none)
