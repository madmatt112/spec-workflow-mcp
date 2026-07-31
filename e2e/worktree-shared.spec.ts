import { expect, test } from '@playwright/test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { decode } from '@toon-format/toon';
import { access, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import {
  HarnessWorktree,
  RegisteredProject,
  WorktreeHarness,
  resetSpecWorkflowHome
} from './helpers/worktree-harness';

const DASHBOARD_API_BASE_URL = 'http://127.0.0.1:5084';

/** The one spec that exists, in the MAIN checkout only. */
const SHARED_SPEC_NAME = 'spec-shared';
/** Logs `src/service.ts` plus one file that exists in only one worktree each. */
const ISOLATION_TASK_ID = '1';
/** Logs `app.ts` and `src/service.ts` — relative, unanchored, no leading `./`. */
const BARE_PATH_TASK_ID = '2';

/**
 * The two worktrees, and what makes each one's edits recognisable.
 *
 * `wt-nested` is the "B" of the isolation scenario *and* the nested layout, in
 * which the shared workflow root physically contains the worktree — the harder
 * of the two containment cases, so it is the one worth spending on the pair.
 *
 * Markers are compared as substrings, so no marker may be a prefix of another.
 */
const WT_A = { name: 'wt-a', marker: 'MARKER-ALPHA', uniqueFile: 'src/only-in-alpha.ts' };
const WT_B = { name: 'wt-nested', marker: 'MARKER-BETA', uniqueFile: 'src/only-in-beta.ts' };

/** A decoded `ToolResponse` — the MCP text content is TOON, not JSON. */
interface DecodedToolResponse {
  success: boolean;
  message: string;
  data?: any;
}

/**
 * One tool call, plus the context the server resolved to serve it.
 *
 * The stderr half is not diagnostics. What a tool *found* and where the tool
 * *ran* are two separate claims, and for a document that lives in the shared
 * root only the first is visible in the response: a server that resolved its
 * workspace to the main checkout — inference off, say — reads exactly the same
 * file. `workspacePath=` is the only place the second claim is observable.
 */
interface WorktreeToolCall {
  response: DecodedToolResponse;
  /** Server stderr, guaranteed to carry the startup resolution lines. */
  stderr: string;
}

/** The last line `logWorkspaceResolution` emits; see `src/index.ts:324`. */
const RESOLUTION_COMPLETE = 'workflowRootPath=';

function requireSpecWorkflowHome(): string {
  const specWorkflowHome = process.env.SPEC_WORKFLOW_HOME;
  if (!specWorkflowHome) {
    // Hard stop rather than a fallback: without the override the spawned
    // servers register temp worktrees in the developer's real global registry,
    // where they are permanently unreapable under path translation. Run this
    // suite with playwright.worktree.config.ts.
    throw new Error('SPEC_WORKFLOW_HOME must be set by playwright.worktree.config.ts');
  }
  return specWorkflowHome;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

/**
 * Drops the `methodology` line from a TOON document.
 *
 * Not a convenience: `toMCPResponse` encodes the whole `ToolResponse` with
 * `@toon-format/toon`, and for both tools called here the `methodology` value is
 * a multi-thousand-character markdown blob that the *same library* re-encodes
 * into a document its own `decode` rejects ("Expected 0 inline array items, but
 * got 1"). Verified against the real response: with this one line removed the
 * document decodes and every other field survives intact.
 *
 * Safe as a line filter because TOON puts each value on one physical line —
 * embedded newlines are `\n` escapes, so no quoted value can span into or hide
 * one of these lines. Nothing in this suite asserts on the methodology.
 */
function stripMethodology(toon: string): string {
  return toon
    .split('\n')
    .filter((line) => !/^\s*methodology:/.test(line))
    .join('\n');
}

/**
 * Calls one MCP tool on a server whose `cwd` is `worktreePath`.
 *
 * The server is spawned exactly the way {@link WorktreeHarness} spawns its own
 * (requirement 7.3: `node <tsx cli> <absolute entry>`, configured path = the
 * main checkout), so the context the tool runs under is the *inferred* one —
 * workspace on the worktree, workflow root on the main checkout. That is the
 * whole point: "a review triggered from worktree A" is not a review told to use
 * worktree A, it is a review whose only input is where the agent was standing.
 *
 * A dedicated short-lived server rather than the harness's long-lived one
 * because the harness's children have no client attached: an MCP tool call
 * needs the `initialize` handshake, and this is the SDK's own client doing it.
 * It registers as a second *instance* of the same project, which changes no
 * project count.
 */
async function callToolFromWorktree(params: {
  worktreePath: string;
  repoPath: string;
  specWorkflowHome: string;
  tool: string;
  args: Record<string, unknown>;
}): Promise<WorktreeToolCall> {
  const serverRoot = process.cwd();
  const tsxCli = join(serverRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  const entryPoint = join(serverRoot, 'src', 'index.ts');

  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }
  env.SPEC_WORKFLOW_HOME = params.specWorkflowHome;
  // Both outrank inference; a developer with either exported would otherwise
  // get a workspace this suite never built.
  delete env.SPEC_WORKFLOW_WORKSPACE;
  delete env.SPEC_WORKFLOW_SHARED_ROOT;

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [tsxCli, entryPoint, params.repoPath],
    cwd: params.worktreePath,
    env,
    stderr: 'pipe'
  });

  const client = new Client({ name: 'worktree-e2e', version: '1.0.0' });
  // Drained, not ignored: an unread pipe fills and blocks the child, and the
  // server's startup resolution lines land here.
  let stderrText = '';
  transport.stderr?.on('data', (chunk: Buffer) => {
    stderrText += chunk.toString();
  });

  await client.connect(transport);
  try {
    // Waited for rather than sampled: the resolution lines and the `initialize`
    // response travel on two different pipes, so "the call returned, therefore
    // stderr has arrived" is an assumption, and one whose failure mode is a
    // silently *unasserted* workspace rather than a red test. This waits for a
    // line every server prints on every arm of `logWorkspaceResolution`, so it
    // cannot itself excuse a wrong workspace.
    const startedAt = Date.now();
    while (!stderrText.includes(RESOLUTION_COMPLETE) && Date.now() - startedAt < 15000) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    if (!stderrText.includes(RESOLUTION_COMPLETE)) {
      throw new Error(
        `The server started from ${params.worktreePath} never logged its workspace resolution.\n${stderrText}`
      );
    }

    const result = await client.callTool({ name: params.tool, arguments: params.args });
    const content = (result.content ?? []) as Array<{ type: string; text?: string }>;
    const text = content.map((part) => part.text ?? '').join('');
    if (!text) {
      throw new Error(
        `Tool "${params.tool}" returned no text content from ${params.worktreePath}.\n${stderrText}`
      );
    }
    try {
      return {
        response: decode(stripMethodology(text)) as unknown as DecodedToolResponse,
        stderr: stderrText
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Could not decode the TOON response of "${params.tool}": ${reason}\n${text}`);
    }
  } finally {
    await client.close();
  }
}

/**
 * One implementation-log markdown file, in the shape
 * `ImplementationLogManager.parseMarkdownContent` reads back.
 *
 * The logged paths stay exactly as passed. They are the input under test in two
 * of the scenarios below, and any normalization here would be this file quietly
 * doing the work the server is being asked to do.
 */
function implementationLogMarkdown(taskId: string, filesModified: string[]): string {
  const logId = `e2e-${taskId}-00000000-0000-4000-8000-000000000000`;
  return [
    `# Implementation Log: Task ${taskId}`,
    '',
    `**Summary:** Seeded by the shared-worktree e2e suite for task ${taskId}.`,
    '',
    `**Timestamp:** ${new Date().toISOString()}`,
    `**Log ID:** ${logId}`,
    '',
    '---',
    '',
    '## Statistics',
    '',
    '- **Lines Added:** +1',
    '- **Lines Removed:** -0',
    `- **Files Changed:** ${filesModified.length}`,
    '- **Net Change:** 1',
    '',
    '## Files Modified',
    ...filesModified.map((file) => `- ${file}`),
    '',
    '## Files Created',
    '_No files created_',
    '',
    '---',
    '',
    '## Artifacts',
    '',
    '_No artifacts recorded_',
    ''
  ].join('\n');
}

/**
 * Seeds `tasks.md` and two implementation logs into the SHARED spec — the one
 * in the main checkout, which both worktrees' servers read.
 *
 * One spec, one task list, one log per task, two workspaces. Everything that
 * differs between the two reviews below therefore comes from the workspace,
 * because nothing else differs at all.
 */
async function seedSharedSpecTasks(repoPath: string): Promise<void> {
  const specDir = join(repoPath, '.spec-workflow', 'specs', SHARED_SPEC_NAME);
  const logsDir = join(specDir, 'Implementation Logs');
  await mkdir(logsDir, { recursive: true });

  await writeFile(
    join(specDir, 'tasks.md'),
    [
      '# Tasks',
      '',
      `- [x] ${ISOLATION_TASK_ID}. Edit the workspace-local service`,
      '  - _Requirements: 7.2_',
      '',
      `- [x] ${BARE_PATH_TASK_ID}. Edit files logged as bare relative paths`,
      '  - _Requirements: 7.2_',
      ''
    ].join('\n'),
    'utf-8'
  );

  await writeFile(
    join(logsDir, `task-${ISOLATION_TASK_ID}_20260731000000_e2e00001.md`),
    implementationLogMarkdown(ISOLATION_TASK_ID, [
      'src/service.ts',
      WT_A.uniqueFile,
      WT_B.uniqueFile
    ]),
    'utf-8'
  );

  await writeFile(
    join(logsDir, `task-${BARE_PATH_TASK_ID}_20260731000000_e2e00002.md`),
    // `app.ts` has no directory component at all and `src/service.ts` has no
    // anchor — neither exists anywhere under the shared workflow root, so the
    // deleted pre-resolution (task 10) would anchor both there and drop both.
    implementationLogMarkdown(BARE_PATH_TASK_ID, ['app.ts', 'src/service.ts']),
    'utf-8'
  );
}

/**
 * Gives one worktree a committed base and then an uncommitted edit to it.
 *
 * The commit is mandatory, not tidiness: `computeTaskDiff` diffs against `HEAD`,
 * so a file that was only ever written produces an *empty* diff and every
 * assertion below would pass or fail for the wrong reason. git's index is
 * per-worktree, so this lands on this worktree's own branch and is invisible to
 * the other one.
 */
async function seedWorktreeCode(
  worktree: HarnessWorktree,
  fixture: { marker: string; uniqueFile: string }
): Promise<void> {
  const base = (label: string) => `export const ${label} = "${worktree.name}";\n`;

  await worktree.writeFile('src/service.ts', base('source'));
  await worktree.writeFile('app.ts', base('app'));
  await worktree.writeFile(fixture.uniqueFile, base('unique'));
  await worktree.commitAll(`Base tree for ${worktree.name}`);

  const edited = (label: string, suffix: string) =>
    `${base(label)}export const ${label}Marker = "${fixture.marker}${suffix}";\n`;

  await worktree.writeFile('src/service.ts', edited('source', '-SERVICE'));
  await worktree.writeFile('app.ts', edited('app', '-APP'));
  await worktree.writeFile(fixture.uniqueFile, edited('unique', '-UNIQUE'));
}

// NOT `describe.serial`. These five scenarios assert five distinct behaviours
// and each has to report its own verdict: under serial mode a failure in one
// marks every later scenario "did not run", so one broken behaviour hides four
// intact ones — the exact collapse this suite was split up to avoid. Ordering is
// not what serial mode was buying: `playwright.worktree.config.ts` sets
// `workers: 1` with `fullyParallel: false`, which already runs them in
// declaration order in one worker.
test.describe('Shared worktree specs', () => {
  test.setTimeout(240000);

  let harness: WorktreeHarness;
  let registeredProjects: RegisteredProject[];
  let specWorkflowHome: string;
  let repoPath: string;

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(240000);

    specWorkflowHome = requireSpecWorkflowHome();
    await resetSpecWorkflowHome(specWorkflowHome);

    harness = new WorktreeHarness({
      serverRoot: process.cwd(),
      dashboardApiBaseUrl: DASHBOARD_API_BASE_URL,
      specWorkflowHome,
      mode: 'shared',
      sharedSpecName: SHARED_SPEC_NAME,
      // Both layouts: `wt-a` beside the main checkout, `wt-nested` under it —
      // the layout in which the shared workflow root contains the worktree.
      worktrees: [
        { name: WT_A.name, layout: 'sibling' },
        { name: WT_B.name, layout: 'nested' }
      ]
    });

    await harness.setup();
    repoPath = harness.getRepoPath();

    // Seeded before the servers start so nothing below races a file watcher.
    await seedSharedSpecTasks(repoPath);
    await seedWorktreeCode(harness.getWorktree(WT_A.name), WT_A);
    await seedWorktreeCode(harness.getWorktree(WT_B.name), WT_B);

    await harness.startMcpServers();
    registeredProjects = await harness.waitForProjects(2, 90000);
  });

  test.afterAll(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  test('infers each worktree as its own workspace over a shared workflow root', async () => {
    for (const worktree of harness.getWorktrees()) {
      // Retained, not the rolling tail: this is startup output, and the
      // dashboard scenarios keep these servers alive and talking long enough to
      // evict it from a MAX_LOG_LINES window.
      const logs = harness.getResolutionLogsFor(worktree.name);
      expect(logs, `inference log for ${worktree.name}`).toContain(
        'Workspace inferred from the working directory.'
      );
      expect(logs).toContain(`workspacePath=${worktree.path}`);
      expect(logs).toContain(`workflowRootPath=${repoPath}`);
    }

    const entries = await harness.readRegistry();
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry.workflowRootPath).toBe(repoPath);
    }
    expect(entries.map((entry) => entry.projectPath).sort())
      .toEqual(harness.getWorktrees().map((worktree) => worktree.path).sort());

    expect(registeredProjects.map((project) => project.projectPath).sort())
      .toEqual(harness.getWorktrees().map((worktree) => worktree.path).sort());
  });

  // Scenario 1: two worktrees register as distinct projects sharing one spec list.
  test('registers two distinct projects that serve the same shared spec list', async () => {
    const projectIds = registeredProjects.map((project) => project.projectId);
    expect(new Set(projectIds).size).toBe(2);

    const specLists: string[][] = [];
    for (const project of registeredProjects) {
      const response = await fetch(
        `${DASHBOARD_API_BASE_URL}/api/projects/${project.projectId}/specs`
      );
      expect(response.ok, `specs request for ${project.projectPath}`).toBe(true);
      const specs = await response.json() as Array<{ name: string }>;
      specLists.push(specs.map((spec) => spec.name).sort());
    }

    // The only `.spec-workflow` in this fixture is in the main checkout, so a
    // project that resolved its workflow root to its own worktree would list
    // nothing at all.
    for (const names of specLists) {
      expect(names).toContain(SHARED_SPEC_NAME);
    }
    expect(specLists[0]).toEqual(specLists[1]);
  });

  // Scenario 2: a review triggered from worktree A diffs A's files, not B's.
  test('diffs the triggering worktree and not the other one', async () => {
    const worktreeA = harness.getWorktree(WT_A.name);
    const worktreeB = harness.getWorktree(WT_B.name);

    const { response: fromA } = await callToolFromWorktree({
      worktreePath: worktreeA.path,
      repoPath,
      specWorkflowHome,
      tool: 'review-task',
      args: { action: 'prepare', specName: SHARED_SPEC_NAME, taskId: ISOLATION_TASK_ID }
    });
    expect(fromA.success, fromA.message).toBe(true);

    const diffA = fromA.data.diff as string;
    // Present: A's own edits, by content and by a path that exists only in A.
    expect(diffA).toContain(`${WT_A.marker}-SERVICE`);
    expect(diffA).toContain(WT_A.uniqueFile);
    // ABSENT, asserted two independent ways. Content: B edited the *same*
    // relative file, `src/service.ts`, with a different marker, so a diff taken
    // against B's tree would carry B's marker. Path: `src/only-in-beta.ts` is
    // logged for this task and exists only in B, so a diff that reached B's
    // tree would name it. Neither may appear.
    expect(diffA).not.toContain(WT_B.marker);
    expect(diffA).not.toContain('only-in-beta');
    expect(fromA.data.diffStats.filesChanged).toBe(2);
    for (const file of fromA.data.filesToReview as Array<{ path: string }>) {
      expect(file.path.startsWith(`${worktreeA.path}/`)).toBe(true);
    }

    // The same spec, the same task, the same log — only the triggering worktree
    // differs. Without this half, a server that resolved *both* workspaces to A
    // would still satisfy everything above.
    const { response: fromB } = await callToolFromWorktree({
      worktreePath: worktreeB.path,
      repoPath,
      specWorkflowHome,
      tool: 'review-task',
      args: { action: 'prepare', specName: SHARED_SPEC_NAME, taskId: ISOLATION_TASK_ID }
    });
    expect(fromB.success, fromB.message).toBe(true);

    const diffB = fromB.data.diff as string;
    expect(diffB).toContain(`${WT_B.marker}-SERVICE`);
    expect(diffB).toContain(WT_B.uniqueFile);
    expect(diffB).not.toContain(WT_A.marker);
    expect(diffB).not.toContain('only-in-alpha');
  });

  // Scenario 3: bare relative logged paths still produce a diff from a worktree.
  test('produces a non-empty diff for logged paths that are bare relative filenames', async () => {
    const worktreeA = harness.getWorktree(WT_A.name);

    const { response: prepared } = await callToolFromWorktree({
      worktreePath: worktreeA.path,
      repoPath,
      specWorkflowHome,
      tool: 'review-task',
      args: { action: 'prepare', specName: SHARED_SPEC_NAME, taskId: BARE_PATH_TASK_ID }
    });
    expect(prepared.success, prepared.message).toBe(true);

    // The regression this guards: pre-resolving logged paths against the
    // workflow root before resolution (deleted in task 10) anchors `app.ts` and
    // `src/service.ts` to the main checkout, where neither exists. Both get
    // dropped, the diff comes back empty, and the reviewing agent is told the
    // changes were already committed.
    const diff = prepared.data.diff as string;
    expect(diff.length).toBeGreaterThan(0);
    expect(diff).toContain('app.ts');
    expect(diff).toContain('src/service.ts');
    expect(prepared.data.diffStats.filesChanged).toBe(2);
    expect(prepared.data.fileResolution.workspaceCount).toBe(2);
    expect(prepared.data.fileResolution.workflowCount).toBe(0);
  });

  // Scenario 4: an adversarial review triggered from a worktree finds its target.
  test('locates the adversarial review target document in the shared root', async () => {
    const worktreeA = harness.getWorktree(WT_A.name);

    const { response: prepared, stderr } = await callToolFromWorktree({
      worktreePath: worktreeA.path,
      repoPath,
      specWorkflowHome,
      tool: 'adversarial-review',
      args: { specName: SHARED_SPEC_NAME, phase: 'requirements' }
    });
    // The failure mode is explicit: `Target file not found: <path>`, which is
    // what a worktree-anchored workflow root produces here.
    expect(prepared.success, prepared.message).toBe(true);

    // Half one, and the half the response cannot show: the review ran with the
    // WORKTREE as its workspace. Everything below is about the shared root, and
    // a server whose workspace had collapsed onto the main checkout — pass
    // `--no-workspace-inference` and it does — reads the very same document and
    // satisfies all of it. Without this the scenario asserts a split it never
    // establishes there was.
    expect(stderr, 'the review must run from the worktree, not the main checkout')
      .toContain('Workspace inferred from the working directory.');
    expect(stderr).toContain(`workspacePath=${worktreeA.path}`);
    expect(stderr).toContain(`workflowRootPath=${repoPath}`);

    const sharedSpecDir = join(repoPath, '.spec-workflow', 'specs', SHARED_SPEC_NAME);
    expect(prepared.data.targetFile).toBe(join(sharedSpecDir, 'requirements.md'));
    expect(prepared.data.promptOutputPath.startsWith(`${sharedSpecDir}/`)).toBe(true);
    expect(await pathExists(prepared.data.promptOutputPath)).toBe(true);

    // The split is the point: the runner would spawn in the worktree, but the
    // document it reads and the scaffold it writes belong to the shared root.
    // Nothing may have been created in the worktree.
    expect(await pathExists(join(worktreeA.path, '.spec-workflow'))).toBe(false);
  });
});

