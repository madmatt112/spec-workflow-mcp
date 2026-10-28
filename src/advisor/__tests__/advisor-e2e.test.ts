import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { promises as fsp } from 'fs';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'fs';
import { createServer, type Server } from 'http';
import net from 'net';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { MultiProjectDashboardServer, _resetMultiServerWarningsForTests } from '../../dashboard/multi-server.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../../core/global-dir.js';
import { ADVISOR_MCP_PATH, loadOrCreateSecret, loadOrCreateAdvisorSecret } from '../../controller/access.js';
import { createWait } from '../../controller/waits.js';
import { readWait, readRun, writeRun, readQueue, writeQueue, type RunRecord, type QueueFile } from '../../controller/state.js';
import { pushConfigPath, searchPath, eventsPath } from '../home.js';

// End-to-end proof for the advisor spec (decomposition entry's verification
// scenario; tasks.md task 19). Each check drives a real
// MultiProjectDashboardServer over HTTP, against a fresh temp SDD_HOME, with
// a fixture project, stub `claude` (scripts/stub-claude.mjs) and `gh`
// (scripts/stub-gh.mjs), and a local push-capture server. No controller
// collaborator is mocked: only the external processes/services the agent
// rules name a seam for (claude, gh, the embedder, the ntfy-style push
// target) are stubbed. Each test below is coverage of behaviour tasks 3-16
// already shipped (a regression guard), not a red test. Check 6 (a planted
// source instruction stages nothing) and check 3 with a real embedder are
// left `pending` in verification-evidence.md: they need a live advisor
// session / an installed embedding server this environment does not have.

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const STUB_CLAUDE = join(REPO_ROOT, 'scripts', 'stub-claude.mjs');
const STUB_GH = join(REPO_ROOT, 'scripts', 'stub-gh.mjs');

const realFetch: typeof fetch = globalThis.fetch;

const USAGE = {
  input_tokens: 11,
  output_tokens: 222,
  cache_read_input_tokens: 333,
  cache_creation: { ephemeral_5m_input_tokens: 44, ephemeral_1h_input_tokens: 55 },
};

beforeAll(() => {
  chmodSync(STUB_CLAUDE, 0o755);
  chmodSync(STUB_GH, 0o755);
});

async function getFreePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const a = s.address();
      if (!a || typeof a === 'string') { s.close(); reject(new Error('no port')); return; }
      const port = a.port;
      s.close(() => resolvePort(port));
    });
    s.on('error', reject);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(predicate: () => boolean | Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await sleep(25);
  }
  throw new Error('waitFor timed out');
}

function textOf(result: { content?: { type: string; text?: string }[] }): string {
  return (result.content ?? []).map((c) => c.text ?? '').join('\n');
}

