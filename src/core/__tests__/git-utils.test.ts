import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import * as gitUtils from '../git-utils.js';
import {
  resolveGitRoot,
  resolveGitWorkspaceRoot,
  isGitWorktree,
  gitCommonDirAbsolute,
  gitTopLevel,
  sameRepository,
  normalizeIdentityPath,
  resolveWorkspaceRoots,
  scrubbedGitEnv,
  SPEC_WORKFLOW_SHARED_ROOT_ENV
} from '../git-utils.js';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn()
}));

const mockedExecSync = vi.mocked(execSync);

describe('resolveGitRoot', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV];
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('explicit env var override', () => {
    it('should use SPEC_WORKFLOW_SHARED_ROOT when set', () => {
      process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV] = '/custom/root';

      const result = resolveGitRoot('/some/project');

      expect(result).toBe('/custom/root');
      expect(mockedExecSync).not.toHaveBeenCalled();
    });

    it('should trim whitespace from env var', () => {
      process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV] = '  /custom/root  ';

      const result = resolveGitRoot('/some/project');

      expect(result).toBe('/custom/root');
    });

    it('should resolve a relative env var to an absolute path', () => {
      // Requirement 2.9: returned verbatim, every `.spec-workflow` path derived
      // from it resolves against the process working directory instead.
      process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV] = 'relative/shared/root';

      const result = resolveGitRoot('/some/project');

      expect(result).toBe(resolve('relative/shared/root'));
      expect(mockedExecSync).not.toHaveBeenCalled();
    });

    it('should ignore empty env var', () => {
      process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV] = '';
      mockedExecSync.mockReturnValue('.git');

      const result = resolveGitRoot('/some/project');

      expect(result).toBe('/some/project');
      expect(mockedExecSync).toHaveBeenCalled();
    });

    it('should ignore whitespace-only env var', () => {
      process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV] = '   ';
      mockedExecSync.mockReturnValue('.git');

      const result = resolveGitRoot('/some/project');

      expect(result).toBe('/some/project');
      expect(mockedExecSync).toHaveBeenCalled();
    });
  });

  describe('main git repository', () => {
    it('should return original path when in main repo', () => {
      mockedExecSync.mockReturnValue('.git');

      const result = resolveGitRoot('/main/repo');

      expect(result).toBe('/main/repo');
    });

    it('should return original path when git returns ".git" with newline', () => {
      mockedExecSync.mockReturnValue('.git\n');

      const result = resolveGitRoot('/main/repo');

      expect(result).toBe('/main/repo');
    });
  });

  describe('git worktree', () => {
    it('should return main repo path when in worktree (Unix-style path)', () => {
      mockedExecSync.mockReturnValue('/home/user/main-repo/.git');

      const result = resolveGitRoot('/home/user/worktree');

      expect(result).toBe('/home/user/main-repo');
    });

    it('should return main repo path when git returns worktree subfolder', () => {
      mockedExecSync.mockReturnValue('/home/user/main-repo/.git/worktrees/feature-branch');

      const result = resolveGitRoot('/home/user/worktree');

      expect(result).toBe('/home/user/main-repo');
    });

    it('should handle Windows-style paths', () => {
      mockedExecSync.mockReturnValue('C:/Users/dev/main-repo/.git');

      const result = resolveGitRoot('C:/Users/dev/worktree');

      expect(result).toBe('C:/Users/dev/main-repo');
    });
  });

  describe('subdirectory with relative path', () => {
    it('should resolve relative path when git returns relative .git path', () => {
      // When running from a subdirectory, git returns relative paths like "../../.git"
      mockedExecSync.mockReturnValue('../../.git');

      const result = resolveGitRoot('/home/user/repo/src/core');

      // Should resolve to the main repo path, not return "../.." which would fail path traversal check
      expect(result).toBe('/home/user/repo');
    });

    it('should resolve deeply nested relative path', () => {
      mockedExecSync.mockReturnValue('../../../.git');

      const result = resolveGitRoot('/home/user/repo/src/lib/utils');

      expect(result).toBe('/home/user/repo');
    });

    it('should resolve single level relative path', () => {
      mockedExecSync.mockReturnValue('../.git');

      const result = resolveGitRoot('/home/user/repo/src');

      expect(result).toBe('/home/user/repo');
    });
  });

  describe('error handling', () => {
    it('should return original path when git command fails', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('not a git repository');
      });

      const result = resolveGitRoot('/not/a/git/repo');

      expect(result).toBe('/not/a/git/repo');
    });

    it('should return original path when git is not installed', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('git: command not found');
      });

      const result = resolveGitRoot('/some/path');

      expect(result).toBe('/some/path');
    });

    it('should return original path on timeout', () => {
      mockedExecSync.mockImplementation(() => {
        const error = new Error('timeout');
        (error as any).killed = true;
        throw error;
      });

      const result = resolveGitRoot('/some/path');

      expect(result).toBe('/some/path');
    });
  });

  describe('execSync configuration', () => {
    it('should call git with correct options', () => {
      mockedExecSync.mockReturnValue('.git');

      resolveGitRoot('/test/path');

      expect(mockedExecSync).toHaveBeenCalledWith(
        'git rev-parse --git-common-dir',
        expect.objectContaining({
          cwd: '/test/path',
          encoding: 'utf-8',
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 5000
        })
      );
    });
  });
});

