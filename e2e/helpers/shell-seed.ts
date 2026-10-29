/**
 * Shared fixture seed for the visual suite (task 1; design C7 T4/T5).
 *
 * Copied from the module-private fixture code of `../worktree-shell.spec.ts`
 * (`KNOWN_SPAWN`, `seedClosedSpec`, the `beforeAll` body at lines 91-196) since
 * Requirement 6.4 forbids editing that file and its helpers are not exported.
 * `seedVisualSuite` adds a fourth, already-resolved deferral on top of the
 * three the shell suite seeds, so the Deferrals view has a `resolved` row to
 * screenshot.
 */
import { appendFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { RegisteredProject, WorktreeHarness, resetSpecWorkflowHome } from './worktree-harness';
import { DeferralStorage } from '../../src/core/deferral-storage.js';
import { sddHome } from '../../src/dashboard/harness/state-files.js';
import { type PrRead, type RunRecord } from '../../src/controller/state.js';

const DASHBOARD_API_BASE_URL = 'http://127.0.0.1:5084';

// A spawn.start/spawn.end pair carrying every W field, copied verbatim from
// `../worktree-shell.spec.ts`'s `KNOWN_SPAWN` so a seeded closed spec's ledger
// matches that suite's shape.
export const KNOWN_SPAWN: Array<Record<string, string>> = [
  { ts: '2026-01-01T00:00:00.000Z', type: 'spawn.start', agent: 'sdd-drafter', phase: 'requirements' },
  { ts: '2026-01-01T00:00:01.000Z', type: 'spawn.end', agent: 'sdd-drafter', tokens: '142', input: '100', output: '10', cacheRead: '20', cacheWrite5m: '8', cacheWrite1h: '4' },
];

function getProjectByPathSuffix(projects: RegisteredProject[], suffix: string): RegisteredProject {
  const project = projects.find((entry) => entry.projectPath.endsWith(`/${suffix}`) || entry.projectPath.endsWith(`\\${suffix}`));
  if (!project) {
    throw new Error(`Project with path suffix "${suffix}" was not found in: ${JSON.stringify(projects, null, 2)}`);
  }
  return project;
}

/** Seed one closed spec under a worktree's `.spec-workflow`, copied from `../worktree-shell.spec.ts`. */
export async function seedClosedSpec(
  projectPath: string,
  spec: string,
  date: string,
  opts: { appendHandoff: boolean },
): Promise<void> {
  const workflowRoot = join(projectPath, '.spec-workflow');
  const specDir = join(workflowRoot, 'specs', spec);
  await mkdir(specDir, { recursive: true });
  await writeFile(join(specDir, 'tasks.md'), '- [ ] 1. first task\n- [ ] 2. second task\n', 'utf-8');
  await writeFile(
    join(specDir, 'harness-events.jsonl'),
    KNOWN_SPAWN.map((e) => JSON.stringify(e)).join('\n') + '\n',
    'utf-8',
  );
  const phaseLog = [
    '',
    '## Phase log',
    '',
    '| Date | Spec | Stage | State | Result | Note |',
    '| --- | --- | --- | --- | --- | --- |',
    `| ${date} | ${spec} | closeout | complete | closed | done |`,
    '',
  ].join('\n');
  const handoff = join(workflowRoot, 'HANDOFF.md');
  if (opts.appendHandoff) {
    await appendFile(handoff, phaseLog, 'utf-8');
  } else {
    await writeFile(handoff, '# HANDOFF\n' + phaseLog, 'utf-8');
  }
}

export interface SeededVisualFixture {
  harness: WorktreeHarness;
  projectA: RegisteredProject;
  projectB: RegisteredProject;
  ledgerPathA: string;
  runRecord: RunRecord;
}

/**
 * Builds the two-worktree, two-project fixture the visual suite screenshots:
 * the same harness setup, run record and three deferrals as
 * `../worktree-shell.spec.ts`'s `beforeAll`, plus a fourth deferral resolved
 * via {@link DeferralStorage.resolve} so a `resolved` pill is on screen.
 */
export async function seedVisualSuite(options: {
  serverRoot: string;
  specWorkflowHome: string;
}): Promise<SeededVisualFixture> {
  // Empties both `activeProjects.json` and the controller's durable
  // `projects.json`, so the sidebar carries no "remembered" entry from a prior
  // invocation and the before/after screenshots are reproducible.
  await resetSpecWorkflowHome(options.specWorkflowHome);

  const harness = new WorktreeHarness({
    serverRoot: options.serverRoot,
    dashboardApiBaseUrl: DASHBOARD_API_BASE_URL,
    specWorkflowHome: options.specWorkflowHome,
    mode: 'no-shared',
    worktrees: [
      { name: 'wt-a', layout: 'sibling', specName: 'spec-a', sourceFile: 'src/service-a.ts' },
      { name: 'wt-b', layout: 'sibling', specName: 'spec-b', sourceFile: 'src/service-b.ts' }
    ]
  });

  await harness.setup();

  const wtA = harness.getWorktree('wt-a');
  const specADir = join(wtA.path, '.spec-workflow', 'specs', 'spec-a');
  const ledgerPathA = join(specADir, 'harness-events.jsonl');
  await mkdir(specADir, { recursive: true });
  await writeFile(
    join(wtA.path, '.spec-workflow', 'HANDOFF.md'),
    '# HANDOFF\n\nActive spec **`spec-a`**\n',
    'utf-8'
  );
  await writeFile(
    ledgerPathA,
    JSON.stringify({ ts: '2026-10-06T10:00:00.000Z', type: 'run.start', run: 'run-1', spec: 'spec-a' }) + '\n',
    'utf-8'
  );

  await harness.startMcpServers();
  const registered = await harness.waitForProjects(2, 90000);
  const projectA = getProjectByPathSuffix(registered, 'wt-a');
  const projectB = getProjectByPathSuffix(registered, 'wt-b');

  const prReads: PrRead[] = [
    {
      kind: 'run', repo: 'alpha-service', number: 42,
      url: 'https://example.test/alpha/pull/42',
      ci: 'green', mergeable: 'MERGEABLE', verdict: 'merged',
      reasons: ['all required checks passed'],
      newDependencies: ['left-pad', 'ms'],
      sha: 'cafef00d1234567', at: '2026-10-06T10:05:00.000Z',
    },
    {
      kind: 'closeout', repo: 'beta-service', number: 7,
      ci: 'red', mergeable: 'CONFLICTING', verdict: 'blocked',
      reasons: ['conflicts with the base branch', 'a required check is failing'],
      at: '2026-10-06T10:06:00.000Z',
    },
  ];
  const runRecord: RunRecord = {
    v: 1, id: 'e2e-pr-panel', project: projectA.projectId,
    codeRoot: projectA.projectPath, specStore: projectA.projectPath,
    spec: 'spec-a', worktree: projectA.projectPath, branch: 'feat/spec-a',
    status: 'done', created: '2026-10-06T10:00:00.000Z', updated: '2026-10-06T10:06:00.000Z',
    tokens: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    prReads,
  };
  const runDir = join(sddHome(), 'runs', runRecord.id);
  await mkdir(runDir, { recursive: true });
  await writeFile(join(runDir, 'run.json'), JSON.stringify(runRecord, null, 2) + '\n', 'utf-8');

  // Four deferrals in project A: owner matthew, owner harness, none, and one
  // already resolved (the extra deferral this helper adds over the shell
  // suite's three, so the Deferrals view has a resolved pill to screenshot).
  const storageA = new DeferralStorage(projectA.projectPath);
  const baseDeferral = {
    originSpec: 'spec-a', originPhase: 'design' as const,
    revisitTrigger: 'when the next spec starts', tags: [] as string[],
    supersedes: null as string | null,
    body: { context: 'ctx', decision: 'dec', revisitCriteria: 'crit' },
  };
  await storageA.create({ ...baseDeferral, title: 'Owned by matthew', owner: 'matthew' });
  await storageA.create({ ...baseDeferral, title: 'Owned by harness', owner: 'harness' });
  await storageA.create({ ...baseDeferral, title: 'No owner recorded' });
  const resolvedId = await storageA.create({ ...baseDeferral, title: 'Already resolved' });
  await storageA.resolve(resolvedId, 'Fixed by the visual refresh.');

  // A closed spec in each project; only project A has a baseline-w-per-task.
  await seedClosedSpec(projectA.projectPath, 'closed-alpha', '2026-03-10', { appendHandoff: true });
  await writeFile(
    join(projectA.projectPath, '.spec-workflow', 'agent-rules.md'),
    '# agent-rules\nbaseline-w-per-task: 85\n',
    'utf-8',
  );
  await seedClosedSpec(projectB.projectPath, 'closed-beta', '2026-02-10', { appendHandoff: false });

  return { harness, projectA, projectB, ledgerPathA, runRecord };
}
