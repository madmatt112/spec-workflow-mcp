// src/dashboard/harness/run-setup.ts
//
// One server-side rule set builds the run-setup form, validates it and writes
// `harness-run.json` (design.md C3, D5; Requirement 1). It reads the task 1
// read-only index snapshot, the task 2 wire types and the task 3 HANDOFF parser,
// and never writes any spec-store file but `harness-run.json`.
import { readFileSync, writeFileSync, renameSync, unlinkSync } from 'fs';
import { join } from 'path';
import { IndexGenerator } from '../../core/index-generator.js';
import { handoffPath } from '../../watch/index.js';
import { AGENT_PROFILES } from '../../watch/ledger.js';
import type { AgentProfile } from '../../watch/ledger.js';
import type { SpecIndexEntry } from '../../types.js';
import type { ProjectContext } from '../project-manager.js';
import { parseHandoffRouting } from './project-watch.js';
import type {
  Provider, SetupInput, SetupView, ValidationError, SpecRow, RoleRow, HarnessRunFile,
} from './types.js';

/** The model aliases an anthropic role may name (design D4). */
export const MODEL_ALIASES: readonly string[] = ['opus', 'sonnet', 'fable'];
/** The DeepSeek models a deepseek role may name (sdd-providers.sh:29). */
export const DEEPSEEK_MODELS: readonly string[] = ['deepseek-v4-pro', 'deepseek-flash'];
/** The roles a provider map may route off anthropic (sdd-providers.sh:23). */
export const ELIGIBLE_ROLES: readonly string[] = ['sdd-reviewer', 'sdd-checker', 'sdd-reviser'];

/** One `## Providers` row of agent-rules.md (grammar of sdd-providers.sh:42). */
export interface ProviderRow { agent: string; provider: string; model?: string }

/** The run-relevant fields read from `agent-rules.md`. */
export interface AgentRules {
  worktree: 'yes' | 'no';
  gates: 'block' | 'record';
  worktreeSetup: string | null;
  providers: ProviderRow[];
}

const PROVIDER_ROW = /^- ([^:\s]+): (\S+)(?: (\S+))?$/;

function readIfExists(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf-8');
  } catch {
    return undefined;
  }
}

/**
 * Read `agent-rules.md` from the workflow root. `worktree` is `yes` when a line
 * equals `worktree-per-change: required`; `gates` is a `gates: block`/`gates:
 * record` value, else `block`; `worktreeSetup` is the first code span of the
 * `worktree-setup:` line, else null; `providers` are the `## Providers` rows in
 * the grammar of sdd-providers.sh:42 up to the next `## ` heading. A missing file
 * gives `no`, `block`, null and no rows.
 */
