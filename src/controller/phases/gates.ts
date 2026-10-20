// src/controller/phases/gates.ts
//
// T5b of the controller (docs/controller-tasks.md "T5b `document-gates`",
// docs/controller-design.md §5 "Documents", §7). The two human gates of the
// document phase, built in code as a `DocumentGates` implementation that the
// document loop (`document.ts`) calls at its gate points. The rule source is
// `harness/skills/sdd-document-phase/references/gates.md` and the supervisor's
// `sdd-continue/SKILL.md` "Gate A" / "Gate B"; the rule-to-code mapping is in the
// function doc comments.
//
// Record mode is gone (design §5): the controller always writes a wait and parks
// the run. Every gate crosses the operator through a `gate-a`/`gate-b` wait
// (`waits.ts`, T4); answering it renders `questions.md` and the run resumes.
//
// The seam T6 holds: `createDocumentGates(deps)` returns a `DocumentGates` whose
// `gateA`/`gateB` park the run and whose `resumeAfterGateA`/`resumeAfterGateB`
// drive the loop forward once the wait is answered. `pendingGate` lets the loop
// resume at a gate on re-entry instead of restarting the phase.
import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  DocumentGates,
  DocumentPhase,
  GateDirective,
  GateAInput,
  GateAResumeInput,
  GateBInput,
  GateBResumeInput,
  GateDecision,
  PendingGate,
} from './document.js';
import {
  createWait as realCreateWait,
  type CreateWaitInput,
  type ControllerWaitRecord,
} from '../waits.js';
import {
  listWaits as realListWaits,
  readWait as realReadWait,
  type RunRecord,
  type WaitRecord,
  type WaitState,
  type WaitKind,
  type WaitQuestion,
} from '../state.js';
import { harnessHandler } from '../../tools/harness.js';
import type { ToolContext } from '../../types.js';

/**
 * The wait-store seam. T6 wires the real `waits.ts`/`state.ts` functions; tests
 * inject fakes or the real ones against a temp `SDD_HOME`. `createDocumentGates`
 * defaults to the real functions so a caller can omit `deps`.
 */
export interface GateDeps {
  createWait: (input: CreateWaitInput) => Promise<ControllerWaitRecord>;
  listWaits: (opts?: { state?: WaitState }) => Promise<WaitRecord[]>;
  readWait: (id: string) => Promise<WaitRecord | undefined>;
  now?: () => Date;
}

const defaultDeps: GateDeps = {
  createWait: realCreateWait,
  listWaits: realListWaits,
  readWait: realReadWait,
};

/** `requirements` → `gate-a`, `tasks` → `gate-b`; `design` has no gate. */
function kindFor(phase: DocumentPhase): 'gate-a' | 'gate-b' | undefined {
  if (phase === 'requirements') return 'gate-a';
  if (phase === 'tasks') return 'gate-b';
  return undefined;
}

/** The recommended pick of an asked decision: its `recommended`, else `options[0]`. */
function recommendedOf(q: Pick<WaitQuestion, 'recommended' | 'options'>): string {
  return q.recommended ?? q.options?.[0] ?? '';
}

/** Flatten a wait's `answer` map (`id → {value}`) to `id → value`. */
function flattenAnswers(record: WaitRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, a] of Object.entries(record.answer ?? {})) out[id] = a.value;
  return out;
}

/**
 * Rank the drafter's decisions most direction-setting first (gates.md "Gate A",
 * sdd-continue "Gate A": a human owns scope/outcome/trade-off decisions, not
 * mechanics). The controller has no model, so it ranks deterministically: a
 * decision that offers a genuine choice (two or more options) is direction-setting
 * and ranks first; the drafter's own order breaks ties (it records decisions in
 * significance order). A stable sort keeps that order within each group.
 */
export function rankDecisions(decisions: GateDecision[]): GateDecision[] {
  const isChoice = (d: GateDecision): boolean => Array.isArray(d.options) && d.options.length >= 2;
  return decisions
    .map((d, i) => ({ d, i }))
    .sort((a, b) => (Number(isChoice(b.d)) - Number(isChoice(a.d))) || (a.i - b.i))
    .map((x) => x.d);
}

/** At most five decisions are asked (gates.md five-question cap); the rest recorded. */
const GATE_A_MAX_ASKED = 5;

/**
 * The always-offered gate-A "do nothing" question: its id, and the option that
 * (or any typed reason) defers the spec. "Proceed" is the recommended pick, so
 * deferring is never the default.
 */
