# Adversarial Analysis — spec-lint/design (v1), round 1

Attack surface: feasibility, consistency, edge cases. Fresh lens: wire contracts across
a boundary (tool response ⇄ skill Lint step; round-prompt sections ⇄ reviewer; the
changes script's I/O; the `plugins/` copy vs `harness/` source). This is the first
review, so every finding is Novel; the whole document is delta.

I read both ends of every cited range: `src/tools/{index,root-selection,adversarial-review,get-task-review,review-gate}.ts`,
`src/core/{mdx-validator,task-validator,task-parser,gate-rules,path-utils,task-diff}.ts`,
the three `src/markdown/templates/*.md` cap lines, `docs/{TOOLS-REFERENCE,SDD-HARNESS}.md`,
`harness/skills/sdd-document-phase/{SKILL.md,references/briefs.md,references/cleanup.md}`,
`harness/agents/{sdd-document-orchestrator,sdd-reviewer}.md`,
`harness/skills/sdd-continue/references/formats.md`, `scripts/sync-plugin-assets.cjs`,
the decomposition entry 5, and the approved `requirements.md`.

---

## Findings

### R1-1 — Tool count target is off by one (MUST_FIX)

Component 10 says: "`docs/TOOLS-REFERENCE.md:5`: '11 tools' becomes '12 tools' (the
array at `src/tools/index.ts:17-30` after registration)." That target is false.

`registerTools()` at `src/tools/index.ts:17-30` **already contains 12 entries** today
(`specWorkflowGuideTool` … `getTaskReviewTool`; I counted 12, and the codebase-context
file agrees: line 5 "the twelve registered tools", line 110 "registers twelve"). The
`docs/TOOLS-REFERENCE.md:5` header still says "**11 tools**" — a pre-existing drift from
when `get-task-review` was added — while the tool-index table at `:22-33` already lists
**12 rows**. After registering `spec-lint` the array holds **13 entries** and the table
holds **13 rows**, so the count at `:5` must become **13**, not 12.

The design ties the count to "the array … after registration" (= 13) but states the
value as 12, contradicting its own cited source. Shipping the design as written leaves
`docs/TOOLS-REFERENCE.md:5` saying "12 tools" against a 13-tool registry, which is
exactly the count/length invariant requirement 10.4 is meant to hold. Requirement 10.4's
own parenthetical ("11 today; twelve entries") carries the same miscount, but the design
is the artifact under review and its stated number is wrong about the codebase.
Fix: the count becomes 13; state it as 13 in Component 10.

### R1-2 — Lint step runs before the version variable is updated; lint commit is mislabeled (MUST_FIX)

Component 8 attaches "Run the Lint step." to **`SKILL.md:97` (Step 1 item 5)**,
**`:143` (Step 3 item 5)** and **`:227` (Step R item 2)** — "after its commit". At each
site the very next item performs the version assignment:

- `SKILL.md:98`: "6. D = 1. Go to Step 2." (D is first defined here)
- `SKILL.md:143-144`: "5. Checkpoint commit … `v<D+1> after round <A>`." then "6. D = D + 1."
- `SKILL.md:227-228`: "2. … Checkpoint commit." then "3. D = D + 1."

The Lint step (Component 8 sub-steps 3 and 6) names the brief `reviews/lint-brief-<PHASE>-v<D>.md`
and commits `docs(sdd): <SPEC> <PHASE> v<D> lint`, and states "D unchanged" — i.e. it
assumes `D` already equals the just-written version. It does not. At Step 3 the reviser
has just written **v<D+1>** and committed it, but `D` is still the pre-increment value
until item 6. So the lint pass on a v(D+1) document produces a brief and commit labeled
**`v<D> lint`** — the previous version number. At Step 1 the Lint step first executes
before `D = 1` runs at item 6, so `<D>` is unset.