export function readAgentRules(workflowRoot: string): AgentRules {
  const text = readIfExists(join(workflowRoot, 'agent-rules.md'));
  if (text === undefined) {
    return { worktree: 'no', gates: 'block', worktreeSetup: null, providers: [] };
  }
  const lines = text.split(/\r?\n/);

  const worktree: 'yes' | 'no' =
    lines.some((l) => l.trim() === 'worktree-per-change: required') ? 'yes' : 'no';

  let gates: 'block' | 'record' = 'block';
  const gatesMatch = text.match(/^gates:\s*(block|record)\b/m);
  if (gatesMatch) gates = gatesMatch[1] as 'block' | 'record';

  let worktreeSetup: string | null = null;
  const setupLine = lines.find((l) => /^worktree-setup:/.test(l.trim()));
  if (setupLine) {
    const span = setupLine.match(/`([^`]+)`/);
    if (span) worktreeSetup = span[1];
  }

  const providers: ProviderRow[] = [];
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^##\s+Providers\s*$/.test(lines[i])) { idx = i + 1; break; }
  }
  if (idx >= 0) {
    for (let i = idx; i < lines.length; i++) {
      const raw = lines[i];
      if (/^##\s/.test(raw)) break;
      const t = raw.trim();
      if (t === '' || t[0] !== '-') continue;
      const m = PROVIDER_ROW.exec(t);
      if (!m) continue;
      const row: ProviderRow = { agent: m[1], provider: m[2] };
      if (m[3]) row.model = m[3];
      providers.push(row);
    }
  }

  return { worktree, gates, worktreeSetup, providers };
}

function readRunFile(workflowRoot: string): HarnessRunFile | null {
  const text = readIfExists(join(workflowRoot, 'harness-run.json'));
  if (text === undefined) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as HarnessRunFile;
  } catch {
    // Unparsable file: no saved notice.
  }
  return null;
}

/**
 * Build the run-setup view for a project: the spec rows from the task 1 snapshot,
 * the HANDOFF routing, one role row per profile in sorted order (a role the
 * provider map routes to deepseek defaults to that provider and model, D3), the
 * fixed supervisor row, the launchable spec (else its disabled reason) and the
 * saved run file. Reads only `project.projectPath`.
 */
export async function buildSetupView(
  project: ProjectContext,
  profiles: Record<string, AgentProfile> = AGENT_PROFILES,
): Promise<SetupView> {
  const workflowRoot = join(project.projectPath, '.spec-workflow');
  const snapshot = await new IndexGenerator(project.projectPath).snapshot();
  const { routing } = snapshot;

  const specs: SpecRow[] = [];
  const pushRows = (entries: SpecIndexEntry[], bucket: SpecRow['bucket']) => {
    for (const e of entries) {
      specs.push({
        name: e.name,
        bucket,
        currentPhase: e.currentPhase,
        overallStatus: e.overallStatus,
        progress: { total: e.taskProgress.total, completed: e.taskProgress.completed },
        routed: e.name === routing.spec,
      });
    }
  };
  pushRows(snapshot.active, 'active');
  pushRows(snapshot.deferred, 'deferred');
  pushRows(snapshot.other, 'other');

  const rules = readAgentRules(workflowRoot);
  const providerMap = new Map(rules.providers.map((p) => [p.agent, p]));

  const handoff = parseHandoffRouting(readIfExists(handoffPath(workflowRoot)));

  const roles: RoleRow[] = Object.keys(profiles)
    .sort()
    .map((agent) => {
      const profile = profiles[agent];
      const mapped = providerMap.get(agent);
      const routesDeepseek = mapped?.provider === 'deepseek' && !!mapped.model;
      const defaultProvider: Provider = routesDeepseek ? 'deepseek' : 'anthropic';
      const defaultModel = routesDeepseek ? mapped!.model! : profile.model;
      return {
        agent,
        role: profile.role,
        declaredModel: profile.model,
        effort: profile.effort,
        defaultModel,
        defaultProvider,
        providerEditable: ELIGIBLE_ROLES.includes(agent),
      };
    });

  const launchable = routing.state === 'active' ? routing.spec : null;
  const disabledReason = routing.state === 'active' ? null : routing.reason;

  return {
    specs,
    routing,
    handoff,
    launchable,
    disabledReason,
    supervisor: { model: 'claude-opus-5-5', effort: 'high' },
    roles,
    worktree: rules.worktree,
    gates: rules.gates,
    modelAliases: [...MODEL_ALIASES],
    deepseekModels: [...DEEPSEEK_MODELS],
    eligibleRoles: [...ELIGIBLE_ROLES],
    saved: readRunFile(workflowRoot),
  };
}

function checkAnthropicModel(model: string): string | null {
  if (MODEL_ALIASES.includes(model)) return null;
  if (model.startsWith('claude-')) return null;
  return `Model must be an alias (${MODEL_ALIASES.join(', ')}) or a full id starting with claude-.`;
}

/**
 * Validate a form submission against the view it was built from. Returns the
 * first error as `{ field, value, error }`, else null (Requirement 1 AC 6-10).
 */
export function validateSetup(input: SetupInput, view: SetupView): ValidationError | null {
  if (input.spec !== view.launchable) {
    return { field: 'spec', value: String(input.spec), error: `Spec must be the launchable spec ${view.launchable ?? '(none)'}.` };
  }
  if (input.worktree !== 'yes' && input.worktree !== 'no') {
    return { field: 'worktree', value: String(input.worktree), error: 'Worktree must be yes or no.' };
  }
  if (input.gates !== 'block' && input.gates !== 'record') {
    return { field: 'gates', value: String(input.gates), error: 'Gates must be block or record.' };
  }
  const supErr = checkAnthropicModel(input.supervisorModel);
  if (supErr) return { field: 'supervisorModel', value: String(input.supervisorModel), error: supErr };

  const byAgent = new Map(view.roles.map((r) => [r.agent, r]));
  for (const [agent, role] of Object.entries(input.roles)) {
    const viewRole = byAgent.get(agent);
    if (!viewRole) {
      return { field: `roles.${agent}`, value: String(role?.model ?? ''), error: `Unknown role ${agent}.` };
    }
    const provider = role.provider;
    if (provider !== undefined && provider !== 'anthropic' && provider !== 'deepseek') {
      return { field: `roles.${agent}.provider`, value: String(provider), error: 'Provider must be anthropic or deepseek.' };
    }
    const effectiveProvider: Provider = provider ?? viewRole.defaultProvider;
    if (effectiveProvider !== 'anthropic' && !ELIGIBLE_ROLES.includes(agent)) {
      return { field: `roles.${agent}.provider`, value: String(effectiveProvider), error: `${agent} may only run on anthropic.` };
    }
    if (typeof role.model !== 'string') {
      return { field: `roles.${agent}.model`, value: String(role.model), error: 'Model must be a string.' };
    }
    if (effectiveProvider === 'deepseek') {
      if (!DEEPSEEK_MODELS.includes(role.model)) {
        return { field: `roles.${agent}.model`, value: role.model, error: `DeepSeek model must be one of ${DEEPSEEK_MODELS.join(', ')}.` };
      }
    } else {
      const err = checkAnthropicModel(role.model);
      if (err) return { field: `roles.${agent}.model`, value: role.model, error: err };
    }
  }
  return null;
}

/**
 * Reduce a validated submission to the run file. A role is kept only when its
 * model or provider differs from its default, and a kept role carries both
 * fields (Requirement 1 AC 12). `writtenAt` is `now().toISOString()`.
 */
export function toRunFile(input: SetupInput, view: SetupView, now: () => Date): HarnessRunFile {
  const byAgent = new Map(view.roles.map((r) => [r.agent, r]));
  const roles: Record<string, { model: string; provider: Provider }> = {};
  for (const [agent, role] of Object.entries(input.roles)) {
    const viewRole = byAgent.get(agent);
    if (!viewRole) continue;
    const provider: Provider = role.provider ?? viewRole.defaultProvider;
    const model = role.model;
    if (model !== viewRole.defaultModel || provider !== viewRole.defaultProvider) {
      roles[agent] = { model, provider };
    }
  }
  return {
    spec: input.spec,
    writtenAt: now().toISOString(),
    supervisorModel: input.supervisorModel,
    worktree: input.worktree,
    gates: input.gates,
    roles,
  };
}

/** Write `harness-run.json` atomically (temp file then rename). */
export function writeRunFile(workflowRoot: string, file: HarnessRunFile): void {
  const path = join(workflowRoot, 'harness-run.json');
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(file, null, 2) + '\n');
  renameSync(tmp, path);
}

/**
 * Delete `harness-run.json` only when its parsed `writtenAt` equals the
 * argument. A missing or unparsable file is left alone (design D14).
 */
export function deleteRunFileIf(workflowRoot: string, writtenAt: string): void {
  const path = join(workflowRoot, 'harness-run.json');
  const text = readIfExists(path);
  if (text === undefined) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return;
  }
  if (parsed && typeof parsed === 'object' && (parsed as { writtenAt?: unknown }).writtenAt === writtenAt) {
    unlinkSync(path);
  }
}
