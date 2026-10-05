/**
 * Named server-side brief templates, one per brief kind the harness spawns
 * (design Component 3, C6, D2). Each template declares its render `mode`, the
 * `required` caller keys (in placeholder order, so a missing-value message lists
 * them left to right), the `optional` keys that default to '' when the caller
 * omits them (design Component 5), and a `render` that fills its placeholders
 * from a value map.
 *
 * The six document-phase kinds — `drafter`, `gate-a`, `reviewer`, `reviser`,
 * `adjudicator` and `checker` — are ported from
 * `harness/skills/sdd-document-phase/references/briefs.md` verbatim (design C6):
 * the skills' `<…>` slots that the server knows become values, the phase and D
 * conditionals render on the server, and each role's report sentence is the
 * design C9 block — the fixed C9 sentence and that role's keys (Requirement 5.1,
 * 5.2). The read-and-obey first line is filled with the spec-store
 * `agent-rules.md` path when it exists and dropped when `agentRules` is unset
 * (2.4). `reviewer` is append mode: it appends its round section to the existing
 * scaffold at the caller's path, and a missing target fails (design Error
 * Handling 5). The `implementer` and `test-author` kinds' `{{taskBlock}}` is
 * filled by the tasks parser, not the caller (2.2).
 */

/** One server-side brief template (design C6, illustrative type). */
export interface BriefTemplate {
  /** How the brief is written out: a fresh file (`write`) or appended (`append`). */
  mode: 'write' | 'append';
  /** Caller keys that must have a value, in placeholder order. */
  required: string[];
  /** Keys that default to '' when the caller omits them. */
  optional?: string[];
  /** Fill the template from `values` (caller values plus server `agentRules`, `taskBlock`, `spec`). */
  render(values: Record<string, string>): string;
}

/**
 * The design C9 report-block sentence every ported report sentence is replaced
 * with (design C9; Requirement 5 criterion 1).
 */
const C9_SENTENCE =
  'End with this block, at most 8 lines; the whole report is at most 80 words; ' +
  'put more in a file under `/tmp/scratchpad/sdd/<spec>/` and name it in one line.';

/** The `## Report` block: the C9 sentence then one `key:` line per role key (design C9). */
function reportBlockLines(keys: string[]): string[] {
  return ['## Report', '', C9_SENTENCE, '', ...keys.map((k) => '- ' + k + ':')];
}

/** The implementer role's C9 report keys (design C9 `sdd-implementer` row). */
const IMPLEMENTER_REPORT_KEYS = ['logged', 'commit', 'checks', 'checks-file', 'green', 'flag', 'retro'];

/** The verifier role's C9 report keys (design C9 `sdd-verifier` row). */
const VERIFIER_REPORT_KEYS = ['verdict', 'findings', 'retro'];

/** The word cap per phase (`harness/skills/sdd-document-phase/references/briefs.md:42`). */
const CAP_WORDS: Record<string, string> = {
  requirements: '3,500 words',
  design: '4,000 words',
  tasks: '150 words per task block',
};

/** Whether the caller passed a graph path (design C3): a non-empty value other than `none`. */
function graphIsActive(v: Record<string, string>): boolean {
  return typeof v.graph === 'string' && v.graph.length > 0 && v.graph !== 'none';
}

// --- drafter -----------------------------------------------------------------

/** The shared drafter Rules section (briefs.md:65-136), `<CODE_ROOT>`/`<SPEC_STORE_ROOT>` filled. */
function drafterRulesLines(codeRoot: string, specStoreRoot: string): string[] {
  return [
    '## Rules',
    '- Ground every claim in the real code. Cite `path:line` or `path:start-end` only after',
    '  reading both ends of the range. A misstated artifact is an automatic MUST_FIX for',
    '  the reviewer.',
    '- A claim about compiler, library or wire behaviour is checkable: probe the installed',
    '  version under `' + codeRoot + '` and cite the probe, or leave the claim out. Design only: a',
    '  sentence that names a specific library or framework API capability — a method, an',
    '  option, or an exposed field — is such a checkable claim; probe it against the installed',
    '  version under `' + codeRoot + '` and cite the probe, or state only the behaviour you',
    '  verified. Never carry an unproven library-capability claim into a later phase.',
    '- Keep the decomposition entry\'s scope. If you cut or defer anything it lists, say so',
    '  in a `## Scope notes` section and in your report.',
    '- Do not re-decide what an earlier phase pinned. Design enumerates every artifact the',
    '  requirements name; tasks cover every design component.',
    '- Requirements only: label any acceptance criterion that asserts an equality or',
    '  invariant already true on the pre-feature base an invariant (verified, not',
    '  red-first), so the tasks author does not route it as a red/green Test task. An AC',
    '  that cannot fail before the feature is built is verified, not red-first',
    '  (retro canonical-link F5).',
    '- Design only: when you pin an interface whose Testing Strategy needs an extra argument',
    '  (for example a `timeoutMs`), pin that argument as an optional trailing parameter, so the',
    '  implementer does not have to invent a backward-compatible shim.',
    '- Design only: when you pin an interface you do not exercise live — a method on a fork or',
    '  integration branch — cite that branch\'s tip (for example `fork/integration`) and confirm',
    '  the symbol resolves there, never a historical commit hash that may predate the method',
    '  (retro P1).',
    '- Design only: pin the interface and its post-conditions, not a code shape. Label any inline',
    '  code "illustrative — verify against the test fake," so a shape bug in the sample does not',
    '  read as binding (retro P2).',
    '- When a design departs from a requirement\'s literal (a widened enum, a defaulted',
    '  param, a changed shape), flag it in your report as `RE-DECIDED: <req> — <one line>`.',
    '- Record every call you make on the product\'s behalf under `## Decisions taken in',
    '  this document` as `D<n> — <decision>: <options considered>; chosen because <one',
    '  line>`. A human reads that list.',
    '- End the document with `## Revision History` and the line',
    '  `- **v1** (<today>) — Initial draft.`',
    '- In `## Revision History` and decision-log bullets, cite findings by id and prose',
    '  only. Never write a backticked path, line range or code identifier there; the',
    '  citation lint does not scan these sections.',
    '- MDX rule: no bare angle brackets outside code spans. `<name>` fails the approval',
    '  lint; write `` `<name>` `` or "name".',
    '- tasks.md only: follow `' + specStoreRoot + '/templates/tasks-template.md` exactly. Each',
    '  task is `- [ ] N. Title` (sub-tasks `N.M`), with `- File:` lines, a `- Purpose:`',
    '  line, `_Leverage: …_`, `_Requirements: …_`, and a `_Prompt: Task: … | Restrictions:',
    '  … | Success: …_` line that ends with `_`. Every task numbered, so the parser counts',
    '  it. Order tasks so each step leaves the tree compiling and every existing suite',
    '  green. State the dependency order in a short preamble. A prompt must not pin a call',
    '  signature, UI label or helper name that a different task in this document creates;',
    '  write "the hook task 7 exports" and let the implementer read the merged code. When a',
    '  `_Prompt` cites a decision id (`D<n>`) as the reason for a behaviour, verify that',
    '  decision actually governs that behaviour before the brief ships, and cite the governing',
    '  requirement number alongside it (retro P8/P9/G2). Cite code by symbol or',
    '  acceptance-criterion name plus line number. Any citation into a file merged by an earlier',
    '  task must be re-resolved before the tasks review (retro P8/G4). For',
    '  every existing test file a task names, say whether the change alters a value it',
    '  asserts exactly. When a prompt enumerates assertion sites to update (line anchors',
    '  like `:127`, `:479`), label the list an illustrative minimum ("at least these") and',
    '  tell the implementer to widen it to every assertion the change touches; never let a',
    '  reader treat one as exhaustive and under-test (retro P11). A task whose tests cover',
    '  behaviour an earlier task in this document already shipped — an integration test that',
    '  cannot fail before that code exists — marks its coverage `- Test (integration): <path>',
    '  — <call>` instead of `- Test:`, so the implementation phase routes it implementer-only',
    '  with no red-first author (retro P4). When a task uses an artefact a later task creates (a route, an',
    '  export), the prompt names the bridge (a cast, a stub) and the later task\'s prompt',
    '  says to remove it. When a task tells the implementer to stage a scratch store with',
    '  its own event script, give that script an explicit path under the scratch store',
    '  (`<scratch-store>/event.sh`) and state that it must not reuse the supervisor\'s',
    '  `EVENT_SCRIPT` path. When a task authors a `set -u` shell script, its prompt says to',
    '  read every optional environment variable as `${VAR:-}`, never bare `$VAR`, so an',
    '  unset key takes the intended no-value path instead of aborting on an unbound',
    '  variable. Only the supervisor writes the run ledger — `event.sh`, its `.runid` and',
    '  the run\'s `harness-events.jsonl`; a spawned worker calls `EVENT_SCRIPT` only to',
    '  append rows and never rewrites, re-initializes or repoints it. Start the tasks',
    '  document with a `Document version: v1` line right after the H1.',
    '- tasks.md only: before hand-off, self-check Success-clause coverage. For every task,',
    '  each test its `_Prompt` `Task:` body names, and every behavioural `- Test:` coverage',
    '  line that asserts observable output or state, must have a matching clause in that',
    '  task\'s `Success:` clause. The test-author writes to the `Success:` clause, so a tested',
    '  behaviour the clause omits is silently dropped; the tasks reviewer still verifies this',
    '  (retro P7), but a clean draft leaves nothing for it to raise.',
    '- Edit only the document and the context file. Approvals, deferrals, HANDOFF, INDEX and',
    '  every other file belong to the orchestrator.',
    '- Do not ask questions. Decide, and record the decision in the document.',
  ];
}

