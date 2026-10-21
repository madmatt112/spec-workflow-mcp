// src/bootstrap/init.ts
//
// The bootstrap `init` command (design C3; Req 1 AC 7-8, Req 2, Req 3, Req 4
// AC 2, 6, 8, Req 5 AC 1, 7, Req 6, Reliability and Security NFRs). One export,
// `runInit`, runs three phases in order: validate (nothing written until every
// input is valid, Req 6 AC 2), write (`.mcp.json` and `agent-rules.md`, each
// through a same-directory temp file and a rename), and register (C6).
//
// `InitArgs` is the single source of the init argument shape (design C3); cli.ts
// and agent-rules.ts import it from here. Facts detection and template rendering
// live in agent-rules.ts (C5); the controller calls live in controller-client.ts
// (C6). No output line ever carries the shared secret or an existing entry's env
// value (Security NFR).
import { promises as fs, existsSync, readFileSync } from 'fs';
import { resolve, join, dirname, basename } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { gitTopLevel, normalizeIdentityPath } from '../core/git-utils.js';
import { detectFacts, renderAgentRules, templatePath } from './agent-rules.js';
import { controllerUrl, readSecret, registerWithController } from './controller-client.js';
import type { BootstrapIo } from './cli.js';

/** The init argument shape (design C3). The single source for cli.ts and agent-rules.ts. */
export interface InitArgs {
  repoPath: string;
  store?: string;
  testCommand?: string;
  worktreeSetup?: string;
  mergeMethod?: 'merge' | 'squash';
}

const SERVER_KEY = 'spec-workflow';

/** The `~` rule of expandTildePath (src/index.ts:120-125), copied (design C2). */
function expandTilde(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return path.replace('~', homedir());
  }
  return path;
}

/** The default entry path: `dist/index.js` for the built binary (design C3, Req 3 AC 1). */
function defaultEntryPath(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', 'index.js');
}

/** Write `text` to `dest` through a same-directory temp file and a rename (Reliability NFR). */
async function atomicWrite(dest: string, text: string): Promise<void> {
  const tmp = join(dirname(dest), `.${basename(dest)}.${randomBytes(6).toString('hex')}.tmp`);
  await fs.writeFile(tmp, text, 'utf-8');
  await fs.rename(tmp, dest);
}

/** Structural deep-equality for the previous-entry compare of Req 3 AC 4. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  const bk = Object.keys(bo);
  if (ak.length !== bk.length) return false;
  return ak.every((k) => k in bo && deepEqual(ao[k], bo[k]));
}

/** The left-out-fact notes: per null fact, its template key and the option that sets it (Req 4 AC 6). */
const FACT_NOTES: Array<{ fact: 'worktreeSetup' | 'testCommand'; key: string; option: string }> = [
  { fact: 'worktreeSetup', key: 'worktree-setup', option: '--worktree-setup' },
  { fact: 'testCommand', key: 'tdd-test-command', option: '--test-command' },
];

/**
 * Run `init`: validate every input, write `.mcp.json` and `agent-rules.md`, then
 * register with the controller. Returns 0 on a full success, 1 on an input error
 * (nothing written), 2 on a registration failure (the written files are kept).
 */
