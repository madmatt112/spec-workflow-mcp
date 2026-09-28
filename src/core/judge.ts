import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { BaseOutcome, JudgeAnswers, JudgeResult } from '../types.js';
import type { TaskTest } from './task-parser.js';

/**
 * Component 11 — the shadow judge (requirement 7). One cheap, independent score
 * per author test file, recorded on the gate's review and never routed on. No
 * SDK dependency; the module never throws — every failure returns `null` so the
 * gate verdict is untouched (requirement 7.6, 7.8).
 */

export interface JudgeInput {
  /** Path -> red-commit test file content, from the proof. */
  redText: Record<string, string>;
  /** The task's `Success` prompt section. */
  successCriteria: string;
  /** The requirement criteria the task's `_Requirements:` ids name. */
  requirementCriteria: string[];
  /** The task's `- Test:` seams. */
  testLines: TaskTest[];
  /** The classified base outcome. */
  base: BaseOutcome;
}

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const MODEL = 'jev-1.13.0';
const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 1_000;
// 429 (rate limit) and 529 (overloaded) are the two retryable statuses the Jev
// note names; every other non-2xx fails open (docs/jev-integration-research.md:47).
const RETRY_STATUSES = new Set([429, 529]);
const MAX_STATE_CHARS = 48_000;
const TRUNCATION_MARKER = '…[truncated]';

// The four questions, one call. Texts are the memo's
// (docs/tdd-implementation-research.md:348-356). Shapes are confirmed against
// the `@typesafe-ai/sdk` v0.6.0 TypeScript declarations: a noul question is
// `{ type, instructions }`; a score question is `{ type, instructions, criteria }`
// where `criteria` is an ordered array of level descriptions, low to high
// (ScoreCriteria = readonly [EntryType, EntryType, ...EntryType[]]).
const QUESTIONS = {
  tautological: {
    type: 'noul',
    instructions:
      "At least one test derives its expected value with the same logic the code under test would use, or from the code's own output, instead of from a value the criteria state.",
  },
  asserts_criteria: {
    type: 'score',
    instructions:
      'How many of the stated criteria does at least one test pin to an exact value?',
    criteria: [
      'None of the criteria are pinned to exact values.',
      'Some of the criteria are pinned, with exact values.',
      'All of the criteria are pinned, with exact values.',
    ],
  },
  through_seam: {
    type: 'noul',
    instructions:
      'Every test reaches the behaviour only through the call named on the Test line.',
  },
  mocks_internals: {
    type: 'noul',
    instructions:
      'A test replaces a collaborator inside the module under test with a mock or stub.',
  },
} as const;

/**
 * The mode from the environment (requirement 7.2). No `TYPESAFE_API_KEY` (or a
 * blank one) gives `off`; a key with `SPEC_WORKFLOW_JUDGE_TDD` unset gives
 * `shadow`; a valid value is used as given; an invalid one gives `shadow`.
 */
export function judgeMode(
  env: NodeJS.ProcessEnv = process.env,
): 'off' | 'shadow' | 'enforce' {
  const key = (env.TYPESAFE_API_KEY ?? '').trim();
  if (key === '') return 'off';
  const mode = env.SPEC_WORKFLOW_JUDGE_TDD;
  if (mode === undefined) return 'shadow';
  if (mode === 'off' || mode === 'shadow' || mode === 'enforce') return mode;
  return 'shadow';
}

/**
 * Score one gate's author test files. Returns `null` at once under `off`, when
 * there is no red text to score, and on any request, transport, cache or parse
 * failure (requirement 7.6). A content-hash cache hit sends nothing and returns
 * the stored result with `cached: true` (requirement 7.5). `enforce` acts as
 * `shadow` in this spec: both send the request and record the answers.
 */
