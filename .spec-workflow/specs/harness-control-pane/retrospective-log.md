
## 2026-09-28T20:18:20Z · requirements · v1 · gotcha
Round 1 on v1: iterate, MUST_FIX 1 / SHOULD_FIX 4 / MINOR 3. R1-1 is a scope contradiction (AC 2.9 writes new run.start ledger fields that decomposition boundary note and D14 forbid). R1-2..R1-5 are wire/validation gaps.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements.md
Cost: 1 reviewer spawn

## 2026-09-28T20:54:15Z · requirements · v2 · inefficiency
Round 2 on v2: iterate 1/2/3. All findings fix-induced by the v2 lint trim: R2-1 (MUST_FIX) scope-note citation 753-754 landed on an unrelated note and short of the quoted phrase (correct 754-755); R2-2 (SHOULD_FIX) trim dropped 'distinct from initial/projects-update' from AC 4.9/5.10 and AC 5.10's type enumeration; R2-3 (SHOULD_FIX) AC 4.9 'only harness subscribers via existing broadcastToProject' contradicts that helper's projectId-only filter. Lesson: an aggressive over-cap trim can move citations off quoted text and weaken accepted wire-contract ACs.
Evidence: /home/mcf/repo/spec-workflow-mcp/.spec-workflow/specs/harness-control-pane/reviews/adversarial-analysis-requirements-r2.md
Cost: 1 reviewer spawn
