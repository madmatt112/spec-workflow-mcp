// src/advisor/mcp-endpoint.ts
//
// The advisor's one tool surface over every project (design.md C3;
// requirements.md Requirement 7 AC 1, AC 3, AC 4, NFR Security; tasks.md
// task 13). `registerAdvisorMcp(app, deps)` registers GET, POST and DELETE
// on `ADVISOR_MCP_PATH`: per request, a low-level MCP `Server` with
// `ListTools`/`CallTool` handlers (the pattern of `src/server.ts:255-268`)
// over a stateless `StreamableHTTPServerTransport` (`sessionIdGenerator:
// undefined`), `reply.hijack()`, then `transport.handleRequest(request.raw,
// reply.raw, request.body)` (probed on SDK 1.27.1, fastify 5.8.1).
import { promises as fs } from 'fs';
import { join, resolve, sep } from 'path';
import type { FastifyInstance } from 'fastify';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema, type Tool } from '@modelcontextprotocol/sdk/types.js';
import { ADVISOR_MCP_PATH } from '../controller/access.js';
import { listRuns, listWaits, readProjects, readRateLimit, type PrRead } from '../controller/state.js';
import { PathUtils } from '../core/path-utils.js';
import { buildSummary } from './summary.js';
import { buildTallies } from './tallies.js';
import { search } from './search/search.js';
import { readSources } from './sources.js';
import { listActions, stageAction, type StageActionInput } from './actions.js';

/** What the endpoint needs beyond what the exported builders already read or write directly. */
export interface AdvisorMcpDeps {
  /** A project id -> the root that holds `.spec-workflow/`, else `undefined` for an unknown project. */
  projectRoot(project: string): string | undefined;
}

type ToolHandler = (args: Record<string, unknown>, ctx: { deps: AdvisorMcpDeps; conversation: string }) => Promise<unknown>;

const EMPTY_SCHEMA = { type: 'object' as const, properties: {} };
const REASON = { reason: { type: 'string' as const } };

const READ_TOOLS: Tool[] = [
  { name: 'projects', description: 'Every project the controller knows.', inputSchema: EMPTY_SCHEMA },
  { name: 'runs', description: 'Every run.', inputSchema: EMPTY_SCHEMA },
  { name: 'waits', description: 'Every wait.', inputSchema: EMPTY_SCHEMA },
  { name: 'specs', description: 'Every spec directory, per project.', inputSchema: EMPTY_SCHEMA },
  {
    name: 'read_store_file',
    description: "Read a file inside a project's .spec-workflow/.",
    inputSchema: { type: 'object', properties: { project: { type: 'string' }, path: { type: 'string' } }, required: ['project', 'path'] },
  },
  {
    name: 'pr_reads',
    description: 'The latest read per pull request, optionally scoped to one project.',
    inputSchema: { type: 'object', properties: { project: { type: 'string' } } },
  },
  { name: 'usage', description: 'The five-hour and seven-day usage windows.', inputSchema: EMPTY_SCHEMA },
  {
    name: 'summary',
    description: 'The hello summary.',
    inputSchema: { type: 'object', properties: { include: { type: 'array', items: { type: 'string' } } } },
  },
  {
    name: 'tallies',
    description: 'Tokens, failures and findings by ISO week.',
    inputSchema: {
      type: 'object',
      properties: { from: { type: 'string' }, to: { type: 'string' }, project: { type: 'string' } },
      required: ['from', 'to'],
    },
  },
  {
    name: 'search',
    description: 'Merged text and meaning search over the known corpus.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        project: { type: 'string' },
        spec: { type: 'string' },
        kind: { type: 'string' },
        from: { type: 'string' },
        to: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
  { name: 'sources', description: 'The sources registry.', inputSchema: EMPTY_SCHEMA },
  {
    name: 'staged_actions',
    description: 'Every staged action, optionally filtered by state.',
    inputSchema: { type: 'object', properties: { state: { type: 'string' } } },
  },
];

const STAGE_TOOLS: Tool[] = [
  {
    name: 'stage_merge',
    description: 'Stage a merge for the operator to confirm.',
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'string' }, pr: { type: 'number' }, branch: { type: 'string' }, ...REASON },
      required: ['project', 'pr', 'branch', 'reason'],
    },
  },
  {
    name: 'stage_deploy',
    description: 'Stage a deploy for the operator to confirm.',
    inputSchema: { type: 'object', properties: { ...REASON }, required: ['reason'] },
  },
  {
    name: 'stage_launch',
    description: 'Stage a spec launch for the operator to confirm.',
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'string' }, spec: { type: 'string' }, ...REASON },
      required: ['project', 'spec', 'reason'],
    },
  },
  {
    name: 'stage_answer',
    description: 'Stage an answer to a wait for the operator to confirm.',
    inputSchema: {
      type: 'object',
      properties: { wait: { type: 'string' }, answers: { type: 'object' }, ...REASON },
      required: ['wait', 'answers', 'reason'],
    },
  },
  {
    name: 'stage_deferral',
    description: 'Stage a new deferral for the operator to confirm.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string' },
        title: { type: 'string' },
        originSpec: { type: 'string' },
        originPhase: { type: 'string' },
        revisitTrigger: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        owner: { type: 'string' },
        body: {
          type: 'object',
          properties: { context: { type: 'string' }, decision: { type: 'string' }, revisitCriteria: { type: 'string' } },
        },
        ...REASON,
      },
      required: ['project', 'title', 'body', 'owner', 'reason'],
    },
  },
  {
    name: 'stage_decomposition',
    description: "Stage an update to a project's decomposition.md for the operator to confirm.",
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'string' }, slug: { type: 'string' }, markdown: { type: 'string' }, ...REASON },
      required: ['project', 'slug', 'markdown', 'reason'],
    },
  },
  {
    name: 'stage_backlog',
    description: "Stage one line for the operator's owner-backlog.md for the operator to confirm.",
    inputSchema: { type: 'object', properties: { text: { type: 'string' }, ...REASON }, required: ['text', 'reason'] },
  },
];