describe('resolveGitWorkspaceRoot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return workspace root from git when available', () => {
    mockedExecSync.mockReturnValue('/home/user/repo\n');

    const result = resolveGitWorkspaceRoot('/home/user/repo/src/components');

    expect(result).toBe('/home/user/repo');
    expect(mockedExecSync).toHaveBeenCalledWith(
      'git rev-parse --show-toplevel',
      expect.objectContaining({
        cwd: '/home/user/repo/src/components',
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      })
    );
  });

  it('should return original path when git fails', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('not a git repository');
    });

    const result = resolveGitWorkspaceRoot('/not/a/repo');

    expect(result).toBe('/not/a/repo');
  });
});

describe('isGitWorktree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return false when in main repo', () => {
    mockedExecSync.mockReturnValue('.git');

    expect(isGitWorktree('/main/repo')).toBe(false);
  });

  it('should return true when in worktree', () => {
    mockedExecSync.mockReturnValue('/home/user/main-repo/.git');

    expect(isGitWorktree('/home/user/worktree')).toBe(true);
  });

  it('should return false when not a git repo', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('not a git repository');
    });

    expect(isGitWorktree('/not/a/repo')).toBe(false);
  });

  it('should return false when git is not available', () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('git: command not found');
    });

    expect(isGitWorktree('/some/path')).toBe(false);
  });
});