const DEFER_QUESTION_ID = 'defer';
const DEFER_OPTION = 'Do nothing — defer this spec';

export function createDocumentGates(deps: GateDeps = defaultDeps): DocumentGates {
  const { createWait, listWaits } = deps;

  /** The newest open-or-answered wait of `kind` for this run, or undefined. */
  async function findWait(run: RunRecord, kind: WaitKind): Promise<ControllerWaitRecord | undefined> {
    const all = (await listWaits()) as ControllerWaitRecord[];
    return all
      .filter((w) => w.run === run.id && w.kind === kind && (w.state === 'open' || w.state === 'answered'))
      .sort((a, b) => b.created.localeCompare(a.created))[0];
  }

  // =========================================================================
  // Gate A (requirements, after v1 and the lint step; gates.md "Gate A").
  // =========================================================================
  async function gateA(input: GateAInput): Promise<GateDirective> {
    // Idempotent: a re-entry before the run parked finds the wait already open.
    const existing = await findWait(input.run, 'gate-a');
    if (existing) return { kind: 'waiting', waitId: existing.id };

    const ranked = rankDecisions(input.decisions ?? []);
    const asked = ranked.slice(0, GATE_A_MAX_ASKED);
    const recorded = ranked.slice(GATE_A_MAX_ASKED);

    const questions: WaitQuestion[] = asked.map((d, i) => ({
      id: d.id && d.id.length > 0 ? d.id : `D${i + 1}`,
      text: d.text,
      options: d.options,
      recommended: d.recommended ?? d.options?.[0],
      reason: 'direction-setting decision',
    }));
    // Gate A always offers "do nothing / defer this spec" as the final question,
    // even when there are no direction-setting decisions to ask (so the wait is
    // always opened). Picking the defer option (optionally followed by a reason) ends the run
    // and tags the decomposition heading `(deferred)`; "Proceed" is recommended,
    // so the defer is never the default pick.
    questions.push({
      id: DEFER_QUESTION_ID,
      text:
        'Proceed with this spec, or do nothing and defer it? Reply "Proceed" to ' +
        `continue, or pick "${DEFER_OPTION}" (optionally followed by a reason) to end ` +
        'the run now — the drafted requirements are kept and no design, tasks or ' +
        'implementation run.',
      options: ['Proceed', DEFER_OPTION],
      recommended: 'Proceed',
      free: true,
      reason: 'deferring ends the run and keeps the drafted requirements',
    });
    // The decisions ranked past the cap are recorded, not asked (gates.md): they
    // ride the wait's one wire-visible extra field (`proposals`, kept for the
    // sheet) as `recorded without asking` lines, so the sheet still lists them.
    const recordedLines = recorded.map(
      (d) =>
        `${d.id ? d.id + ' — ' : ''}${d.text} — recorded without asking as ` +
        `"${d.recommended ?? d.options?.[0] ?? '(drafter default)'}"`,
    );

    const record = await createWait({
      kind: 'gate-a',
      runId: input.run.id,
      projectId: input.run.project,
      spec: input.run.spec,
      specDir: input.specDir,
      questions,
      proposals: recordedLines.length > 0 ? recordedLines : undefined,
    });
    return { kind: 'waiting', waitId: record.id };
  }

  /**
   * Resume gate A (sdd-continue "Gate A" steps 4-6): a changed answer — the
   * operator picked something other than the recorded default — becomes a
   * revision comment to one reviser step (revision.md Step R); an unchanged
   * answer is recorded only. Returns `revise` with the numbered comments when any
   * answer changed, else `proceed`.
   */
  async function resumeAfterGateA(input: GateAResumeInput): Promise<GateDirective> {
    const wait = await findWait(input.run, 'gate-a');
    if (!wait) return { kind: 'proceed' }; // nothing to resume

    // Only an answer that starts with the option's words defers, so a stray comment
    // typed into the field never ends a run; the rest of the answer is the reason.
    const deferAnswer = (input.answers[DEFER_QUESTION_ID] ?? '').trim();
    const deferMatch = /^(do nothing|defer)\b(?:\s*[—-]\s*defer this spec)?[\s:,.—-]*/i.exec(deferAnswer);
    if (deferMatch) {
      return { kind: 'defer', reason: deferAnswer.slice(deferMatch[0].length).trim() };
    }

    const comments: string[] = [];
    for (const q of wait.questions) {
      if (q.id === DEFER_QUESTION_ID) continue; // handled above, never a revision
      const picked = (input.answers[q.id] ?? '').trim();
      const rec = recommendedOf(q).trim();
      if (picked.length === 0 || picked === rec) continue; // unchanged: recorded only
      comments.push(
        `RI-${comments.length + 1}: ${q.text} — the operator chose "${picked}"` +
          (rec.length > 0 ? ` (the drafter recommended "${rec}").` : '.'),
      );
    }
    if (comments.length === 0) return { kind: 'proceed' };
    return { kind: 'revise', findings: comments.join('\n') };
  }

  // =========================================================================
  // Gate B (tasks, after approval; gates.md "Gate B", sdd-continue "Gate B").
  // =========================================================================
  async function gateB(input: GateBInput): Promise<GateDirective> {
    const existing = await findWait(input.run, 'gate-b');
    if (existing) return { kind: 'waiting', waitId: existing.id };

    const veto = await buildVetoList(input);
    const tasks = readTaskPlan(input.specDir);

    // One decision for the operator: approve the plan, or annotate it (the
    // annotation runs one advisory reviser round). A reply of "Approve" proceeds;
    // any other text is the annotation (sdd-continue "Gate B").
    const vetoCount = veto.length;
    const questions: WaitQuestion[] = [
      {
        id: 'gate-b',
        text:
          'Approve the task plan, or annotate it? Reply "Approve" to proceed, or ' +
          'type an annotation to revise the tasks once before implementation.',
        options: ['Approve', 'Annotate'],
        recommended: 'Approve',
        free: true,
        reason:
          vetoCount > 0
            ? `${vetoCount} task(s) flagged for your attention (see below)`
            : 'no tasks were flagged',
      },
    ];

    // The plan and the ranked veto list ride `proposals` (the wire-visible extra
    // field, kept for the sheet). The first line carries the approved version so a
    // resume can tell whether an annotation's revision already landed.
    const proposals = [
      `Plan approved at v${input.version}.`,
      ...tasks.map((t) => `Task ${t.id}: ${t.title}`),
      ...veto.map(
        (v) => `[veto ${v.rank}, class ${v.class}] task ${v.taskId}: ${v.summary}`,
      ),
    ];

    const record = await createWait({
      kind: 'gate-b',
      runId: input.run.id,
      projectId: input.run.project,
      spec: input.run.spec,
      specDir: input.specDir,
      questions,
      proposals,
    });
    return { kind: 'waiting', waitId: record.id };
  }

  /**
   * Resume gate B (sdd-continue "Gate B" step 3): a reply of "Approve" (or empty)
   * proceeds; any other text is an annotation that becomes one reviser revision
   * comment. The document loop runs the reviser and re-approves the tasks
   * document; gate B does not fire again (the round is advisory, Req 5 AC 6).
   */
  async function resumeAfterGateB(input: GateBResumeInput): Promise<GateDirective> {
    const reply = (input.answers['gate-b'] ?? '').trim();
    if (reply.length === 0 || /^approve$/i.test(reply)) return { kind: 'proceed' };
    const text = /^annotate$/i.test(reply)
      ? 'Re-examine the vetoed tasks and address the operator’s gate-B annotation.'
      : reply;
    return { kind: 'revise', findings: `RI-1: ${text}` };
  }

  // =========================================================================
  // The veto list (gates.md "Gate B": class (a) + classes (b)/(c), folded).
  // =========================================================================
  async function buildVetoList(input: GateBInput): Promise<VetoItem[]> {
    // Class (a): sensitive-path items (score 2) and action-keyword items (score
    // 1), computed server-side from `tasks.md` and the `## Sensitive paths` list
    // via `gate-rules.ts`/`veto-rules.ts` — no model (harness.ts `gate class-a`).
    const toolContext: ToolContext = { projectPath: input.specStoreRoot, workspacePath: input.codeRoot };
    const classA = await harnessHandler(
      { action: 'gate', op: 'class-a', specName: input.run.spec },
      toolContext,
    );
    const items: VetoItem[] = [];
    if (classA.success) {
      const data = classA.data as { items?: ClassAItem[] } | undefined;
      for (const it of data?.items ?? []) {
        items.push({ rank: 0, class: 'a', taskId: it.taskId, summary: it.reason, score: it.score });
      }
    }

    // Classes (b)/(c): the kept gate-b/gate-c tags the reviser recorded in the
    // tasks document's Revision History — a new external dependency, or work
    // beyond the approved requirements (gates.md item 2). A plain grep of the
    // reviewer-written tags, not a model: a tag whose latest bullet is Rejected
    // was intentionally kept and vetoes; an Accepted tag was removed and drops.
    for (const t of parseVetoTags(readDocument(input.specDir))) {
      items.push({ rank: 0, class: t.class, taskId: t.taskId, summary: t.reason, score: 0 });
    }

    // Fold into one ranked list, most consequential first: class (a) by score
    // descending (already sorted by the server), then (b)/(c) in document order
    // (gates.md item 3). Assign rank last, 1 = most consequential.
    items.sort((x, y) => classOrder(x) - classOrder(y) || y.score - x.score);
    items.forEach((it, i) => (it.rank = i + 1));
    return items;
  }

  // =========================================================================
  // Resume routing (design §5 resumability): the open or answered gate wait.
  // =========================================================================
  async function pendingGate(run: RunRecord, phase: DocumentPhase): Promise<PendingGate | undefined> {
    const kind = kindFor(phase);
    if (!kind) return undefined;
    const wait = await findWait(run, kind); // open or answered — all resume needs
    if (!wait) return undefined;
    return {
      waitId: wait.id,
      kind,
      answered: wait.state === 'answered',
      version: gateVersion(wait),
      answers: wait.state === 'answered' ? flattenAnswers(wait) : undefined,
    };
  }

  return { gateA, resumeAfterGateA, gateB, resumeAfterGateB, pendingGate };
}

