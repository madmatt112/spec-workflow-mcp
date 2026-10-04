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
          '`). Rule on each: `refinement` (closed) or `widening` (a MUST_FIX). Close a flag as a `refinement` and carry it to the next drafter on your own authority when the change stays within the governing requirement\'s intent; rule `widening` (a MUST_FIX) only when the flag reverses a requirement or crosses a decision the human owns.',
      );
    }
  } else {
    lines.push(
      '- Read the Revision History line for v' + v.D +
        ' first and attack those changes before anything else. Every MUST_FIX after round 1 in past specs was a claim error introduced by the previous delta. Mark a finding that lands in text the previous delta wrote `Compounds: R<A-1>-<n>`, naming the round-<A-1> finding whose fix wrote the clause. Label each round-<A> MUST_FIX `fix-induced` when the last delta introduced it or `carried` when it is a pre-existing defect the last fix did not touch.',
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
    '7. Edit only the document. Approvals, deferrals, HANDOFF, INDEX and the memory file belong to others. You may replace a context-file line that an accepted finding refutes: same line, corrected text, the probe that proves it. Tasks phase only: when an accepted finding changes a call signature that `design.md` states, apply the same text to that design component and add to `design.md` a Revision History line `- **v<D> amended** (<date>) — tasks R<A>-<n>: <what>`; list it under the finding\'s bullet as `also applied to design.md`. This does not widen scope and needs no re-approval — approval records do not hash content.',
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

// --- adjudicator (docPath form) ----------------------------------------------

function renderAdjudicator(v: Record<string, string>): string {
  const lines: string[] = ['# Adjudication brief — ' + v.spec + ' ' + v.phase + ', post-cap corrective pass', ''];
  if (v.agentRules !== undefined) lines.push('Read and obey ' + v.agentRules + ' first.', '');
  lines.push(
    'The review loop reached its cap: v<D> of `' + v.docPath + '` was reviewed in `<r<A> analysis path>` and still carries MUST_FIX <m> / SHOULD_FIX <s>. You are the corrective pass. Fix or rule out each open item, write v<D+1> in place, and stop. Nothing reviews v<D+1> again; a narrow check only verifies that each listed item was addressed. A SHOULD_FIX you rule out is carried into the next phase\'s drafter brief, so its reason must stand on its own.',
    '',
    '## Open items',
    v.items,
    '',
    '## Inputs',
    '- Context file: `<spec dir>/codebase-context.md`. Read it first.',
    '- Document (v<D>); the r<A> analysis; the memory file `<memory file path>`; <requirements and design as applicable>. Code under `<CODE_ROOT>`.',
    '- Cap: <requirements: 3,500 words | design: 4,000 words | tasks: 150 words per task block excluding its prompt>. Do not grow the document past it.',
    '',
    '## Rules',
    '- For each item: fix it in the document, or rule it out with a stated reason. A rule-out is a ruling; it is final for this phase.',
    '- Verify every citation against the real tree, both ends of every range.',
    '- Revision History line: `- **v<D+1>** (<today>) — Post-cap corrective pass, adjudicated, not re-reviewed.` followed by one nested bullet per item: `- **<id> — fixed | ruled out (<severity>).** <one line>`. Keep the words `Post-cap corrective pass` exactly; the orchestrator greps for them.',
    '- Report in 150 words or fewer: each item as `<id>: fixed | ruled out (<severity>) — <reason>`, files touched, flags. No file contents.',
    '- Edit only the document. Do not ask questions.',
    '',
    ...reportBlockLines(['version', 'fixed', 'ruled-out', 'notes', 'flags']),
  );
  return lines.join('\n') + '\n';
}

// --- checker (narrow check, write over the prompt) ---------------------------

function renderChecker(v: Record<string, string>): string {
  const lines: string[] = ['# Narrow check — ' + v.spec + '/' + v.phase + ' v<D>', ''];
  let para =
    'This is not a review. v<D-1> of `<document path>` was reviewed in `<r<A> analysis path>`; a corrective pass produced v<D> and addressed the items below. Verify only that each item was addressed in v<D>: fixed, or ruled out with a stated reason under the v<D> Revision History line. Read `' +
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
    'Write to `<analysis output path>`:',
    '- One line per item: `<id>: addressed | not addressed — <one line>`.',
    '- The line `VERIFIED: <k>/<n>` where k is the number addressed.',
    '- Any new observation under a `## Deferred findings` heading, one line each. Do not write a verdict block. Do not update the memory file. Do not edit the document.',
    '',
    ...reportBlockLines(['verified', 'deferred', 'analysis']),
  );
  return lines.join('\n') + '\n';
}

// --- verifier, implementer, test-author (unchanged, {{key}} bodies) ----------

/** Raw body of each `{{key}}`-placeholder kind; one placeholder per line. */
const BODIES: Record<string, string> = {
  verifier: [
    '# {{title}}',
    '',
    'Read and obey {{agentRules}} first.',
    '',
    '## Job',
    '{{job}}',
    '',
  ].join('\n'),
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
  adjudicator: { mode: 'write', required: ['items', 'phase', 'docPath'], render: renderAdjudicator },
  checker: { mode: 'write', required: ['phase', 'items', 'specDir', 'codeRoot'], render: renderChecker },
  verifier: { mode: 'write', required: ['title', 'job'], render: (v) => renderBody(BODIES.verifier, v) },
  implementer: {
    mode: 'write',
    required: ['title', 'redTests'],
    optional: ['redTests'],
    render: (v) => renderBody(BODIES.implementer, v),
  },
  'test-author': { mode: 'write', required: ['title', 'job'], render: (v) => renderBody(BODIES['test-author'], v) },
};

/** Whether a template fills the server-provided `{{taskBlock}}` slot. */
export function templateUsesTaskBlock(name: string): boolean {
  return (BODIES[name] ?? '').includes('{{taskBlock}}');
}