function renderDrafter(v: Record<string, string>): string {
  const phase = v.phase;
  const graph = graphIsActive(v);

  const load0 =
    phase === 'requirements'
      ? 'nothing yet; you write the context file (below).'
      : '`' + v.specDir + '/codebase-context.md` first: it maps the code the earlier documents cite. Start from it instead of exploring from cold.';
  const steering =
    phase === 'requirements'
      ? '`' + v.specStoreRoot + '/steering/product.md`'
      : phase === 'design'
      ? '`' + v.specStoreRoot + '/steering/tech.md`, `structure.md`, and `design-system.md` if it exists'
      : '`' + v.specStoreRoot + '/steering/structure.md`';
  const earlierDocs =
    phase === 'requirements'
      ? 'none'
      : phase === 'design'
      ? '`' + v.specDir + '/requirements.md`'
      : '`' + v.specDir + '/requirements.md` and `' + v.specDir + '/design.md`';
  const prevPhase =
    phase === 'requirements' ? 'the decomposition' : phase === 'design' ? 'requirements' : 'design';
  const sizeCap =
    phase === 'tasks'
      ? CAP_WORDS.tasks + ', excluding its `_Prompt:` line'
      : CAP_WORDS[phase] ?? '';

  let ccIntro =
    '`' + v.specDir + '/codebase-context.md` is the map of the code this spec touches, written from the exploration you do anyway.';
  if (graph) {
    ccIntro +=
      phase === 'requirements'
        ? ' Build the file from graphify explain and query output for each area the decomposition entry names; open a code file only to confirm the range you cite.'
        : ' Extend the file the same way.';
    ccIntro += ' A graph node alone is not a citation; every line cites a range you read at both ends.';
  }
  ccIntro += ' Create it if it does not exist; append to it if it does (never delete a line another phase wrote). Shape:';

  const lines: string[] = ['# Drafter brief — ' + v.spec + ' ' + phase + ' v1', ''];
  if (v.agentRules !== undefined) lines.push('Read and obey ' + v.agentRules + ' first.', '');

  lines.push(
    '## Job',
    'Write v1 of `' + v.docPath + '` in place, write or extend `' + v.specDir + '/codebase-context.md`.',
    '',
    '## Load, in this order',
    '0. ' + load0,
    '1. Steering: ' + steering + '.',
    '2. The decomposition entry for `' + v.spec + '` in',
    '   `' + v.specStoreRoot + '/spec-decomposition/decomposition.md`: grep for the slug, read that',
    '   entry only (delivers, verification scenario, notes, decided, depends, design should',
    '   address). It fixes the scope. If the entry points at conventions sections elsewhere',
    '   in the file, read those too.',
    '3. This spec\'s earlier documents: ' + earlierDocs + '.',
    '4. The template: `' + v.specStoreRoot + '/user-templates/' + phase + '-template.md`, else',
    '   `' + v.specStoreRoot + '/templates/' + phase + '-template.md`.',
    '5. The code under `' + v.codeRoot + '` that the document must describe. Read before you cite.',
    '',
    '## Carried from ' + prevPhase,
    v.carried,
    'Address each carried item in this document, or state in `## Scope notes` why it does',
    'not apply to this phase.',
    '',
    '## Size',
    '- Cap: ' + sizeCap + '. Count with `wc -w` before you report.',
    '- Introduction, overview and alignment sections: three sentences each.',
    '- Do not describe the codebase inside the document. Cite a path when a claim needs',
    '  it; the map of the code lives in the context file.',
    '- Every sentence is for an agent that will act on it: a criterion, a decision, a',
    '  constraint, a citation. Cut the rest.',
    '',
    '## Codebase context',
    ccIntro,
    '- First line `# Codebase context — ' + v.spec + '`.',
    '- One `## <area>` heading per area (a route, a package, a table, a component tree).',
    '- Under each, one line per file that matters: `- path:start-end — what it is, one',
    '  clause`. Cite only after reading both ends of the range.',
    '- No prose, no design opinions, no requirements. Lists only.',
    'Every later reviewer, reviser and implementer reads it first.',
    '',
    ...drafterRulesLines(v.codeRoot, v.specStoreRoot),
    '',
    ...reportBlockLines(['doc', 'words', 'context', 're-decided', 'scope-cut', 'gate-a', 'flags']),
  );
  return lines.join('\n') + '\n';
}

// --- gate-a ------------------------------------------------------------------

function renderGateA(v: Record<string, string>): string {
  const lines: string[] = ['# Gate-A re-spawn brief — ' + v.spec + ' requirements', ''];
  if (v.agentRules !== undefined) lines.push('Read and obey ' + v.agentRules + ' first.', '');
  lines.push(
    '## Job',
    'A lint fix changed `' + v.docPath + '`\'s `## Decisions taken in this document` section',
    'after you wrote v1. Do only your gate-A step again: re-read that section fresh,',
    're-extract and re-rank the full set of up to five direction-setting decisions, and',
    're-`put` the complete `{ items: [...] }` list through the `harness` tool\'s `gate` action',
    '(`op: put`, `slot: a`). A `gate put` overwrites the whole file, so put the complete list,',
    'not one triple. Do not edit the document or any other file. Report in 40 words or fewer:',
    'the decision count you put, flags. No file contents.',
  );
  return lines.join('\n') + '\n';
}

// --- reviewer (append) -------------------------------------------------------

