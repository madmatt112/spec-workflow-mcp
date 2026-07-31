/**
 * The one definition of "this is a worktree e2e spec".
 *
 * `playwright.worktree.config.ts` runs exactly these files (`testMatch`) and
 * `playwright.config.ts` ignores exactly these files (`testIgnore`). The two
 * configs are only correct while those sets are complementary, so they import
 * the same constant rather than each holding a copy: a copy kept in step by a
 * comment fails silently in both directions — edit only the `testIgnore` and
 * the worktree suites also run under the default config, which sets no
 * `SPEC_WORKFLOW_HOME` and therefore registers temporary worktrees in the
 * developer's real global registry as permanently unreapable entries; edit only
 * the `testMatch` and `test:e2e:worktree` quietly runs zero specs.
 *
 * Anchored to the *basename* by the leading separator class. Playwright tests
 * this regex against the full absolute path, so an unanchored
 * `/worktree-.*\.spec\.ts$/` would also match every spec in a checkout that
 * merely *lives* under a `worktree-…` directory — which, in a repository about
 * git worktrees, is the expected place to be working. That would swallow the
 * whole default suite: `test:e2e` would silently run nothing at all.
 */
export const WORKTREE_SPEC_PATTERN = /[\\/]worktree-[^\\/]*\.spec\.ts$/;
