import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { judgeMode, judgeTdd, JudgeInput } from '../judge.js';

function asFetch(fn: unknown): typeof fetch {
  return fn as unknown as typeof fetch;
}

function goodResponseBody() {
  return {
    model: 'jev-1.13.0',
    answers: {
      tautological: { type: 'noul', noul: 0.2 },
      asserts_criteria: { type: 'score', score: 1.5, confidence: 0.8, legend: {}, probabilities: {} },
      through_seam: { type: 'noul', noul: 0.9 },
      mocks_internals: { type: 'noul', noul: 0.1 },
    },
    usage: { input_tokens: 1234, output_tokens: 0 },
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const KEY_ENV: NodeJS.ProcessEnv = { TYPESAFE_API_KEY: 'test-key' };

const baseInput: JudgeInput = {
  redText: {
    'src/core/__tests__/foo.test.ts':
      "import assert from 'node:assert';\nassert.strictEqual(double(2), 4);",
  },
  successCriteria: 'double returns twice its input',
  requirementCriteria: ['THE function SHALL return twice its input'],
  testLines: [{ path: 'src/core/__tests__/foo.test.ts', seam: 'double' }],
  base: 'assertion-red',
};

describe('judgeMode', () => {
  it('is off without a key', () => {
    expect(judgeMode({})).toBe('off');
  });

  it('is off when the key is blank', () => {
    expect(judgeMode({ TYPESAFE_API_KEY: '   ' })).toBe('off');
  });

  it('is shadow with a key and the variable unset', () => {
    expect(judgeMode({ TYPESAFE_API_KEY: 'k' })).toBe('shadow');
  });

  it('uses a valid value as given', () => {
    expect(judgeMode({ TYPESAFE_API_KEY: 'k', SPEC_WORKFLOW_JUDGE_TDD: 'off' })).toBe('off');
    expect(judgeMode({ TYPESAFE_API_KEY: 'k', SPEC_WORKFLOW_JUDGE_TDD: 'shadow' })).toBe('shadow');
    expect(judgeMode({ TYPESAFE_API_KEY: 'k', SPEC_WORKFLOW_JUDGE_TDD: 'enforce' })).toBe('enforce');
  });

  it('falls back to shadow on an invalid value', () => {
    expect(judgeMode({ TYPESAFE_API_KEY: 'k', SPEC_WORKFLOW_JUDGE_TDD: 'loud' })).toBe('shadow');
  });

  it('is off without a key even when the variable is set', () => {
    expect(judgeMode({ SPEC_WORKFLOW_JUDGE_TDD: 'enforce' })).toBe('off');
  });
});

describe('judgeTdd', () => {
  let cacheDir: string;

  beforeEach(async () => {
    cacheDir = await fs.mkdtemp(join(tmpdir(), 'judge-test-'));
  });

  afterEach(async () => {
    await fs.rm(cacheDir, { recursive: true, force: true });
  });

  it('returns null under off and sends nothing', async () => {
    const fetchImpl = vi.fn();
    const result = await judgeTdd(baseInput, { cacheDir, env: {}, fetchImpl: asFetch(fetchImpl) });
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns null when there is no red text', async () => {
    const fetchImpl = vi.fn();
    const result = await judgeTdd(
      { ...baseInput, redText: {} },
      { cacheDir, env: KEY_ENV, fetchImpl: asFetch(fetchImpl) },
    );
    expect(result).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends one documented request and extracts the answers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(goodResponseBody()));
    const result = await judgeTdd(baseInput, {
      cacheDir,
      env: { TYPESAFE_API_KEY: 'sekret' },
      fetchImpl: asFetch(fetchImpl),
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.typesafe.ai/v1/systemone');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer sekret');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body.model).toBe('jev-1.13.0');
    expect(Object.keys(body.state).sort()).toEqual([
      'base_outcome',
      'requirement_criteria',
      'success_criteria',
      'test_files',
      'test_lines',
    ]);
    expect(body.state.base_outcome).toBe('assertion-red');
    expect(body.state.success_criteria).toBe('double returns twice its input');
    expect(body.state.requirement_criteria).toEqual(['THE function SHALL return twice its input']);
    expect(body.state.test_lines).toEqual([{ path: 'src/core/__tests__/foo.test.ts', seam: 'double' }]);
    expect(body.state.test_files).toContain('// file: src/core/__tests__/foo.test.ts');

    expect(body.questions.tautological.type).toBe('noul');
    expect(body.questions.through_seam.type).toBe('noul');
    expect(body.questions.mocks_internals.type).toBe('noul');
    expect(body.questions.asserts_criteria.type).toBe('score');
    expect(Array.isArray(body.questions.asserts_criteria.criteria)).toBe(true);
    expect(body.questions.asserts_criteria.criteria).toHaveLength(3);

    expect(result).not.toBeNull();
    expect(result!.answers).toEqual({
      tautological: 0.2,
      asserts_criteria: 1.5,
      through_seam: 0.9,
      mocks_internals: 0.1,
    });
    expect(result!.model).toBe('jev-1.13.0');
    expect(result!.inputTokens).toBe(1234);
    expect(result!.cached).toBe(false);
    expect(typeof result!.ms).toBe('number');
  });

  it('never puts the key in the cached file', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(goodResponseBody()));
    await judgeTdd(baseInput, { cacheDir, env: { TYPESAFE_API_KEY: 'sekret' }, fetchImpl: asFetch(fetchImpl) });
    const files = await fs.readdir(join(cacheDir, 'judge'));
    const contents = await fs.readFile(join(cacheDir, 'judge', files[0]), 'utf-8');
    expect(contents).not.toContain('sekret');
  });

  it('retries once after a 429 then succeeds', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 429 }))
      .mockResolvedValueOnce(jsonResponse(goodResponseBody()));
    const result = await judgeTdd(baseInput, { cacheDir, env: KEY_ENV, fetchImpl: asFetch(fetchImpl) });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result?.answers.tautological).toBe(0.2);
  }, 10_000);

  it('returns null on a timeout without retrying', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' }));
    const result = await judgeTdd(baseInput, { cacheDir, env: KEY_ENV, fetchImpl: asFetch(fetchImpl) });
    expect(result).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns null on a 500 and does not retry it', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('server error', { status: 500 }));
    const result = await judgeTdd(baseInput, { cacheDir, env: KEY_ENV, fetchImpl: asFetch(fetchImpl) });
    expect(result).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns null on a non-JSON body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('not json', { status: 200 }));
    const result = await judgeTdd(baseInput, { cacheDir, env: KEY_ENV, fetchImpl: asFetch(fetchImpl) });
    expect(result).toBeNull();
  });

  it('returns null on a malformed answer set', async () => {
    const bad = goodResponseBody();
    delete (bad.answers as Record<string, unknown>).through_seam;
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(bad));
    const result = await judgeTdd(baseInput, { cacheDir, env: KEY_ENV, fetchImpl: asFetch(fetchImpl) });
    expect(result).toBeNull();
  });

  it('truncates test_files at 48,000 characters with a marker', async () => {
    const big = 'x'.repeat(60_000);
    const input: JudgeInput = { ...baseInput, redText: { 'a.test.ts': big } };
    let capturedBody: { state: { test_files: string } } | undefined;
    const fetchImpl = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string);
      return Promise.resolve(jsonResponse(goodResponseBody()));
    });
    await judgeTdd(input, { cacheDir, env: KEY_ENV, fetchImpl: asFetch(fetchImpl) });

    const tf = capturedBody!.state.test_files;
    const expected = ('// file: a.test.ts\n' + big).slice(0, 48_000) + '…[truncated]';
    expect(tf).toBe(expected);
    expect(tf.endsWith('…[truncated]')).toBe(true);
    expect(tf.length).toBe(48_000 + '…[truncated]'.length);
  });

  it('a second call hits the cache, sends nothing, and returns cached: true', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(goodResponseBody()));
    const first = await judgeTdd(baseInput, { cacheDir, env: KEY_ENV, fetchImpl: asFetch(fetchImpl) });
    expect(first?.cached).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const throwFetch = vi.fn(() => {
      throw new Error('cache hit must not send a request');
    });
    const second = await judgeTdd(baseInput, { cacheDir, env: KEY_ENV, fetchImpl: asFetch(throwFetch) });
    expect(throwFetch).not.toHaveBeenCalled();
    expect(second?.cached).toBe(true);
    expect(second?.answers).toEqual(first?.answers);
  });
});
