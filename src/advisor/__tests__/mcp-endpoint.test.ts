import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import fastify from 'fastify';
import type { FastifyInstance } from 'fastify';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { registerAdvisorMcp, type AdvisorMcpDeps } from '../mcp-endpoint.js';
import { ADVISOR_MCP_PATH } from '../../controller/access.js';
import { listActions } from '../actions.js';
import { buildSummary } from '../summary.js';

// Contract for src/advisor/mcp-endpoint.ts (design.md C3; requirements.md
// Requirement 7 AC 1, AC 3, AC 4, NFR Security; tasks.md task 13).
// registerAdvisorMcp(app, deps) registers GET/POST/DELETE on
// ADVISOR_MCP_PATH (task 4's export), one low-level MCP Server per request
// over a stateless StreamableHTTPServerTransport. Every test drives a bare
// fastify instance through a real MCP SDK Client/StreamableHTTPClientTransport
// round trip over HTTP -- the only way to reach ListTools/CallTool, which
// are internal to the per-request Server this module constructs -- against a
// fresh temp SDD_HOME, so the advisor home store is real (listActions,
// buildSummary) and never mocked.
//
// `deps`'s shape is not pinned by design.md beyond the signature
// `registerAdvisorMcp(app, deps): void`. This file fixes it to the one
// thing `read_store_file` cannot get any other way: a project-id ->
// spec-store-root resolver, named `projectRoot` here, mirroring the
// `ActionDeps.projectPath` seam already used for the project-scoped merge
// and deferral executors (src/advisor/actions.ts) -- except this resolver
// returns the root that holds `.spec-workflow/`, the value `read_store_file`
// needs, not the workspace path `ActionDeps.projectPath` returns. Every
// other tool this file exercises (summary, stage_merge) reads or writes the
// real production store directly (buildSummary, stageAction via
// listActions), so no further deps field is needed for these tests.
//
// Per success criterion (task 13 _Prompt Success line; Requirement 7 AC
// 1/3/4; NFR Security's "a reason beside it"):
//   (a) "ListTools returns every tool above"                      -> list-tools test
//   (b) "summary returns the summary shape"                       -> summary test
//   (c) "stage_merge without a reason fails"                      -> no-reason test
//   (d) "stage_merge with one creates a staged action carrying
//        the header conversation id and merges nothing"            -> stage-merge test
//        (the "else unknown" half of design.md C3's conversation-id
//        rule is folded into its own small test, as the other branch
//        of the same rule)
//   (e) "read_store_file refuses a .. path and a symlink out"      -> two escape tests

const ADVISOR_TOOL_NAMES = [
  'projects', 'runs', 'waits', 'specs', 'read_store_file', 'pr_reads', 'usage',
  'summary', 'tallies', 'search', 'sources', 'staged_actions',
  'stage_merge', 'stage_deploy', 'stage_launch', 'stage_answer',
  'stage_deferral', 'stage_decomposition', 'stage_backlog',
].sort();

const NO_DEPS: AdvisorMcpDeps = { projectRoot: () => undefined };

let home: string;
let savedSddHome: string | undefined;
let app: FastifyInstance | undefined;
let baseUrl: string;
let client: Client | undefined;
let extraDirs: string[];

function scratchProjectRoot(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  extraDirs.push(dir);
  return dir;
}

async function startServer(deps: AdvisorMcpDeps): Promise<void> {
  app = fastify();
  registerAdvisorMcp(app, deps);
  baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
}

async function connect(headers?: Record<string, string>): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(new URL(baseUrl + ADVISOR_MCP_PATH), {
    requestInit: headers ? { headers } : undefined,
  });
  const c = new Client({ name: 'mcp-endpoint-test', version: '0.0.0' });
  await c.connect(transport);
  client = c;
  return c;
}

function textOf(result: { content?: { type: string; text?: string }[] }): string {
  return (result.content ?? []).map((c) => c.text ?? '').join('\n');
}

beforeEach(() => {
  savedSddHome = process.env.SDD_HOME;
  home = mkdtempSync(join(tmpdir(), 'sdd-advisor-mcp-home-'));
  process.env.SDD_HOME = home;
  extraDirs = [];
});