function renderReviewer(v: Record<string, string>): string {
  const phase = v.phase;
  const D = Number(v.D);
  const dMinus1 = String(D - 1);

  const lines: string[] = ['## This round', ''];
  lines.push('- Read `' + v.specDir + '/codebase-context.md` first; it maps the code this document cites.');
  lines.push('  Start your code reads from it.');
  lines.push('- Version under review: v' + v.D + '.');

  if (v.lintChecks !== '') {
    const reverify =
      D === 1 ? 'the whole `## Changes since` section below' : 'the `## Lint commit` section below';
    lines.push(
      '- Machine-verified: `spec-lint` ran ' + v.lintChecks + ' on v' + v.D +
        ' before the lint pass fixed anything. A rule with no finding listed here passed only that pre-fix run: verify meaning only for it. Re-verify only citations the v' +
        v.D + ' lint commit changed: ' + reverify +
        '. Still open (error = MUST_FIX candidate, warning = your call, info = a note): ' + v.lintOpen + '.',
    );
  }

  const changesFrom =
    D === 1
      ? 'the `docs(sdd): ' + v.spec + ' ' + phase + ' v1` checkpoint'
      : 'the newest commit whose subject holds `docs(sdd): ' + v.spec + ' ' + phase + ' v' + dMinus1 + '`';
  lines.push(
    '- Changes: the diff from ' + changesFrom +
      ' to the working tree follows as `## Changes since <short sha>`, cut at 500 lines.',
  );

  if (D === 1) {
    lines.push(
      '- First review. Read the decomposition entry for `' + v.spec + '` in `' + v.specStoreRoot +
        '/spec-decomposition/decomposition.md` and check the document against its scope. The context file is drafter-written and unreviewed; re-probe any `## Probes` line the document relies on.',
    );
    if (v.reDecided !== 'none') {
      lines.push(
        '- The drafter re-decided these requirement literals (see `' + v.reDecided +
          '`). Rule on each: `refinement` (closed) or `widening` (a MUST_FIX). You may close a flag as a `refinement` and carry it to the next drafter on your own authority when the change stays within the governing requirement\'s intent; this needs no orchestrator ruling or adjudication — state the closure and its reason in your analysis. Rule `widening` (a MUST_FIX) only when the flag reverses a requirement or crosses a decision the human owns.',
      );
    }
  } else {
    lines.push(
      '- Read the Revision History line for v' + v.D +
        ' first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. A finding that re-flags a cross-artifact seam an earlier round already raised — a producer-to-consumer wire, or an acceptance criterion that contradicts the component that implements it — is marked `Compounds: R<k>-<n>` for the round `k` that first raised that seam. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it (a `Compounds` finding is fix-induced) or `carried` when it is a pre-existing defect the last fix did not touch, so the orchestrator sees which MUST_FIX the last fix created; the label is guidance and does not change the round budget.',
    );
  }

  lines.push(
    '- Fix-induced re-check (round 2 onward): when a finding is caused by a fix a previous round made — a regression of earlier-agreed wording, not a newly discovered defect — scope your check of it to that fix\'s diff against the requirement it must satisfy, not a re-review of the whole document, and record it as a fix-induced re-check, not a fresh corrective round.',
  );

  if (v.overCap !== 'none') {
    lines.push('- Over cap: ' + v.overCap + '; a SHOULD_FIX naming what to cut.');
  }

  const lensText =
    phase === 'requirements' && D === 1
      ? 'wire contracts across a boundary (router, query params, response shapes, client state), the default first lens for requirements.'
      : v.lens;
  lines.push('- Fresh lens for this round: ' + lensText);

  if (phase === 'design') {
    lines.push(
      '- A design sentence that names a specific library or framework API capability — a method, an option, or an exposed field — is a checkable claim, not prose. Confirm the document probed it against the installed version under `' +
        v.codeRoot +
        '` and cited the probe, or stated only the behaviour it verified; an unproven library-capability assertion carried toward implementation is a MUST_FIX.',
    );
    lines.push(
      '- Data Models completeness — any result or response object that a requirement references has its full field shape pinned in Data Models, not only its union arms. A named result object whose shape is given only through its union members, with no enumerated fields, is a MUST_FIX.',
    );
    lines.push(
      '- Error-branch shape — every named error branch, a race loser included, pins both its error-type discriminant (for example a `LaunchError.step` value) and its response status code in the design, not only its message, before the phase closes. A named error branch that leaves its discriminant or its status code unstated is a MUST_FIX; left unpinned here, a race-loser shape is carried unresolved into tasks (retro P3).',
    );
  }

  if (phase === 'tasks') {
    lines.push(
      '- Gate B: if a task introduces a new external dependency, number it as a normal finding and append `[gate-b:T<task id>]` to that finding\'s title; if a task does more than the approved requirements ask, append `[gate-c:T<task id>]`. Judge from the tasks and the approved `' +
        v.specDir +
        '/requirements.md` — your normal reviewer read. The orchestrator carries the kept ones to the human\'s gate B; it never reads the body.',
    );
    lines.push(
      '- For every `Test:` line: the call exists in the design\'s interfaces, an earlier task\'s prompt or this task\'s prompt, and the success criteria are assertable through it with values the requirements state; a miss is a normal finding.',
    );
    lines.push(
      '- Success-clause coverage (retro P7): for every task, each test the `Task:` body of its `_Prompt` names must also appear in that task\'s `Success:` clause. The test-author writes to the `Success:` clause, so a test the prompt requires but the `Success:` clause omits is silently dropped; flag it as a normal finding.',
    );
  }

  lines.push('- Closed by ruling, do not re-open: ' + v.closedByRuling + '.');
  lines.push(
    '- Rejected findings from earlier rounds are recorded with their reasons in the Revision History and the memory file. Re-raise one only with new evidence, marked Recurring.',
  );

  const memNote =
    D === 1
      ? 'The scaffold above does not mention it on the first round. Create it after your analysis, in the format later rounds expect: `# Adversarial Review Memory — ' +
        phase +
        '`, `Last updated`, `## Cumulative Findings Summary` (Accepted / Partially Accepted / Rejected / Unresolved, every finding of this round under Unresolved), `## Patterns & Themes`, `## Guidance for Next Review`.'
      : 'Read it first and rewrite it after your analysis, as the scaffold says.';
  lines.push('- Rolling memory file: `' + v.memoryPath + '`. ' + memNote);

  let codeLine =
    '- Code lives under `' + v.codeRoot + '`; the spec store under `' + v.specStoreRoot + '`. Use absolute paths.';
  if (v.agentRules !== undefined) {
    codeLine += ' Project rules for reading code and running checks: `' + v.agentRules + '`.';
  }
  lines.push(codeLine);

  lines.push('', ...reportBlockLines(['verdict', 'escalate', 'analysis']));
  return lines.join('\n') + '\n';
}

// --- reviser (round, should-fix-only, revision, lint-fix) --------------------

/** The reviser disposition rules (briefs.md:298-358), `revDescriptor` filling rule 4. */
function reviserDispositionRules(dPlus1: string, revDescriptor: string, closedByRuling: string): string[] {
  return [
    '## Disposition rules',
    '1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.',
    '2. Verify every citation you add or change against the real tree under `<CODE_ROOT>`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.',
    '3. Do not widen scope, and do not re-decide what an earlier phase pinned.',
    '4. Write v' + dPlus1 + ' in place. Add the Revision History line `- **v' + dPlus1 + '** (<today>) — ' + revDescriptor + '` followed by one nested bullet per finding: `- **<id> — <Accepted | Partially accepted | Rejected> (<severity>).** <what changed, or why not>`. If the document carries a `Document version:` header, set it to v' + dPlus1 + '. A Revision-History or decision-log bullet cites findings by id and prose only; it carries no backticked path or identifier token. State what the fix did, not what it did not, and cite the exact post-fix line the changed text now reads.',
    '5. Closed by ruling, leave as is: ' + closedByRuling + '.',
    '6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template\'s task shape; every task numbered; `_Prompt: …_` ends with `_`.',
    '7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it. Tasks phase only: when an accepted finding changes a call signature that `design.md` states, apply the same text to that design component and add to `design.md` a Revision History line `- **v<D> amended** (<date>) — tasks R<A>-<n>: <what>` (v<D> is design.md\'s current version); list it under the finding\'s bullet as `also applied to design.md`. This does not widen scope and needs no re-approval — approval records do not hash content.',
    '8. Do not ask questions.',
    '9. After you accept a finding, search the document for every other place with the same construct (the same rule table, command, fixture shape or union member) and fix each; list them under the finding\'s bullet. A sibling left unchanged is next round\'s finding.',
    '10. A finding marked `Compounds: R<A-1>-<n>` lands in text a previous delta wrote: do not reword the clause again. Write one plain sentence of what the clause must claim, delete the old text, and probe the new claim as round 1 would. A claim you cannot probe is deleted, not kept.',
    '11. A MUST_FIX that names a cross-artifact wire (a producer and its consumer) or an acceptance-criterion contradiction (the AC and the component that implements it) is a seam: edit and cite both ends under the finding\'s bullet, never the symptom on one side. A finding marked `Compounds: R<k>-<n>` re-flags a seam an earlier round left half-fixed; fix both ends now.',
    '12. Gate-B tags (tasks phase). When a finding\'s title carries a `[gate-b:T<id>]` (new external dependency) or `[gate-c:T<id>]` (work beyond the approved requirements) tag, begin that finding\'s Revision History bullet reasoning (rule 4) with the exact tag, so it sits on the same line as the bullet\'s `Accepted`/`Rejected` disposition: `Accepted` when you removed the task, `Rejected` when you intentionally kept it — say why either way. The orchestrator greps these lines for gate B; a tag left off its Revision History line drops that task from the veto list.',
    '13. Before you report, re-scan only the lines you changed in this pass for the finding classes you just fixed (a citation missing its directory prefix, a bare `:<line>`, an unproven rationale clause, a half-fixed cross-artifact seam). Fix any regression your own delta introduced now; it is cheaper here than as next round\'s finding (retro P7).',
    '14. After any re-anchor or agreed-wording fix, before you hand back, self-verify that every new producer the delta introduced has a named consumer, and every acceptance criterion the delta touched stays consistent with the rest of the document. Record this as part of the fix-induced re-check (retro P7).',
    '15. Post-trim citation check. After any trim that removes a line to keep the document under its cap, re-verify that every surviving accepted acceptance criterion still carries its original citation, anchored to the exact phrase it supports. Never relocate a citation onto an unrelated note to save a line. A trim that drops an accepted AC\'s citation, or moves one off the phrase it cited, is a MUST_FIX next round (retro P1).',
  ];
}

function capInputsFor(phase: string): string {
  return phase === 'tasks' ? '150 words per task block excluding its prompt' : CAP_WORDS[phase] ?? '';
}

function reviserInputDocLines(v: Record<string, string>, phase: string): string[] {
  const out: string[] = [];
  if (phase === 'design') out.push('- Requirements: `' + v.specDir + '/requirements.md`.');
  if (phase === 'tasks') {
    out.push('- Requirements: `' + v.specDir + '/requirements.md`.');
    out.push('- Design: `' + v.specDir + '/design.md`.');
  }
  return out;
}

