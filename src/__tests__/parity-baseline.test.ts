/**
 * Parity characterization baseline — requirements 3.11 and 7.8.
 *
 * R3 AC 11: when `workspacePath` and `projectPath` are equal, the files diffed,
 * the files typechecked, the containment decisions and the `tsconfigPath` string
 * must each be identical to pre-change behaviour. R7 AC 8 requires each named
 * observable to be asserted individually, for a **non-worktree** project with
 * **no path argument**, and requires the assertions to be written as a
 * characterization test capturing today's values *before* any behaviour change
 * lands. Written afterwards they could only record what the code then does, and
 * would be no guard at all for the single-checkout population.
 *
 * ┌─ HOW TO READ A FAILURE OF THIS SUITE ─────────────────────────────────────┐
 * │ Every assertion here was captured against the unmodified tree. With one   │
 * │ named exception (see "projectId — symlinked configured path" below), a    │
 * │ failure means the single-checkout population's behaviour moved. That is a │
 * │ regression, not a stale expectation. Do not update the expected value.    │
 * └───────────────────────────────────────────────────────────────────────────┘
 *
 * Observables asserted individually, so a failure names what moved:
 *   1. resolved workspace root (repository root, and from a subdirectory)
 *   2. resolved workflow root, and its equality with the workspace root
 *   3. containment decisions (accepted, rejected-outside, missing, deduped,
 *      `.spec-workflow` accepted)
 *   4. the file set reaching the diff, and the root the diff runs against
 *   5. the file set reaching the typecheck, and the root(s) it is given
 *   6. `tsconfigPath`
 *   7. `projectId`, and the path stored beside it
 *
 * Deliberately NOT asserted: the diff text, the typecheck `reason`, warning
 * strings, and the labelled shape of `filesToReview` — all of those are
 * scheduled to change by design, and pinning them would produce false failures.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { promises as fs, statSync } from 'fs';
import { isAbsolute, join, resolve } from 'path';

/**
 * Records the arguments the orchestrator hands to the diff and the typecheck,
 * then delegates to the real implementation. This is the only way to observe
 * "the file set reaching the diff / the typecheck" — the prepare response
 * reports results, not inputs.
 */
const recorder = vi.hoisted(() => ({
  typecheckCalls: [] as unknown[][],
  diffCalls: [] as unknown[][],
}));

vi.mock('../core/typecheck.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/typecheck.js')>();
  return {
    ...actual,
    runProjectTypecheck: (...args: any[]) => {
      recorder.typecheckCalls.push(args);
      return (actual.runProjectTypecheck as any)(...args);
    },
  };
});

vi.mock('../core/task-diff.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../core/task-diff.js')>();
  return {
    ...actual,
    computeTaskDiff: (...args: any[]) => {
      recorder.diffCalls.push(args);
      return (actual.computeTaskDiff as any)(...args);
    },
  };
});

import { parseArguments } from '../index.js';
import { ProjectRegistry, generateProjectId } from '../core/project-registry.js';
import { reviewTaskHandler } from '../tools/review-task.js';
import { ImplementationLogManager } from '../dashboard/implementation-log-manager.js';
import { ToolContext } from '../types.js';
import { GitFixture, cleanupAllGitFixtures, GitRepoFixture } from '../core/__tests__/helpers/git-fixture.js';

const SPEC_NAME = 'parity-spec';
const PARITY_PID = 987654;

/**
 * A literal id, computed once against the unmodified tree, for a path that is a
 * compile-time constant. The fixture's repository path is a fresh temp
 * directory, so no literal can be written for it — asserting its registered id
 * against `generateProjectId` alone moves both sides together the moment the id
 * format changes, and nothing else in this file pins the format. This pair does.
 *
 * The path is constant, absolute and traverses no symlink (it does not exist),
 * so task 15's realpath normalization has nothing to normalize: its
 * deterministic fallback yields this same string and this same id. Task 15 is
 * not permitted to edit this line.
 *
 * It is a POSIX spelling, so `registerProject`'s `resolve()` rewrites it on
 * win32 (`C:\parity\...`) and the id would differ there. The test is
 * `skipIf(win32)`, the same way the symlink case below is.
 */
const LITERAL_ID_PATH = '/parity/baseline/fixed-root';
const LITERAL_ID = 'cFmw1GUH3mY-DZY5';

let fixture: GitFixture;
let repo: GitRepoFixture;
let outsideFile: string;
let specPath: string;
let globalDir: string;
let warnSpy: ReturnType<typeof vi.spyOn>;

