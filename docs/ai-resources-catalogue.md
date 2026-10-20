# AI tools and techniques from saved LinkedIn posts: catalogue and fit

Source: `~/linkedin-posts.md` (44 posts that Matthew saved, exported 2026-10-20). This
document lists the AI-development tools and techniques in those posts, and gives each one a
fit against the foundation rework (`docs/foundation-review.md`, `docs/controller-design.md`).
The grill decisions are at the end.

Fixed assumptions that filter the list (2026-10-07, ADR 0001): one operator; Claude Code on
the subscription only (no API billing, no other runtime); mechanisms are deterministic code,
and the model is only for judgement and prose; tokens come first.

## 1. Catalogue

Post numbers refer to `~/linkedin-posts.md`.

### Harness architecture (agent factories, meta-harnesses, loops)

| # | Item | What it is |
| --- | --- | --- |
| 30 | Warren (Jaymin West) | Open-source "software factory": work queue of issues, control plane, ephemeral sandboxes, PR review, event stream, git-tracked memory. |
| 34 | Omnigent (Databricks) | Meta-harness above Claude Code and Codex: compose agents, swap model mid-loop, contextual policies (for example, ask after each $100 of spend), OS sandbox. |
| 3 | PostHog cloud agents runtime | Write-up of the lessons from building their own agent runtime. |
| 29 | PostHog on loops | PR babysitter, bug fixer, performance autoresearch: collect data, build, evaluate, repeat. |
| 11 | Redis Streams for resumable LLM streaming | One ordered, replayable stream per turn; the agent works on when the client disconnects. |
| 12 | Reef | Continuous training from per-call feedback. Out of scope (subscription only). |
| 42 | DeerFlow 2.0 | Local agent that writes a missing tool and continues. |

### Token cost and context

| # | Item | What it is |
| --- | --- | --- |
| 4 | Router plugin (Alexei Ledenev) | Per-turn model and effort routing (Haiku 5.5 or Opus 5.5) from a small classifier (Jev, Clef); counts the cold-cache cost before a switch. |
| 33 | Headroom | Compression layer in front of the model: JSON, code structure, logs. |
| 38 | Token economics (Alex Struc) | RTK for command output, "Caveman" terse-output skill, no resume of stale sessions after the cache expires. |
| 39 | Pin the CLI version | Cache TTL change, about 20K injected tokens per request in new CLI versions; pin versions, monitor. |
| 1 | XERJ | Code and docs search engine over MCP; 2.7x fewer output tokens on code the model never saw, no gain on popular code. |
| 36 | codeindex | Blast-radius score per file and a symbol index; `--claude-md` output. |

### Specs, documents and verification

| # | Item | What it is |
| --- | --- | --- |
| 25 | AI-assisted RFCs (Phil Calçado) | A serious-looking document no longer proves serious work; an RFC process updated for that. |
| 26 | Principal AI Engineer Handbook | CI checks page structure; a "verified on" date that expires fails the build until a person reviews the page again. |
| 2 | SRE Alerting Guidelines | Alerting guide that ships with an LLM skill file. |
| 41, 14 | Strix; Claude Code for pentesting | Open-source AI penetration testing. |

### Writing style and prompting

| # | Item | What it is |
| --- | --- | --- |
| 23 | Tone rules (Henryk Brzozowski) | The anti-antithesis rules already in Matthew's `CLAUDE.md`. |
| 24 | Brevity rules | Long answers copy the style of the Claude-written files they read; tell the model not to copy that style. |
| 21, 22 | natural-writing skill; avoid-ai-writing skill | Style rule sets. |
| 20 | Prompting tips | Let it ask questions (AskUserQuestion); dictate context; one used skill beats many. |
| 17 | Summarizer layer | A second model rewrites Claude's replies for the reader. |

### Interfaces and operations

