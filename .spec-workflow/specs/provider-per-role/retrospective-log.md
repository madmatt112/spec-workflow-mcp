# Retrospective log — provider-per-role

## 2026-09-22T15:37:11Z · requirements · v2 · gotcha
Round 1 (first review of this doc, post-gate-A v2): iterate MUST_FIX 1 / SHOULD_FIX 6 / MINOR 2. MUST_FIX is a D2/D5 decision-log contradiction the gate-A delta did not propagate; SHOULD_FIX cluster on refusal ordering, model mapping, launch values, worktree-cwd premise, agent-profiles rationale.
Evidence: adversarial-analysis-requirements.md
Cost: 1 reviewer spawn

## 2026-09-22T16:01:30Z · requirements · v3 · gotcha
Round 2 on v3: iterate MUST_FIX 1 / SHOULD_FIX 1 / MINOR 2. R2-1 is fix-induced (Compounds R1-2): the round-1 alias fix left the response model field unsettled between the requested claude-* alias and the DeepSeek message.model requirement, and preflight (a) does not gate it. No rejections either round.
Evidence: adversarial-analysis-requirements-r2.md
Cost: 1 reviewer spawn

## 2026-09-22T16:38:57Z · requirements · v4 · inefficiency
Round 3 on v4: iterate MUST_FIX 1 / SHOULD_FIX 1. Both findings compound the previous delta: R3-1 (fix-induced, Compounds R2-1) and R3-2 (Recurring, Compounds R2-2) — the R2-1 seam settlement and R2-2 wording did not fully land. D=4 with MUST_FIX flat (1->1 across r2->r3), so cap-convergence extra round not granted; going to post-cap corrective pass.
Evidence: adversarial-analysis-requirements-r3.md
Cost: 1 reviewer spawn