export async function judgeTdd(
  input: JudgeInput,
  opts: { cacheDir: string; env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch },
): Promise<JudgeResult | null> {
  const env = opts.env ?? process.env;
  if (judgeMode(env) === 'off') return null;
  if (Object.keys(input.redText).length === 0) return null;

  const key = (env.TYPESAFE_API_KEY ?? '').trim();
  const bodyJson = JSON.stringify(buildBody(input));
  const cachePath = cacheFilePath(opts.cacheDir, bodyJson);

  const cached = await readCache(cachePath);
  if (cached) return { ...cached, cached: true };

  // Default to the global `fetch`, read at call time (design Component 11).
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  const start = Date.now();
  try {
    let response = await doFetch(ENDPOINT, requestInit(key, bodyJson));
    if (RETRY_STATUSES.has(response.status)) {
      await delay(RETRY_DELAY_MS);
      response = await doFetch(ENDPOINT, requestInit(key, bodyJson));
    }
    if (!response.ok) return null;
    const json: unknown = await response.json();
    const parsed = parseAnswer(json);
    if (!parsed) return null;
    const result: JudgeResult = {
      answers: parsed.answers,
      model: parsed.model,
      inputTokens: parsed.inputTokens,
      ms: Date.now() - start,
      cached: false,
    };
    await writeCache(cachePath, result);
    return result;
  } catch {
    return null;
  }
}

function buildBody(input: JudgeInput): {
  model: string;
  state: Record<string, unknown>;
  questions: typeof QUESTIONS;
} {
  return {
    model: MODEL,
    state: {
      test_files: buildTestFiles(input.redText),
      success_criteria: input.successCriteria,
      requirement_criteria: input.requirementCriteria,
      test_lines: input.testLines,
      base_outcome: input.base,
    },
    questions: QUESTIONS,
  };
}

/**
 * Every red file under a `// file: <path>` header, cut at 48,000 characters with
 * the marker `…[truncated]` (requirement 7.3).
 */
function buildTestFiles(redText: Record<string, string>): string {
  const joined = Object.entries(redText)
    .map(([p, content]) => `// file: ${p}\n${content}`)
    .join('\n\n');
  if (joined.length <= MAX_STATE_CHARS) return joined;
  return joined.slice(0, MAX_STATE_CHARS) + TRUNCATION_MARKER;
}

function requestInit(key: string, bodyJson: string): RequestInit {
  return {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: bodyJson,
    // A fresh per-attempt deadline (design Transport).
    signal: AbortSignal.timeout(TIMEOUT_MS),
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * The inbound extraction, confirmed against the `@typesafe-ai/sdk` v0.6.0
 * declarations: a noul answer carries `{ noul: number }`, a score answer carries
 * `{ score: number }`, and the envelope carries `model` and `usage.input_tokens`.
 * A missing or mistyped answer, token count or model is a malformed body and
 * returns `null` (requirement 7.6).
 */
function parseAnswer(
  json: unknown,
): { answers: JudgeAnswers; model: string; inputTokens: number } | null {
  if (typeof json !== 'object' || json === null) return null;
  const obj = json as Record<string, unknown>;

  const model = obj.model;
  if (typeof model !== 'string' || model.length === 0) return null;

  const usage = obj.usage;
  const inputTokens =
    typeof usage === 'object' && usage !== null
      ? (usage as Record<string, unknown>).input_tokens
      : undefined;
  if (typeof inputTokens !== 'number' || !Number.isFinite(inputTokens)) return null;

  const answers = obj.answers;
  if (typeof answers !== 'object' || answers === null) return null;
  const a = answers as Record<string, unknown>;

  const tautological = readField(a.tautological, 'noul');
  const asserts_criteria = readField(a.asserts_criteria, 'score');
  const through_seam = readField(a.through_seam, 'noul');
  const mocks_internals = readField(a.mocks_internals, 'noul');
  if (
    tautological === null ||
    asserts_criteria === null ||
    through_seam === null ||
    mocks_internals === null
  ) {
    return null;
  }

  return {
    answers: { tautological, asserts_criteria, through_seam, mocks_internals },
    model,
    inputTokens,
  };
}

function readField(answer: unknown, field: 'noul' | 'score'): number | null {
  if (typeof answer !== 'object' || answer === null) return null;
  const v = (answer as Record<string, unknown>)[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function cacheFilePath(cacheDir: string, bodyJson: string): string {
  const hash = createHash('sha256').update(bodyJson).digest('hex');
  return path.join(cacheDir, 'judge', `${hash}.json`);
}

async function readCache(p: string): Promise<JudgeResult | null> {
  try {
    return JSON.parse(await fs.readFile(p, 'utf-8')) as JudgeResult;
  } catch {
    return null;
  }
}

async function writeCache(p: string, result: JudgeResult): Promise<void> {
  try {
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(result), 'utf-8');
  } catch {
    // Best-effort: a cache-write failure must not fail the judge.
  }
}