// ---------------------------------------------------------------------------
// Veto types and helpers (gates.md "Gate B").
// ---------------------------------------------------------------------------

/** The class-(a) item shape `harness gate class-a` returns (`veto-rules.ts`). */
interface ClassAItem {
  taskId: string;
  title: string;
  kind: 'sensitive-path' | 'keyword';
  reason: string;
  score: number;
}

/** One folded veto item across all three classes (gates.md item 3). */
interface VetoItem {
  rank: number;
  class: 'a' | 'b' | 'c';
  taskId: string;
  summary: string;
  score: number;
}

/** Class order for the fold: (a) before (b) before (c). */
function classOrder(v: VetoItem): number {
  return v.class === 'a' ? 0 : v.class === 'b' ? 1 : 2;
}

/** The approved version a gate-b wait was raised at, parsed from its first proposal line. */
function gateVersion(wait: ControllerWaitRecord): number {
  const first = wait.proposals?.[0] ?? '';
  const m = /\bv(\d+)\b/.exec(first);
  return m ? Number(m[1]) : 1;
}

/** Read `<specDir>/tasks.md`, or '' when absent. */
function readDocument(specDir: string): string {
  try {
    return readFileSync(join(specDir, 'tasks.md'), 'utf-8');
  } catch {
    return '';
  }
}