describe('git environment scrubbing (requirement 1.9)', () => {
  const SCRUBBED = ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE'];
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[SPEC_WORKFLOW_SHARED_ROOT_ENV];
    for (const name of SCRUBBED) {
      process.env[name] = `/exported/${name}`;
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function envOfCall(index: number): NodeJS.ProcessEnv {
    const call = mockedExecSync.mock.calls[index];
    const env = (call?.[1] as { env?: NodeJS.ProcessEnv } | undefined)?.env;
    expect(env, `git invocation #${index} ran without an explicit environment`).toBeDefined();
    return env!;
  }

  function envOfLastCall(): NodeJS.ProcessEnv {
    expect(mockedExecSync.mock.calls.length, 'expected a git invocation').toBeGreaterThan(0);
    return envOfCall(mockedExecSync.mock.calls.length - 1);
  }

  // Every recorded invocation, not just the last: a function that runs git more
  // than once (`sameRepository`) or that grows a second call site later must
  // have *each* of them scrubbed.
  function envOfEveryCall(): NodeJS.ProcessEnv[] {
    expect(
      mockedExecSync.mock.calls.length,
      'expected at least one git invocation'
    ).toBeGreaterThan(0);
    return mockedExecSync.mock.calls.map((_call, index) => envOfCall(index));
  }

  // Every exported function in the module that invokes git. `isGitWorktree` has
  // no production caller today; it is listed because the moment one is added an
  // unscrubbed call site would be live.
  const gitInvokingFunctions: Array<[name: string, invoke: () => unknown]> = [
    ['resolveGitRoot', () => resolveGitRoot('/test/path')],
    ['resolveGitWorkspaceRoot', () => resolveGitWorkspaceRoot('/test/path')],
    ['isGitWorktree', () => isGitWorktree('/test/path')],
    ['gitCommonDirAbsolute', () => gitCommonDirAbsolute('/test/path')],
    ['gitTopLevel', () => gitTopLevel('/test/path')],
    ['sameRepository', () => sameRepository('/test/a', '/test/b')],
    ['resolveWorkspaceRoots', () => resolveWorkspaceRoots({
      configuredPath: '/test/path',
      cwd: '/test/cwd',
      dashboardMode: false,
      noInference: false,
      noSharedWorktreeSpecs: false
    })]
  ];

  // Every exported function that does *not* invoke git. Each entry is invoked
  // below and asserted to run no command at all, so this list is not an
  // unverified escape hatch: putting a git-invoking export here fails outright
  // rather than quietly exempting it from the scrubbing assertions.
  const nonGitExports: Array<[name: string, invoke: () => unknown]> = [
    ['normalizeIdentityPath', () => normalizeIdentityPath('/test/path')],
    // Builds the scrubbed environment for callers that run git themselves —
    // `runGit` in task-diff.ts and both dashboard agent spawns (requirement
    // 2.12). It runs no command of its own.
    ['scrubbedGitEnv', () => scrubbedGitEnv()]
  ];

  for (const [name, invoke] of gitInvokingFunctions) {
    it(`${name} removes the four GIT_* variables from every git invocation`, () => {
      mockedExecSync.mockReturnValue('/test/path');

      invoke();

      for (const env of envOfEveryCall()) {
        for (const variable of SCRUBBED) {
          expect(env[variable], `${name} leaked ${variable}`).toBeUndefined();
        }
      }
    });

    it(`${name} preserves the rest of the environment`, () => {
      mockedExecSync.mockReturnValue('/test/path');
      process.env.SPEC_WORKFLOW_SCRUB_PROBE = 'kept';

      invoke();

      for (const env of envOfEveryCall()) {
        expect(env.SPEC_WORKFLOW_SCRUB_PROBE).toBe('kept');
        expect(env.PATH).toBe(process.env.PATH);
      }
    });
  }

  for (const [name, invoke] of nonGitExports) {
    it(`${name} invokes no command, so exempting it from scrubbing is sound`, () => {
      invoke();

      expect(
        mockedExecSync,
        `${name} is listed as non-git but ran a command; move it to gitInvokingFunctions`
      ).not.toHaveBeenCalled();
    });
  }

  it('rebuilds the environment per call, so a variable exported later is still scrubbed', () => {
    delete process.env.GIT_DIR;
    mockedExecSync.mockReturnValue('.git');
    resolveGitRoot('/test/path');
    expect(envOfLastCall().GIT_DIR).toBeUndefined();

    process.env.GIT_DIR = '/exported/later';
    resolveGitRoot('/test/path');

    expect(envOfLastCall().GIT_DIR).toBeUndefined();
  });

  // The assertions above are the real guard: they observe the environment
  // actually handed to git, so they catch a call site that skips the helper, one
  // that re-inherits `process.env` after spreading it, and one that scrubs only
  // some of the variables. They are complete only while the two premises below
  // hold, and each has its own test.
  //
  // Premise 1: every git invocation goes through `execSync`, the only
  // `child_process` API `vi.mock` replaces here. A call made with `spawnSync` or
  // `execFileSync` would reach the real git and be invisible to the mock.
  //
  // Both checks below are textual scans of the module source, and each covers
  // the other's hole: the call-shape scan misses `import { spawnSync as run }`
  // because the call site reads `run(...)`, and the import scan misses
  // `import * as cp` because no API name appears in the import. What neither
  // sees is a binding obtained inside a function body — `const { spawnSync: run
  // } = require('child_process')`, or `await import(...)` — which is the honest
  // limit of scanning text instead of the module graph.
  it('invokes git only through execSync, the API these tests observe', () => {
    const source = readFileSync(new URL('../git-utils.ts', import.meta.url), 'utf-8');

    // Every process-launching `child_process` export except `execSync`.
    const unobservableApis = ['exec', 'execFile', 'execFileSync', 'spawn', 'spawnSync', 'fork'];

    // Called by name, including through a namespace import (`cp.spawnSync(`).
    // The trailing `(` is what keeps `exec` from matching `execSync` and keeps
    // prose like "git rebase --exec" in a comment from failing this.
    const called = unobservableApis.filter((api) => new RegExp(`\\b${api}\\s*\\(`).test(source));
    expect(called, 'git call made through an API the mock does not replace').toEqual([]);

    // Imported by name under any local alias, which the call-shape scan cannot
    // see. Only the name to the left of `as` is checked — that is the
    // `child_process` export, whatever the call site calls it.
    const imported = [
      ...source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'child_process'/g)
    ]
      .flatMap(([, bindings]) => bindings.split(','))
      .map((binding) => binding.trim().split(/\s+as\s+/)[0].trim())
      .filter((name) => unobservableApis.includes(name));

    expect(imported, 'unobservable child_process API imported, possibly under an alias').toEqual(
      []
    );
  });

  // Premise 2: every exported function that can invoke git is in
  // `gitInvokingFunctions`. A new export is not classified automatically, so
  // this fails until it is listed. Neither list is a way out: one subjects the
  // export to the scrubbing assertions, the other asserts it runs no command,
  // so a git-invoking export fails in whichever list it is put.
  it('classifies every exported function as git-invoking or not', () => {
    const exported = Object.entries(gitUtils)
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name)
      .sort();
    const classified = [
      ...gitInvokingFunctions.map(([name]) => name),
      ...nonGitExports.map(([name]) => name)
    ].sort();

    expect(
      exported,
      'unclassified export: add it to gitInvokingFunctions if it can invoke git, to nonGitExports otherwise — each list asserts the behaviour it claims'
    ).toEqual(classified);
  });
});
