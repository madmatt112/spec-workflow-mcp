# Adversarial Analysis — spec-lint/requirements (v1)

Round 1. Primary surface: completeness, ambiguity, scope. Fresh lens: wire
contracts across a boundary (the `spec-lint` response shape and the round-prompt
contract the orchestrator builds from it). First review, so no delta to attack;
findings are all Novel.

Method: read every cited artifact at both ends of its range (registry, root
selection, path-utils, mdx/task validators, task-parser, gate-rules, adversarial
scaffold, SKILL/briefs/cleanup/formats, the two agents, the templates and docs),
and re-ran every `## Probes` figure the document leans on (wc -w, EARS SHALL
counts, task-10 block words, review-gate git history). Every code and line-range
citation in the document checks out — no misstated code artifact. The defects are
internal contradictions and one mis-scoped probe.

## Topics attacked

1. **The round-prompt contract (Req 9) — the whole point of the spec.** Challenge
   the `Machine-verified` bullet against `data.checks` (1.6), the mdx carve-out
   (3.2) and the remaining-findings list (9.3). Stress-test what the reviewer is
   actually told when a finding survives the lint pass.
2. **The EARS decision (Req 4, D4).** Stress-test the probe "18 of 49 in
   tighter-reviews lack SHALL" against the rule the doc itself defines in 4.1/4.2.
3. **Tasks-shape reuse and severity (Req 5, D5, Req 1.7).** Challenge raising the
   `_Prompt` closing-underscore to `error` against both the severity definition
   and D5's "never disagree with the approval" rationale.
4. **The lint pass in the skill (Req 8, D10).** Stress-test the derived lint-brief
   template against the "D SHALL NOT change" invariant.
5. **Scope edges.** info-only results, the root-selection comment cross-ref, doc
   count words.

## Findings

### R1-1 — MUST_FIX (Novel) — the `Machine-verified` bullet contradicts its own round prompt
Requirement 9.2 makes the bullet say, whenever the Lint step ran, "every
citation's path and line range exist; do not re-verify existence or ranges." But
8.5 and 9.3 put findings that survive the lint pass — including
`citation-path`/`citation-range` errors the reviser *rejected* — into the same
bullet, one per line. So a single round prompt can say "all citations verified,
don't re-check" and immediately list a citation error. The reviewer is told two
opposite things about the same artifact.

The mdx case is the same defect the doc half-noticed: 1.6 defines `data.checks`
as "the rule ids that **ran** for this phase," and mdx always runs; 3.2 says list
mdx as machine-verified "only when the lint reported zero `mdx` findings." 9.2's
blanket "the checks in `data.checks` ran … do not re-verify" re-includes mdx even
when an mdx finding exists, contradicting 3.2. The doc never states how the
orchestrator turns "checks that ran" into "checks safe to trust" (checks minus the
rule-ids that produced findings). Fix: make 9.2's universal claim conditional per
check-class on zero surviving findings, or reword to "the checks below ran on this
version; treat only the findings listed here as open, verify their meaning."

### R1-2 — SHOULD_FIX (Novel) — D4's EARS probe measures a different population than the rule
D4 justifies the lenient warning-level rule with "2 of 52 in review-gate and 18 of
49 in tighter-reviews lack `SHALL`." Re-probed: "18 of 49" is exactly
`grep -E '^[0-9]+\.' tighter-reviews/requirements.md | grep -vc SHALL` — a naive
per-line count over **every** numbered line in the document. 12 of those 18 lines
are not criteria at all under Requirement 4.1's scope: 6 sit under `### Track
sequencing` / `### Coverage constraints` in the Introduction (lines 7-9, 15-17),
and 6 sit under a `##### R4.10` test-pinning list (lines 225-230). Others carry
`SHALL` on a continuation line, which 4.2 includes. Applying the rule the doc
actually defines (numbered items under `#### Acceptance Criteria`, text gathered
across continuation lines) yields **2** ears-shape warnings on tighter-reviews, not
18. review-gate happens to give 2/52 under both methods, which masked the error.
The probe overstates the rule's false-positive rate ~9x and, as stated, argues
about a population the tool never inspects. Re-probe under 4.1/4.2's scope and
re-state D4. (The warning-level choice can stand — but on the strength of
continuation-wrapped `The … SHALL` declaratives, not the cited 18.)

### R1-3 — SHOULD_FIX (Novel) — a heuristic promoted to `error`, undercutting both 1.7 and D5
Requirement 5.1 raises the `_Prompt` missing-closing-underscore finding to rule
`task-prompt-unclosed` at `error`. The source check is a heuristic:
task-validator.ts:177-189 labels it "Prompt field **may be** missing closing
underscore" and, for multi-line prompts, decides by scanning for any line ending
in `_` that does not start with `_[A-Z]` (lines 182-188) — it can misfire. Two
problems:
- It contradicts Requirement 1.7, which reserves `error` for "a machine-certain
  defect" and `warning` for "a heuristic that can misfire."
- It contradicts D5's own rationale ("chosen so the lint and the approval never
  disagree; only the closing-underscore severity is raised"). The approval treats
  this as a non-blocking warning — `approvals request` refuses only on
  `validationResult.valid === false`, i.e. errors, and warnings do not block
  (approvals.ts:400-421). Raising it to `error` makes the lint *stricter* than the
  approval on exactly this field, so the two now disagree, which is what D5 said the
  reuse prevents.