const TOOLS: Tool[] = [...READ_TOOLS, ...STAGE_TOOLS];

/** Spec directory names per project, by project name (Error Handling: a missing specs/ gives []). */
async function listAllSpecs(): Promise<{ project: string; specs: string[] }[]> {
  const { projects } = await readProjects();
  const out: { project: string; specs: string[] }[] = [];
  for (const project of projects) {
    let specs: string[] = [];
    try {
      const dirents = await fs.readdir(join(PathUtils.getWorkflowRoot(project.workflowRootPath), 'specs'), { withFileTypes: true });
      specs = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
    } catch {
      specs = [];
    }
    out.push({ project: project.name, specs });
  }
  return out;
}

/** The latest `PrRead` per project+PR number, optionally scoped to one project (design C3). */
async function latestPrReads(project?: string): Promise<Array<{ project: string } & PrRead>> {
  const runs = await listRuns();
  const latest = new Map<string, { project: string } & PrRead>();
  for (const run of runs) {
    if (project && run.project !== project) continue;
    for (const read of run.prReads ?? []) {
      const key = `${run.project}|${read.number}`;
      const prev = latest.get(key);
      if (!prev || read.at > prev.at) latest.set(key, { project: run.project, ...read });
    }
  }
  return [...latest.values()];
}

/**
 * Resolve `path` inside `project`'s `.spec-workflow/`, refusing anything that
 * resolves outside it after `realpath` — `..` and symlinks included (design
 * Error Handling #3, Requirement 7 AC 4).
 */
async function readStoreFile(deps: AdvisorMcpDeps, project: string, path: string): Promise<string> {
  const root = deps.projectRoot(project);
  if (!root) throw new Error('path outside the spec store');

  const storeRoot = join(root, '.spec-workflow');
  const target = resolve(storeRoot, path);
  const realStoreRoot = await fs.realpath(storeRoot).catch(() => storeRoot);
  const isInside = (p: string) => p === realStoreRoot || p.startsWith(realStoreRoot + sep);
  if (!isInside(target)) throw new Error('path outside the spec store');

  let realTarget: string;
  try {
    realTarget = await fs.realpath(target);
  } catch {
    throw new Error('path outside the spec store');
  }
  if (!isInside(realTarget)) throw new Error('path outside the spec store');

  return fs.readFile(realTarget, 'utf-8');
}

function requireReason(args: Record<string, unknown>): string {
  const reason = typeof args.reason === 'string' ? args.reason.trim() : '';
  if (!reason) throw new Error('a non-empty reason is required');
  return reason;
}