function renderLintFix(v: Record<string, string>): string {
  const phase = v.phase;
  const lines: string[] = ['# Lint brief — ' + v.spec + ' ' + phase + ' v' + v.D, ''];
  if (v.agentRules !== undefined) lines.push('Read and obey ' + v.agentRules + ' first.', '');
  lines.push(
    '## Job',
    'Fix the lint findings below in v' + v.D + ' of `' + v.docPath + '` in place.',
    '',
    '## Inputs',
    '- Context file: `' + v.specDir + '/codebase-context.md`. Read it first; it maps the code the document cites.',
    '- Document: `' + v.docPath + '` (v' + v.D + '). Cap: ' + capInputsFor(phase) + '. Do not grow the document past it; a fix that adds a paragraph removes one.',
    ...reviserInputDocLines(v, phase),
    '- Findings: the list under `## Revision input`.',
    '- Prior dispositions: a version\'s lint pass receives the prior version\'s dispositioned findings (each token, its disposition and reason).',
    '',
    '## Revision input',
    v.findings,
    '',
    '## Disposition rules',
    '1. Assess every finding on its merits: accept, partially accept, or reject, each with one line of reasoning. Never accept to be agreeable; never reject to save work. When a finding says a rationale clause is false, delete the clause unless you can prove the replacement with a probe; never reword an unproven claim.',
    '2. Verify every citation you add or change against the real tree under `<CODE_ROOT>`. Read both ends of a line range. A misstated artifact is a MUST_FIX next round.',
    '3. Do not widen scope, and do not re-decide what an earlier phase pinned.',
    '4. Edit v' + v.D + ' in place. Add no version line. Append under the v' + v.D + ' Revision History line one nested bullet: `- **Lint pass.** <n> fixed; rejected: <none | L-n reason, …>`.',
    '5. Closed by ruling, leave as is: ' + v.closedByRuling + '.',
    '6. MDX rule: no bare angle brackets outside code spans. tasks.md: keep the template\'s task shape; every task numbered; `_Prompt: …_` ends with `_`.',
    '7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it.',
    '8. Do not ask questions.',
    '9. After you accept a finding, search the document for every other place with the same construct (the same rule table, command, fixture shape or union member) and fix each; list them under the finding\'s bullet. A sibling left unchanged is next round\'s finding.',
    '10. Every citation you insert or change carries its directory-prefixed path (`src/core/typecheck.ts:30`), never a bare filename (`typecheck.ts:30`) or a bare `:<line>`. A citation that lacks a directory prefix, or a bare `:<line>` token, outside a code block is itself a finding to reject or repair before you hand off, so a later pass cannot re-resolve it to the wrong file (retro P6).',
    '11. A citation-identifier warning on a token that is unchanged since a version where it was rejected with a reason is suppressed, not re-fired.',
    '',
    ...reportBlockLines(['version', 'words', 'accepted', 'partial', 'rejected', 'cut-scope', 'flags']),
  );
  return lines.join('\n') + '\n';
}

function renderReviser(v: Record<string, string>): string {
  if (v.variant === 'lint-fix') return renderLintFix(v);

  const phase = v.phase;
  const D = Number(v.D);
  const dPlus1 = String(D + 1);
  const revDescriptor =
    v.variant === 'should-fix-only'
      ? 'SHOULD_FIX-only corrective pass.'
      : v.variant === 'revision'
      ? 'Revision from the input below.'
      : 'Round-<A> adversarial response (<analysis file name>, verdict iterate <m>/<s>/<k>).';
  const findingsLine = v.variant === 'revision' ? 'the list below (revision input)' : '`' + v.findings + '`';

  const lines: string[] = ['# Reviser brief — ' + v.spec + ' ' + phase + ' v' + dPlus1, ''];
  if (v.agentRules !== undefined) lines.push('Read and obey ' + v.agentRules + ' first.', '');
  lines.push(
    '## Job',
    'Produce v' + dPlus1 + ' of `' + v.docPath + '` in place from the findings below.',
    '',
    '## Inputs',
    '- Context file: `' + v.specDir + '/codebase-context.md`. Read it first; it maps the code the document cites.',
    '- Document: `' + v.docPath + '` (v' + v.D + '). Cap: ' + capInputsFor(phase) + '. Do not grow the document past it; a fix that adds a paragraph removes one.',
    ...reviserInputDocLines(v, phase),
    '- Findings: ' + findingsLine + '.',
    '- Memory: `' + v.memoryPath + '` (read; do not write it — the reviewer maintains it). Read `## Guidance for Next Review`. When it names another place where an accepted finding\'s defect occurs, fix that place under the same finding\'s bullet as `also applied to <where>`. This is not widening scope.',
    '- You may call the spec-workflow `adversarial-response` tool (`specName: ' + v.spec + '`, `phase: ' + phase + '`) for the response methodology. Ignore its instructions to present to a user, wait, or delete approvals.',
    '',
  );
  if (v.variant === 'revision') {
    lines.push('## Revision input', v.findings, '');
  }
  lines.push(
    ...reviserDispositionRules(dPlus1, revDescriptor, v.closedByRuling),
    '',
    ...reportBlockLines(['version', 'words', 'accepted', 'partial', 'rejected', 'cut-scope', 'flags']),
  );
  return lines.join('\n') + '\n';
}

// --- adjudicator (docPath form or taskId form) -------------------------------

/**
 * Task adjudication brief (implementation phase, briefs.md:193-207). Rendered when
 * the caller passes `taskId` instead of `docPath`. The report sentence is replaced
 * with the C9 block keyed on `commit` (not `version`), the task-form adjudicator
 * keys (design C9 `sdd-adjudicator` row, Requirement 5.1).
 */
function renderAdjudicatorTask(v: Record<string, string>): string {
  const agentRules = v.agentRules !== undefined ? v.agentRules : '<AGENT_RULES>';
  const lines: string[] = [
    '# Task ' + v.taskId + ' — adjudication (spec ' + v.spec + ')',
    '',
    'Read and obey ' + agentRules + ' first, then `/tmp/scratchpad/sdd/' + v.spec + '/impl-standing.md`.',
    '',
    'Three fix rounds did not converge. Rule on each open finding below: accept and fix it,',
    "or reject it with a stated reason. Re-run the task's checks. Update the implementation",
    'log if files changed. Do not ask questions.',
    '',
    '## Open findings (from the last verification)',
    v.items,
    '',
    ...reportBlockLines(['commit', 'fixed', 'ruled-out', 'notes', 'flags']),
  ];
  return lines.join('\n') + '\n';
}

function renderAdjudicator(v: Record<string, string>): string {
  if (v.taskId !== undefined && v.taskId !== '') return renderAdjudicatorTask(v);

  const D = Number(v.D);
  const dPlus1 = String(D + 1);
  const lines: string[] = ['# Adjudication brief — ' + v.spec + ' ' + v.phase + ', post-cap corrective pass', ''];
  if (v.agentRules !== undefined) lines.push('Read and obey ' + v.agentRules + ' first.', '');
  lines.push(
    'The review loop reached its cap: v' + v.D + ' of `' + v.docPath + '` was reviewed in `' + v.analysisPath + '` and still carries MUST_FIX ' + v.mustFix + ' / SHOULD_FIX ' + v.shouldFix + '. You are the corrective pass. Fix or rule out each open item, write v' + dPlus1 + ' in place, and stop. Nothing reviews v' + dPlus1 + ' again; a narrow check only verifies that each listed item was addressed. A SHOULD_FIX you rule out is carried into the next phase\'s drafter brief, so its reason must stand on its own.',
    '',
    '## Open items',
    v.items,
    '',
    '## Inputs',
    '- Context file: `' + v.specDir + '/codebase-context.md`. Read it first.',
    '- Document (v' + v.D + '); the r<A> analysis; the memory file `' + v.memoryPath + '`; <requirements and design as applicable>. Code under `' + v.codeRoot + '`.',
    '- Cap: <requirements: 3,500 words | design: 4,000 words | tasks: 150 words per task block excluding its prompt>. Do not grow the document past it.',
    '',
    '## Rules',
    '- For each item: fix it in the document, or rule it out with a stated reason. A rule-out is a ruling; it is final for this phase.',
    '- Verify every citation against the real tree, both ends of every range.',
    '- Revision History line: `- **v' + dPlus1 + '** (<today>) — Post-cap corrective pass, adjudicated, not re-reviewed.` followed by one nested bullet per item: `- **<id> — fixed | ruled out (<severity>).** <one line>`. Keep the words `Post-cap corrective pass` exactly; the orchestrator greps for them.',
    '- Edit only the document. Do not ask questions.',
    '',
    ...reportBlockLines(['version', 'fixed', 'ruled-out', 'notes', 'flags']),
  );
  return lines.join('\n') + '\n';
}

// --- checker (narrow check, write over the prompt) ---------------------------