/**
 * How many times the simultaneous start is repeated in scenario 5.
 *
 * **Two, and repetition is no longer what detects a missing lock — the barrier
 * is.** An earlier version of this scenario spawned two servers back to back and
 * repeated the start 25 times, because `spawn` plus tsx startup plus git
 * resolution put the two processes tens of milliseconds apart while the registry
 * read-modify-write is a couple of milliseconds wide: one round in ten caught a
 * deleted `withRegistryLock`, and 25 rounds still missed it a few percent of the
 * time. A test that can go green on a broken implementation is not a guard,
 * however long the odds — and the odds were machine-dependent besides.
 *
 * With every server parked one statement short of `registerProject` and released
 * at a shared instant (see `e2e/helpers/registration-barrier-entry.ts`), all of
 * that startup skew is outside the window. Measured by deleting
 * `withRegistryLock` from `ProjectRegistry.registerProject`: **8 runs out of 8
 * failed, every one of them in round 1** — five on an idle machine and three
 * under `nproc` busy loops. Unmodified, the same scenario passed 6 runs out of 6
 * across both conditions. The second round is margin, not mechanism.
 */
const RACE_ROUNDS = 2;

/** Matches both outcomes of `registerProject` — see requirement 6.4's banner. */
const REGISTRATION_ATTEMPTED = /Project (NOT )?registered/;

