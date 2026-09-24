# Verification evidence — agent-cache-ttl

Live scenarios (1), (2), (3) and (5) run against the branch from a rebuilt-harness
restart (design C8, Requirement 6 criterion 7). `recompute.mjs --write` replaces the
four lines below; the retrospective phase requires all four `passed` before it starts.

- (1) pending — session SID — orchestrator cw1h N cw5m 0; worker cw5m N cw1h 0
- (2) pending — session SID — gap S s, read P% of previous prefix, gapRewrites 0
- (3) pending — session SID — R rows, all equal to recompute
- (5) pending — session SID — run.start cacheTtl=FORCE_PROMPT_CACHING_5M=1, W warning lines