function renderChecker(v: Record<string, string>): string {
  const D = Number(v.D);
  const dMinus1 = String(D - 1);
  const lines: string[] = ['# Narrow check — ' + v.spec + '/' + v.phase + ' v' + v.D, ''];
  let para =
    'This is not a review. v' + dMinus1 + ' of `' + v.docPath + '` was reviewed in `' + v.analysisPath + '`; a corrective pass produced v' + v.D + ' and addressed the items below. Verify only that each item was addressed in v' + v.D + ': fixed, or ruled out with a stated reason under the v' + v.D + ' Revision History line. Read `' +
    v.specDir +
    '/codebase-context.md` first, then the document, then the code the items cite under `' +
    v.codeRoot +
    '` as needed.';
  if (v.agentRules !== undefined) para += ' Project rules: `' + v.agentRules + '`.';
  lines.push(
    para,
    '',
    '## Items',
    v.items,
    '',
    '## Output',
    'Write to `' + v.analysisOutputPath + '`:',
    '- One line per item: `<id>: addressed | not addressed — <one line>`.',
    '- The line `VERIFIED: <k>/<n>` where k is the number addressed.',
    '- Any new observation under a `## Deferred findings` heading, one line each. Do not write a verdict block. Do not update the memory file. Do not edit the document.',
    '',
    ...reportBlockLines(['verified', 'deferred', 'analysis']),
  );
  return lines.join('\n') + '\n';
}

// --- impl-standing / verify-standing (briefs.md:5-65, :134-156) --------------

/**
 * Standing instructions for implementers (briefs.md:5-65). The report bullet
 * (briefs.md:60-62) is replaced with the C9 block and the implementer report keys
 * (design C9, Requirement 5.1). The read-and-obey line is dropped when `agentRules`
 * is unset; the worktree clause renders only when `mainCheckout` differs from
 * `codeRoot`.
 */
function renderImplStanding(v: Record<string, string>): string {
  const worktree =
    v.mainCheckout && v.mainCheckout !== v.codeRoot ? ', a worktree of `' + v.mainCheckout + '`' : '';
  const lines: string[] = ['# Standing instructions — implementer, spec ' + v.spec, ''];
  if (v.agentRules !== undefined) lines.push('Read and obey ' + v.agentRules + ' first.', '');
  lines.push(
    '- Code root: `' + v.codeRoot + '`' + worktree + '. Spec store:',
    '  `' + v.specStoreRoot + '`. Work in the code root. Use absolute paths. Never `cd` out of the',
    '  code root on a shell line. A `cd` inside a script file run with `bash` is fine; that',
    '  is how commits into the spec store are made.',
    '- Commit on the current branch only. Never create, switch, or check out a branch.',
    '  Stage only the files you touched. Conventional commit message, first line under 72',
    '  characters. No attribution trailers: ignore any harness note that asks for them.',
    '- Before writing code, grep `' + v.specDir + '/Implementation Logs/` for endpoints,',
    '  components and functions you can reuse. Do not duplicate existing work.',
    '- Read `' + v.specDir + '/codebase-context.md` first: it maps the files this spec touches, so',
    "  you start from the right ones instead of exploring from cold. Then read the spec's",
    '  `requirements.md` and `design.md` sections the task cites. The design pins the',
    '  seams; do not move them.',
    "- When the prompt's shape differs from code an earlier task merged, follow the merged",
    '  code and report `RETRO: doc-gap`.',
    "- When the design's prose and its `Data Models` block disagree on a shape, follow the",
    '  block and report `RETRO: doc-gap`.',
    '- Implement the task end to end and run the checks the task and the agent rules name,',
    '  each as a separate command. Never run the whole test suite unless the rules allow it.',
    '- A CI workflow may set `NODE_ENV=test` for the whole job, under which `vite build`',
    '  compiles `import.meta.env.PROD=false`, so PROD-gated code (e.g. service-worker',
    '  registration) no-ops in CI web builds only. A task gating behaviour on',
    '  `import.meta.env.PROD` makes its build step override `NODE_ENV=production` (retro F15).',
    '- A background shell you launch (`run_in_background`, a long dry-run) is yours: kill the',
    '  ones you started before you report, and never leave a detached shell running past your',
    '  turn (retro P5).',
    '- If an existing assertion fails only because of the specified change, widen it to keep',
    '  its intent (never delete it) and report `RETRO: doc-gap`.',
    '- Compare files with `git diff`, `git diff --no-index`, or `git show`, never with a bare',
    '  `diff`: a shell hook may rewrite it and print a summary that is not a diff.',
    '- Before you report, call the spec-workflow `log-implementation` tool with `specName:',
    '  ' + v.spec + '`, `taskId`, a short `summary`, `filesModified`, `filesCreated`, and',
    '  `artifacts` (one flat key, kept short). A task without a log is not complete.',
    '- If the task cannot be implemented as written because it contradicts the design, the',
    '  requirements, or a decomposition assumption, do not force a wrong build. Stop and',
    '  report `DESIGN-DEFECT: <one line>`.',
    "- If the task's own instructions say a measured outcome needs a human ruling before any",
    '  later task may run, do not force past it. Stop and report `ESCALATE: <one line>`.',
    '- If you learn something that changes a later spec, report `AFFECTS-FUTURE-SPECS: <one',
    '  line>`. If something about the process, the tools, the documents or the harness cost',
    '  you time, report `RETRO: <category> — <one line>` (categories: gotcha, bug,',
    '  tool-error, mcp-deficiency, harness-defect, misunderstanding, inefficiency,',
    '  doc-gap, model-behaviour, deviation).',
    '- When a designed fallback let you proceed but masked a missing tool or capability (the',
    '  primary path was unavailable, so you took the fallback), do not stay silent: apply the',
    '  fallback and continue, but report `RETRO: tool-error — <the missing tool>` so the gap',
    '  stays visible, and `ESCALATE: <the missing capability>` instead when the fallback masks',
    '  a capability a later task depends on (retro P12).',
    '- When a judgment call of yours changes the data the spec ships — which sources it covers,',
    '  or how a record is named, filtered or dropped — do not leave it to the diff alone:',
    '  report `RETRO: deviation — <the shipped-data change, one line>`, so the change stays',
    '  visible to the retrospective (retro P14).',
    '- Do not touch `tasks.md`, approvals, deferrals, HANDOFF or INDEX.',
    '- Do not ask questions.',
    '',
    ...reportBlockLines(IMPLEMENTER_REPORT_KEYS),
  );
  return lines.join('\n') + '\n';
}

/**
 * Standing instructions for verifiers (briefs.md:134-156). The report bullet
 * (briefs.md:151-154) is replaced with the C9 block and the verifier report keys
 * (design C9, Requirement 5.1).
 */
function renderVerifyStanding(v: Record<string, string>): string {
  const lines: string[] = ['# Standing instructions — verifier, spec ' + v.spec, ''];
  if (v.agentRules !== undefined) lines.push('Read and obey ' + v.agentRules + ' first.', '');
  lines.push(
    '- Code root: `' + v.codeRoot + '`. Spec store: `' + v.specStoreRoot + '`. Absolute paths. Read-only',
    '  on source: you never edit code, and you never commit.',
    '- Read `' + v.specDir + '/codebase-context.md` first: it maps the files this spec touches.',
    "- You did not write this code. Judge it against the task's `_Requirements`,",
    '  `_Leverage`, success criteria, the design, and the actual changed files. Run the',
    '  checks; do not infer from a passing test what a test does not assert. For anything',
    '  visual or geometric, require a real browser and a real number.',
    '- Compare files and revisions with `git diff`, `git diff --no-index`, or `git show`,',
    '  never with a bare `diff`: a shell hook may rewrite it and print a summary that is not',
    '  a diff.',
    '- No diffs, no file contents, no test output beyond one line. Do not ask questions.',
    '',
    ...reportBlockLines(VERIFIER_REPORT_KEYS),
  );
  return lines.join('\n') + '\n';
}

// --- fix (briefs.md:103-132, :232-253) ---------------------------------------

/** The CI-fix content (briefs.md:235-249), reused by both `ci` and `reconcile`. */
function renderCiFix(v: Record<string, string>): string {
  const checkNames = v.checkNames ?? '<check names>';
  const logPaths = v.logPaths ?? '<log file path(s)>';
  const lines: string[] = [
    '# CI red — fix round ' + v.round + ' (spec ' + v.spec + ')',
    '',
    'Read `/tmp/scratchpad/sdd/' + v.spec + '/impl-standing.md` first and obey it.',
    '',
    "The PR's checks failed: " + checkNames + ". The failing steps' log tail is in " + logPaths + '; ' +
      'read those files. Reproduce the failure locally first, with the command the job runs ' +
      '(read its workflow file under `.github/workflows/`). Fix the cause, not the symptom: when ' +
      "the spec's change made shared test fixtures or setup stale, fix the fixtures. Run the " +
      'reproduce command until it passes, run the checks the agent rules allow for the files you ' +
      'touched, and commit on the current branch. Do not push. Call `log-implementation` for the ' +
      "task the fix belongs to when that task's files changed.",
    '',
    'If the failure is CI infrastructure and not the code (a runner out of memory, a network ' +
      'timeout, a job that passed before on the same commit), change nothing and report ' +
      '`INFRA: <one line>`.',
    '',
    ...reportBlockLines(IMPLEMENTER_REPORT_KEYS),
  ];
  return lines.join('\n') + '\n';
}