export async function runInit(
  args: InitArgs,
  io: BootstrapIo,
  entryPath: string = defaultEntryPath(),
  timeoutMs?: number,
): Promise<0 | 1 | 2> {
  // --- Phase 1: validate — nothing is written before it passes (Req 6 AC 2) ---
  const requested = resolve(expandTilde(args.repoPath));
  let stat;
  try {
    stat = await fs.stat(requested);
  } catch {
    io.err(`error: ${requested}: does not exist`);
    return 1;
  }
  const dir = stat.isDirectory() ? requested : dirname(requested);
  const top = gitTopLevel(dir);
  if (top === null) {
    io.err(`error: ${requested}: not inside a git work tree`);
    return 1;
  }

  let storeRoot: string;
  let entryEnv: Record<string, string>;
  if (args.store !== undefined) {
    const storeAbs = resolve(expandTilde(args.store));
    let storeStat;
    try {
      storeStat = await fs.stat(storeAbs);
    } catch {
      io.err(`error: ${storeAbs}: does not exist`);
      return 1;
    }
    if (!storeStat.isDirectory()) {
      io.err(`error: ${storeAbs}: not a directory`);
      return 1;
    }
    storeRoot = normalizeIdentityPath(storeAbs);
    entryEnv = { SPEC_WORKFLOW_SHARED_ROOT: storeRoot };
  } else {
    storeRoot = top;
    entryEnv = {};
  }

  const mcpJsonPath = join(top, '.mcp.json');
  let existingRaw: string | null = null;
  let mcpObj: Record<string, unknown> = {};
  if (existsSync(mcpJsonPath)) {
    existingRaw = await fs.readFile(mcpJsonPath, 'utf-8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(existingRaw);
    } catch {
      io.err(`error: ${mcpJsonPath}: not valid JSON`);
      return 1;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      io.err(`error: ${mcpJsonPath}: not a JSON object`);
      return 1;
    }
    const servers = (parsed as Record<string, unknown>).mcpServers;
    if (servers !== undefined && (typeof servers !== 'object' || servers === null || Array.isArray(servers))) {
      io.err(`error: ${mcpJsonPath}: mcpServers is not an object`);
      return 1;
    }
    mcpObj = parsed as Record<string, unknown>;
  }

  const facts = detectFacts(top, args);

  // --- Phase 2: write — each write is a same-directory temp file and a rename --
  const specWorkflowDir = join(storeRoot, '.spec-workflow');
  await fs.mkdir(specWorkflowDir, { recursive: true });

  const newEntry = { type: 'stdio', command: 'node', args: [entryPath], env: entryEnv };
  if (typeof mcpObj.mcpServers !== 'object' || mcpObj.mcpServers === null) {
    mcpObj.mcpServers = {};
  }
  const servers = mcpObj.mcpServers as Record<string, unknown>;
  const prevEntry = servers[SERVER_KEY];
  servers[SERVER_KEY] = newEntry;
  const serialized = JSON.stringify(mcpObj, null, 2) + '\n';

  if (existingRaw === null) {
    await atomicWrite(mcpJsonPath, serialized);
    io.out(`wrote ${mcpJsonPath}`);
  } else if (serialized === existingRaw) {
    io.out(`kept ${mcpJsonPath}`);
  } else {
    await atomicWrite(mcpJsonPath, serialized);
    let line = `updated ${mcpJsonPath}`;
    if (prevEntry !== undefined && !deepEqual(prevEntry, newEntry)) {
      const prev = prevEntry as { command?: unknown; args?: unknown };
      const command = typeof prev.command === 'string' ? prev.command : '';
      const prevArgs = Array.isArray(prev.args) ? prev.args.map(String) : [];
      line += ` (was: ${[command, ...prevArgs].join(' ')})`;
    }
    io.out(line);
  }

  const agentRulesPath = join(specWorkflowDir, 'agent-rules.md');
  if (existsSync(agentRulesPath)) {
    io.out(`kept ${agentRulesPath}`);
  } else {
    const rendered = renderAgentRules(readFileSync(templatePath(), 'utf-8'), facts);
    await atomicWrite(agentRulesPath, rendered);
    io.out(`wrote ${agentRulesPath}`);
    for (const note of FACT_NOTES) {
      if (facts[note.fact] === null) {
        io.out(`note: ${note.key} not detected; set it with ${note.option}`);
      }
    }
  }

  // --- Phase 3: register (C6) -------------------------------------------------
  const notCommitted = `files are not committed; review and commit them, then run doctor ${top}`;
  const url = await controllerUrl();
  const secret = await readSecret();
  const result = await registerWithController(
    url,
    secret ?? '',
    { projectPath: top, workflowRootPath: storeRoot },
    timeoutMs,
  );
  if (result.ok) {
    io.out(`registered ${result.projectId}`);
    io.out(notCommitted);
    return 0;
  }
  io.out(`registration failed: ${result.reason}; start the controller with scripts/sdd-service.sh install, then re-run init`);
  io.out(notCommitted);
  return 2;
}
