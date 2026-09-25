# Verification evidence — agent-cache-ttl

Live scenarios (1), (2), (3) and (5) run against the branch from a rebuilt-harness
restart (design C8, Requirement 6 criterion 7). `recompute.mjs --write` replaces the
four lines below; the retrospective phase requires all four `passed` before it starts.

- (1) passed — session 9475ef6c-46c2-402d-b00f-44fc6cf61a8f — orchestrator cw1h 124970 cw5m 0; worker cw5m 16011 cw1h 0
- (2) passed — session 0ee6d641-dc05-45d0-add4-314c19235d0d — gap 819 s, read 100% of content older than the last turn (80% of the whole previous prefix; the last turn is re-sent on resume), gapRewrites 0
- (3) passed — session 9475ef6c-46c2-402d-b00f-44fc6cf61a8f — 10 rows, all equal to recompute
- (5) passed — session 683dc48c-bda7-4b54-9398-09da32ca0ba7 — run.start cacheTtl=FORCE_PROMPT_CACHING_5M=1, 1 warning lines