/** The task headers for the compact plan: `- [ ] N. Title` lines (a structure read). */
function readTaskPlan(specDir: string): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  for (const line of readDocument(specDir).split('\n')) {
    const m = /^\s*[-*]\s+\[[ xX-]\]\s+(\d+(?:\.\d+)*)[.)]?\s+(.+)$/.exec(line);
    if (!m) continue;
    out.push({ id: m[1], title: m[2].replace(/\[gate-[bc]:[^\]]+\]/g, '').trim() });
  }
  return out;
}

/**
 * The kept gate-b/gate-c tags in a tasks document's Revision History (gates.md
 * item 2): for each distinct `[gate-(b|c):T<id>]` tag take its most recent line
 * and keep it only when that line's disposition is Rejected (the task was
 * intentionally kept). An Accepted tag means the task was removed, so it drops.
 */
export function parseVetoTags(tasksMd: string): { taskId: string; class: 'b' | 'c'; reason: string }[] {
  const re = /\[gate-(b|c):T?([^\]]+)\]/;
  const latest = new Map<string, { taskId: string; cls: 'b' | 'c'; line: string }>();
  for (const line of tasksMd.split('\n')) {
    const m = re.exec(line);
    if (!m) continue;
    const cls = m[1] as 'b' | 'c';
    const taskId = m[2].trim();
    latest.set(`${cls}:${taskId}`, { taskId, cls, line });
  }
  const out: { taskId: string; class: 'b' | 'c'; reason: string }[] = [];
  for (const { taskId, cls, line } of latest.values()) {
    if (!/\breject/i.test(line)) continue; // Accepted ⇒ task removed ⇒ not a veto
    const reason = line.replace(/^\s*[-*]\s*/, '').trim().slice(0, 200);
    out.push({ taskId, class: cls, reason });
  }
  return out;
}
