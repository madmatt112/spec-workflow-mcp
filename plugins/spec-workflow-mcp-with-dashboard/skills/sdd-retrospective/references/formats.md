# Retrospective formats

## `retrospective.md`

```markdown
# Retrospective — <SPEC>

Compiled <ISO date> by the retro orchestrator from the retro log, HANDOFF, deferrals,
implementation logs, task reviews, the git log and earlier retrospectives.

<!-- Proposal format for the analyst: see the end of this file. -->

## Gotchas
## Product bugs found
## Tool and MCP errors or deficiencies
## Harness defects
## Prompt misunderstandings
## Inefficiencies
## Documentation gaps
## Model behaviour
## Process deviations and rulings
## Decisions the harness made for the human
## Repeat patterns
## Summary numbers
```

Finding format (one bullet per finding, under its section):

```
- **F<n> — <title>.** <what happened, one to three sentences>. Evidence: <reference>.
  Frequency: <once | <n> times in this spec | seen in <other spec> too>. Cost: <rounds,
  spawns, minutes, tokens, or "unknown">.
```

`## Repeat patterns` lists findings that also appear in an earlier spec's
`retrospective.md`, with both references. `## Summary numbers` is a short table:
phases, versions per phase, review rounds, fix rounds, adjudications, escalations,
rulings, deferrals added, orchestrator spawns, PR.

The file ends with this block so the analyst has the proposal format in hand:

```markdown
## Proposal format (for the analyst)

One proposal per finding, numbered P<n> and naming the finding it answers:

- **P<n> (F<m>) — <title>.** <the change, one to three sentences>.
  Target: <harness skills or agents | server code, docs or templates | project steering,
  templates or decomposition conventions | CLAUDE.md, memory or settings | product code>.
  Effort: <S | M | L>. Risk: <low | medium | high>: <one line>.
  Prerequisites: <none | list>.
  DECISION NEEDED: <yes | no>. <When yes: the question, then two to four options, one
  line each, with your recommendation marked.>

The file ends with `## Graduation candidates`: patterns seen in two or more specs'
findings, each proposed for promotion into a steering document or agent-rules.md,
with the rule text as it would be written.
```

## `retrospective-proposals.md`

```markdown
# Retrospective proposals — <SPEC>

Written <ISO date> by the retro analyst from retrospective.md.

## Proposals
<one proposal per finding, in the proposal format>

## Graduation candidates
<pattern → proposed rule text → target document>
```

## `retrospective-plan.md` (written by the supervisor)

```markdown
# Retrospective plan — <SPEC>

Status: <APPROVED | DRAFT — decisions needed>
Date: <ISO date>

## Approved proposals
<each approved proposal, verbatim>

## Decisions
<each DECISION NEEDED question with the chosen option, or "open" in a DRAFT>

## Rejected proposals
<each, with the reason>

## Open questions (DRAFT only)
<the questions a human still needs to answer>
```
