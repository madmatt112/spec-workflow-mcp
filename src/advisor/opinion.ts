// src/advisor/opinion.ts
//
// The second opinion (design.md C7; requirements.md Requirement 5, 3.4).
// `startSecondOpinion` runs one headless `sdd-advisor` step on an open wait,
// on the operator's press only: no run slot, never queued, never answers the
// wait or touches a run. A valid result attaches through `attachAdvice`; an
// invalid or failed one records `opinionStatus: failed`, advice untouched.
// Either way it writes one `advisor.opinion` row (Requirement 5.6) with the five `StepUsage` fields `buildTallies` attributes to role `sdd-advisor`.
import { promises as fs } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { advisorHomeDir, advisorOpinionsDir, appendEvent } from './home.js';
import { readWait, type WaitOpinion, type WaitQuestion, type WaitRecord } from '../controller/state.js';
import { attachAdvice, setOpinionStatus } from '../controller/waits.js';
import { runStep, type StepSpec } from '../controller/step.js';

/** What the route (and the tests) hand `startSecondOpinion` (C7). */
export interface SecondOpinionDeps {
  usageBlock(): { blocked: boolean; resumeAt?: string };
}

export type SecondOpinionResult =
  | { ok: true }
  | { ok: false; error: 'not-found' | 'not-open' | 'running' | 'usage-window'; reason?: string };

const OPINION_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  required: ['picks', 'summary'],
  properties: {
    picks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['question', 'pick', 'reason'],
        properties: {
          question: { type: 'string' },
          pick: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    summary: { type: 'string' },
  },
} as const;

function wordCount(text: string): number {
  return text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
}

/**
 * Schema match: each pick names a wait question and, where it has options,
 * one of them; reasons at most 60 words, summary at most 100 (D5, 5.2).
 */
function validateOpinion(structured: unknown, questions: WaitQuestion[]): WaitOpinion | null {
  if (!structured || typeof structured !== 'object') return null;
  const raw = structured as { picks?: unknown; summary?: unknown };
  if (!Array.isArray(raw.picks) || typeof raw.summary !== 'string') return null;
  if (wordCount(raw.summary) > 100) return null;

  const byId = new Map(questions.map((q) => [q.id, q]));
  const picks: WaitOpinion['picks'] = [];
  for (const entry of raw.picks) {
    if (!entry || typeof entry !== 'object') return null;
    const pick = entry as { question?: unknown; pick?: unknown; reason?: unknown };
    if (typeof pick.question !== 'string' || typeof pick.pick !== 'string' || typeof pick.reason !== 'string') {
      return null;
    }
    const question = byId.get(pick.question);
    if (!question) return null;
    if (question.options && question.options.length > 0 && !question.options.includes(pick.pick)) return null;
    if (wordCount(pick.reason) > 60) return null;
    picks.push({ question: pick.question, pick: pick.pick, reason: pick.reason });
  }
  return { picks, summary: raw.summary };
}

/** One `### ` block per question: its text, its options or "free text", its recommendation. */
function questionBlock(q: WaitQuestion): string {
  const lines = [`### ${q.text}`, '', `- id: ${q.id}`];
  lines.push(q.options && q.options.length > 0 ? `- options: ${q.options.join(' | ')}` : '- free text');
  if (q.recommended) lines.push(`- recommended: ${q.recommended}`);
  if (q.reason) lines.push(`- reason: ${q.reason}`);
  return lines.join('\n');
}

/** `advisor/opinions/<waitId>/<stamp>/brief.md` (design C7): questions, options, recommendation, the rendered earlier advice, and the word limits. */
function renderBrief(wait: WaitRecord): string {
  const parts = [
    '# Second opinion',
    '',
    'Pick one value per question below. For each, give a reason of at most 60',
    'words. Then give a summary of at most 100 words covering every pick.',
    '',
    ...wait.questions.map(questionBlock),
    '',
    '## Earlier advice',
    '',
    wait.advice ?? '(none yet)',
    '',
    'Report a JSON object: { "picks": [{ "question": "<id>", "pick": "<value>", "reason": "<=60 words" }], "summary": "<=100 words" }.',
    '',
  ];
  return parts.join('\n');
}

function stamp(): string {
  return `${Date.now()}-${randomBytes(3).toString('hex')}`;
}

/**
 * One headless `sdd-advisor` step on `waitId`, from the operator's press only
 * (C7; 5.1, 5.4). Guards in order: unknown wait (404), not-open (409), one
 * already running (409), the usage window (409, 5.5/D9) — none starts a step.
 * Else marks `opinionStatus` running, writes the brief, runs the step: a valid
 * result attaches and clears the status (5.1, 5.2); invalid/failed records
 * `opinionStatus: failed`, advice untouched (5.7); either way writes one
 * `advisor.opinion` row (5.6).
 */
export async function startSecondOpinion(waitId: string, deps: SecondOpinionDeps): Promise<SecondOpinionResult> {
  const wait = await readWait(waitId);
  if (!wait) return { ok: false, error: 'not-found' };
  if (wait.state !== 'open') return { ok: false, error: 'not-open' };
  if (wait.opinionStatus?.state === 'running') return { ok: false, error: 'running' };

  const block = deps.usageBlock();
  if (block.blocked) {
    const reason = block.resumeAt
      ? `the usage window is above the controller's threshold until ${block.resumeAt}`
      : "the usage window is above the controller's threshold";
    return { ok: false, error: 'usage-window', reason };
  }

  await setOpinionStatus(waitId, { state: 'running' });

  const opinionDir = join(advisorOpinionsDir(), waitId, stamp());
  await fs.mkdir(opinionDir, { recursive: true });
  const briefPath = join(opinionDir, 'brief.md');
  await fs.writeFile(briefPath, renderBrief(wait), 'utf-8');

  const home = advisorHomeDir();
  await fs.mkdir(home, { recursive: true });

  const spec: StepSpec = {
    role: 'sdd-advisor',
    briefPath,
    worktree: home,
    logPath: join(opinionDir, 'step.jsonl'),
    maxTurns: 6,
    schema: OPINION_SCHEMA,
    mcpConfig: { mcpServers: {} },
    noSessionPersistence: true,
  };
  const result = await runStep(spec);

  const opinion = result.classification === 'ok' ? validateOpinion(result.structuredOutput, wait.questions) : null;
  const outcome = opinion ? 'ok' : result.classification !== 'ok' ? result.classification : 'invalid result';

  if (opinion) {
    await attachAdvice(waitId, opinion.summary, opinion);
  } else {
    await setOpinionStatus(waitId, { state: 'failed', reason: outcome });
  }

  await appendEvent({
    v: 1,
    ts: new Date().toISOString(),
    type: 'advisor.opinion',
    wait: waitId,
    outcome,
    input: result.usage.input,
    output: result.usage.output,
    cacheRead: result.usage.cacheRead,
    cacheWrite5m: result.usage.cacheWrite5m,
    cacheWrite1h: result.usage.cacheWrite1h,
  });

  return { ok: true };
}