const savedEnv: Record<string, string | undefined> = {};

/**
 * A root argument is an absolute path string that does not name an existing
 * file.
 *
 * `runProjectTypecheck` gains a required second root parameter (R4 AC 5), so a
 * positional recorder would silently start reading the file list out of the
 * wrong slot — hence a predicate rather than an index. But "any string" is too
 * loose in the other direction: a non-root string added alongside that second
 * root (task 11's per-workspace cache key, a label, a mode) would be collected
 * as a root and fail this suite for a *shape* change rather than a behaviour
 * change.
 *
 * "Is this a root argument?" and "is this a directory that exists?" are
 * different questions, and only the first belongs here. A root is always
 * spelled as an absolute path; a cache key, a label or a mode is not. That is
 * the discriminator. Existence deliberately is NOT: a root that has stopped
 * existing — a deleted worktree, an unresolved second root at task 10 or 11 —
 * is exactly the regression this net exists to catch, so a nonexistent
 * absolute path is still collected and still compared against the one expected
 * root. The single existence question asked is the narrow one that can only
 * rule a string OUT: an absolute path naming an existing *file* is not a root.
 *
 * It stays strict where it matters: a root that moved to a different directory
 * — a subdirectory, the raw configured path, a link spelling — is still
 * collected here and still compared against the one expected root.
 */
function rootArgs(args: unknown[]): string[] {
  return args.filter((a): a is string => typeof a === 'string' && isRootArgument(a));
}

function isRootArgument(value: string): boolean {
  if (!isAbsolute(value)) return false;
  try {
    return !statSync(value).isFile();
  } catch {
    // Absolute and not resolvable: still a root argument, and comparing it
    // against the expected root is the whole point.
    return true;
  }
}

function fileArg(args: unknown[]): string[] {
  const found = args.find((a) => Array.isArray(a));
  return (found as string[] | undefined) ?? [];
}

/**
 * `filesToReview` changes from `string[]` to a labelled
 * `{ path, root, ambiguous }[]` (R4 AC 18 / design §4). That is a shape change,
 * not a decision change — normalizing to paths here keeps this suite asserting
 * the containment decisions across it rather than failing on the shape.
 */
function toPaths(filesToReview: unknown): string[] {
  if (!Array.isArray(filesToReview)) return [];
  return filesToReview.map((entry) =>
    typeof entry === 'string' ? entry : (entry as { path: string }).path
  );
}

