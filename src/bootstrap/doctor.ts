// src/bootstrap/doctor.ts
//
// The bootstrap `doctor` command (design C4; Req 7 AC 1-6). It names the first
// thing wrong with a configured repository and writes nothing (Req 7 AC 6): it
// reads the session file only through the read-only peek (C9) and never creates,
// writes, renames or deletes a file or directory.
//
// Three exports. `runChecks` runs the seven checks in Req 7 AC 1 order, marking a
// check `skip` when a Req 7 AC 2 dependency did not pass. `runDoctor` validates
// the path as `init` does (C3 phase 1 step 1), prints one line per check, then a
// `first failure:` line, and returns the exit code. `serviceEnv` is the
// environment the controller service runs `gh` with: this process's environment
// overlaid with `service.env` in the controller home (Req 7 AC 4).
import { promises as fs, readFileSync, existsSync, statSync } from 'fs';
import { execFile, execFileSync } from 'child_process';
import { resolve, join, dirname } from 'path';
import { homedir } from 'os';
import { gitTopLevel, scrubbedGitEnv, normalizeIdentityPath } from '../core/git-utils.js';
import { readAgentRules } from '../dashboard/harness/run-setup.js';
import { parseAgentRuleKey } from '../core/gate-rules.js';
import { readProjects, controllerHome } from '../controller/state.js';
import { controllerUrl, checkHealth } from './controller-client.js';
import { ghBin } from '../controller/merge.js';
import type { BootstrapIo } from './cli.js';

export type CheckName = 'mcp' | 'store' | 'agent-rules' | 'controller'
  | 'registered' | 'remote' | 'token';

export interface CheckResult {
  name: CheckName;
  status: 'ok' | 'fail' | 'skip';
  reason?: string;
  fix?: string;
}

/** The doctor's default per-network-call timeout (Performance NFR, 10 s). */
const DEFAULT_TIMEOUT_MS = 10000;

const TOKEN_FIX = 're-run scripts/sdd-service.sh install with GH_TOKEN set, or gh auth login';

/** The `~` rule of expandTildePath (src/index.ts:120-125), copied (design C2). */
function expandTilde(path: string): string {
  if (path.startsWith('~/') || path === '~') {
    return path.replace('~', homedir());
  }
  return path;
}

/**
 * This process's environment overlaid with `service.env` in the controller home,
 * the environment the controller service runs with (Req 7 AC 4). The file lists
 * `KEY=value` lines; blank and `#` lines are skipped (the form the installer
 * writes, `scripts/sdd-service.sh:136-147`). A missing file returns the process
 * environment unchanged.
 */
