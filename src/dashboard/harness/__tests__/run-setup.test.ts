import { describe, it, expect, afterEach } from 'vitest';
import { promises as fsp, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import {
  readAgentRules,
  buildSetupView,
  validateSetup,
  toRunFile,
  writeRunFile,
  deleteRunFileIf,
  MODEL_ALIASES,
  DEEPSEEK_MODELS,
  ELIGIBLE_ROLES,
} from '../run-setup.js';
import type { SetupInput, SetupView, HarnessRunFile } from '../types.js';
import type { ProjectContext } from '../../project-manager.js';
import type { AgentProfile } from '../../../watch/ledger.js';

// Contract for src/dashboard/harness/run-setup.ts (design.md C3; task 4
// _Prompt; Requirements 1.1, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11,
// 1.12).
//
// Criterion "drift with sdd-providers.sh" (task 4 _Prompt: "Export the
//   constants ... DEEPSEEK_MODELS and ELIGIBLE_ROLES (the lists of
//   harness/skills/sdd-continue/references/sdd-providers.sh:29 and :23)";
//   Requirement 1 AC 6, AC 7):
//   Pre-condition: the real sdd-providers.sh source text.
//   Test: read the `ELIGIBLE="..."` line and the `modelsAllowed` array
//   literal out of the script, then compare to the imported constants.
//   Observable result: ELIGIBLE_ROLES and DEEPSEEK_MODELS (sorted) equal the
//   script's two lists (sorted).
//   Expected-value source: harness/skills/sdd-continue/references/sdd-providers.sh:23,29.
//
// Criterion "rules pre-fill" (design.md C3: "readAgentRules(workflowRoot) ...
//   worktree ... gates ... worktreeSetup ... providers"; Requirement 1 AC 9):
//   Pre-condition: an agent-rules.md with `worktree-per-change: required`, a
//   `worktree-setup:` line whose first code span is `npm ci`, a `gates:
//   record` line and a `## Providers` section with one deepseek and one
//   anthropic row.
//   Test: readAgentRules(workflowRoot).
//   Observable result: { worktree: 'yes', gates: 'record', worktreeSetup:
//   'npm ci', providers: [{ agent: 'sdd-reviewer', provider: 'deepseek',
//   model: 'deepseek-flash' }, { agent: 'sdd-checker', provider: 'anthropic'
//   }] }.
//   Expected-value source: the task 4 _Prompt sentence and the literal
//   fixture values.
//
// Criterion "missing-file defaults" (same _Prompt sentence: "a missing file
//   gives no, block, null and no rows"; Requirement 1 AC 9):
//   Pre-condition: workflowRoot with no agent-rules.md.
//   Test: readAgentRules(workflowRoot).
//   Observable result: { worktree: 'no', gates: 'block', worktreeSetup:
//   null, providers: [] }.
//   Expected-value source: the _Prompt sentence.
//
// Criterion "specs list order and routing" (Requirement 1 AC 1):
//   Pre-condition: two specs on disk, `alpha` (1 of 2 tasks done) and
//   `bravo` (2 of 2 done), a decomposition naming `alpha` then `bravo`.
//   Test: buildSetupView(project, {}).
//   Observable result: view.specs is, in order, [{ name: 'alpha', bucket:
//   'active', currentPhase: 'implementation', overallStatus: 'implementing',
//   progress: { total: 2, completed: 1 }, routed: true }, { name: 'bravo',
//   bucket: 'active', currentPhase: 'completed', overallStatus: 'completed',
//   progress: { total: 2, completed: 2 }, routed: false }].
//   Expected-value source: src/core/spec-status-deriver.ts (phase/status
//   from the fixture's task counts) and src/core/spec-routing-deriver.ts
//   (the first not-Complete spec in build order is routed).
//
// Criterion "HANDOFF routing shown" (Requirement 1 AC 3):
//   Pre-condition: a HANDOFF.md inside the workflow root naming `alpha`
//   active with a live-phase line (phase document, state in-progress,
//   result gate-a), one spec `alpha` on disk.
//   Test: buildSetupView(project, {}).
//   Observable result: view.handoff deep-equals { spec: 'alpha', phase:
//   'document', state: 'in-progress', result: 'gate-a' }.
//   Expected-value source: the literal fixture header values, parsed by
//   task 3's parseHandoffRouting.
//
// Criterion "role rows and the supervisor row" (Requirement 1 AC 4, AC 5):
//   Pre-condition: a profiles map with three agents out of alphabetical
//   order, one of them (`sdd-checker`) an eligible role, no agent-rules.md.
//   Test: buildSetupView(project, profiles).
//   Observable result: view.roles holds one row per key, sorted by key,
//   each with declaredModel/effort equal to the profile's own values,
//   defaultModel equal to declaredModel, defaultProvider 'anthropic', and
//   providerEditable true only for sdd-checker; view.supervisor deep-equals
//   { model: 'claude-opus-5-5', effort: 'high' }.
//   Expected-value source: the task 4 _Prompt sentence (sorted role rows,
//   fixed supervisor row) and harness/skills/sdd-continue/references/sdd-providers.sh:23
//   (sdd-checker is eligible).
//
// Criterion "deepseek default from the provider map" (design D3; Requirement
//   1 AC 7):
//   Pre-condition: an agent-rules.md `## Providers` section routing
//   `sdd-reviewer` to `deepseek deepseek-flash` and `sdd-checker` to plain
//   `anthropic`; profiles for sdd-reviewer (eligible), sdd-checker
//   (eligible) and sdd-implementer (not eligible).
//   Test: buildSetupView(project, profiles).
//   Observable result: the sdd-reviewer row has defaultProvider 'deepseek',
//   defaultModel 'deepseek-flash', providerEditable true; the sdd-checker
//   row has defaultProvider 'anthropic', providerEditable true; the
//   sdd-implementer row has providerEditable false.
//   Expected-value source: design D3 ("a role the map routes to deepseek
//   defaults to the map's model") and sdd-providers.sh:23 (eligible set).
//
// Criterion "non-active routing disables the form" (Requirement 1 AC 10):
//   Pre-condition: a workflow root with no specs at all.
//   Test: buildSetupView(project, {}).
//   Observable result: view.launchable is null and view.disabledReason is
//   'No specs exist yet.'.
//   Expected-value source: src/core/spec-routing-deriver.ts:69 (the
//   'no-specs' reason string), read as the real collaborator's own output.
//
// Criterion "empty profiles give no role rows" (Requirement 1 AC 4):
//   Pre-condition: the same no-specs workflow root.
//   Test: buildSetupView(project, {}).
//   Observable result: view.roles is [].
//   Expected-value source: task 4 _Prompt ("empty profiles give no role
//   rows").
//
// Criterion "anthropic model validation" (Requirement 1 AC 6):
//   Pre-condition: a synthetic SetupView with an anthropic-default role
//   `sdd-checker` (providerEditable, default provider anthropic).
//   Test: validateSetup(input, view) with that role's model set in turn to
//   'sonnet', 'claude-sonnet-5' and 'deepseek-flash'.
//   Observable result: null, null, then { field: 'roles.sdd-checker.model',
//   value: 'deepseek-flash', error: <string> }.
//   Expected-value source: Requirement 1 AC 6 ("neither a model alias ...
//   nor a full id starting with claude-").
//
// Criterion "deepseek model validation" (Requirement 1 AC 8):
//   Pre-condition: the same view; `sdd-reviewer` is eligible.
//   Test: validateSetup(input, view) with sdd-reviewer's provider set to
//   'deepseek' and its model set in turn to 'deepseek-v4-pro' and 'sonnet'.
//   Observable result: null, then { field: 'roles.sdd-reviewer.model',
//   value: 'sonnet', error: <string> }.
//   Expected-value source: Requirement 1 AC 8 ("SHALL require one of the two
//   DeepSeek models").
//
// Criterion "non-eligible role refused off anthropic" (Requirement 1 AC 7):
//   Pre-condition: the same view; `sdd-implementer` is not eligible.
//   Test: validateSetup(input, view) with sdd-implementer's provider set to
//   'deepseek'.
//   Observable result: { field: 'roles.sdd-implementer.provider', value:
//   'deepseek', error: <string> }.
//   Expected-value source: Requirement 1 AC 7 ("a provider field only for
//   the roles the validator allows").
//
// Criterion "unknown role refused" (Requirement 1 AC 6, the "SHALL name the
//   field" clause):
//   Pre-condition: the same view.
//   Test: validateSetup(input, view) with an extra role key not in
//   view.roles.
//   Observable result: a ValidationError whose field is
//   'roles.sdd-unknown'.
//   Expected-value source: task 4 _Prompt ("a role key not in view.roles is
//   refused (field roles.AGENT)").
//
// Criterion "worktree and gates choice validation" (Requirement 1 AC 9):
//   Pre-condition: the same view.
//   Test: validateSetup(input, view) with worktree set to 'sometimes', then
//   with gates set to 'always'.
//   Observable result: { field: 'worktree', value: 'sometimes', error:
//   <string> }, then { field: 'gates', value: 'always', error: <string> }.
//   Expected-value source: task 4 _Prompt ("worktree and gates must be one
//   of their two values").
//
// Criterion "spec must equal launchable" (Requirement 1 AC 10):
//   Pre-condition: the same view, whose launchable is 'alpha'.
//   Test: validateSetup(input, view) with spec set to 'other-spec'.
//   Observable result: { field: 'spec', value: 'other-spec', error:
//   <string> }.
//   Expected-value source: task 4 _Prompt ("spec must equal launchable").
//
// Criterion "omission at defaults" (Requirement 1 AC 12):
//   Pre-condition: a SetupInput whose every role's model and provider equal
//   the view's declared defaults.
//   Test: toRunFile(input, view, now).
//   Observable result: file.roles is {}.
//   Expected-value source: Requirement 1 AC 12 ("SHALL omit that role").
//
// Criterion "provider-only change keeps both fields" (Requirement 1 AC 12):
//   Pre-condition: a SetupInput whose sdd-reviewer role keeps the default
//   model text but sets provider to 'deepseek' (default provider
//   'anthropic').
//   Test: toRunFile(input, view, now).
//   Observable result: file.roles is exactly { 'sdd-reviewer': { model:
//   'claude-opus-4-8', provider: 'deepseek' } } — both fields present, no
//   other role present.
//   Expected-value source: design C3 ("a kept role carries both") — the
//   task 4 _Prompt's "a provider-only change keeps both fields" example.
//
// Criterion "run file carries the top-level fields" (Requirement 1 AC 11):
//   Pre-condition: a SetupInput with spec 'alpha', worktree 'yes', gates
//   'record'.
//   Test: toRunFile(input, view, now) with a fixed `now`.
//   Observable result: { spec: 'alpha', writtenAt: <now.toISOString()>,
//   supervisorModel: 'claude-opus-5-5', worktree: 'yes', gates: 'record' }
//   are all present on the returned file.
//   Expected-value source: Requirement 1 AC 11 (the file's field list) and
//   task 4 _Prompt ("writtenAt is now.toISOString()").
//
// Criterion "writeRunFile writes harness-run.json" (Requirement 1 AC 11):
//   Pre-condition: an empty workflow root directory and a HarnessRunFile
//   value.
//   Test: writeRunFile(workflowRoot, file), then read
//   `<workflowRoot>/harness-run.json` from disk.
//   Observable result: the parsed JSON deep-equals the file value passed
//   in.
//   Expected-value source: Requirement 1 AC 11 ("SHALL write
//   .spec-workflow/harness-run.json").
//
// Criterion "deleteRunFileIf spares a mismatched writtenAt" (design D14):
//   Pre-condition: harness-run.json on disk with writtenAt
//   '2026-01-01T00:00:00.000Z'.
//   Test: deleteRunFileIf(workflowRoot, '2026-02-02T00:00:00.000Z').
//   Observable result: the file still exists on disk with its original
//   content, unchanged.
//   Expected-value source: design D14 ("deletes the setup file only when
//   its written-at time matches").

const here = dirname(fileURLToPath(import.meta.url));
const PROVIDERS_SCRIPT = join(here, '../../../../harness/skills/sdd-continue/references/sdd-providers.sh');

const tempDirs: string[] = [];

async function makeWorkflowRoot(): Promise<{ projectPath: string; workflowRoot: string }> {
  const projectPath = await fsp.mkdtemp(join(tmpdir(), 'run-setup-'));
  tempDirs.push(projectPath);
  const workflowRoot = join(projectPath, '.spec-workflow');
  await fsp.mkdir(join(workflowRoot, 'specs'), { recursive: true });
  return { projectPath, workflowRoot };
}

function projectFor(projectPath: string): ProjectContext {
  return { projectPath } as ProjectContext;
}

async function createSpec(
  workflowRoot: string,
  name: string,
  files: { requirements?: string; design?: string; tasks?: string },
): Promise<void> {
  const dir = join(workflowRoot, 'specs', name);
  await fsp.mkdir(dir, { recursive: true });
  if (files.requirements !== undefined) await fsp.writeFile(join(dir, 'requirements.md'), files.requirements);
  if (files.design !== undefined) await fsp.writeFile(join(dir, 'design.md'), files.design);
  if (files.tasks !== undefined) await fsp.writeFile(join(dir, 'tasks.md'), files.tasks);
}

async function writeDecomposition(workflowRoot: string, content: string): Promise<void> {
  const dir = join(workflowRoot, 'spec-decomposition');
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(join(dir, 'decomposition.md'), content);
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

/** A synthetic SetupView for validateSetup/toRunFile: no real fs read. */
function buildView(): SetupView {
  return {
    specs: [],
    routing: { state: 'active', spec: 'alpha', reason: 'test fixture', candidates: [], warnings: [] },
    handoff: null,
    launchable: 'alpha',
    disabledReason: null,
    supervisor: { model: 'claude-opus-5-5', effort: 'high' },
    roles: [
      {
        agent: 'sdd-checker', role: 'checker', declaredModel: 'claude-sonnet-5', effort: 'high',
        defaultModel: 'claude-sonnet-5', defaultProvider: 'anthropic', providerEditable: true,
      },
      {
        agent: 'sdd-implementer', role: 'implementer', declaredModel: 'claude-opus-4-8', effort: 'xhigh',
        defaultModel: 'claude-opus-4-8', defaultProvider: 'anthropic', providerEditable: false,
      },
      {
        agent: 'sdd-reviewer', role: 'adversarial reviewer', declaredModel: 'claude-opus-4-8', effort: 'xhigh',
        defaultModel: 'claude-opus-4-8', defaultProvider: 'anthropic', providerEditable: true,
      },
    ],
    worktree: 'no',
    gates: 'block',
    modelAliases: [...MODEL_ALIASES],
    deepseekModels: [...DEEPSEEK_MODELS],
    eligibleRoles: [...ELIGIBLE_ROLES],
    saved: null,
  };
}

/** A SetupInput whose every role sits exactly at its view default. */
function defaultInput(): SetupInput {
  return {
    spec: 'alpha',
    supervisorModel: 'claude-opus-5-5',
    worktree: 'no',
    gates: 'block',
    roles: {
      'sdd-checker': { model: 'claude-sonnet-5' },
      'sdd-implementer': { model: 'claude-opus-4-8' },
      'sdd-reviewer': { model: 'claude-opus-4-8' },
    },
  };
}

describe('run-setup', () => {
  describe('module constants', () => {
    it('ELIGIBLE_ROLES and DEEPSEEK_MODELS match sdd-providers.sh (Req 1.6, 1.7)', () => {
      const text = readFileSync(PROVIDERS_SCRIPT, 'utf-8');
      const eligibleMatch = text.match(/^ELIGIBLE="([^"]+)"$/m);
      const modelsMatch = text.match(/const modelsAllowed = \[([^\]]+)\];/);
      expect(eligibleMatch).not.toBeNull();
      expect(modelsMatch).not.toBeNull();

      const scriptEligible = eligibleMatch![1].split(/\s+/).filter(Boolean).sort();
      const scriptModels = modelsMatch![1]
        .split(',')
        .map((s) => s.trim().replace(/^"|"$/g, ''))
        .sort();

      expect([...ELIGIBLE_ROLES].sort()).toEqual(scriptEligible);
      expect([...DEEPSEEK_MODELS].sort()).toEqual(scriptModels);
    });
  });

  describe('readAgentRules', () => {
    it('reads worktree, gates, worktreeSetup and providers from a full rules file (Req 1.9)', async () => {
      const { workflowRoot } = await makeWorkflowRoot();
      await fsp.writeFile(
        join(workflowRoot, 'agent-rules.md'),
        [
          'worktree-per-change: required',
          'worktree-setup: `npm ci`; also runs `npx playwright install chromium`',
          'gates: record',
          '',
          '## Providers',
          '',
          '- sdd-reviewer: deepseek deepseek-flash',
          '- sdd-checker: anthropic',
          '',
        ].join('\n'),
      );

      const rules = readAgentRules(workflowRoot);

      expect(rules.worktree).toBe('yes');
      expect(rules.gates).toBe('record');
      expect(rules.worktreeSetup).toBe('npm ci');
      expect(rules.providers).toEqual([
        { agent: 'sdd-reviewer', provider: 'deepseek', model: 'deepseek-flash' },
        { agent: 'sdd-checker', provider: 'anthropic' },
      ]);
    });

    it('defaults to no/block/null/[] when agent-rules.md is missing (Req 1.9)', async () => {
      const { workflowRoot } = await makeWorkflowRoot();

      const rules = readAgentRules(workflowRoot);

      expect(rules).toEqual({ worktree: 'no', gates: 'block', worktreeSetup: null, providers: [] });
    });
  });

  describe('buildSetupView', () => {
    it('lists specs in decomposition order, marking the routed spec (Req 1.1)', async () => {
      const { projectPath, workflowRoot } = await makeWorkflowRoot();
      await createSpec(workflowRoot, 'alpha', {
        requirements: '# R\n', design: '# D\n', tasks: '- [x] 1. a\n- [ ] 2. b\n',
      });
      await createSpec(workflowRoot, 'bravo', {
        requirements: '# R\n', design: '# D\n', tasks: '- [x] 1. a\n- [x] 2. b\n',
      });
      await writeDecomposition(workflowRoot, '# Plan\n\n1. alpha\n2. bravo\n');

      const view = await buildSetupView(projectFor(projectPath), {});

      expect(view.specs).toEqual([
        {
          name: 'alpha', bucket: 'active', currentPhase: 'implementation', overallStatus: 'implementing',
          progress: { total: 2, completed: 1 }, routed: true,
        },
        {
          name: 'bravo', bucket: 'active', currentPhase: 'completed', overallStatus: 'completed',
          progress: { total: 2, completed: 2 }, routed: false,
        },
      ]);
    });

    it('shows the HANDOFF live phase, state and last result for the active spec (Req 1.3)', async () => {
      const { projectPath, workflowRoot } = await makeWorkflowRoot();
      await createSpec(workflowRoot, 'alpha', { requirements: '# R\n' });
      await fsp.writeFile(
        join(workflowRoot, 'HANDOFF.md'),
        [
          '> **READ FIRST — SDD routing (2026-09-29, harness v4).** Active spec **`alpha`**.',
          '> Live phase **document**, state **in-progress**, last result **gate-a**.',
        ].join('\n'),
      );

      const view = await buildSetupView(projectFor(projectPath), {});

      expect(view.handoff).toEqual({ spec: 'alpha', phase: 'document', state: 'in-progress', result: 'gate-a' });
    });

    it('builds one sorted role row per profile and the fixed supervisor row (Req 1.4, 1.5)', async () => {
      const { projectPath } = await makeWorkflowRoot();
      const profiles: Record<string, AgentProfile> = {
        'sdd-verifier': { model: 'claude-opus-4-8', effort: 'xhigh', role: 'verifier' },
        'sdd-checker': { model: 'claude-sonnet-5', effort: 'high', role: 'checker' },
        'sdd-adjudicator': { model: 'claude-opus-5-5', effort: 'high', role: 'adjudicator' },
      };

      const view = await buildSetupView(projectFor(projectPath), profiles);

      expect(view.roles).toEqual([
        {
          agent: 'sdd-adjudicator', role: 'adjudicator', declaredModel: 'claude-opus-5-5', effort: 'high',
          defaultModel: 'claude-opus-5-5', defaultProvider: 'anthropic', providerEditable: false,
        },
        {
          agent: 'sdd-checker', role: 'checker', declaredModel: 'claude-sonnet-5', effort: 'high',
          defaultModel: 'claude-sonnet-5', defaultProvider: 'anthropic', providerEditable: true,
        },
        {
          agent: 'sdd-verifier', role: 'verifier', declaredModel: 'claude-opus-4-8', effort: 'xhigh',
          defaultModel: 'claude-opus-4-8', defaultProvider: 'anthropic', providerEditable: false,
        },
      ]);
      expect(view.supervisor).toEqual({ model: 'claude-opus-5-5', effort: 'high' });
    });

    it("defaults an eligible role's provider from the rules-file provider map (Req 1.7, design D3)", async () => {
      const { projectPath, workflowRoot } = await makeWorkflowRoot();
      await fsp.writeFile(
        join(workflowRoot, 'agent-rules.md'),
        ['worktree-setup: `npm ci`', '', '## Providers', '', '- sdd-reviewer: deepseek deepseek-flash', '- sdd-checker: anthropic', ''].join('\n'),
      );
      const profiles: Record<string, AgentProfile> = {
        'sdd-reviewer': { model: 'claude-opus-4-8', effort: 'xhigh', role: 'adversarial reviewer' },
        'sdd-checker': { model: 'claude-sonnet-5', effort: 'high', role: 'checker' },
        'sdd-implementer': { model: 'claude-opus-4-8', effort: 'xhigh', role: 'implementer' },
      };

      const view = await buildSetupView(projectFor(projectPath), profiles);
      const byAgent = Object.fromEntries(view.roles.map((r: { agent: string }) => [r.agent, r]));

      expect(byAgent['sdd-reviewer']).toMatchObject({ defaultProvider: 'deepseek', defaultModel: 'deepseek-flash', providerEditable: true });
      expect(byAgent['sdd-checker']).toMatchObject({ defaultProvider: 'anthropic', providerEditable: true });
      expect(byAgent['sdd-implementer']).toMatchObject({ defaultProvider: 'anthropic', providerEditable: false });
    });

    it('gives null launchable and the routing reason when the store has no specs (Req 1.10)', async () => {
      const { projectPath } = await makeWorkflowRoot();

      const view = await buildSetupView(projectFor(projectPath), {});

      expect(view.launchable).toBeNull();
      expect(view.disabledReason).toBe('No specs exist yet.');
    });

    it('gives no role rows when profiles is empty (Req 1.4)', async () => {
      const { projectPath } = await makeWorkflowRoot();

      const view = await buildSetupView(projectFor(projectPath), {});

      expect(view.roles).toEqual([]);
    });
  });

  describe('validateSetup', () => {
    it('accepts an anthropic-role alias and full claude- id, refuses anything else (Req 1.6)', () => {
      const view = buildView();
      const base = defaultInput();

      expect(validateSetup({ ...base, roles: { ...base.roles, 'sdd-checker': { model: 'sonnet' } } }, view)).toBeNull();
      expect(validateSetup({ ...base, roles: { ...base.roles, 'sdd-checker': { model: 'claude-sonnet-5' } } }, view)).toBeNull();

      const result = validateSetup({ ...base, roles: { ...base.roles, 'sdd-checker': { model: 'deepseek-flash' } } }, view);
      expect(result).not.toBeNull();
      expect(result!.field).toBe('roles.sdd-checker.model');
      expect(result!.value).toBe('deepseek-flash');
      expect(typeof result!.error).toBe('string');
      expect(result!.error.length).toBeGreaterThan(0);
    });

    it('requires a DeepSeek-listed model once a role provider is deepseek (Req 1.8)', () => {
      const view = buildView();
      const base = defaultInput();

      const valid = validateSetup(
        { ...base, roles: { ...base.roles, 'sdd-reviewer': { model: 'deepseek-v4-pro', provider: 'deepseek' } } },
        view,
      );
      expect(valid).toBeNull();

      const invalid = validateSetup(
        { ...base, roles: { ...base.roles, 'sdd-reviewer': { model: 'sonnet', provider: 'deepseek' } } },
        view,
      );
      expect(invalid).not.toBeNull();
      expect(invalid!.field).toBe('roles.sdd-reviewer.model');
      expect(invalid!.value).toBe('sonnet');
    });

    it("refuses setting a non-eligible role's provider to deepseek (Req 1.7)", () => {
      const view = buildView();
      const base = defaultInput();

      const result = validateSetup(
        { ...base, roles: { ...base.roles, 'sdd-implementer': { model: 'deepseek-v4-pro', provider: 'deepseek' } } },
        view,
      );

      expect(result).not.toBeNull();
      expect(result!.field).toBe('roles.sdd-implementer.provider');
      expect(result!.value).toBe('deepseek');
    });

    it('refuses a role key that is not in view.roles (Req 1.6)', () => {
      const view = buildView();
      const base = defaultInput();

      const result = validateSetup(
        { ...base, roles: { ...base.roles, 'sdd-unknown': { model: 'sonnet' } } },
        view,
      );

      expect(result).not.toBeNull();
      expect(result!.field).toBe('roles.sdd-unknown');
    });

    it('refuses a worktree or gates value outside their two choices (Req 1.9)', () => {
      const view = buildView();
      const base = defaultInput();

      const badWorktree = validateSetup({ ...base, worktree: 'sometimes' as SetupInput['worktree'] }, view);
      expect(badWorktree).toEqual({ field: 'worktree', value: 'sometimes', error: expect.any(String) });

      const badGates = validateSetup({ ...base, gates: 'always' as SetupInput['gates'] }, view);
      expect(badGates).toEqual({ field: 'gates', value: 'always', error: expect.any(String) });
    });

    it('refuses input.spec when it does not equal view.launchable (Req 1.10)', () => {
      const view = buildView();
      const base = defaultInput();

      const result = validateSetup({ ...base, spec: 'other-spec' }, view);

      expect(result).toEqual({ field: 'spec', value: 'other-spec', error: expect.any(String) });
    });
  });

  describe('toRunFile', () => {
    const now = () => new Date('2026-09-29T12:00:00.000Z');

    it('omits every role whose model and provider equal its default (Req 1.12)', () => {
      const view = buildView();
      const file = toRunFile(defaultInput(), view, now);

      expect(file.roles).toEqual({});
    });

    it('keeps a role with both fields when only its provider differs from default (Req 1.12)', () => {
      const view = buildView();
      const base = defaultInput();
      const input: SetupInput = {
        ...base,
        roles: { ...base.roles, 'sdd-reviewer': { model: 'claude-opus-4-8', provider: 'deepseek' } },
      };

      const file = toRunFile(input, view, now);

      expect(file.roles).toEqual({ 'sdd-reviewer': { model: 'claude-opus-4-8', provider: 'deepseek' } });
    });

    it('carries spec, writtenAt, supervisorModel, worktree and gates from the input (Req 1.11)', () => {
      const view = buildView();
      const input: SetupInput = { ...defaultInput(), worktree: 'yes', gates: 'record' };

      const file = toRunFile(input, view, now);

      expect(file.spec).toBe('alpha');
      expect(file.writtenAt).toBe('2026-09-29T12:00:00.000Z');
      expect(file.supervisorModel).toBe('claude-opus-5-5');
      expect(file.worktree).toBe('yes');
      expect(file.gates).toBe('record');
    });
  });

  describe('writeRunFile and deleteRunFileIf', () => {
    it('writes harness-run.json to the workflow root (Req 1.11)', async () => {
      const { workflowRoot } = await makeWorkflowRoot();
      const file: HarnessRunFile = {
        spec: 'alpha', writtenAt: '2026-09-29T12:00:00.000Z', supervisorModel: 'claude-opus-5-5',
        worktree: 'no', gates: 'block', roles: {},
      };

      writeRunFile(workflowRoot, file);

      const written = JSON.parse(readFileSync(join(workflowRoot, 'harness-run.json'), 'utf-8'));
      expect(written).toEqual(file);
    });

    it('spares a run file whose writtenAt differs from the argument (design D14)', async () => {
      const { workflowRoot } = await makeWorkflowRoot();
      const path = join(workflowRoot, 'harness-run.json');
      const file: HarnessRunFile = {
        spec: 'alpha', writtenAt: '2026-01-01T00:00:00.000Z', supervisorModel: 'claude-opus-5-5',
        worktree: 'no', gates: 'block', roles: {},
      };
      writeFileSync(path, JSON.stringify(file));

      deleteRunFileIf(workflowRoot, '2026-02-02T00:00:00.000Z');

      expect(existsSync(path)).toBe(true);
      expect(JSON.parse(readFileSync(path, 'utf-8'))).toEqual(file);
    });
  });
});