/**
 * Fix brief (briefs.md:103-132). Variants `verifier`, `repair` and `gate` swap the
 * middle paragraph (and, for `gate`, the findings heading); `ci` and `reconcile`
 * both render the CI-fix content (briefs.md:232-253), as today's Reconcile step
 * reuses it through the reviser template.
 */
function renderFix(v: Record<string, string>): string {
  const variant = v.variant;
  if (variant === 'ci' || variant === 'reconcile') return renderCiFix(v);

  const lines: string[] = [
    '# Task ' + v.taskId + ' — fix round ' + v.round + ' (spec ' + v.spec + ')',
    '',
    'Read `/tmp/scratchpad/sdd/' + v.spec + '/impl-standing.md` first and obey it.',
    '',
  ];
  if (variant === 'repair') {
    lines.push(
      'The end-to-end verification of the spec failed. Reproduce the failure first, fix its ' +
        'cause (not the symptom), add coverage that fails without the fix, run the scenario ' +
        'again, and report.',
    );
  } else if (variant === 'gate') {
    lines.push(
      "The gate returned `fail`. Fix every reason below, re-run the task's checks, update the " +
        'implementation log with `log-implementation` if files changed, and report.',
    );
  } else {
    lines.push(
      'The independent review of task ' + v.taskId + ' returned `fix-required`. Fix every ' +
        "finding below, re-run the task's checks, update the implementation log with " +
        '`log-implementation` if files changed, and report.',
    );
  }
  lines.push(
    '',
    variant === 'gate' ? '## Gate output' : '## Findings (from the verifier)',
    v.findings,
    '',
    '## Task reference',
    '`<spec dir>/tasks.md` lines <A>–<B>.',
  );
  return lines.join('\n') + '\n';
}

// --- verifier (briefs.md:158-230, :255-267) ----------------------------------

/** The per-task verifier brief lines (briefs.md:158-184); `batch` passes many ids. */
function verifierTaskLines(v: Record<string, string>): string[] {
  return [
    '# Review task ' + v.taskIds + ' — ' + v.title + ' (spec ' + v.spec + '), round ' + v.round,
    '',
    'Read `/tmp/scratchpad/sdd/' + v.spec + '/verify-standing.md` first and obey it.',
    '',
    'The gate already passed for this task at `risk: high`; its results are in `## Gate',
    "results` below. Do not re-run the gate's checks.",
    '',
    '1. Call the spec-workflow `review-task` tool with `action: prepare`, `specName:',
    '   ' + v.spec + '`, `taskId: "' + v.taskIds + '"`, `projectPath: <CODE_ROOT>` (retro P5). It returns the task,',
    '   the implementation log summary and the files to review.',
    '2. Read the files it names and the files the implementer reported:',
    '   ' + v.files,
    '   Run only checks the gate did not run.',
    '3. Call `review-task` with `action: record`, the same `specName` and `taskId`,',
    '   `projectPath: <CODE_ROOT>` (retro P5), `verdict`',
    '   (`pass` when clean; `fail` when any critical finding; `findings` when only',
    '   warnings or info), a one-line `summary`, and `findings` (severity, title, file,',
    '   line, description, taskRequirement, category).',
    '4. Report as the standing instructions say. `VERDICT: pass` when the recorded verdict',
    '   is `pass` or `findings` with no warning-or-higher item; otherwise `fix-required`.',
    '',
    '## Gate results (from the gate call, verbatim)',
    v.gateResults,
  ];
}

/** End-to-end verification brief (briefs.md:209-230); report sentence → C9 block. */
function renderVerifierE2e(v: Record<string, string>): string {
  const lines: string[] = [
    '# End-to-end verification — spec ' + v.spec,
    '',
    'Read `/tmp/scratchpad/sdd/' + v.spec + '/verify-standing.md` first and obey it.',
    '',
    '## Scenario (from the decomposition entry)',
    v.scenario,
    '',
    '## Full check suite (from the agent rules; run each as a separate command)',
    '<typecheck>, <tests, scoped as the rules allow>, <lint>, <migrations>, <e2e>',
    '',
    'Run the scenario, then the suite. Do not skip a check because per-task reviews passed; ' +
      'integration failures are what this step exists to catch.',
    '',
    'Pass-bar note: when a scenario measures cached prompt content across a subagent resume, ' +
      'measure content older than the last turn — Claude Code re-sends the last turn on resume, ' +
      'so the last turn is never a cache hit.',
    '',
    ...reportBlockLines(VERIFIER_REPORT_KEYS),
  ];
  return lines.join('\n') + '\n';
}

/** CI verify brief (briefs.md:255-267); report sentence → C9 block. */
function renderVerifierCi(v: Record<string, string>): string {
  const checkNames = v.checkNames ?? '<check names>';
  const sha = v.sha ?? '<sha>';
  const command = v.command ?? '<command>';
  const lines: string[] = [
    '# CI red — verification round ' + v.round + ' (spec ' + v.spec + ')',
    '',
    'Read `/tmp/scratchpad/sdd/' + v.spec + '/verify-standing.md` first and obey it.',
    '',
    'Checks that failed: ' + checkNames + ". The implementer's fix is commit " + sha + '; its reproduce ' +
      'command: ' + command + '. Run that command yourself in `<CODE_ROOT>`, then every check the agent ' +
      'rules list for the files the fix touched, each as its own command.',
    '',
    ...reportBlockLines(VERIFIER_REPORT_KEYS),
  ];
  return lines.join('\n') + '\n';
}

/**
 * Verifier brief (design C6 `verifier` row). `task`/`batch` render the per-task
 * review brief (no own report block — it defers to the verify-standing instructions);
 * `narrow` appends the post-adjudication narrow-verification text; `e2e` and `ci`
 * render the end-to-end and CI verify briefs with the C9 block.
 */
function renderVerifier(v: Record<string, string>): string {
  if (v.variant === 'e2e') return renderVerifierE2e(v);
  if (v.variant === 'ci') return renderVerifierCi(v);

  const lines = verifierTaskLines(v);
  if (v.variant === 'narrow') {
    lines.push(
      '',
      'Verify only the findings listed below; each is `addressed` or `not addressed` with one ' +
        'line. When the terminus was a gate fail, re-run the checks listed as failing. Record ' +
        'the review the same way. `VERDICT: pass` when every listed finding is addressed or ' +
        "ruled out with a reason in the adjudicator's report.",
    );
  }
  return lines.join('\n') + '\n';
}

// --- book-script (design C7) -------------------------------------------------

/**
 * The static body of `book.sh` (design C7): an idempotent, segment-driven
 * bookkeeping script run as `bash book.sh <segment> [-- <segment>]...`. Each
 * segment runs in order; on a step failure the script prints
 * `book: segment <i> <step> failed: <cause>` to stderr and exits 1 with no later
 * segment run; an unknown segment is a usage error (exit 2). The run id and
 * ledger path come from `EVENT_SCRIPT`'s `SDD_RUN`/`SDD_LEDGER` lines
 * (`harness/skills/sdd-continue/references/formats.md:164-183`); rows reach the
 * ledger only through that script (Requirement 6 criteria 4, 5). Every write is
 * idempotent across re-runs (Requirement 6 criteria 6, 7). Written with
 * `String.raw` so the embedded node regexes keep their backslashes; the four
 * `${...}` array expansions and the fenced-diff backticks are the only
 * interpolations. The run header (paths filled per call) is prepended in
 * `renderBookScript`.
 */