Net effect: the reviewer can get a MUST_FIX candidate (9.3) on a multi-line prompt
the parser (task-parser.ts:233-263) captures fine. Keep it `warning`, or restrict
`error` to the single-line-certain branch (`/_Prompt:\s*.+_$/` absent with no
closing `_` anywhere in the block).

### R1-4 — SHOULD_FIX (Novel) — the derived lint-brief template still tells the reviser to bump the version
Requirement 8.3 builds `reviews/lint-brief-<PHASE>-v<D>.md` "from … the reviser
brief (`briefs.md:148-206`) with `## Revision input` filled … and disposition rule
4 replaced." But that brief also says v<D+1> in three other places that 8.3 does
not touch: the title (line 151 `# Reviser brief — <SPEC> <PHASE> v<D+1>`), the
`## Job` line 156 ("Produce v<D+1> of `<document path>` in place"), and rule 4's
"set … to v<D+1>." 8.4 and D10 require D to stay fixed and no version line to be
added. As specified (replace rule 4 only), the reviser is still told to produce
v<D+1> and would bump it, which corrupts the v4 cap accounting D10 exists to
protect. Enumerate every v<D+1> the lint brief must drop, not just rule 4.

### R1-5 — MINOR (Novel) — the root-selection comment cross-reference
Requirement 1.3 says the comment at root-selection.ts:36-40 "SHALL name `spec-lint`
as a fifth user." That comment reads "Only the four tools named in requirement 3.8
use this …" — requirement 3.8 is worktree-execution-context's and enumerates
exactly four tools, none of them spec-lint. A literal edit ("the five tools named
in requirement 3.8") states a falsehood the tool itself would flag. Tell the
implementer to decouple the sentence from that cross-reference.

### R1-6 — MINOR (Novel) — info-only results may vanish
8.2 says `info` findings alone "spawn nothing," so no lint pass runs. 9.3 surfaces
findings "remaining after the lint pass (8.5)." When only `info` findings exist,
no pass happened, so nothing "remains after the pass," and the round prompt may
carry no trace of them. State whether info-only findings reach the reviewer or are
intentionally dropped.

### R1-7 — MINOR (Novel) — two count/parse wording gaps
(a) 10.4 adds a fourth machine-read line to SDD-HARNESS.md:241-248, but that block
opens "Three lines are machine-read"; per agent-rules `## Documents`, the count word
must change to "Four." (b) 6.3 says caps are "parsed as `parseSensitivePaths`
parses its section," but parseSensitivePaths (gate-rules.ts:73-93) returns a flat
list of bullet strings and never splits `key: value`; caps need a `:` split it does
not do. Call it "mirrors the section scan," not identical parsing.

## Top risks / gaps

1. The round prompt is self-contradictory on surviving findings (R1-1): the
   reviewer is told not to re-verify citations while a citation error sits in the
   same bullet. This is the spec's headline deliverable.
2. The EARS false-positive rate is mis-probed (R1-2); fixtures and expectations
   calibrated on "18 of 49" will not match the ~2 the rule produces.
3. A self-described heuristic is emitted as `error` (R1-3), producing false
   MUST_FIX candidates and making the lint stricter than the approval it claims to
   agree with.
4. The lint-brief template, as specified, bumps the version (R1-4), breaking the
   D-unchanged / v4-cap accounting.
5. Unclassifiable (`info`) findings can silently disappear (R1-6).

## Top 3 conclusions to challenge or reverse

1. **D4's evidence, not its verdict.** "18 of 49 tighter-reviews criteria lack
   SHALL" is a naive per-line grep; under the rule the doc defines it is ~2. Reverse
   the cited evidence and re-justify the warning-level choice on the real ground
   (declarative `The … SHALL` criteria, continuation-wrapped), or the reader
   concludes the tool will bury an approved doc in warnings it never emits.
2. **Requirement 3's user story: "so that Step 5's lint-fix version is never
   needed."** Reverse "never." The mdx validator returns only the first compile
   error (3.2) and the lint runs at most once per version (8.5), so a document with
   two bare brackets still reaches the Step 5 approval fallback (8.9 keeps it). Keep
   the fallback; drop the claim that it becomes dead.
3. **D5: reuse "so the lint and the approval never disagree; only the
   closing-underscore severity is raised."** The exception defeats the rule: the
   approval does not block on that warning (approvals.ts:400-421), the lint would
   (error → MUST_FIX candidate), so on that one field they now disagree. Either the
   rationale or the severity has to give.

## What's missing before acting

- Re-probe EARS under 4.1/4.2's own scope and rewrite D4's parenthetical.
- Specify how the orchestrator derives the "machine-verified" set from
  `data.checks` minus rule-ids with surviving findings, and reword 9.2 so it cannot
  co-exist with a listed citation/mdx finding.
- Fully specify the lint-brief template (title, Job, every v<D+1>), not rule 4 alone.
- Decide and state info-only surfacing.
- One worked round-prompt example (Machine-verified + Changes + surviving findings)
  would expose the 9.2/9.3 conflict on paper before code.

ESCALATE: none — the tool spawns nothing (1.9, D15), reads only under three
safeJoin bases (NFR Security), and performs no destructive, auth, money or data
operation. No human-now trigger.

```
VERDICT: iterate
MUST_FIX: 1
SHOULD_FIX: 3
MINOR: 3
DESIGN_READY: no
ESCALATE: none
```