async function withCwd<T>(dir: string, fn: () => T | Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

function makeContext(projectPath: string): ToolContext {
  // Task 6 makes `ToolContext.workspacePath` required and updates every
  // construction site including this one. That is a compile-driven addition
  // (the value is this same path — the roots are equal here), not a change to
  // anything asserted below.
  return { projectPath };
}

beforeAll(async () => {
  for (const key of ['SPEC_WORKFLOW_HOME', 'SPEC_WORKFLOW_SHARED_ROOT', 'SPEC_WORKFLOW_WORKSPACE']) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

  // Assign before building so a mid-construction throw is still torn down.
  fixture = await GitFixture.create('specwf-parity-');
  globalDir = join(fixture.root, 'global-dir');
  process.env.SPEC_WORKFLOW_HOME = globalDir;

  // A plain repository — no linked worktree. This is the single-checkout
  // population R3 AC 11 protects. `GitFixture.create` realpath-normalizes its
  // temp root, so `resolve(path) === realpath(path)` for everything under it;
  // that is what keeps the `projectId` assertion below stable across task 15.
  repo = await fixture.createRepo('parity-main');
  await repo.writeFile('src/kept.ts', 'export const kept = 1;\n');
  await repo.writeFile('src/nested/deep.ts', 'export const deep = 2;\n');
  await repo.commitAll('Add sources');

  const outsideDir = await fixture.createNonGitDirectory('outside-the-repo');
  outsideFile = join(outsideDir, 'stranger.ts');
  await fs.writeFile(outsideFile, 'export const stranger = 3;\n', 'utf-8');

  specPath = join(repo.path, '.spec-workflow', 'specs', SPEC_NAME);
  await fs.mkdir(specPath, { recursive: true });
  await fs.writeFile(join(specPath, 'tasks.md'), [
    '# Tasks',
    '',
    '- [x] 1. Ordinary source files',
    '  _Requirements: 3.11_',
    '',
    '- [x] 2. A .spec-workflow file',
    '  _Requirements: 3.11_',
    '',
  ].join('\n'), 'utf-8');
  await fs.writeFile(join(specPath, 'notes.md'), 'notes\n', 'utf-8');

  const logManager = new ImplementationLogManager(specPath);
  await logManager.addLogEntry({
    taskId: '1',
    timestamp: new Date().toISOString(),
    summary: 'Ordinary source files, one missing entry, one outside entry, one duplicate spelling',
    // Two spellings of one file: the `new Set` at review-task.ts:360 dedupes
    // raw strings, so both survive it and only the path-level dedupe collapses
    // them (R4 AC 11).
    filesModified: ['src/kept.ts', './src/kept.ts'],
    filesCreated: ['src/nested/deep.ts', 'src/never-written.ts', outsideFile],
    statistics: { linesAdded: 2, linesRemoved: 0, filesChanged: 2 },
    artifacts: {},
  });
  await logManager.addLogEntry({
    taskId: '2',
    timestamp: new Date().toISOString(),
    summary: 'A file under .spec-workflow',
    filesModified: [`.spec-workflow/specs/${SPEC_NAME}/notes.md`],
    filesCreated: [],
    statistics: { linesAdded: 1, linesRemoved: 0, filesChanged: 1 },
    artifacts: {},
  });
});

afterAll(async () => {
  warnSpy?.mockRestore();
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  // Explicit teardown: vitest's worker pool never emits the process `exit`
  // event, so the fixture's exit hook does not fire here (deferral d-2124a571).
  await fixture?.cleanup();
});

afterAll(cleanupAllGitFixtures);

describe('parity baseline — resolved roots (no path argument, non-worktree)', () => {
  it('resolves the workspace root to the repository top-level from the repository root', async () => {
    const parsed = await withCwd(repo.path, () => parseArguments([]));
    expect(parsed.workspacePath).toBe(repo.path);
  });

  it('resolves the workspace root to the repository top-level from a subdirectory', async () => {
    // R1 AC 2 pins `resolveGitWorkspaceRoot`'s toplevel result as the fallback.
    // Returning the raw configured path (here, the cwd) instead would move
    // `projectId` and narrow containment to a subdirectory for every
    // single-checkout user. This assertion is the guard for that.
    const subdir = join(repo.path, 'src', 'nested');
    const parsed = await withCwd(subdir, () => parseArguments([]));
    expect(parsed.workspacePath).toBe(repo.path);
    expect(parsed.workspacePath).not.toBe(subdir);
  });

  it('resolves the workflow root to the repository top-level', async () => {
    const parsed = await withCwd(repo.path, () => parseArguments([]));
    expect(parsed.workflowRootPath).toBe(repo.path);
  });

  it('resolves the two roots equal, which is R3 AC 11\'s precondition', async () => {
    const parsed = await withCwd(join(repo.path, 'src'), () => parseArguments([]));
    expect(parsed.workflowRootPath).toBe(parsed.workspacePath);
  });
});

describe('parity baseline — containment decisions', () => {
  let filesToReview: string[];

  beforeAll(async () => {
    const result = await reviewTaskHandler(
      { action: 'prepare', specName: SPEC_NAME, taskId: '1' },
      makeContext(repo.path)
    );
    expect(result.success).toBe(true);
    filesToReview = toPaths(result.data.filesToReview);
  });

  it('accepts the full set and nothing else, in order', () => {
    expect(filesToReview).toEqual([
      join(repo.path, 'src', 'kept.ts'),
      join(repo.path, 'src', 'nested', 'deep.ts'),
    ]);
  });

  it('accepts a file at the repository root level', () => {
    expect(filesToReview).toContain(join(repo.path, 'src', 'kept.ts'));
  });

  it('accepts a file nested below the repository root', () => {
    expect(filesToReview).toContain(join(repo.path, 'src', 'nested', 'deep.ts'));
  });

  it('rejects an absolute path outside the root', () => {
    expect(filesToReview).not.toContain(outsideFile);
  });

  it('drops a logged entry whose file does not exist', () => {
    expect(filesToReview).not.toContain(join(repo.path, 'src', 'never-written.ts'));
  });

  it('collapses two spellings of one file to a single entry', () => {
    const kept = join(repo.path, 'src', 'kept.ts');
    expect(filesToReview.filter((p) => p === kept)).toHaveLength(1);
  });

  // A `.spec-workflow` entry is accepted today, and — the roots being equal —
  // R3 AC 11 requires it to keep reaching the diff and the typecheck too, not
  // merely the reviewer-facing list. Task 10 routes `workspaceFiles` to both;
  // in the two-root case a `.spec-workflow` path belongs to the workflow root
  // and drops out of them, but here it resolves under the workspace and must
  // not. Asserting only `filesToReview` would let that drop pass unnoticed, so
  // each of the three observables is asserted on its own.
  describe('a file under .spec-workflow', () => {
    let specWorkflowFiles: string[];
    let diffCall: unknown[];
    let typecheckCall: unknown[];

    beforeAll(async () => {
      recorder.diffCalls.length = 0;
      recorder.typecheckCalls.length = 0;

      const result = await reviewTaskHandler(
        { action: 'prepare', specName: SPEC_NAME, taskId: '2' },
        makeContext(repo.path)
      );
      expect(result.success).toBe(true);
      specWorkflowFiles = toPaths(result.data.filesToReview);

      expect(recorder.diffCalls).toHaveLength(1);
      expect(recorder.typecheckCalls).toHaveLength(1);
      diffCall = recorder.diffCalls[0];
      typecheckCall = recorder.typecheckCalls[0];
    });

    it('is accepted into filesToReview', () => {
      expect(specWorkflowFiles).toEqual([join(specPath, 'notes.md')]);
    });

    it('reaches the diff, which still runs against the repository root', () => {
      expect(fileArg(diffCall)).toEqual([join(specPath, 'notes.md')]);
      expect(rootArgs(diffCall)).toEqual([repo.path]);
    });

    it('reaches the typecheck, which still gets the repository root', () => {
      expect(fileArg(typecheckCall)).toEqual([join(specPath, 'notes.md')]);
      const roots = rootArgs(typecheckCall);
      expect(roots.length).toBeGreaterThan(0);
      for (const root of roots) {
        expect(root).toBe(repo.path);
      }
    });
  });
});

describe('parity baseline — the file sets reaching the diff and the typecheck', () => {
  let diffCall: unknown[];
  let typecheckCall: unknown[];
  let tsconfigPath: unknown;

  beforeAll(async () => {
    recorder.diffCalls.length = 0;
    recorder.typecheckCalls.length = 0;

    const result = await reviewTaskHandler(
      { action: 'prepare', specName: SPEC_NAME, taskId: '1' },
      makeContext(repo.path)
    );
    expect(result.success).toBe(true);

    expect(recorder.diffCalls).toHaveLength(1);
    expect(recorder.typecheckCalls).toHaveLength(1);
    diffCall = recorder.diffCalls[0];
    typecheckCall = recorder.typecheckCalls[0];
    tsconfigPath = result.data.typecheckResults?.[0]?.tsconfigPath;
  });

  const expectedFiles = () => [
    join(repo.path, 'src', 'kept.ts'),
    join(repo.path, 'src', 'nested', 'deep.ts'),
  ];

  it('hands the diff exactly the accepted file set', () => {
    expect(fileArg(diffCall)).toEqual(expectedFiles());
  });

  it('runs the diff against the repository root', () => {
    expect(rootArgs(diffCall)).toEqual([repo.path]);
  });

  it('hands the typecheck exactly the accepted file set', () => {
    expect(fileArg(typecheckCall)).toEqual(expectedFiles());
  });

  it('gives the typecheck the repository root for every root it takes', () => {
    const roots = rootArgs(typecheckCall);
    expect(roots.length).toBeGreaterThan(0);
    for (const root of roots) {
      expect(root).toBe(repo.path);
    }
  });

  it('reports tsconfigPath as tsconfig.json directly under the repository root', () => {
    expect(tsconfigPath).toBe(join(repo.path, 'tsconfig.json'));
  });
});

describe('parity baseline — projectId and the path stored beside it', () => {
  it('uses a repository path that is explicitly not reached through a symlink', async () => {
    // The premise of the next two assertions. If the fixture ever stops
    // realpath-normalizing its temp root, `resolve` and `realpath` diverge and
    // those assertions would move at task 15 — which they must not.
    expect(await fs.realpath(repo.path)).toBe(repo.path);
    expect(resolve(repo.path)).toBe(repo.path);
  });

  it.skipIf(process.platform === 'win32')(
    'registers a non-symlinked path under the literal id today produces',
    async () => {
      // The literal pin. A constant path, so the expected value is a constant
      // too: if either the id format or `registerProject`'s use of it moves,
      // this fails with a hard-coded expectation that cannot have moved with it.
      const registry = new ProjectRegistry();
      const projectId = await registry.registerProject(LITERAL_ID_PATH, PARITY_PID, {
        workflowRootPath: LITERAL_ID_PATH,
      });

      expect(projectId).toBe(LITERAL_ID);
      await registry.unregisterProjectById(projectId);
    }
  );

  it('registers the repository root under the id of that exact absolute path', async () => {
    // Structural, and complementary to the literal above: this one says the
    // registered id is the id of the *resolved workspace path* rather than of
    // some other spelling, which a constant path cannot show. The temp root is
    // realpath-normalized, so `resolve(p) === realpath(p)` here and task 15's
    // realpath normalization cannot move this value either.
    const registry = new ProjectRegistry();
    const parsed = await withCwd(repo.path, () => parseArguments([]));
    const projectId = await registry.registerProject(parsed.workspacePath, PARITY_PID, {
      workflowRootPath: parsed.workflowRootPath,
    });

    expect(projectId).toBe(generateProjectId(repo.path));
    await registry.unregisterProjectById(projectId);
  });

  it('stores the workspace path in the same spelling the id was computed from', async () => {
    const registry = new ProjectRegistry();
    const projectId = await registry.registerProject(repo.path, PARITY_PID, {
      workflowRootPath: repo.path,
    });

    const entry = await registry.getProjectById(projectId);
    expect(entry?.projectPath).toBe(repo.path);
    expect(entry?.workflowRootPath).toBe(repo.path);
    await registry.unregisterProjectById(projectId);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // THE ONE TEST IN THIS FILE WHOSE EXPECTATIONS ARE ALLOWED TO MOVE.
  //
  // Today `registerProject` derives BOTH the identity and the stored path from
  // a single `resolve()` of the configured path (project-registry.ts:190-216),
  // so a path that traverses a symlink registers under the id of the *link*
  // spelling AND stores that same link spelling beside it. R1 AC 10 makes the
  // id realpath-normalized; R1 AC 11 requires the path stored beside it to be
  // normalized identically. Both come from the one variable, so task 15 moves
  // both. Migration records this as an intentional identifier move.
  //
  // TASK 15 IS THE ONLY TASK PERMITTED TO UPDATE THIS TEST. Exactly two
  // assertions in the body below are permitted to move, and only these two:
  //
  //   1. `expect(projectId).not.toBe(generateProjectId(repo.path))`
  //      becomes a `toBe`. Once identity is realpath-normalized the link and
  //      the physical spelling are one identity — that is R1 AC 10 itself.
  //
  //   2. `expect(entry?.projectPath).toBe(resolve(linkPath))`
  //      becomes the physical spelling — `await fs.realpath(linkPath)`, which
  //      equals `repo.path` here. This is not a separate decision: the stored
  //      path comes off the same `resolve()` as the id, so if the id moved and
  //      this line did NOT go red, R1 AC 11 was not implemented.
  //
  // The test's title moves with them; the id is no longer "the link spelling".
  //
  // OFF LIMITS to task 15, and a regression if red:
  //
  //   - `expect(projectId).toBe(generateProjectId(linkPath))`, the first
  //     assertion in the body. Task 15 puts `normalizeIdentityPath` INSIDE
  //     `generateProjectId`, so both sides of this comparison normalize
  //     together and it stays green. Red here means the normalization went to
  //     the call site instead of inside the function — a task-15 defect, not a
  //     permitted move.
  //   - `LITERAL_ID` / `LITERAL_ID_PATH`. That path is a constant that does not
  //     exist, so AC 12's deterministic fallback yields the same string and the
  //     same id. The pin does not move.
  //   - Every other test in this file, including the three non-symlink registry
  //     tests above: the fixture's temp root is already realpath-normalized, so
  //     normalization is a no-op for them.
  //
  // The two permitted expectations are deliberately left un-pinned to literals
  // so the move stays visible as an edit to those lines rather than hiding
  // inside a constant. Any task other than 15 that finds this test failing has
  // found a regression.
  // ───────────────────────────────────────────────────────────────────────────
  it.skipIf(process.platform === 'win32')(
    'registers a symlinked configured path under the id of the link spelling',
    async () => {
      const linkPath = await fixture.createSymlink(repo.path, 'parity-main-link');
      const registry = new ProjectRegistry();
      const projectId = await registry.registerProject(linkPath, PARITY_PID, {
        workflowRootPath: linkPath,
      });

      expect(projectId).toBe(generateProjectId(linkPath));
      expect(projectId).not.toBe(generateProjectId(repo.path));

      const entry = await registry.getProjectById(projectId);
      expect(entry?.projectPath).toBe(resolve(linkPath));
      await registry.unregisterProjectById(projectId);
    }
  );
});