const BOOK_BODY = String.raw`
RUN_ID=""
LEDGER=""
RETRO_LOG=""
if [ -f "$EVENT_SCRIPT" ]; then
  RUN_ID="$(grep '^export SDD_RUN=' "$EVENT_SCRIPT" | head -n1 | cut -d'"' -f2)"
  LEDGER="$(grep '^export SDD_LEDGER=' "$EVENT_SCRIPT" | head -n1 | cut -d'"' -f2)"
fi
if [ -f "$RETRO_SCRIPT" ]; then
  RETRO_LOG="$(grep '^export SDD_RETRO_LOG=' "$RETRO_SCRIPT" | head -n1 | cut -d'"' -f2)"
fi

RESULT=""
CAUSE=""
idx=0

# event <type> key=value… — already landed when this run has a row after its
# latest phase.start with the same type and every passed key equal.
event_landed() {
  local type="$1"; shift
  [ -n "$LEDGER" ] || return 1
  [ -f "$LEDGER" ] || return 1
  node -e '
const fs = require("fs");
const [ledger, run, type, ...kv] = process.argv.slice(1);
let rows;
try { rows = fs.readFileSync(ledger, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); }
catch (e) { process.exit(1); }
rows = rows.filter((r) => r.run === run);
let start = -1;
for (let i = 0; i < rows.length; i++) if (rows[i].type === "phase.start") start = i;
const after = rows.slice(start + 1);
const want = {};
for (const a of kv) { const i = a.indexOf("="); if (i > 0) want[a.slice(0, i)] = a.slice(i + 1); }
const hit = after.some((r) => r.type === type && Object.keys(want).every((k) => String(r[k]) === want[k]));
process.exit(hit ? 0 : 1);
' "$LEDGER" "$RUN_ID" "$type" "$@"
}

seg_event() {
  if [ "$#" -lt 1 ]; then CAUSE="event needs a type"; return 2; fi
  local type="$1"; shift
  if event_landed "$type" "$@"; then RESULT="skipped"; return 0; fi
  if bash "$EVENT_SCRIPT" "$type" "$@" >/dev/null; then RESULT="ok"; return 0; fi
  CAUSE="event.sh failed"; return 1
}

# check <N> todo|doing|done — sets the checkbox with the updateTaskStatus pattern
# (src/core/task-parser.ts:446-485); already landed when the line is in that state.
seg_check() {
  if [ "$#" -lt 2 ]; then CAUSE="check needs <N> todo|doing|done"; return 2; fi
  local id="$1" state="$2"
  local marker
  case "$state" in
    todo) marker=" " ;;
    doing) marker="-" ;;
    done) marker="x" ;;
    *) CAUSE="check: unknown state '$state'"; return 2 ;;
  esac
  local tasks="$SPEC_DIR/tasks.md"
  if [ ! -f "$tasks" ]; then CAUSE="tasks.md not found at $tasks"; return 1; fi
  local out
  out="$(node -e '
const fs = require("fs");
const [file, id, marker] = process.argv.slice(1);
const content = fs.readFileSync(file, "utf8");
const lines = content.split("\n");
let found = false, changed = false;
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^(\s*)([-*])\s+\[([ x-])\]\s+(.+)/);
  if (!m) continue;
  const prefix = m[1], listMarker = m[2], cur = m[3], taskText = m[4];
  const tm = taskText.match(/^(\d+(?:\.\d+)*)\s*\\?\.?\s+(.+)/);
  if (tm && tm[1] === id) {
    found = true;
    if (cur !== marker) { lines[i] = prefix + listMarker + " [" + marker + "] " + taskText; changed = true; }
    break;
  }
}
if (!found) { process.stderr.write("task " + id + " not found"); process.exit(1); }
if (changed) { fs.writeFileSync(file, lines.join("\n")); process.stdout.write("ok"); }
else process.stdout.write("skipped");
' "$tasks" "$id" "$marker")" || { CAUSE="check update failed"; return 1; }
  RESULT="$out"; return 0
}

# head — prints the CODE_ROOT HEAD sha; read only.
seg_head() {
  local sha
  sha="$(cd "$CODE_ROOT" && /usr/bin/git rev-parse HEAD 2>/dev/null)" || { CAUSE="git rev-parse failed"; return 1; }
  echo "head: $sha"
  RESULT="ok"; return 0
}

# edit <file> <old> <new> — one exact replacement
# (harness/skills/sdd-document-phase/references/cleanup.md:99-125); already landed
# when old is absent and new is present.
seg_edit() {
  if [ "$#" -lt 3 ]; then CAUSE="edit needs <file> <old> <new>"; return 2; fi
  local file="$1" olds="$2" news="$3"
  if [ ! -f "$file" ]; then CAUSE="edit: file not found $file"; return 1; fi
  local out
  out="$(node -e '
const fs = require("fs");
const [file, oldS, newS] = process.argv.slice(1);
const text = fs.readFileSync(file, "utf8");
const first = text.indexOf(oldS);
if (first < 0) {
  if (text.indexOf(newS) >= 0) { process.stdout.write("skipped"); process.exit(0); }
  process.stderr.write("edit: old string not found"); process.exit(1);
}
if (text.indexOf(oldS, first + oldS.length) >= 0) { process.stderr.write("edit: old string not unique"); process.exit(1); }
fs.writeFileSync(file, text.slice(0, first) + newS + text.slice(first + oldS.length));
process.stdout.write("ok");
' "$file" "$olds" "$news")" || { CAUSE="edit replacement failed"; return 1; }
  RESULT="$out"; return 0
}

# changes <phase> <D> <prompt> — the round-diff logic
# (harness/skills/sdd-document-phase/references/cleanup.md:127-159); already landed
# when the prompt already holds a ## Changes heading.
seg_changes() {
  if [ "$#" -lt 3 ]; then CAUSE="changes needs <phase> <D> <prompt>"; return 2; fi
  local phase="$1" D="$2" prompt="$3"
  if [ -f "$prompt" ] && grep -q '^## Changes' "$prompt"; then RESULT="skipped"; return 0; fi
  local doc="$SPEC_DIR/$phase.md"
  local cap=500
  local want pat
  if [ "$D" = 1 ]; then want=1; pat="^docs\(sdd\): $SPEC $phase v1$"
  else want=$((D - 1)); pat="^docs\(sdd\): $SPEC $phase v$want( |$)"; fi
  local base
  base="$(cd "$SPEC_STORE_REPO" && /usr/bin/git log -1 --format=%H -E --grep="$pat" -- "$doc" 2>/dev/null || true)"
  if [ -z "$base" ]; then
    printf '\n## Changes: no checkpoint commit found for v%s\n' "$want" >> "$prompt"
    RESULT="ok"; return 0
  fi
  local short body n
  short="$(cd "$SPEC_STORE_REPO" && /usr/bin/git rev-parse --short "$base")"
  body="$(cd "$SPEC_STORE_REPO" && /usr/bin/git diff "$base" -- "$doc")"
  n="$(printf '%s\n' "$body" | wc -l)"
  {
    printf '\n## Changes since %s\n\n${'````'}diff\n' "$short"
    printf '%s\n' "$body" | head -n "$cap"
    [ "$n" -gt "$cap" ] && printf '[truncated at %s lines; read the document]\n' "$cap"
    printf '${'````'}\n'
  } >> "$prompt"
  RESULT="ok"; return 0
}

# retro <stage> <ref> <category> <body> <evidence> <cost> — bash <retroScript>
# (harness/skills/sdd-continue/references/formats.md:101-117) with
# a mark <run> <h> suffix appended to the evidence, h the first 8 hex of the
# SHA-1 of stage, ref, category and body; landed when grep -F finds the marker.
seg_retro() {
  if [ "$#" -ne 6 ]; then CAUSE="retro needs 6 arguments"; return 2; fi
  local stage="$1" ref="$2" category="$3" body="$4" evidence="$5" cost="$6"
  local h
  h="$(node -e '
const c = require("crypto");
process.stdout.write(c.createHash("sha1").update(process.argv.slice(1).join("|")).digest("hex").slice(0, 8));
' "$stage" "$ref" "$category" "$body")" || { CAUSE="retro hash failed"; return 1; }
  local marker="mark $RUN_ID $h"
  if [ -n "$RETRO_LOG" ] && [ -f "$RETRO_LOG" ] && grep -Fq "$marker" "$RETRO_LOG"; then RESULT="skipped"; return 0; fi
  if bash "$RETRO_SCRIPT" "$stage" "$ref" "$category" "$body" "$evidence · $marker" "$cost" >/dev/null; then RESULT="ok"; return 0; fi
  CAUSE="retro.sh failed"; return 1
}

# state <text> — rewrites the | State | row of ## <SPEC> — implementation in
# HANDOFF, creating the section when missing; idempotent by overwrite.
seg_state() {
  if [ "$#" -lt 1 ]; then CAUSE="state needs <text>"; return 2; fi
  local text="$1"
  node -e '
const fs = require("fs");
const [file, spec, text] = process.argv.slice(1);
let content = "";
try { content = fs.readFileSync(file, "utf8"); } catch (e) { content = ""; }
const header = "## " + spec + " — implementation";
const row = "| State | " + text + " |";
const lines = content.split("\n");
let hi = -1;
for (let i = 0; i < lines.length; i++) if (lines[i].trim() === header) { hi = i; break; }
if (hi < 0) {
  let out = content;
  if (out.length && !out.endsWith("\n")) out += "\n";
  out += "\n" + header + "\n\n" + row + "\n";
  fs.writeFileSync(file, out);
} else {
  let end = lines.length;
  for (let i = hi + 1; i < lines.length; i++) if (lines[i].indexOf("## ") === 0) { end = i; break; }
  let ri = -1;
  for (let i = hi + 1; i < end; i++) if (lines[i].trim().indexOf("| State") === 0) { ri = i; break; }
  if (ri >= 0) lines[ri] = row;
  else lines.splice(end, 0, row);
  fs.writeFileSync(file, lines.join("\n"));
}
' "$HANDOFF" "$SPEC" "$text" || { CAUSE="state update failed"; return 1; }
  RESULT="ok"; return 0
}

# commit <message> — the commit-script logic
# (harness/skills/sdd-document-phase/references/cleanup.md:71-97); already landed
# when nothing is staged.
seg_commit() {
  if [ "$#" -lt 1 ]; then CAUSE="commit needs <message>"; return 2; fi
  local msg="$1"
  local out rc
  out="$(
    cd "$SPEC_STORE_REPO" || { echo cdfail; exit 3; }
    staged=0
    for p in ".spec-workflow/specs/$SPEC" ".spec-workflow/approvals/$SPEC" ".spec-workflow/HANDOFF.md" ".spec-workflow/spec-decomposition/INDEX.md" ".spec-workflow/deferrals" "HANDOFF.md"; do
      [ -e "$p" ] || continue
      /usr/bin/git check-ignore -q "$p" && continue
      if ! /usr/bin/git add -A -- "$p"; then echo addfail; exit 4; fi
      staged=1
    done
    if [ "$staged" -eq 0 ]; then echo skipped; exit 0; fi
    if /usr/bin/git diff --cached --quiet; then echo skipped; exit 0; fi
    if /usr/bin/git -c core.hooksPath=/dev/null commit -q -s -m "$msg"; then echo ok; exit 0; fi
    echo commitfail; exit 5
  )"
  rc=$?
  case "$rc" in
    0) RESULT="$out"; return 0 ;;
    4) CAUSE="git add failed"; return 1 ;;
    5) CAUSE="git commit failed"; return 1 ;;
    *) CAUSE="commit failed"; return 1 ;;
  esac
}

run_one() {
  if [ "$#" -eq 0 ]; then return 0; fi
  idx=$((idx + 1))
  local step="$1"; shift
  RESULT=""; CAUSE=""
  local rc=0
  case "$step" in
    event) seg_event "$@"; rc=$? ;;
    check) seg_check "$@"; rc=$? ;;
    retro) seg_retro "$@"; rc=$? ;;
    state) seg_state "$@"; rc=$? ;;
    commit) seg_commit "$@"; rc=$? ;;
    head) seg_head "$@"; rc=$? ;;
    changes) seg_changes "$@"; rc=$? ;;
    edit) seg_edit "$@"; rc=$? ;;
    *) echo "book: segment $idx $step failed: unknown segment" >&2; exit 2 ;;
  esac
  if [ "$rc" -eq 0 ]; then
    echo "book: $step $RESULT"
  elif [ "$rc" -eq 2 ]; then
    echo "book: segment $idx $step failed: $CAUSE" >&2
    exit 2
  else
    echo "book: segment $idx $step failed: $CAUSE" >&2
    exit 1
  fi
}

seg=()
for tok in "$@"; do
  if [ "$tok" = "--" ]; then
    if [ "${'$'}{#seg[@]}" -gt 0 ]; then run_one "${'$'}{seg[@]}"; fi
    seg=()
  else
    seg+=("$tok")
  fi
done
if [ "${'$'}{#seg[@]}" -gt 0 ]; then run_one "${'$'}{seg[@]}"; fi
exit 0
`;