| # | Item | What it is |
| --- | --- | --- |
| 7 | Google A2UI | Agents describe UI as declarative JSON; the client renders it with its own components. No agent code reaches the browser. |
| 13 | HQTUI | Terminal UI library, 15 fps over SSH. |
| 32 | voicebox | Local voice clone, dictation, TTS, MCP server. |
| 31, 37 | exe.dev; Hetzner box for agents | Remote machines for agents. |
| 8 | Jev Ultrafast | Browser agent from an element table, no screenshots. |

### Not relevant to the harness

5 (interview notes), 6 (uncensored model), 9 (overnight app builder), 10 (DeepSeek
pricing), 15 (Omarchy), 16 (MLX Serve), 18, 43 (resume prompts), 19 (consulting), 27
(Staff Engineer at Stripe), 28 (small model), 35 (mcp-canada), 40 (Claude tips), 44 (RAG
guide).

## 2. Fit against the rework

Research pass 2026-10-20 (web; lnkd.in links were not followed). "Router" (post 4) was not
found. Claude Code docs: a model or effort change mid-conversation invalidates the prompt
cache, and one report measured only about 12% saving from per-turn routing. So route per
step, not per turn.

### 2.1 The controller already does this (the posts confirm the design)

- **Warren, PostHog runtime (30, 3).** Queue, control plane, one worktree per run, spend
  cap, event stream, crash recovery, delivery as a PR, memory in git files. The controller
  has each of these (ledger, run records, token cap, `run.json` pids, spec store).
- **Token hygiene (38, 39).** RTK, the one-hour cache on long-lived roles (spec 13),
  terse worker reports (80 words).
- **Tone rules (23).** Already in `~/.claude/CLAUDE.md`.

### 2.2 Candidates to add to the rework

| ID | Idea | From | Where it lands | Size |
| --- | --- | --- | --- | --- |
| C1 | **CI babysitter.** A red CI check on the run's PR starts a capped implementer fix round on the PR branch before it becomes an `error` wait. | 29 (PostHog loops), 30 | merge stage (`merge.ts`, `runs.ts`) | M |
| C2 | **Blast radius as a risk input.** The review gate counts the files that import a touched file, direct and transitive, and raises the risk tier above a threshold. | 36 (codeindex) | `gate-rules.ts` | S-M |
| C3 | **Implementer model by risk.** A low-risk task runs on Sonnet, a high-risk task on Opus. Chosen per step, never mid-step. | 4, research note | `implementation.ts`, agent profiles | S |
| C4 | **Security pass for sensitive specs.** When a spec touches sensitive paths (money, personal data, auth), the end-to-end verification adds a security review with a reproduced proof for each finding. | 41, 14 (Strix) | verifier brief | S-M |
| C5 | **Contextual policy in code.** Example: a step that adds a new dependency opens a wait before the PR merges. | 34 (Omnigent) | gate rules, merge rule | S |
| C6 | **Pin the Claude CLI version per run.** Record `claude --version` in `run.json` at launch; a change mid-run writes a ledger note. | 39 | `runs.ts` | XS |
| C7 | **Prose-style carry-over.** Drafter, reviser and retro compiler do not copy the style of the Claude-written files they read. | 24 | agent role files | XS |
| C8 | **"Do nothing" option and rubric pre-flight.** Gate A and design decisions always list "do nothing"; a short rubric check runs before a document goes to review. | 25 (Calçado) | drafter brief, lint | S |
| C9 | **Docs that expire.** `SDD-HARNESS.md` and the ADRs carry a "verified against build" line; a check fails when the build moved on and nobody re-verified. | 26 | CI check | S |

### 2.3 Inputs to the advisor design session (spec 25)

- **Search and indices (1, 36, graphify).** XERJ (MCP search over code, docs and logs;
  helps only on code the model never saw; untested on private code), codeindex (symbol
  index, blast radius), graphify (already local). Candidates for "state of the world" search.
- **Staged actions as declarative UI (7, A2UI).** The advisor emits a typed action; the
  dashboard renders it from a fixed component set and the operator confirms. This matches
  design §16 "staged, not executed".
- **Policies in code (34).** Same guard idea as the staged actions.