async function stage(
  kind: StageActionInput['kind'],
  target: Record<string, unknown>,
  params: Record<string, unknown>,
  args: Record<string, unknown>,
  conversation: string,
): Promise<{ id: string }> {
  const reason = requireReason(args);
  const action = await stageAction({ kind, target, params, reason, conversation });
  return { id: action.id };
}

const HANDLERS: Record<string, ToolHandler> = {
  projects: async () => (await readProjects()).projects,
  runs: async () => listRuns(),
  waits: async () => listWaits(),
  specs: async () => listAllSpecs(),
  read_store_file: async (args, { deps }) => readStoreFile(deps, String(args.project ?? ''), String(args.path ?? '')),
  pr_reads: async (args) => latestPrReads(typeof args.project === 'string' ? args.project : undefined),
  usage: async () => (await readRateLimit()) ?? null,
  summary: async (args) => buildSummary({ include: Array.isArray(args.include) ? (args.include as string[]) : undefined }),
  tallies: async (args) =>
    buildTallies({
      from: String(args.from ?? ''),
      to: String(args.to ?? ''),
      project: typeof args.project === 'string' ? args.project : undefined,
    }),
  search: async (args) =>
    search({
      query: String(args.query ?? ''),
      project: typeof args.project === 'string' ? args.project : undefined,
      spec: typeof args.spec === 'string' ? args.spec : undefined,
      kind: typeof args.kind === 'string' ? args.kind : undefined,
      from: typeof args.from === 'string' ? args.from : undefined,
      to: typeof args.to === 'string' ? args.to : undefined,
      limit: typeof args.limit === 'number' ? args.limit : undefined,
    }),
  sources: async () => readSources(),
  staged_actions: async (args) => {
    const actions = await listActions();
    return typeof args.state === 'string' ? actions.filter((a) => a.state === args.state) : actions;
  },

  stage_merge: async (args, { conversation }) =>
    stage('merge', { project: args.project, pr: args.pr }, { branch: args.branch }, args, conversation),
  stage_deploy: async (args, { conversation }) => stage('deploy', {}, {}, args, conversation),
  stage_launch: async (args, { conversation }) =>
    stage('launch', { project: args.project, spec: args.spec }, {}, args, conversation),
  stage_answer: async (args, { conversation }) =>
    stage('answer', { wait: args.wait }, { answers: args.answers }, args, conversation),
  stage_deferral: async (args, { conversation }) =>
    stage(
      'deferral',
      { project: args.project },
      {
        title: args.title,
        originSpec: args.originSpec ?? null,
        originPhase: args.originPhase ?? null,
        revisitTrigger: args.revisitTrigger ?? '',
        tags: Array.isArray(args.tags) ? args.tags : [],
        owner: args.owner,
        body: args.body,
      },
      args,
      conversation,
    ),
  stage_decomposition: async (args, { conversation }) =>
    stage('decomposition', { project: args.project }, { slug: args.slug, markdown: args.markdown }, args, conversation),
  stage_backlog: async (args, { conversation }) => stage('backlog', {}, { text: args.text }, args, conversation),
};

/** One low-level MCP Server + stateless transport for one request (design C3). */
async function handle(app: FastifyInstance, deps: AdvisorMcpDeps, request: any, reply: any): Promise<void> {
  const conversation = typeof request.headers['x-sdd-conversation'] === 'string' ? request.headers['x-sdd-conversation'] : 'unknown';

  const server = new Server({ name: 'sdd-advisor', version: '1.0.0' }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const handler = HANDLERS[req.params.name];
    if (!handler) {
      return { content: [{ type: 'text', text: `unknown tool: ${req.params.name}` }], isError: true };
    }
    try {
      const result = await handler((req.params.arguments ?? {}) as Record<string, unknown>, { deps, conversation });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }], isError: true };
    }
  });

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  reply.hijack();
  await server.connect(transport);
  await transport.handleRequest(request.raw, reply.raw, request.body);
}

/** Register the advisor's MCP endpoint (design.md C3). */
export function registerAdvisorMcp(app: FastifyInstance, deps: AdvisorMcpDeps): void {
  app.get(ADVISOR_MCP_PATH, async (request, reply) => handle(app, deps, request, reply));
  app.post(ADVISOR_MCP_PATH, async (request, reply) => handle(app, deps, request, reply));
  app.delete(ADVISOR_MCP_PATH, async (request, reply) => handle(app, deps, request, reply));
}
