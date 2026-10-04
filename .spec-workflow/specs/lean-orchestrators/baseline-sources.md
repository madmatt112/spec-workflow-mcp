# Baseline sources — lean-orchestrators

Committed baseline for the retrospective: the per-unit W and per-source W of
each document and implementation orchestrator spawn of `tdd-task-loop` and
`trading-rules`, captured while their transcripts still exist (Requirement 2).
A spawn that reports `sources unknown (<reason>)` stays so, with its ledger W;
no breakdown is invented (Requirement 2.2).

- Date: 2026-10-03
- CODE_ROOT HEAD: b8c53b4bd00647ff35514239f5c0420e194c562d

## tdd-task-loop (this spec store)

```
usage tdd-task-loop  runs 3  spawns 48  tokens 133,403,987
phase | agent | spawns | tokens | W | cw5m | cw1h | gapRewrites | graph
requirements | sdd-checker | 1 | 0 | 0 (+1 unknown) | unknown | unknown | unknown | 0
requirements | sdd-document-orchestrator | 2 | 8,680,916 | 1,853,906.8 | 0 | 496,165 | 2 | 0
requirements | sdd-drafter | 1 | 9,502,850 | 1,327,130.75 | 192,989 | 0 | 0 | 6
requirements | sdd-reviewer | 3 | 0 | 0 (+3 unknown) | unknown | unknown | unknown | 1
requirements | sdd-reviser | 3 | 3,166,837 | 759,182.8 | 179,092 | 0 | 0 | 0
requirements | total | 10 | 21,350,603 | 3,940,220.35 (+4 unknown) | 372,081 | 496,165 | 2 (+4 unknown) | 7  orch 40.7%  in 492 out 88,594 cw 868,246 cr 20,393,271  anthropic 21,350,603  deepseek 0  orch W/round 617,968.933
design | sdd-document-orchestrator | 1 | 6,516,676 | 1,580,372.7 | 0 | 446,566 | 3 | 0
design | sdd-drafter | 1 | 12,579,510 | 1,676,330.55 | 242,319 | 0 | 0 | 1
design | sdd-reviewer | 2 | 0 | 0 (+2 unknown) | unknown | unknown | unknown | 1
design | sdd-reviser | 1 | 7,075,858 | 1,127,104.9 | 130,628 | 0 | 0 | 0
design | total | 5 | 26,172,044 | 4,383,808.15 (+2 unknown) | 372,947 | 446,566 | 3 (+2 unknown) | 2  orch 24.9%  in 456 out 99,761 cw 819,513 cr 25,252,314  anthropic 26,172,044  deepseek 0  orch W/round 790,186.35
tasks | sdd-document-orchestrator | 1 | 5,716,782 | 1,064,379.7 | 0 | 231,447 | 1 | 0
tasks | sdd-drafter | 1 | 11,451,125 | 1,592,980.85 | 257,705 | 0 | 0 | 0
tasks | sdd-reviewer | 1 | 0 | 0 (+1 unknown) | unknown | unknown | unknown | 0
tasks | total | 3 | 17,167,907 | 2,657,360.55 (+1 unknown) | 257,705 | 231,447 | 1 (+1 unknown) | 0  orch 33.3%  in 264 out 41,678 cw 489,152 cr 16,636,813  anthropic 17,167,907  deepseek 0  orch W/round 1,064,379.7
implementation | sdd-implementation-orchestrator | 1 | 19,140,393 | 2,682,602.2 | 0 | 396,776 | 1 | 0
implementation | sdd-implementer | 18 | 34,991,849 | 6,095,136.2 | 1,278,356 | 0 | 0 | 2
implementation | sdd-verifier | 3 | 2,499,246 | 470,333.2 | 175,818 | 0 | 0 | 1
implementation | total | 22 | 56,631,488 | 9,248,071.6 | 1,454,174 | 396,776 | 1 | 3  orch 33.8%  in 1,406 out 236,221 cw 1,850,950 cr 54,542,911  anthropic 56,631,488  deepseek 0  orch W/task 157,800.129
retrospective | sdd-retro-analyst | 1 | 387,915 | 112,077.15 | 43,105 | 0 | 0 | 0
retrospective | sdd-retro-orchestrator | 1 | 1,563,227 | 283,029.3 | 77,302 | 0 | 0 | 0
retrospective | total | 2 | 1,951,142 | 395,106.45 | 120,407 | 0 | 0 | 0  orch 80.1%  in 76 out 12,542 cw 120,407 cr 1,818,117  anthropic 1,951,142  deepseek 0  orch W/round -
closeout | sdd-closeout-orchestrator | 2 | 4,670,876 | 865,271.2 | 0 | 198,549 | 0 | 0
closeout | sdd-implementer | 4 | 5,459,927 | 898,794.9 (+1 unknown) | 184,702 | 0 | 0 (+1 unknown) | 0
closeout | total | 6 | 10,130,803 | 1,764,066.1 (+1 unknown) | 184,702 | 198,549 | 0 (+1 unknown) | 0  orch 46.1%  in 270 out 32,876 cw 383,251 cr 9,714,406  anthropic 10,130,803  deepseek 0  orch W/round -
total |  | 48 | 133,403,987 | 22,388,633.2 (+8 unknown) | 2,762,016 | 1,769,503 | 7 (+8 unknown) | 12  in 2,964 out 511,672 cw 4,531,519 cr 128,357,832  anthropic 133,403,987  deepseek 0

sources tdd-task-loop  spawns 5  unknown 0  (shares are estimates; W totals are floors)
requirements | sdd-document-orchestrator | a90c9017dfba700e3 | calls 22 | peak 85,632 | W 345,572 | ledger W 345,572 | diff 0.00%
  base | 174,004 | 50.4%
  skill | 124,496 | 36.0%
  own-output | 33,848 | 9.8%
  bash | 7,115 | 2.1%
  prompt | 3,021 | 0.9%
  read:spec-store | 1,220 | 0.4%
  worker-report | 698 | 0.2%
  mcp:harness.brief | 511 | 0.1%
  mcp:harness.orient | 253 | 0.1%
  tool:Write | 250 | 0.1%
  mcp:spec-lint | 153 | 0.0%
  tool:SubagentHandback | 4 | 0.0%
requirements | sdd-document-orchestrator | a527f166d0562b678 | calls 74 | peak 162,872 | W 1,508,335 | ledger W 1,508,335 | diff 0.00%
  base | 535,365 | 35.5%
  skill | 419,718 | 27.8%
  own-output | 201,546 | 13.4%
  mcp:adversarial-review | 162,124 | 10.7%
  read:spec-store | 51,709 | 3.4%
  bash | 45,928 | 3.0%
  worker-report | 33,710 | 2.2%
  read:other | 22,781 | 1.5%
  prompt | 12,757 | 0.8%
  mcp:spec-lint | 11,937 | 0.8%
  mcp:harness.brief | 5,428 | 0.4%
  mcp:harness.orient | 1,510 | 0.1%
  mcp:approvals.approve | 1,254 | 0.1%
  mcp:approvals.request | 1,223 | 0.1%
  mcp:approvals.prune | 683 | 0.0%
  mcp:approvals.list | 509 | 0.0%
  tool:Edit | 150 | 0.0%
  tool:SubagentHandback | 4 | 0.0%
design | sdd-document-orchestrator | a9bfa276a98dff098 | calls 61 | peak 149,986 | W 1,580,373 | ledger W 1,580,373 | diff -0.00%
  skill | 497,426 | 31.5%
  base | 479,306 | 30.3%
  own-output | 319,918 | 20.2%
  bash | 85,713 | 5.4%
  read:spec-store | 71,703 | 4.5%
  mcp:adversarial-review | 61,608 | 3.9%
  worker-report | 22,368 | 1.4%
  mcp:spec-lint | 11,466 | 0.7%
  prompt | 9,677 | 0.6%
  read:other | 8,632 | 0.5%
  mcp:harness.brief | 6,062 | 0.4%
  tool:Write | 3,124 | 0.2%
  mcp:harness.orient | 1,183 | 0.1%
  mcp:approvals.request | 585 | 0.0%
  tool:Edit | 551 | 0.0%
  mcp:approvals.approve | 483 | 0.0%
  mcp:approvals.prune | 312 | 0.0%
  mcp:approvals.list | 253 | 0.0%
  tool:SubagentHandback | 4 | 0.0%
tasks | sdd-document-orchestrator | a9f174477e2096c49 | calls 56 | peak 136,143 | W 1,064,380 | ledger W 1,064,380 | diff -0.00%
  base | 350,234 | 32.9%
  skill | 330,755 | 31.1%
  own-output | 163,286 | 15.3%
  bash | 111,998 | 10.5%
  mcp:spec-lint | 31,993 | 3.0%
  mcp:adversarial-review | 21,309 | 2.0%
  read:other | 17,084 | 1.6%
  read:spec-store | 15,567 | 1.5%
  prompt | 6,946 | 0.7%
  worker-report | 6,367 | 0.6%
  mcp:harness.brief | 2,896 | 0.3%
  tool:Write | 1,582 | 0.1%
  mcp:approvals.request | 924 | 0.1%
  mcp:harness.orient | 820 | 0.1%
  mcp:approvals.approve | 699 | 0.1%
  mcp:approvals.prune | 536 | 0.1%
  mcp:deferrals.add | 472 | 0.0%
  mcp:approvals.list | 387 | 0.0%
  tool:Edit | 376 | 0.0%
  mcp:harness.gate | 144 | 0.0%
  tool:SubagentHandback | 4 | 0.0%
implementation | sdd-implementation-orchestrator | a46fec387251fb6c6 | calls 127 | peak 229,380 | W 2,682,602 | ledger W 2,682,602 | diff 0.00%
  skill | 728,721 | 27.2%
  base | 662,322 | 24.7%
  read:spec-store | 547,894 | 20.4%
  own-output | 393,864 | 14.7%
  mcp:review-task.gate | 129,358 | 4.8%
  worker-report | 96,250 | 3.6%
  bash | 67,223 | 2.5%
  mcp:harness.brief | 17,732 | 0.7%
  prompt | 17,247 | 0.6%
  read:other | 6,891 | 0.3%
  tool:Write | 6,135 | 0.2%
  mcp:deferrals.list | 4,998 | 0.2%
  mcp:harness.orient | 2,359 | 0.1%
  mcp:spec-status | 875 | 0.0%
  mcp:spec-index.generate | 729 | 0.0%
  tool:SubagentHandback | 4 | 0.0%
```