afterEach(async () => {
  if (client) {
    await client.close();
    client = undefined;
  }
  if (app) {
    await app.close();
    app = undefined;
  }
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  rmSync(home, { recursive: true, force: true });
  for (const dir of extraDirs) rmSync(dir, { recursive: true, force: true });
});

describe('src/advisor/mcp-endpoint.ts registerAdvisorMcp', () => {
  // AC 7.1: the endpoint exposes every read tool and one stage tool per
  // Requirement 6 AC 1 kind. Pre-condition: a bare server with no fixtures.
  // Test: ListTools over a real MCP client connected through
  // ADVISOR_MCP_PATH. Observable result: the tool name set is exactly the
  // 19 names design.md C3 lists ("Read tools:" / "Stage tools:"), no more
  // and no fewer. Expected value source: requirements.md Requirement 7 AC 1
  // and design.md C3's two tool lists.
  it('lists every read and stage tool (7.1)', async () => {
    await startServer(NO_DEPS);
    const c = await connect();

    const { tools } = await c.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual(ADVISOR_TOOL_NAMES);
  });

  // AC 7.1 (summary tool wiring): Pre-condition: an empty home (no waits,
  // runs or sources), so buildSummary's result is deterministic. Test: call
  // the `summary` tool with no arguments. Observable result: its parsed
  // JSON content deep-equals a direct `buildSummary()` call against the
  // same home, proving the tool is wired to the real builder with no
  // transformation. Expected value source: design.md C3 ("summary
  // {include?}") and the AdvisorSummary shape `buildSummary` already
  // returns (task 7, not re-verified here).
  it('the summary tool returns the real AdvisorSummary shape (7.1)', async () => {
    await startServer(NO_DEPS);
    const c = await connect();

    const result = await c.callTool({ name: 'summary', arguments: {} });
    const parsed = JSON.parse(textOf(result as { content?: { type: string; text?: string }[] }));
    const expected = await buildSummary();

    expect(result.isError).not.toBe(true);
    expect(parsed).toEqual(expected);
  });

  // NFR Security / Requirement 6 AC 1 ("each needing a non-empty reason"):
  // Pre-condition: no staged actions exist. Test: call `stage_merge` with
  // project/pr/branch but no `reason`. Observable result: the call returns a
  // tool error (isError true) and the action store still holds zero
  // actions -- nothing was staged. Expected value source: tasks.md task 13
  // _Prompt ("stage tools ... each needing a non-empty reason") and NFR
  // Security ("Source content SHALL never be placed in a staged action's
  // parameters without the advisor's own reason beside it").
  it('refuses to stage a merge with no reason (NFR Security)', async () => {
    await startServer(NO_DEPS);
    const c = await connect();

    const result = await c.callTool({
      name: 'stage_merge',
      arguments: { project: 'proj-a', pr: 7, branch: 'feat/x' },
    });

    expect(result.isError).toBe(true);
    expect(await listActions()).toEqual([]);
  });

  // Requirement 6 AC 1/2 + Requirement 7 AC 3 ("no tool executes an action
  // directly") + design.md C3 (conversation id from the x-sdd-conversation
  // header). Pre-condition: no staged actions exist. Test: call
  // `stage_merge` with a reason and header `x-sdd-conversation: conv-123`.
  // Observable result: exactly one StagedAction is written (read back
  // through the real `listActions()`) with kind `merge`, the project/pr/
  // branch carried through to the shape `src/advisor/actions.ts`'s
  // `execMerge` already reads (`target.project`, `target.pr`,
  // `params.branch`), `reason` equal to the call's reason, `conversation`
  // equal to the header, and `state` still `staged` -- proving the tool
  // only staged the action and never ran `confirmAction`/merged anything.
  // Expected value source: task 13 Success line ("stage_merge with one
  // creates a staged action carrying the header conversation id and merges
  // nothing") and the target/params shape fixed by `execMerge`
  // (src/advisor/actions.ts, task 11, already shipped).
  it('stages a merge with the header conversation id and merges nothing (6.1, 6.2, 7.3)', async () => {
    await startServer(NO_DEPS);
    const c = await connect({ 'x-sdd-conversation': 'conv-123' });

    const result = await c.callTool({
      name: 'stage_merge',
      arguments: { project: 'proj-a', pr: 7, branch: 'feat/x', reason: 'ship it' },
    });

    expect(result.isError).not.toBe(true);
    const actions = await listActions();
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      kind: 'merge',
      reason: 'ship it',
      conversation: 'conv-123',
      state: 'staged',
      target: { project: 'proj-a', pr: 7 },
      params: { branch: 'feat/x' },
    });
  });

  // design.md C3 ("The conversation id is the x-sdd-conversation header,
  // else unknown"): the other branch of the same rule the previous test
  // covers for the header-present case. Pre-condition: no staged actions
  // exist. Test: call `stage_merge` with a reason and no
  // `x-sdd-conversation` header. Observable result: the one staged
  // action's `conversation` field is exactly `'unknown'`. Expected value
  // source: design.md C3's conversation-id rule.
  it('defaults the conversation id to "unknown" with no header (design C3)', async () => {
    await startServer(NO_DEPS);
    const c = await connect();

    await c.callTool({
      name: 'stage_merge',
      arguments: { project: 'proj-a', pr: 9, branch: 'feat/y', reason: 'ship it too' },
    });

    const actions = await listActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].conversation).toBe('unknown');
  });

  // Requirement 7 AC 4: a spec-store file read stays inside that project's
  // `.spec-workflow/` and refuses any path that leaves it, `..` included.
  // Pre-condition: a project root with `.spec-workflow/` holding one real
  // file, and a sentinel file one level above the store holding content
  // that must never be returned. Test: `read_store_file` with
  // `path: '../outside.txt'`. Observable result: a tool error whose text
  // includes the exact message design.md's Error Handling #3 pins ("path
  // outside the spec store") and that never includes the sentinel file's
  // content. Expected value source: requirements.md Requirement 7 AC 4 and
  // design.md Error Handling #3.
  it('refuses a read_store_file path that escapes via ".." (7.4)', async () => {
    const root = scratchProjectRoot('sdd-advisor-mcp-project-');
    const store = join(root, '.spec-workflow');
    mkdirSync(store, { recursive: true });
    writeFileSync(join(store, 'real.md'), '# inside\n');
    writeFileSync(join(root, 'outside.txt'), 'SECRET-OUTSIDE-CONTENT');

    await startServer({ projectRoot: (project) => (project === 'proj-a' ? root : undefined) });
    const c = await connect();

    const result = await c.callTool({
      name: 'read_store_file',
      arguments: { project: 'proj-a', path: '../outside.txt' },
    });

    expect(result.isError).toBe(true);
    const text = textOf(result as { content?: { type: string; text?: string }[] });
    expect(text).toContain('path outside the spec store');
    expect(text).not.toContain('SECRET-OUTSIDE-CONTENT');
  });

  // Requirement 7 AC 4, the symlink half of the same rule ("`..` and
  // symlinks included", design.md C3 post-conditions). Pre-condition: the
  // same store, plus a symlink inside it that resolves outside the store.
  // Test: `read_store_file` with `path: 'link.md'`. Observable result: the
  // same refusal and no leak of the sentinel content, proving `realpath`
  // resolution runs before the inside-the-store check, not just a string
  // prefix check on the raw path.
  it('refuses a read_store_file path that escapes via a symlink (7.4)', async () => {
    const root = scratchProjectRoot('sdd-advisor-mcp-project-');
    const store = join(root, '.spec-workflow');
    mkdirSync(store, { recursive: true });
    writeFileSync(join(store, 'real.md'), '# inside\n');
    writeFileSync(join(root, 'outside.txt'), 'SECRET-OUTSIDE-CONTENT');
    symlinkSync(join(root, 'outside.txt'), join(store, 'link.md'));

    await startServer({ projectRoot: (project) => (project === 'proj-a' ? root : undefined) });
    const c = await connect();

    const result = await c.callTool({
      name: 'read_store_file',
      arguments: { project: 'proj-a', path: 'link.md' },
    });

    expect(result.isError).toBe(true);
    const text = textOf(result as { content?: { type: string; text?: string }[] });
    expect(text).toContain('path outside the spec store');
    expect(text).not.toContain('SECRET-OUTSIDE-CONTENT');
  });
});
