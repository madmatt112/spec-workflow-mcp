# Foundation review: adversarial review of the plan (2026-10-10)

Report of a read-only adversarial subagent against `docs/foundation-review.md`,
`docs/controller-design.md`, ADRs 0001-0006, the code map and the harness docs. Dispositions
are in `docs/foundation-review.md` section 9.

## REMOVE

**Auto-merge-by-rule on the harness's own repo, coupled to a self-rebuild.** Blocker.
ADR 0003 merges without a wait; design §2 restarts the controller after a merge that changes
`src/`. CI green proves tests pass, not that the service boots. A bad `dist/` is merged by
the controller and then run as its own rebuild, bricking the one process that holds the
queue, dashboard and liveness for every project, with nothing standing to notice. The
2026-09-24 clean record was a human reviewing each diff, not a blind rule.
Alternative: the controller's own repo is `merge: ask`; or decouple merge from restart:
boot-smoke-test the new build in a scratch process, replace only on success, else keep the
old build and write an `error` wait.

**Implementation as the first inlined phase, as a safe choice.** Should-fix.
Implementation is the highest-blast-radius loop (bash, edits, push, PR, merge) and it is bet
on an unverified claim that a bare `claude -p` worker can edit files and run tests with no
prompt and no nested-process denial. Alternative: inline documents first (writes and MCP,
no irreversible git), proving the fresh-process-with-schema mechanism before the merge path
depends on it.

## ADD

**Request authentication on the LAN dashboard and the advisor action API.** Blocker.
`multi-server.ts:126-151` has host-binding guardrails but zero request auth. LAN-reachable
plus launch, answer and merge, plus an unauthenticated action API: anyone on the network can
merge to main, launch runs that execute bash, or answer the harness's own gates.
Alternative: a shared secret on every mutating route and the advisor endpoint; default bind
on 127.0.0.1; the token required even on the LAN.

**A pre-step-(a) roadmap freeze.** Blocker.
INDEX says every spec on disk is complete, so the next spec is the first one in
`decomposition.md` with no directory: spec 16 `dashboard-gates`, still `(active)`, which
describes building gates into the supervisor, the thing the controller replaces. Round 4.6
is a human promise; `decomposition.md` is a routing input. Alternative: park specs 16-21
under a "superseded" heading and regenerate INDEX before step (a).

**An external watchdog, a controller test harness, a budget cap, cancel and cleanup.**
Should-fix. The dashboard reads liveness from the controller, which is useless when the
controller is what crashed; §13-14 are a manual scenario plus prototypes with no automated
loop tests; no per-run cap or trip behaviour; no cancel with worktree, branch and PR
teardown. Alternative: a heartbeat that restarts the unit and pushes on repeated failure; a
stub `claude` binary returning canned step JSON (pattern in `launcher.test.ts` `childEnv`);
a per-run cap that writes an `error` wait; a `cancel` that signals the step and cleans up.

## CHANGE

**Reframe step (b): it is not "wrap the existing supervisor".** Should-fix.
`sdd-continue/SKILL.md:19-21,152-157`: the supervisor never stops at a gate when unattended;
it leaves gates pending and continues. Stop-at-gate and exit is spec 16's unbuilt mechanism,
to be built into a 594-line skill that is deleted at (d). Alternative: skip the bridge and
inline the first phase directly.

**Split step (a) and lift the behavioural changes out of the deletion.** Should-fix.
One PR of ~36k deleted lines across seven areas, reviewed by hand, that also carries two
behaviour changes and an e2e rewrite. Alternative: pure deletions in a few reviewable PRs;
the fixes in their own small PR with tests.

**Harden the advisor's write path; "only on the operator's word" is prose, not a
mechanism.** Should-fix. The advisor reads named sources (a website repo, a writing folder,
other systems, the web) and holds an action API. A prompt-injected source could drive merge
or launch with the operator's blast radius. Alternative: every advisor write surfaces in the
dashboard for the operator to confirm, in code; source content is marked data, never
instructions.

**Fix the "resume is cheap" assumption and the shared-checkout rebuild.** Consider /
should-fix. The dominant pause is the usage window, multi-hour, past the 1 h cache, so a
resume re-pays the cold prefix. The post-merge hold covers only the controller's own steps,
while tradr and jobsync keep running the old harness from the same checkout; a self-rebuild
would swap `dist/` under a live tradr run. Alternative: drop the claim and quantify the
per-step cold-prefix and MCP-startup cost; make the hold wait on any harness run sharing the
checkout.

## Questions the plan never asked the operator

1. Over a week unattended, what single event makes you switch it off: one bad merge, tokens
   over a ceiling, a run touching the wrong repo? That defines what must never happen
   automatically.
2. Besides you on this machine, who ever reaches the dashboard or the advisor, and would a
   stranger launching a run or merging be annoying or harmful?
3. From the advisor chat, do you want it able to act (merge, launch), or only advise and
   hand you the button?
4. When a run merges overnight and the next build breaks, what do you want in the morning:
   everything paused behind one wait, or other projects still running on the last good
   build?
5. When the roadmap is empty, what should the harness do: idle, wait for you, or pick its
   own next work?

## Top three

1. No authentication anywhere on a LAN-reachable dashboard plus advisor action API.
2. Auto-merge-by-rule plus the controller rebuilding itself: one bad green-CI build bricks
   the whole control plane.
3. The roadmap is not frozen before step (a): a stray "continue the sdd process" starts
   spec 16 under the old plan.