/**
 * Render `book.sh` (design C6 `book-script` row, C7). Prepends the run header
 * (the caller-named event/retro scripts, spec dir, spec-store repo, code root,
 * HANDOFF path and spec, each single-quoted) to the static body. Runs under
 * `set -u`.
 */
function renderBookScript(v: Record<string, string>): string {
  const header = [
    '#!/bin/bash',
    'set -u',
    '',
    "EVENT_SCRIPT='" + v.eventScript + "'",
    "RETRO_SCRIPT='" + v.retroScript + "'",
    "SPEC_DIR='" + v.specDir + "'",
    "SPEC_STORE_REPO='" + v.specStoreRepo + "'",
    "CODE_ROOT='" + v.codeRoot + "'",
    "HANDOFF='" + v.handoff + "'",
    "SPEC='" + v.spec + "'",
  ].join('\n');
  return header + '\n' + BOOK_BODY.replace(/^\n/, '') + '\n';
}

// --- implementer, test-author ({{key}} bodies) -------------------------------

/**
 * The red-tests section an implementer brief carries on a marked task
 * (briefs.md:88-101), built from the test author's `authorFiles` and `authorReport`
 * plus the task block's `- Test:` lines (design C9). Returns '' at the call site
 * when the caller supplies neither.
 */
export function buildRedTestsSection(authorFiles: string, testLines: string, authorReport: string): string {
  return [
    '## Red tests (from the test author)',
    '',
    '- Make every author test pass.',
    '- Do not edit an author file without reporting `TEST-AMENDED: <file> — <reason>`.',
    '- You may add your own tests.',
    "- Run the author's files last and report `green: <passed>/<total>`.",
    '',
    'Author files: ' + authorFiles,
    'Test lines:',
    testLines,
    '',
    'Author report (verbatim):',
    authorReport,
  ].join('\n');
}

/** Raw body of each `{{key}}`-placeholder kind; one placeholder per line. */
const BODIES: Record<string, string> = {
  implementer: [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Task text (from tasks.md)',
    '',
    '{{taskBlock}}',
    '',
    '{{redTests}}',
  ].join('\n'),
  'test-author': [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Job',
    '{{job}}',
    '',
    '## Task text (from tasks.md)',
    '',
    '{{taskBlock}}',
    '',
  ].join('\n'),
};

/**
 * Fill a `{{key}}` body from `values`. The read-and-obey line is dropped when the
 * map carries no `agentRules` value (the spec-store `agent-rules.md` is absent);
 * every other placeholder is replaced with its value (2.4).
 */
function renderBody(body: string, values: Record<string, string>): string {
  const text =
    values.agentRules === undefined
      ? body.split('\n').filter((l) => !l.includes('{{agentRules}}')).join('\n')
      : body;
  return text.replace(/\{\{(\w+)\}\}/g, (_full, key: string) =>
    key in values ? values[key] : '',
  );
}

export const BRIEF_TEMPLATES: Record<string, BriefTemplate> = {
  drafter: {
    mode: 'write',
    required: ['phase', 'docPath', 'specDir', 'specStoreRoot', 'codeRoot', 'carried'],
    render: renderDrafter,
  },
  'gate-a': { mode: 'write', required: ['docPath'], render: renderGateA },
  reviewer: {
    mode: 'append',
    required: [
      'phase', 'D', 'specDir', 'lintChecks', 'lintOpen', 'reDecided', 'overCap',
      'lens', 'closedByRuling', 'memoryPath', 'codeRoot', 'specStoreRoot',
    ],
    render: renderReviewer,
  },
  reviser: {
    mode: 'write',
    required: ['phase', 'D', 'docPath', 'specDir', 'findings', 'memoryPath', 'closedByRuling', 'variant'],
    render: renderReviser,
  },
  adjudicator: {
    mode: 'write',
    required: ['items', 'phase'],
    optional: ['D', 'analysisPath', 'mustFix', 'shouldFix', 'specDir', 'memoryPath', 'codeRoot'],
    render: renderAdjudicator,
  },
  checker: {
    mode: 'write',
    required: ['phase', 'D', 'docPath', 'analysisPath', 'items', 'specDir', 'codeRoot', 'analysisOutputPath'],
    render: renderChecker,
  },
  'impl-standing': {
    mode: 'write',
    required: ['codeRoot', 'mainCheckout', 'specStoreRoot', 'specDir'],
    render: renderImplStanding,
  },
  'verify-standing': {
    mode: 'write',
    required: ['codeRoot', 'mainCheckout', 'specStoreRoot', 'specDir'],
    render: renderVerifyStanding,
  },
  implementer: {
    mode: 'write',
    required: ['title', 'authorFiles', 'authorReport'],
    optional: ['authorFiles', 'authorReport'],
    render: (v) => renderBody(BODIES.implementer, v),
  },
  fix: {
    mode: 'write',
    required: ['taskId', 'round', 'variant', 'findings', 'commit'],
    render: renderFix,
  },
  verifier: {
    mode: 'write',
    required: ['title', 'variant', 'taskIds', 'files', 'round', 'gateResults', 'scenario'],
    render: renderVerifier,
  },
  'test-author': { mode: 'write', required: ['title', 'job'], render: (v) => renderBody(BODIES['test-author'], v) },
  'book-script': {
    mode: 'write',
    required: ['eventScript', 'retroScript', 'specDir', 'specStoreRepo', 'codeRoot', 'handoff'],
    render: renderBookScript,
  },
};

/** Whether a template fills the server-provided `{{taskBlock}}` slot. */
export function templateUsesTaskBlock(name: string): boolean {
  return (BODIES[name] ?? '').includes('{{taskBlock}}');
}