## trading-rules (projectPath: /home/mcf/repo/tradr-hosted)

```
usage trading-rules  runs 2  spawns 56  tokens 185,059,411
phase | agent | spawns | tokens | W | cw5m | cw1h | gapRewrites | graph
requirements | sdd-checker | 2 | 0 | 0 (+2 unknown) | unknown | unknown | unknown | 0
requirements | sdd-document-orchestrator | 2 | 3,102,277 | 561,675.1 (+1 unknown) | 0 | 118,808 | 0 (+1 unknown) | 0
requirements | sdd-drafter | 0 | 0 | 0 | - | - | - | 6
requirements | sdd-reviewer | 2 | 0 | 0 (+2 unknown) | unknown | unknown | unknown | 0
requirements | sdd-reviser | 2 | 0 | 0 (+2 unknown) | unknown | unknown | unknown | 0
requirements | total | 8 | 3,102,277 | 561,675.1 (+7 unknown) | 0 | 118,808 | 0 (+7 unknown) | 6  orch 100.0%  in 62 out 5,236 cw 118,808 cr 2,978,171  anthropic 3,102,277  deepseek 0  orch W/round 280,837.55
design | sdd-checker | 1 | 0 | 0 (+1 unknown) | unknown | unknown | unknown | 0
design | sdd-document-orchestrator | 1 | 0 | 0 (+1 unknown) | unknown | unknown | unknown | 0
design | sdd-reviewer | 2 | 0 | 0 (+2 unknown) | unknown | unknown | unknown | 0
design | sdd-reviser | 2 | 0 | 0 (+2 unknown) | unknown | unknown | unknown | 0
design | total | 6 | 0 | 0 (+6 unknown) | unknown | unknown | unknown | 0  orch -  in 0 out 0 cw 0 cr 0  anthropic 0  deepseek 0  orch W/round 0
tasks | sdd-document-orchestrator | 1 | 0 | 0 (+1 unknown) | unknown | unknown | unknown | 0
tasks | sdd-drafter | 1 | 14,848,014 | 1,815,669.75 | 224,779 | 0 | 0 | 0
tasks | sdd-reviewer | 1 | 0 | 0 (+1 unknown) | unknown | unknown | unknown | 0
tasks | total | 3 | 14,848,014 | 1,815,669.75 (+2 unknown) | 224,779 | 0 | 0 (+2 unknown) | 0  orch 0.0%  in 190 out 14,735 cw 224,779 cr 14,608,310  anthropic 14,848,014  deepseek 0  orch W/round 0
implementation | sdd-implementation-orchestrator | 2 | 34,359,717 | 6,831,644.6 | 0 | 1,736,640 | 7 | 0
implementation | sdd-implementer | 20 | 110,557,715 | 15,776,405.75 (+2 unknown) | 2,396,047 | 0 | 0 (+2 unknown) | 1
implementation | sdd-verifier | 12 | 13,420,804 | 2,599,300.05 (+2 unknown) | 973,271 | 0 | 0 (+2 unknown) | 0
implementation | total | 34 | 158,338,236 | 25,207,350.4 (+4 unknown) | 3,369,318 | 1,736,640 | 7 (+4 unknown) | 1  orch 21.7%  in 2,626 out 448,333 cw 5,105,958 cr 152,781,319  anthropic 158,338,236  deepseek 0  orch W/task 401,861.447
retrospective | sdd-retro-analyst | 1 | 197,684 | 67,871.1 | 40,626 | 0 | 0 | 0
retrospective | sdd-retro-orchestrator | 1 | 1,581,224 | 266,145.8 | 93,108 | 0 | 0 | 0
retrospective | total | 2 | 1,778,908 | 334,016.9 | 133,734 | 0 | 0 | 0  orch 88.9%  in 54 out 466 cw 133,734 cr 1,644,654  anthropic 1,778,908  deepseek 0  orch W/round -
closeout | sdd-closeout-orchestrator | 1 | 5,083,997 | 765,154.3 | 0 | 126,521 | 0 | 0
closeout | sdd-implementer | 2 | 1,907,979 | 335,777.1 | 115,298 | 0 | 0 | 0
closeout | total | 3 | 6,991,976 | 1,100,931.4 | 115,298 | 126,521 | 0 | 0  orch 72.7%  in 172 out 5,836 cw 241,819 cr 6,744,149  anthropic 6,991,976  deepseek 0  orch W/round -
total |  | 56 | 185,059,411 | 29,019,643.55 (+19 unknown) | 3,843,129 | 1,981,969 | 7 (+19 unknown) | 7  in 3,104 out 474,606 cw 5,825,098 cr 178,756,603  anthropic 185,059,411  deepseek 0

sources trading-rules  spawns 6  unknown 3  (shares are estimates; W totals are floors)
requirements | sdd-document-orchestrator | ad70b38386afff4a3 | calls 31 | peak 129,963 | W 561,675 | ledger W 561,675 | diff -0.00%
  base | 255,325 | 45.5%
  skill | 189,427 | 33.7%
  own-output | 52,983 | 9.4%
  read:spec-store | 20,652 | 3.7%
  read:other | 18,515 | 3.3%
  bash | 10,498 | 1.9%
  mcp:spec-lint | 6,206 | 1.1%
  prompt | 4,063 | 0.7%
  worker-report | 1,561 | 0.3%
  mcp:harness.brief | 1,532 | 0.3%
  mcp:harness.orient | 494 | 0.1%
  tool:Write | 210 | 0.0%
  tool:Edit | 205 | 0.0%
  tool:SubagentHandback | 4 | 0.0%
requirements | sdd-document-orchestrator | - | sources unknown (no-agent-id) | ledger W unknown
design | sdd-document-orchestrator | - | sources unknown (no-agent-id) | ledger W unknown
tasks | sdd-document-orchestrator | - | sources unknown (no-agent-id) | ledger W unknown
implementation | sdd-implementation-orchestrator | a0ab6c3bf42ecb592 | calls 150 | peak 245,203 | W 5,564,112 | ledger W 5,564,112 | diff 0.00%
  base | 1,360,837 | 24.5%
  skill | 1,334,078 | 24.0%
  read:spec-store | 1,164,826 | 20.9%
  own-output | 1,059,744 | 19.0%
  worker-report | 228,493 | 4.1%
  mcp:review-task.gate | 166,106 | 3.0%
  bash | 136,055 | 2.4%
  mcp:harness.brief | 42,882 | 0.8%
  tool:Edit | 40,415 | 0.7%
  prompt | 22,122 | 0.4%
  tool:Write | 4,608 | 0.1%
  mcp:harness.orient | 3,945 | 0.1%
implementation | sdd-implementation-orchestrator | adfce73a460254d51 | calls 69 | peak 181,607 | W 1,267,533 | ledger W 1,267,533 | diff -0.00%
  base | 469,194 | 37.0%
  skill | 269,602 | 21.3%
  read:spec-store | 244,960 | 19.3%
  own-output | 143,597 | 11.3%
  mcp:deferrals.list | 55,839 | 4.4%
  bash | 49,953 | 3.9%
  worker-report | 10,787 | 0.9%
  mcp:review-task.gate | 7,425 | 0.6%
  prompt | 6,984 | 0.6%
  mcp:harness.brief | 2,700 | 0.2%
  tool:Edit | 2,322 | 0.2%
  tool:Write | 1,629 | 0.1%
  mcp:harness.orient | 1,421 | 0.1%
  mcp:spec-index.generate | 803 | 0.1%
  mcp:spec-status | 312 | 0.0%
  tool:SubagentHandback | 4 | 0.0%
```