/**
 * Waits until every named server has *finished* its registration attempt.
 *
 * Gating on the log rather than on the registry is what makes a lost update fail
 * fast and unambiguously: the line is printed after the server has read its own
 * entry back, so once both have printed, both writes are done. A registry that
 * is still short an entry at that point has lost one — it is not merely slow.
 */
async function waitForRegistrationAttempts(
  harness: WorktreeHarness,
  names: string[],
  timeoutMs = 60000
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (names.every((name) => REGISTRATION_ATTEMPTED.test(harness.getLogsFor(name)))) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `Timed out waiting for ${names.join(', ')} to finish registering.\n${harness.getCapturedLogs()}`
  );
}

/**
 * Scenario 5: agents starting simultaneously all register.
 *
 * **Asserted against the registry file, not the dashboard's project list, and
 * that is a finding rather than a preference.** `ProjectManager`
 * (`src/dashboard/project-manager.ts:74`) points chokidar at the
 * `activeProjects.json` *file*, while `writeRegistry` publishes by renaming a
 * temp file over it — a new inode per write. Two renames a few milliseconds
 * apart deliver a single `change` event, and in a direct test of chokidar 3.6.0
 * with the dashboard's own options the watch then went silent: four further
 * renames spaced 1.5s apart produced no events at all. The first version of this
 * scenario asserted `waitForProjects(2)` and reproduced the consequence — both
 * servers logged `Project registered` with distinct ids while
 * `/api/projects/list` reported one of them for the full 90s timeout.
 *
 * The registry file was correct throughout, so what is unreliable is the
 * dashboard's *view* of closely-spaced registry writes, not the lock. That is a
 * watcher defect and belongs to `worktree-dashboard-concurrency` (requirement
 * 6.6). Requirement 6.2 — "N processes register concurrently ⇒ the registry
 * contains N entries" — is what the lock promises and what this asserts.
 *
 * **The servers are barriered, which is what makes "at the same moment" true.**
 * Each one is spawned through `e2e/helpers/registration-barrier-entry.ts`,
 * completes every part of its startup, parks immediately before
 * `registerProject`, and is released with the others in a single synchronous
 * block. See {@link RACE_ROUNDS} for what that replaced and why.
 */