export function serviceEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  let text: string;
  try {
    text = readFileSync(join(controllerHome(), 'service.env'), 'utf-8');
  } catch {
    return env;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

/** Check 1: `.mcp.json` has a valid `spec-workflow` entry; also yields its store root. */
function checkMcp(top: string): { result: CheckResult; sharedRoot: string | null } {
  const fail = { result: { name: 'mcp' as const, status: 'fail' as const, fix: `run init ${top}` }, sharedRoot: null };
  let raw: string;
  try {
    raw = readFileSync(join(top, '.mcp.json'), 'utf-8');
  } catch {
    return fail;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail;
  }
  const servers = (parsed as { mcpServers?: unknown })?.mcpServers as Record<string, unknown> | undefined;
  const entry = servers?.['spec-workflow'] as { args?: unknown; env?: Record<string, unknown> } | undefined;
  if (!entry || typeof entry !== 'object') return fail;
  const arg0 = Array.isArray(entry.args) ? entry.args[0] : undefined;
  if (typeof arg0 !== 'string' || !arg0.endsWith(join('dist', 'index.js'))) return fail;
  if (!existsSync(arg0) || !statSync(arg0).isFile()) return fail;
  let sharedRoot: string | null = null;
  const sr = entry.env?.SPEC_WORKFLOW_SHARED_ROOT;
  if (typeof sr === 'string' && sr.length > 0) {
    if (!existsSync(sr) || !statSync(sr).isDirectory()) return fail;
    sharedRoot = sr;
  }
  return { result: { name: 'mcp', status: 'ok' }, sharedRoot };
}

/** Parse an `origin` URL for its `github.com` `owner/repo`, else null. */
function parseGithubOrigin(url: string): string | null {
  const m = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  return m ? `${m[1]}/${m[2]}` : null;
}

/** Check 7: `gh api repos/<owner>/<repo>` reports `permissions.push === true`. */
function checkToken(ownerRepo: string, timeoutMs: number): Promise<CheckResult> {
  return new Promise((resolveCheck) => {
    execFile(
      ghBin(),
      ['api', `repos/${ownerRepo}`],
      { env: serviceEnv(), timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        const e = err as (NodeJS.ErrnoException & { killed?: boolean }) | null;
        if (e) {
          // Read the callback error's node-20 fields directly, not runCommand's
          // number-filtered wrapper (design D10): a spawn error's code is a string.
          const reason = e.killed === true ? 'gh timed out' : `gh exited ${e.code}`;
          resolveCheck({ name: 'token', status: 'fail', reason, fix: TOKEN_FIX });
          return;
        }
        let data: { permissions?: { push?: unknown } };
        try {
          data = JSON.parse(stdout) as { permissions?: { push?: unknown } };
        } catch {
          resolveCheck({ name: 'token', status: 'fail', reason: 'unreadable gh output', fix: TOKEN_FIX });
          return;
        }
        if (data?.permissions?.push === true) {
          resolveCheck({ name: 'token', status: 'ok' });
        } else {
          resolveCheck({ name: 'token', status: 'fail', reason: 'no push permission', fix: TOKEN_FIX });
        }
      },
    );
  });
}

/**
 * Run the seven checks in Req 7 AC 1 order against the git top level `top`,
 * marking a check `skip` when a Req 7 AC 2 dependency did not pass (design C4,
 * D6). Writes nothing.
 */
export async function runChecks(top: string, timeoutMs: number = DEFAULT_TIMEOUT_MS): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const passed = (name: CheckName) => results.find((r) => r.name === name)?.status === 'ok';
  const skip = (name: CheckName): CheckResult => ({ name, status: 'skip' });

  // 1. mcp
  const mcp = checkMcp(top);
  results.push(mcp.result);
  const storeRoot = mcp.sharedRoot ? normalizeIdentityPath(mcp.sharedRoot) : top;
  const specWorkflowDir = join(storeRoot, '.spec-workflow');

  // 2. store (depends on mcp)
  if (!passed('mcp')) {
    results.push(skip('store'));
  } else if (existsSync(specWorkflowDir) && statSync(specWorkflowDir).isDirectory()) {
    results.push({ name: 'store', status: 'ok' });
  } else {
    results.push({ name: 'store', status: 'fail', fix: `run init ${top}` });
  }

  // 3. agent-rules (depends on store, which depends on mcp)
  if (!passed('store')) {
    results.push(skip('agent-rules'));
  } else {
    const rulesPath = join(specWorkflowDir, 'agent-rules.md');
    let text: string | null = null;
    try {
      text = readFileSync(rulesPath, 'utf-8');
    } catch {
      text = null;
    }
    const mergeMethod = text === null ? null : parseAgentRuleKey(text, 'merge-method');
    const mergeMethodOk = mergeMethod === null || mergeMethod === 'merge' || mergeMethod === 'squash';
    if (text !== null && readAgentRules(specWorkflowDir).worktree === 'yes' && mergeMethodOk) {
      results.push({ name: 'agent-rules', status: 'ok' });
    } else {
      results.push({ name: 'agent-rules', status: 'fail', fix: `run init ${top}` });
    }
  }

  // 4. controller (independent)
  const health = await checkHealth(await controllerUrl(), timeoutMs);
  if (health.ok) {
    results.push({ name: 'controller', status: 'ok' });
  } else {
    results.push({ name: 'controller', status: 'fail', fix: 'start the controller with scripts/sdd-service.sh install' });
  }

  // 5. registered (depends on store)
  if (!passed('store')) {
    results.push(skip('registered'));
  } else {
    const file = await readProjects();
    const match = file.projects.some((p) => p.workspacePath === top && p.workflowRootPath === storeRoot);
    results.push(match ? { name: 'registered', status: 'ok' } : { name: 'registered', status: 'fail', fix: `run init ${top}` });
  }

  // 6. remote (independent)
  let ownerRepo: string | null = null;
  try {
    const originUrl = execFileSync('git', ['-C', top, 'remote', 'get-url', 'origin'], {
      env: scrubbedGitEnv(),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    ownerRepo = parseGithubOrigin(originUrl);
  } catch {
    ownerRepo = null;
  }
  results.push(ownerRepo ? { name: 'remote', status: 'ok' } : { name: 'remote', status: 'fail', fix: 'add a github.com origin remote' });

  // 7. token (depends on remote)
  if (!passed('remote') || ownerRepo === null) {
    results.push(skip('token'));
  } else {
    results.push(await checkToken(ownerRepo, timeoutMs));
  }

  return results;
}

/** One output line for a check result (design C4 "**Output**"). */
function formatLine(r: CheckResult): string {
  if (r.status !== 'fail') return `${r.status} ${r.name}`;
  const reason = r.reason ? `: ${r.reason}` : '';
  const fix = r.fix ? ` — fix: ${r.fix}` : '';
  return `fail ${r.name}${reason}${fix}`;
}

/**
 * Run `doctor` on `repoPath`: validate the path (as `init` does, C3 phase 1 step
 * 1), run the checks, print one line per check and, on a failure, a final
 * `first failure: <name> — <fix>` line. Returns 1 when a check fails, else 0
 * (Req 7 AC 3). Writes nothing (Req 7 AC 6).
 */
export async function runDoctor(
  repoPath: string,
  io: BootstrapIo,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<0 | 1> {
  const requested = resolve(expandTilde(repoPath));
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

  const results = await runChecks(top, timeoutMs);
  let firstFailure: CheckResult | null = null;
  for (const r of results) {
    io.out(formatLine(r));
    if (r.status === 'fail' && firstFailure === null) firstFailure = r;
  }
  if (firstFailure) {
    io.out(`first failure: ${firstFailure.name} — ${firstFailure.fix ?? ''}`);
    return 1;
  }
  return 0;
}