This is not cosmetic. The changes script (Component 9) runs at the *next* Step 2 with the
now-incremented `D` and looks up the lint commit with
`--grep="^docs\(sdd\): <SPEC> <PHASE> v${D} lint$"`. Because the commit was written as
`v<D-1> lint`, that lookup misses and the **`## Lint commit` section is silently
omitted** — defeating requirement 9.2 / D2 ("Re-verify only citations the `v<D>` lint
commit changed … the `## Lint commit` section"). Worse, the base lookup for that round
(`v${D-1}( |$)`, `git log -1`) then matches the mislabeled lint commit and returns it as
the diff base, so the reviewer's `## Changes since` diff is near-empty. The design's own
placement (item 5, before the increment) contradicts its "v<D> lint / D unchanged"
binding. Fix: sequence the Lint step after the `D` assignment, or bind it to "the version
just committed" rather than the stale `D`.

### R1-3 — Info-only path never defines the open list or the `L-n` labels the round prompt needs (SHOULD_FIX)

Component 8 sub-step (2) ends the Lint step when `summary.error + summary.warning` is 0,
which skips sub-steps (3)–(7). Sub-step (7) is the only place `LINT.open` is defined
("every `L-n` the report marks rejected/partially accepted, **plus every `info`
finding**"), and sub-step (3) is the only place findings receive `L-n` labels (in the
brief's `## Revision input`). So on an info-only run — the exact case requirement 9.3 and
Component 9 call out ("no pass ran (info-only, 8.2)") — `LINT.open` is never computed and
no finding is ever numbered.

Yet Component 9's Machine-verified bullet must then list those info findings as
`L-n (<severity>, <rule>, line <line>): <message>`. The design keeps `LINT.findings`
(sub-step 2) but never says how the orchestrator numbers them or assembles the open list
when the step ended early. The definition of `LINT.open` that includes info findings only
lives in the sub-step that info-only runs skip. Fix: state that the open list and `L-n`
numbering come from `LINT.findings` regardless of whether a reviser ran, or move that
computation out of the early-exit branch.

### R1-4 — EARS/criteria numbered-item regex is silently widened past requirement 4.1 (MINOR)

Requirement 4.1 pins the numbered-item shape as `^\d+\.\s`. Component 3's `criteria`
uses `^\s*(\d+)\.\s+(.*)$`, adding a leading `\s*`. Acceptance-criteria items sit at
column 0 in the templates, so the practical effect is small, but the widening also
matches indented/nested numbered lines inside a criterion's continuation, which could be
mis-scanned as separate criteria. The drafter raised no RE-DECIDED flag and D-list does
not record this departure. Either match `^\d+\.\s` or document the widening.

### R1-5 — Four-backtick diff fence is defeated by a document that contains a four-backtick fence (MINOR)

D2 chooses ````` ````diff ````` fences "because a markdown diff holds list markers and
fences." Four backticks safely wrap the three-backtick fences that spec documents
normally carry (mermaid, ts, bash), because a diff context line ` ``` ` cannot close a
four-backtick fence. But a diffed document that itself contains a bare four-backtick
fence line produces a context line ` ```` ` (one space + four backticks) that **does**
satisfy a four-backtick closing fence, truncating the rendered diff in the round prompt.
No current spec document under `.spec-workflow/specs` uses four-backtick fences (probe:
`grep -rn -E '^ {0,3}````' .spec-workflow` returns 0), so this is currently unexercised
and safe to leave, but the D2 rationale ("holds fences") is only complete for ≤3-backtick
fences. Note it as a known limit.

---

## Top risks / gaps

1. **A shipped doc that miscounts the tools** (R1-1) — the one count invariant requirement
   10.4 exists to hold is stated wrong (12 vs 13).
2. **The reviewer stops seeing real diffs after round 1** (R1-2) — the version-label
   mismatch drops the `## Lint commit` disclosure and can empty the `## Changes since`
   diff, which is the whole point of Component 9.
3. **The info-only Machine-verified bullet is underspecified** (R1-3) — the most common
   lint outcome once errors/warnings are fixed is "info only", and that path lacks a
   defined open-list source.

## Top 3 conclusions to challenge

1. **"The drafter raised no RE-DECIDED flags" and Scope notes "Nothing else … is cut or
   deferred."** At least two undocumented micro-departures exist (R1-4 EARS regex; the D7
   backtick-strip is documented but is itself a correction of requirement 7.1's literal
   label extraction, which would otherwise false-positive on `` ### `spec-lint` tool ``).
   The "no departures" posture is too clean.
2. **D2's claim that four backticks solve the fence problem.** True only for ≤3-backtick
   fences; reverse it to "four backticks handle the fences current documents use, and a
   document with a four-backtick fence is out of scope" (R1-5).
3. **Component 8's "D unchanged" implies `D` already equals the current version.** It does
   not at Step 1/Step 3/Step R (R1-2); challenge the assumption that the Lint step can
   reuse the skill's `D` at those call sites.

## What's missing before acting

- A stated sequencing rule tying the Lint step to the just-committed version (resolves R1-2),
  and a decision on whether the lint brief/commit version equals the document version or the
  skill's `D` at that instant.
- A defined source for the round prompt's open findings and `L-n` numbers on the info-only
  and zero-finding paths (resolves R1-3).
- The corrected tool count (13) wherever it appears, since the fix must also fit under the
  3,995/4,000-word cap — trim a rationale clause to make room.

ESCALATE: none.

```
VERDICT: iterate
MUST_FIX: 2
SHOULD_FIX: 1
MINOR: 2
DESIGN_READY: no
ESCALATE: none
```