### 2.4 Rejected

- **Headroom (33).** A proxy needs `ANTHROPIC_BASE_URL`; that is not verified on a
  subscription. RTK already compresses command output.
- **Omnigent or Warren as a runtime (34, 30).** They replace the controller rather than add
  to it.
- **Reef, DeepSeek, local models (12, 10, 16, 28).** Subscription-only runtime.
- **HQTUI, voicebox, remote boxes (13, 32, 31, 37).** No current need. Ask again if the
  operator wants a terminal Now view or remote runs.

## 3. Grill decisions

Grill with Matthew, 2026-10-20.

Round 1:

1. **Priority.** Verification leads (idea A). Token items only where nearly free.
2. **Term.** The deterministic test of a commit is a **Check** (`GLOSSARY.md`); "review
   gate" is avoided.
3. **C1 CI babysitter: yes.** A red CI check on the run's PR gets up to 2 implementer fix
   rounds on the PR branch, then the `error` wait as today.
4. **C2 blast radius: parked.** Input to the advisor's index design, not built now.
5. **C3 model by risk: yes.** Implementer on Sonnet (`claude-sonnet-5`) for a task gate B
   did not flag, on the current Opus tier (`claude-opus-4-8`) for a flagged task. Chosen
   once per step.
6. **C4 security pass: yes, flagged specs only.** End-to-end verification of a spec with
   sensitive-path flags adds a security review; only a reproduced finding counts.
7. **C5 new dependency: flag only.** Shown on the PR panel and in the ledger; no wait.
8. **C6 CLI version: no.**
9. **C7 style carry-over: yes,** one line in the drafter, reviser and retro-compiler roles.
10. **C8: "do nothing" only.** Gate A always offers "do nothing / defer this spec". No
    rubric pre-flight.
11. **C9 docs that expire: no.**

Rounds 2 and 3:

12. **Packaging.** C1, C3, C4 and C5 become spec 26, run through the controller after
    spec 24 and before 25 and 22. C7 and C8 land now as small PRs.
13. **C1 scope.** The run's own PR only; a red close-out PR stays a wait.
14. **C1 conflicts.** The fixer also resolves a merge conflict with main, inside the same
    2-round cap; a conflict it cannot resolve becomes the wait as today.
15. **C4 outcome.** A reproduced finding goes through capped fix rounds and the
    adjudicator, then a wait if it still reproduces. An unreproduced suspicion becomes a
    deferral owned by Matthew.
16. **C3 source.** Only sensitive-path flags route a task to Opus; keyword flags do not.
17. **C8 outcome.** "Do nothing" at gate A ends the run, tags the decomposition entry
    `(deferred)` with the reason, and keeps the drafted requirements in the spec store.

No ADR: each decision is cheap to reverse.

### Harness eval suite (from evaluation.club, grill 2026-10-20)

Source: dotclub.club (Dan McKinley). evaluation.club argues that reliable agents come from
repeatable eval suites fed by real failures, not from prompt tuning.

18. **Do it** as its own spec 27 `harness-evals`, after 26 and before 25.
19. **A case** is one role run on a frozen brief and a small fixture repository state.
20. **Runner.** The controller's own step runner, on the subscription. `claude plugin eval`
    was not chosen: its sandbox has a fresh HOME, it cannot target one role directly
    (unconfirmed) and its billing is unconfirmed.
21. **Grading.** Code graders on the role's structured report and the repository; 3 runs per
    case, all must pass.
22. **When.** The self-update runs the cases of every role file or brief template that
    changed since the live build, and refuses the deploy on a failure.
23. **Override.** Only an explicit flag naming the failing case; the deploy then writes the
    override to the Progress log and opens a deferral to fix the case.
24. **Seed set.** Every role failure since 2026-10-12 (about six). Pure code bugs stay unit
    tests.
25. **New cases.** A retro finding that is a role or brief defect proposes a case; the
    close-out lands it with the fix, on the operator's approval of the retro plan.