describe('advisor end-to-end (task 19; decomposition verification scenario)', () => {
  let tempDir: string;
  let server: MultiProjectDashboardServer | null = null;
  let extraDirs: string[];
  let helperServers: Array<{ close(): Promise<void> }>;
  const originalEnv = { ...process.env };

  beforeEach(async () => {
    tempDir = join(tmpdir(), `advisor-e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    const stateHomeDir = join(tempDir, '.xdg-state');
    await fsp.mkdir(stateHomeDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = join(tempDir, '.global-state');
    process.env.XDG_STATE_HOME = stateHomeDir;
    process.env.SDD_HOME = join(tempDir, '.sdd-home');
    extraDirs = [];
    helperServers = [];

    // Pass every loopback helper server through (the fake embedder, the push
    // capture server) but never hit the real network for the dashboard's
    // own npm-registry version check (src/dashboard/multi-server.ts:237).
    (globalThis as unknown as { fetch: typeof fetch }).fetch = ((...args: Parameters<typeof fetch>) => {
      const [input, init] = args;
      const url = typeof input === 'string' ? input : (input as { url?: string })?.url;
      if (typeof url === 'string' && url.startsWith('https://registry.npmjs.org/')) {
        return Promise.resolve({ ok: false, json: async () => ({}) } as Response);
      }
      return realFetch(input, init);
    }) as typeof fetch;
  });

  afterEach(async () => {
    if (server) { await server.stop(); server = null; }
    await Promise.all(helperServers.map((s) => s.close()));
    (globalThis as unknown as { fetch: typeof fetch }).fetch = realFetch;
    process.env = { ...originalEnv };
    await fsp.rm(tempDir, { recursive: true, force: true });
    for (const dir of extraDirs) await fsp.rm(dir, { recursive: true, force: true });
  });

  async function startServer(): Promise<{ port: number; secret: string; advisorSecret: string }> {
    const port = await getFreePort();
    server = new MultiProjectDashboardServer({ port });
    await server.start();
    const secret = await loadOrCreateSecret();
    const advisorSecret = await loadOrCreateAdvisorSecret();
    _resetMultiServerWarningsForTests();
    return { port, secret, advisorSecret };
  }

  async function connectAdvisor(port: number, advisorSecret: string, extraHeaders?: Record<string, string>): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}${ADVISOR_MCP_PATH}`), {
      requestInit: { headers: { authorization: `Bearer ${advisorSecret}`, ...extraHeaders } },
    });
    const client = new Client({ name: 'advisor-e2e-test', version: '0.0.0' });
    await client.connect(transport);
    return client;
  }

  function scratchDir(prefix: string): string {
    const dir = mkdtempSync(join(tmpdir(), prefix));
    extraDirs.push(dir);
    return dir;
  }

  function useClaudeScript(runs: unknown[]): void {
    process.env.CONTROLLER_CLAUDE_BIN = STUB_CLAUDE;
    const dir = scratchDir('advisor-e2e-claude-');
    const scriptPath = join(dir, 'script.json');
    writeFileSync(scriptPath, JSON.stringify(runs));
    process.env.STUB_CLAUDE_SCRIPT = scriptPath;
  }

  function useGhScript(runs: unknown[]): string {
    process.env.CONTROLLER_GH_BIN = STUB_GH;
    const dir = scratchDir('advisor-e2e-gh-');
    const scriptPath = join(dir, 'gh-script.json');
    writeFileSync(scriptPath, JSON.stringify(runs));
    process.env.STUB_GH_SCRIPT = scriptPath;
    return scriptPath;
  }

  function recordedArgv(scriptPath: string): string[][] {
    try {
      const raw = readFileSync(`${scriptPath}.argv`, 'utf8').trim();
      return raw ? raw.split('\n').map((l) => JSON.parse(l) as string[]) : [];
    } catch {
      return [];
    }
  }

  async function readEventRows(): Promise<Array<Record<string, unknown>>> {
    try {
      const raw = await fsp.readFile(eventsPath(), 'utf-8');
      return raw.split('\n').filter((l) => l.length > 0).map((l) => JSON.parse(l));
    } catch {
      return [];
    }
  }

  // ── Check 1 (Requirement 2 AC 2): a wait open at the moment of the
  // request is listed in the summary. ─────────────────────────────────────
  it('check 1: an open wait appears in the summary tool (2.2)', async () => {
    const { port, advisorSecret } = await startServer();

    const specDir = scratchDir('advisor-e2e-specdir-');
    const wait = await createWait({
      kind: 'question',
      runId: 'run-e2e-summary',
      projectId: 'proj-e2e-summary',
      spec: 'spec-e2e-summary',
      specDir,
      questions: [{ id: 'q1', text: 'Pick one', options: ['a', 'b'] }],
    });

    const client = await connectAdvisor(port, advisorSecret);
    const result = await client.callTool({ name: 'summary', arguments: {} });
    await client.close();

    expect(result.isError).not.toBe(true);
    const parsed = JSON.parse(textOf(result as { content?: { type: string; text?: string }[] }));
    const found = parsed.openWaits.find((w: { project: string; spec: string }) =>
      w.project === 'proj-e2e-summary' && w.spec === 'spec-e2e-summary');
    expect(found).toBeDefined();
    expect(found.kind).toBe('question');
    expect(typeof found.ageMins).toBe('number');
    expect(wait.state).toBe('open');
  }, 15000);

  // ── Check 2 (Requirement 5 AC 4; design C7): the operator's press
  // attaches picks and starts no other run step; the run and queue stay
  // untouched. ──────────────────────────────────────────────────────────
  it('check 2: the second-opinion route attaches picks and leaves the run untouched (5.4)', async () => {
    useClaudeScript([{
      result: {
        subtype: 'success', is_error: false, num_turns: 1, session_id: 'sess-e2e-opinion',
        result: 'done',
        structured_output: {
          picks: [{ question: 'approach', pick: 'careful', reason: 'Matches the usual pace.' }],
          summary: 'Go with the careful rollout.',
        },
        usage: USAGE,
        duration_ms: 1000,
      },
    }]);

    const { port, secret } = await startServer();

    const specDir = scratchDir('advisor-e2e-specdir-');
    const run: RunRecord = {
      v: 1,
      id: 'run-e2e-opinion',
      project: 'proj-e2e-opinion',
      codeRoot: '/irrelevant',
      specStore: '/irrelevant',
      spec: 'spec-e2e-opinion',
      worktree: '/irrelevant',
      branch: 'feat/thing',
      status: 'waiting',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    } as RunRecord;
    await writeRun(run);
    const before = await readRun(run.id); // writeRun stamps pausedAt on a waiting run
    const queue: QueueFile = { v: 1, runs: ['run-e2e-opinion'] };
    await writeQueue(queue);

    const wait = await createWait({
      kind: 'question',
      runId: 'run-e2e-opinion',
      projectId: 'proj-e2e-opinion',
      spec: 'spec-e2e-opinion',
      specDir,
      questions: [{ id: 'approach', text: 'Pick a rollout approach', options: ['careful', 'fast'], recommended: 'careful' }],
    });

    const res = await realFetch(`http://127.0.0.1:${port}/api/controller/waits/${wait.id}/second-opinion`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(res.status).toBe(202);

    const updated = await readWait(wait.id);
    expect(updated?.opinion).toEqual({
      picks: [{ question: 'approach', pick: 'careful', reason: 'Matches the usual pace.' }],
      summary: 'Go with the careful rollout.',
    });
    expect(updated?.advice).toBe('Go with the careful rollout.');
    expect(updated?.state).toBe('open'); // the opinion never answers the wait

    expect(await readRun(run.id)).toEqual(before);
    expect(await readQueue()).toEqual(queue);
  }, 15000);

  // ── Check 3 (Requirement 4 AC 4): a reworded query, sharing no key word
  // with a retro finding, still ranks that finding in the first ten hits,
  // against the fake Ollama embedder. ─────────────────────────────────────
  it('check 3: a reworded query ranks a retro finding first via the fake embedder (4.4)', async () => {
    const { port, secret, advisorSecret } = await startServer();

    const root = scratchDir('advisor-e2e-search-');
    const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel', 'india', 'juliet'];
    const query = words.join(' ');

    function writeMd(relPath: string, content: string): void {
      const full = join(root, relPath);
      mkdirSync(join(full, '..'), { recursive: true });
      writeFileSync(full, content, 'utf-8');
    }

    writeMd(
      '.spec-workflow/specs/demo/retrospective.md',
      '# Retrospective\n\n- **Finding 1.** The rollout needed a staged rollback plan before the quarter closed. zzzvec-target\n',
    );
    function vec(cosine: number): number[] {
      return [cosine, Math.sqrt(Math.max(0, 1 - cosine * cosine))];
    }
    const vectors = new Map<string, number[]>([['target', vec(0.99)]]);
    for (let i = 1; i <= 10; i++) {
      writeMd(
        `docs/noise-${i}.md`,
        `# Noise ${i}\n\nFiller notes mentioning ${words.slice(0, i).join(' and ')} among other remarks. zzzvec-noise-${i}\n`,
      );
      vectors.set(`noise-${i}`, vec(0.9 - i * 0.08));
    }

    interface FakeOllamaRequest { model: string; input: string[] }
    const fakeOllama: Server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        const body = JSON.parse(raw) as FakeOllamaRequest;
        const embeddings = body.input.map((text) => {
          const m = text.match(/zzzvec-([a-z0-9-]+)/);
          return (m ? vectors.get(m[1]) : undefined) ?? vec(1);
        });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ model: body.model, embeddings }));
      });
    });
    const ollamaUrl = await new Promise<string>((resolve) => {
      fakeOllama.listen(0, '127.0.0.1', () => {
        const addr = fakeOllama.address();
        const p = typeof addr === 'object' && addr ? addr.port : 0;
        resolve(`http://127.0.0.1:${p}`);
      });
    });
    helperServers.push({ close: () => new Promise<void>((r) => fakeOllama.close(() => r())) });
    writeFileSync(searchPath(), JSON.stringify({ v: 1, url: ollamaUrl, model: 'fake-embed' }), 'utf-8');

    // An explicit workflowRootPath (rather than letting addProjectByPath
    // derive one via resolveGitRoot) keeps the corpus rooted at this
    // fixture even when SPEC_WORKFLOW_SHARED_ROOT points at the real
    // checkout (true in a worktree-isolated harness session).
    const addRes = await realFetch(`http://127.0.0.1:${port}/api/projects/add`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ projectPath: root, workflowRootPath: root }),
    });
    expect(addRes.status).toBe(200);

    const client = await connectAdvisor(port, advisorSecret);
    const result = await client.callTool({ name: 'search', arguments: { query } });
    await client.close();

    expect(result.isError).not.toBe(true);
    const parsed = JSON.parse(textOf(result as { content?: { type: string; text?: string }[] }));
    expect(parsed.hits.length).toBeLessThanOrEqual(10);
    expect(parsed.hits.some((h: { path: string }) => h.path.endsWith('retrospective.md'))).toBe(true);
  }, 20000);

  // ── Check 4 (Requirement 6 AC 7): nothing merges until the operator
  // confirms a staged merge; after confirmation it merges and
  // `advisor.action` is logged. ────────────────────────────────────────────
  it('check 4: a staged merge does not merge until confirmed, then merges and logs advisor.action (6.7)', async () => {
    const GH_PR_VIEW = {
      mergeable: 'MERGEABLE',
      mergeStateStatus: 'CLEAN',
      headRefName: 'feat/thing',
      headRefOid: 'deadbeefcafe0001',
      body: 'A clean PR body with no trailers.',
      commits: [{ oid: 'deadbeefcafe0001', messageHeadline: 'feat: do the thing', messageBody: 'Body line.' }],
      author: { login: 'someone' },
    };
    const ghScript = useGhScript([
      { argvIncludes: ['pr', 'view'], stdout: GH_PR_VIEW },
      { argvIncludes: ['api'], stdout: { total_count: 1, workflow_runs: [{ name: 'test', status: 'completed', conclusion: 'success' }] } },
      { argvIncludes: ['api'], stdout: { state: 'success', total_count: 0, statuses: [] } },
      { argvIncludes: ['pr', 'merge', '--merge'], stdout: 'Merged.' },
      { argvIncludes: ['mergeCommit'], stdout: { mergeCommit: { oid: 'f00dc0ffee1234' } } },
    ]);

    const { port, secret, advisorSecret } = await startServer();

    const repo = scratchDir('advisor-e2e-merge-repo-');
    const addRes = await realFetch(`http://127.0.0.1:${port}/api/projects/add`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ projectPath: repo }),
    });
    const { projectId } = (await addRes.json()) as { projectId: string };

    const client = await connectAdvisor(port, advisorSecret, { 'x-sdd-conversation': 'conv-e2e-merge' });
    const stageResult = await client.callTool({
      name: 'stage_merge',
      arguments: { project: projectId, pr: 7, branch: 'feat/thing', reason: 'the PR is green' },
    });
    await client.close();
    expect(stageResult.isError).not.toBe(true);

    const listRes = await realFetch(`http://127.0.0.1:${port}/api/controller/actions`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    const { actions } = (await listRes.json()) as { actions: Array<{ id: string; kind: string; state: string; target: { pr: number } }> };
    const staged = actions.find((a) => a.kind === 'merge' && a.target.pr === 7);
    expect(staged?.state).toBe('staged');
    expect(recordedArgv(ghScript)).toHaveLength(0); // nothing merged yet

    const confirmRes = await realFetch(`http://127.0.0.1:${port}/api/controller/actions/${staged!.id}/confirm`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}` },
    });
    expect(confirmRes.status).toBe(200);
    expect(((await confirmRes.json()) as { ok: boolean }).ok).toBe(true);
    expect(recordedArgv(ghScript).length).toBeGreaterThan(0); // merged after confirmation

    const rows = await readEventRows();
    const actionRows = rows.filter((r) => r.type === 'advisor.action');
    expect(actionRows).toHaveLength(1);
    expect(actionRows[0].kind).toBe('merge');
    expect(actionRows[0].conversation).toBe('conv-e2e-merge');
    expect(String(actionRows[0].outcome)).toMatch(/merged/i);
  }, 20000);

  // ── Check 5 (Requirement 10 AC 1, AC 3): a wait that appears open
  // triggers exactly one push. ─────────────────────────────────────────────
  it('check 5: a new wait gives exactly one push (10.1, 10.3)', async () => {
    const requests: unknown[] = [];
    const captureServer: Server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', () => {
        try { requests.push(JSON.parse(raw)); } catch { requests.push(raw); }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end('{}');
      });
    });
    const captureUrl = await new Promise<string>((resolve) => {
      captureServer.listen(0, '127.0.0.1', () => {
        const addr = captureServer.address();
        const p = typeof addr === 'object' && addr ? addr.port : 0;
        resolve(`http://127.0.0.1:${p}`);
      });
    });
    helperServers.push({ close: () => new Promise<void>((r) => captureServer.close(() => r())) });

    // push.json must exist before the server starts: the pusher's start-up
    // scan and watch both run inside server.start() (design D2/D3).
    await fsp.mkdir(dirname(pushConfigPath()), { recursive: true });
    await fsp.writeFile(
      pushConfigPath(),
      JSON.stringify({ v: 1, url: captureUrl, dashboardUrl: 'http://127.0.0.1:1234' }),
      'utf-8',
    );

    await startServer();

    const specDir = scratchDir('advisor-e2e-specdir-');
    await createWait({
      kind: 'question',
      runId: 'run-e2e-push',
      projectId: 'proj-e2e-push',
      spec: 'spec-e2e-push',
      specDir,
      questions: [{ id: 'q1', text: 'Pick one', options: ['a', 'b'] }],
    });

    await waitFor(() => requests.length > 0);
    await sleep(300); // settle: prove no second push follows

    expect(requests).toHaveLength(1);
    expect(requests[0]).toEqual({ kind: 'question', project: 'proj-e2e-push', spec: 'spec-e2e-push', dashboardUrl: 'http://127.0.0.1:1234' });
  }, 15000);
});