test.describe('Simultaneous worktree server startup', () => {
  test.setTimeout(240000);

  /**
   * Six contenders, the same number `registry-lock.test.ts` uses for
   * requirement 6.2.
   *
   * Not decoration. Two processes can miss a lost update by simply not
   * overlapping — one finishes its read-modify-write before the other's read —
   * and on a saturated machine that happens. Six have to *all* avoid
   * overlapping, from a common release instant, for a missing lock to go
   * unnoticed. The width of the failure is also its own evidence: with the lock
   * gone the registry does not come back one entry short, it comes back with
   * one.
   */
  const RACE_WORKTREES = [
    'wt-race-one',
    'wt-race-two',
    'wt-race-three',
    'wt-race-four',
    'wt-race-five',
    'wt-race-six'
  ];
  let harness: WorktreeHarness;
  let specWorkflowHome: string;

  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(240000);

    specWorkflowHome = requireSpecWorkflowHome();
    harness = new WorktreeHarness({
      serverRoot: process.cwd(),
      dashboardApiBaseUrl: DASHBOARD_API_BASE_URL,
      specWorkflowHome,
      mode: 'shared',
      sharedSpecName: SHARED_SPEC_NAME,
      worktrees: RACE_WORKTREES.map((name) => ({ name, layout: 'sibling' as const })),
      registrationBarrier: true
    });

    await harness.setup();
  });

  test.afterAll(async () => {
    if (harness) {
      await harness.cleanup();
    }
  });

  test('registers every server when they start at the same moment', async () => {
    const expectedPaths = harness.getWorktrees().map((worktree) => worktree.path).sort();

    for (let round = 1; round <= RACE_ROUNDS; round++) {
      // `stopMcpServer` awaits the child's exit, and the server unregisters
      // before exiting — so the previous round's writes are all done before the
      // registry is emptied and nothing from it can land mid-round.
      for (const name of RACE_WORKTREES) {
        await harness.stopMcpServer(name);
      }
      await resetSpecWorkflowHome(specWorkflowHome);

      // `startMcpServers()` is deliberately not used: it awaits each server's
      // registration before spawning the next, which is exactly the
      // serialization this scenario exists to avoid.
      for (const name of RACE_WORKTREES) {
        harness.startMcpServer(name);
      }

      // Spawn order and startup cost are now irrelevant: both servers do all of
      // their work first and wait, and only then are they let into the critical
      // section together. This is the whole difference between a race that is
      // simultaneous by construction and one that is simultaneous on average.
      await harness.waitForRegistrationBarrier(RACE_WORKTREES);
      harness.releaseRegistrationBarrier(RACE_WORKTREES);

      await waitForRegistrationAttempts(harness, RACE_WORKTREES);

      // The registry file, which is what the lock actually protects.
      // Registration is a read-modify-write of one JSON file: without the lock
      // both processes read a registry without the other, and the second write
      // erases the first entry permanently (requirement 6.2).
      const entries = await harness.readRegistry();
      expect(entries.map((entry) => entry.projectPath).sort(), `round ${round}`)
        .toEqual(expectedPaths);
      expect(new Set(entries.map((entry) => entry.projectId)).size, `round ${round}`)
        .toBe(RACE_WORKTREES.length);

      // A server that could not take the lock continues UNREGISTERED rather
      // than aborting (requirement 6.4), so the warning is a distinct failure
      // from a lost update and worth naming.
      for (const name of RACE_WORKTREES) {
        expect(harness.getLogsFor(name), `round ${round}`).not.toContain(
          'could not acquire the registry lock'
        );
      }
    }
  });
});
