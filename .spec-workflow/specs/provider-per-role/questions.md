# Questions — provider-per-role

## Gate A

Receipt written by the supervisor (run-20260922-033238) on requirements v1. The
drafter ranked these most direction-setting first; the first option of each is the
drafter's recorded choice, the rest are the rejected alternatives.

### 1. Refuse, never fall back

question: When the provider map has a bad row, the DeepSeek key is missing, or the launcher is missing: refuse the run with a note, or handle it another way?
options:
- Refuse the run with a note
- Ignore the row with a note
- Fall back to Anthropic for that role
answer: Refuse the run with a note (approve)

### 2. Failed preflight blocks the spec

question: If preflight (a) fails (DeepSeek cannot run the reviewer and write a verdict block): escalate and block the remaining tasks, or continue?
options:
- Escalate and block the remaining tasks until a human rules
- Continue with the Anthropic-only parts
- Defer the whole spec
answer: Escalate and block the remaining tasks until a human rules (approve)

### 3. Anthropic total is the headline

question: In harness usage and the watch view, which tokens figure is the headline: Anthropic only (the Max plan number) with DeepSeek beside it, or something else?
options:
- Anthropic tokens as the headline, DeepSeek shown beside it; all-provider totals kept in the data
- Drop DeepSeek from every total
- A provider filter parameter
answer: Anthropic tokens as the headline, DeepSeek shown beside it; all-provider totals kept in the data (approve)

### 4. Where the provider map lives

question: Where is the per-role provider named: a Providers section in agent-rules.md, or elsewhere?
options:
- A Providers section in agent-rules.md, one bullet per agent with provider and model
- A top-of-file key like the gates key
- A YAML block
- A provider field in each agent's frontmatter
answer: not asked — implementation mechanic; the drafter's recorded choice stands (A Providers section in agent-rules.md, one bullet per agent with provider and model)

### 5. A refused run leaves a ledger trace

question: When the run is refused at start (missing key, bad map row): write run start, a note and run end so the views show why, or stop silently?
options:
- Write run start, a note and run end; spawn nothing
- Stop before any ledger row
- A run start with a refused status
answer: Stop before any ledger row (needs revision — changed from the recorded choice; no free text)

## Gate B

Answered by Matthew on 2026-09-23 (run-20260922-033238): **approve**, no annotation.
The plan was approved with these class-a veto items unannotated: 1, 10, 2.

- 1 (rank 1): launcher body reads and sets ANTHROPIC_AUTH_TOKEN, DEEPSEEK_API_KEY and CLAUDE_CONFIG_DIR
- 10 (rank 2): end-to-end verification runs the launcher against a live API key
- 2 (rank 3): launcher integration test sets CLAUDE_CONFIG_DIR
