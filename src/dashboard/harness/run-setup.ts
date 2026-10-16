// src/dashboard/harness/run-setup.ts
//
// One server-side rule set builds the run-setup view and validates a launch
// (design.md C3, D5; Requirement 1). It reads the task 1 read-only index
// snapshot, the task 2 wire types and the task 3 HANDOFF parser, and writes no
// spec-store file (the `harness-run.json` setup file went with step (d) of the
// foundation rework; the controller's run record carries a run's setup).
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { IndexGenerator } from '../../core/index-generator.js';
import { handoffPath } from '../../watch/index.js';
import { AGENT_PROFILES } from '../../watch/ledger.js';
import type { AgentProfile } from '../../watch/ledger.js';
import type { SpecIndexEntry } from '../../types.js';
import type { ProjectContext } from '../project-manager.js';
import { parseHandoffRouting } from './project-watch.js';
import type {
  Provider, SetupInput, SetupView, ValidationError, SpecRow, RoleRow,
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
  /** `merge-method:` — how the controller merges a PR (default `merge`). */
  mergeMethod: 'merge' | 'squash';
  /** `post-merge:` — the backticked command run after a merge, else null. */
  postMerge: string | null;
  /** `merge:` — merge by rule (`auto`) or ask the operator first (`ask`). */
  merge: 'auto' | 'ask';
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
 * the grammar of sdd-providers.sh:42 up to the next `## ` heading. The merge keys
 * (controller-design.md §10): `mergeMethod` is `merge-method: merge|squash`
 * (default `merge`); `postMerge` is the first code span of the `post-merge:` line,
 * else null; `merge` is `merge: auto|ask` (default `auto`). A missing file gives
 * `no`, `block`, null, no rows, `merge`, null and `auto`.
 */
export function readAgentRules(workflowRoot: string): AgentRules {
  const text = readIfExists(join(workflowRoot, 'agent-rules.md'));
  if (text === undefined) {
    return {
      worktree: 'no', gates: 'block', worktreeSetup: null, providers: [],
      mergeMethod: 'merge', postMerge: null, merge: 'auto',
    };
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

  // Merge keys (controller-design.md §10). `merge:` must not match
  // `merge-method:`: the `\b`/character after `merge` differs (`:` vs `-`).
  let mergeMethod: 'merge' | 'squash' = 'merge';
  const methodMatch = text.match(/^merge-method:\s*(merge|squash)\b/m);
  if (methodMatch) mergeMethod = methodMatch[1] as 'merge' | 'squash';

  let postMerge: string | null = null;
  const postMergeLine = lines.find((l) => /^post-merge:/.test(l.trim()));
  if (postMergeLine) {
    const span = postMergeLine.match(/`([^`]+)`/);
    if (span) postMerge = span[1];
  }

  let merge: 'auto' | 'ask' = 'auto';
  const mergeMatch = text.match(/^merge:\s*(auto|ask)\b/m);
  if (mergeMatch) merge = mergeMatch[1] as 'auto' | 'ask';

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

  return { worktree, gates, worktreeSetup, providers, mergeMethod, postMerge, merge };
}

/**
 * Build the run-setup view for a project: the spec rows from the task 1 snapshot,
 * the HANDOFF routing, one role row per profile in sorted order (a role the
 * provider map routes to deepseek defaults to that provider and model, D3), the
 * fixed supervisor row and the launchable spec (else its disabled reason). Reads
 * only `project.projectPath`.
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

  // Routing sees only specs on disk. With none left to do, the next spec is the
  // first one decomposition.md names that has no directory yet; launch creates it.
  const unstarted = routing.state === 'all-on-disk-complete' || routing.state === 'no-specs'
    ? nextUnstartedSpec(workflowRoot)
    : null;
  const launchable = routing.state === 'active' ? routing.spec : unstarted;
  const disabledReason = launchable ? null : routing.reason;

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
  };
}

/**
 * The first spec decomposition.md names in a `### <n>. \`<name>\`` heading that has
 * no `specs/<name>/` directory and is not tagged `(deferred)`, else null.
 */
export function nextUnstartedSpec(workflowRoot: string): string | null {
  const decomposition = readIfExists(join(workflowRoot, 'spec-decomposition', 'decomposition.md'));
  if (!decomposition) return null;
  for (const line of decomposition.split('\n')) {
    const m = /^###\s+\d+\.\s+`([\w.-]+)`(.*)$/.exec(line);
    if (!m || /\(deferred\)/i.test(m[2])) continue;
    if (!existsSync(join(workflowRoot, 'specs', m[1]))) return m[1];
  }
  return null;
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

