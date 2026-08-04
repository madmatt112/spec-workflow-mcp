import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The factory must declare **every** export `src/index.ts` imports from
 * `git-utils.js`; an incomplete factory throws every test in this file
 * (requirement 7.7). `WorkspaceSource` is a type-only import and is erased, so
 * it is deliberately absent.
 */
vi.mock('../core/git-utils.js', () => ({
  SPEC_WORKFLOW_WORKSPACE_ENV: 'SPEC_WORKFLOW_WORKSPACE',
  resolveGitWorkspaceRoot: vi.fn((path: string) => `/workspace${path}`),
  resolveWorkspaceRoots: vi.fn(() => ({
    workspacePath: '/workspace/default',
    workflowRootPath: '/shared/default',
    source: 'argument' as const
  }))
}));

import { BOOLEAN_FLAGS, VALUE_FLAGS, logWorkspaceResolution, parseArguments, showHelp } from '../index.js';
import { resolveWorkspaceRoots } from '../core/git-utils.js';

const mockedResolveWorkspaceRoots = vi.mocked(resolveWorkspaceRoots);

/**
 * The call-graph assertions this file used to make named
 * `resolveGitWorkspaceRoot` and `resolveGitRoot` directly, because
 * `parseArguments` called both. Both roots now come from the single
 * `resolveWorkspaceRoots` decision point (requirement 2.3), so the assertions
 * are re-derived against it: what `parseArguments` is responsible for is
 * handing the resolver the configured path and the three booleans, and
 * returning what it produced.
 */
function stubRoots(roots: {
  workspacePath: string;
  workflowRootPath: string;
  source?: 'env' | 'flag' | 'inference' | 'argument';
}) {
  mockedResolveWorkspaceRoots.mockReturnValue({
    workspacePath: roots.workspacePath,
    workflowRootPath: roots.workflowRootPath,
    source: roots.source ?? 'argument'
  });
}

describe('index argument parsing (worktree/shared root)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubRoots({ workspacePath: '/workspace/default', workflowRootPath: '/shared/default' });
  });

  it('passes --no-shared-worktree-specs to the resolver and returns both of its roots', () => {
    stubRoots({ workspacePath: '/tmp/specwf-wt-a', workflowRootPath: '/tmp/specwf-wt-a' });

    const parsed = parseArguments(['/tmp/specwf-wt-a', '--no-shared-worktree-specs']);

    expect(parsed.workspacePath).toBe('/tmp/specwf-wt-a');
    expect(parsed.workflowRootPath).toBe('/tmp/specwf-wt-a');
    expect(parsed.noSharedWorktreeSpecs).toBe(true);
    expect(mockedResolveWorkspaceRoots).toHaveBeenCalledWith(
      expect.objectContaining({ configuredPath: '/tmp/specwf-wt-a', noSharedWorktreeSpecs: true })
    );
  });

  it('uses the shared git root by default when no flag is provided', () => {
    stubRoots({
      workspacePath: '/tmp/specwf-wt-b',
      workflowRootPath: '/Users/lucas/dev/projects/spec-workflow-mcp'
    });

    const parsed = parseArguments(['/tmp/specwf-wt-b']);

    expect(parsed.workspacePath).toBe('/tmp/specwf-wt-b');
    expect(parsed.workflowRootPath).toBe('/Users/lucas/dev/projects/spec-workflow-mcp');
    expect(parsed.noSharedWorktreeSpecs).toBe(false);
    expect(parsed.noWorkspaceInference).toBe(false);
    expect(mockedResolveWorkspaceRoots).toHaveBeenCalledWith({
      configuredPath: '/tmp/specwf-wt-b',
      cwd: process.cwd(),
      dashboardMode: false,
      noInference: false,
      noSharedWorktreeSpecs: false
    });
  });

  it('accepts --no-shared-worktree-specs in dashboard mode without treating it as project path', () => {
    stubRoots({
      workspacePath: '/tmp/specwf-wt-dashboard',
      workflowRootPath: '/tmp/specwf-wt-dashboard'
    });

    const parsed = parseArguments(['--dashboard', '--port', '6001', '--no-shared-worktree-specs']);

    expect(parsed.isDashboardMode).toBe(true);
    expect(parsed.port).toBe(6001);
    expect(parsed.noSharedWorktreeSpecs).toBe(true);
    expect(parsed.workspacePath).toBe('/tmp/specwf-wt-dashboard');
    expect(parsed.workflowRootPath).toBe('/tmp/specwf-wt-dashboard');
    // Requirements 1.14 and 2.11: dashboard mode reaches the resolver as its own
    // input, distinct from --no-workspace-inference (requirement 2.10).
    expect(mockedResolveWorkspaceRoots).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardMode: true, noInference: false })
    );
  });

  it('reports the resolver\'s source verbatim', () => {
    stubRoots({ workspacePath: '/wt/a', workflowRootPath: '/repo/main', source: 'inference' });

    expect(parseArguments([]).workspaceSource).toBe('inference');
  });
});

describe('--no-workspace-inference registration (requirements 1.15, 1.16)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubRoots({ workspacePath: '/workspace/default', workflowRootPath: '/shared/default' });
  });

  it('is accepted bare rather than rejected as an unknown option', () => {
    // The escape hatch and the resolver land together for this reason: the
    // validation loop throws for any flag absent from validFlags, so shipping
    // inference without registering the flag makes the documented opt-out a
    // startup failure.
    expect(() => parseArguments(['--no-workspace-inference'])).not.toThrow();
  });

  it('sets noInference on the resolver call', () => {
    parseArguments(['/tmp/project', '--no-workspace-inference']);

    expect(mockedResolveWorkspaceRoots).toHaveBeenCalledWith(
      expect.objectContaining({ configuredPath: '/tmp/project', noInference: true })
    );
  });

  it('is filtered out of the project-path position', () => {
    parseArguments(['--no-workspace-inference']);

    expect(mockedResolveWorkspaceRoots).toHaveBeenCalledWith(
      expect.objectContaining({ configuredPath: process.cwd() })
    );
  });

  it('is reported on the parse result', () => {
    expect(parseArguments(['--no-workspace-inference']).noWorkspaceInference).toBe(true);
    expect(parseArguments([]).noWorkspaceInference).toBe(false);
  });

  it('combines with the other booleans', () => {
    const parsed = parseArguments(['--no-workspace-inference', '--no-shared-worktree-specs', '--no-open']);

    expect(parsed.noWorkspaceInference).toBe(true);
    expect(parsed.noSharedWorktreeSpecs).toBe(true);
    expect(parsed.noOpen).toBe(true);
  });
});

describe('boolean flags in --flag=value form (requirement 1.17)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubRoots({ workspacePath: '/workspace/default', workflowRootPath: '/shared/default' });
  });

  // Enumerated from the registry, never by hand. A hand-written list here came
  // up short exactly as the parser's did: `--dashboard` and `--help`/`-h` were
  // missing from both, so `--dashboard=true` was accepted, read as `false`, and
  // became the project path. Registering a new boolean flag now extends this
  // suite with it automatically.
  it('covers every boolean flag the parser knows about', () => {
    expect([...BOOLEAN_FLAGS].sort()).toEqual(
      ['--dashboard', '--help', '--no-open', '--no-shared-worktree-specs', '--no-workspace-inference', '-h'].sort()
    );
  });

  for (const flag of BOOLEAN_FLAGS) {
    it(`rejects ${flag}=true with an error naming the bare form`, () => {
      // Stripping the =value instead would be worse: the boolean reads are
      // exact-string matches, so the flag would be read as false and the
      // opt-out silently discarded.
      expect(() => parseArguments([`${flag}=true`])).toThrow(new RegExp(`Unknown option: ${flag}=true`));
      expect(() => parseArguments([`${flag}=true`])).toThrow(new RegExp(`Pass it as ${flag} on its own`));
    });

    it(`rejects ${flag}=false as well, rather than accepting it as an opt-in`, () => {
      expect(() => parseArguments([`${flag}=false`])).toThrow(/boolean flag and takes no value/);
    });

    it(`does not let ${flag}=true become the project path`, () => {
      expect(() => parseArguments([`${flag}=true`])).toThrow();
      expect(mockedResolveWorkspaceRoots).not.toHaveBeenCalled();
    });
  }

  it('still accepts --port=3000, which is not a boolean flag', () => {
    expect(parseArguments(['--port=3000']).port).toBe(3000);
  });

  it('rejects --dashboard=true rather than silently running as an MCP server', () => {
    // The worst of the class: the value form parsed clean, `isDashboardMode`
    // read false, and the literal `--dashboard=true` became the project path.
    expect(() => parseArguments(['--dashboard=true'])).toThrow(/--dashboard is a boolean flag and takes no value/);
  });

  it('still enables dashboard mode for a bare --dashboard', () => {
    expect(parseArguments(['--dashboard']).isDashboardMode).toBe(true);
    expect(mockedResolveWorkspaceRoots).toHaveBeenCalledWith(
      expect.objectContaining({ dashboardMode: true, configuredPath: process.cwd() })
    );
  });

  it('rejects -h=true, not just its long form', () => {
    // The value check keyed on a `--` prefix, so the short alias slipped past it
    // and `-h=true` became the project path.
    expect(() => parseArguments(['-h=true'])).toThrow(/-h is a boolean flag and takes no value/);
    expect(() => parseArguments(['--help=true'])).toThrow(/--help is a boolean flag and takes no value/);
  });

  it('keeps every bare boolean flag working', () => {
    const parsed = parseArguments([
      '--dashboard',
      '--no-open',
      '--no-shared-worktree-specs',
      '--no-workspace-inference'
    ]);

    expect(parsed.isDashboardMode).toBe(true);
    expect(parsed.noOpen).toBe(true);
    expect(parsed.noSharedWorktreeSpecs).toBe(true);
    expect(parsed.noWorkspaceInference).toBe(true);
    // No flag reached the project-path position.
    expect(mockedResolveWorkspaceRoots).toHaveBeenCalledWith(
      expect.objectContaining({ configuredPath: process.cwd() })
    );
  });

  it('keeps --help and -h out of the project-path position', () => {
    expect(() => parseArguments(['--help'])).not.toThrow();
    expect(mockedResolveWorkspaceRoots).toHaveBeenCalledWith(
      expect.objectContaining({ configuredPath: process.cwd() })
    );

    expect(() => parseArguments(['-h'])).not.toThrow();
    expect(mockedResolveWorkspaceRoots).toHaveBeenLastCalledWith(
      expect.objectContaining({ configuredPath: process.cwd() })
    );
  });

  it('still rejects an unknown flag in =value form by flag name', () => {
    expect(() => parseArguments(['--nope=1'])).toThrow(/Unknown option: --nope/);
  });
});

describe('value flags are kept out of the project-path position by the registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubRoots({ workspacePath: '/workspace/default', workflowRootPath: '/shared/default' });
  });

  // Enumerated from the registry for the same reason the boolean suite is: the
  // path filter named `--port` by hand, so a newly registered value flag — and
  // the separate token carrying its value — would have landed in the project
  // path. Registering one now extends this suite with it automatically.
  it('covers every value flag the parser knows about', () => {
    expect([...VALUE_FLAGS].sort()).toEqual(['--port']);
  });

  for (const flag of VALUE_FLAGS) {
    it(`drops ${flag} and its value from the project path in both forms`, () => {
      for (const argv of [[flag, '3000', '/tmp/proj'], [`${flag}=3000`, '/tmp/proj'], ['/tmp/proj', flag, '3000']]) {
        mockedResolveWorkspaceRoots.mockClear();
        parseArguments(argv);
        expect(mockedResolveWorkspaceRoots).toHaveBeenCalledWith(
          expect.objectContaining({ configuredPath: '/tmp/proj' })
        );
      }
    });
  }

  it('still parses a bare positional path with no flags at all', () => {
    parseArguments(['/tmp/proj']);
    expect(mockedResolveWorkspaceRoots).toHaveBeenCalledWith(
      expect.objectContaining({ configuredPath: '/tmp/proj' })
    );
  });
});

describe('workspace resolution log (requirement 1.18)', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  const lines = (): string[] => errorSpy.mock.calls.map((call: unknown[]) => String(call[0]));

  function log(overrides: Partial<Parameters<typeof logWorkspaceResolution>[0]> = {}) {
    logWorkspaceResolution({
      workspacePath: '/repo/main',
      workflowRootPath: '/repo/main',
      source: 'argument',
      noSharedWorktreeSpecs: false,
      noWorkspaceInference: false,
      ...overrides
    });
  }

  it('emits the workspace path exactly once, whatever the arm', () => {
    // One event produces one log: the block used to print `workspacePath=`
    // from the chain and again from the MCP-mode banner.
    const cases: Parameters<typeof log>[0][] = [
      { source: 'inference', workspacePath: '/repo/wt-a' },
      { source: 'env', workspacePath: '/elsewhere' },
      { workspacePath: '/repo/wt-a' },
      { noSharedWorktreeSpecs: true },
      { noWorkspaceInference: true },
      {}
    ];

    for (const singleCase of cases) {
      errorSpy.mockClear();
      log(singleCase);
      expect(lines().filter((line) => line.startsWith('workspacePath='))).toHaveLength(1);
      expect(lines().filter((line) => line.startsWith('workflowRootPath='))).toHaveLength(1);
    }
  });

  it('prints at most one headline, so the arms cannot stack', () => {
    // An inferred workspace in a worktree satisfies the inference arm and the
    // differing-roots arm at once; only the first may speak.
    log({ source: 'inference', workspacePath: '/repo/wt-a', noSharedWorktreeSpecs: true, noWorkspaceInference: true });

    const headlines = lines().filter((line) => !line.startsWith('workspacePath=') && !line.startsWith('workflowRootPath='));
    expect(headlines).toHaveLength(1);
    expect(headlines[0]).toContain('Workspace inferred from the working directory');
  });

  it('names the environment variable when the workspace came from it', () => {
    log({ source: 'env', workspacePath: '/elsewhere' });

    expect(lines()[0]).toContain('SPEC_WORKFLOW_WORKSPACE');
    expect(lines()).toContain('workspacePath=/elsewhere');
    expect(lines()).toContain('workflowRootPath=/repo/main');
  });

  it('reports a worktree when the roots differ without inference', () => {
    log({ workspacePath: '/repo/wt-a' });

    expect(lines()[0]).toBe('Git worktree detected.');
  });

  it('reports the disabling flags when they are what changed the roots', () => {
    log({ noSharedWorktreeSpecs: true });
    expect(lines()[0]).toContain('Shared worktree specs disabled');

    errorSpy.mockClear();
    log({ noWorkspaceInference: true });
    expect(lines()[0]).toContain('Workspace inference disabled');
  });

  it('still reports the paths in the ordinary case, with no headline', () => {
    log();

    expect(lines()).toEqual(['workspacePath=/repo/main', 'workflowRootPath=/repo/main']);
  });

  it('prints only the settled path when a rejected inference fell back', () => {
    // main() calls this after `initialize`, with the path `initialize`
    // returned. A rejected inference reports the fallback under `argument` —
    // what the configured path's toplevel is — so no line contradicts the
    // rejection notice `validateInferredWorkspace` already printed.
    log({ source: 'argument', workspacePath: '/repo/main' });

    expect(lines().some((line) => line.includes('/repo/wt-a'))).toBe(false);
    expect(lines().some((line) => line.includes('inferred from the working directory'))).toBe(false);
    expect(lines()).toContain('workspacePath=/repo/main');
  });
});

describe('--help output', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
  });

  it('lists every boolean flag, including --no-workspace-inference', () => {
    showHelp();

    const output = errorSpy.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
    expect(output).toContain('--no-workspace-inference');
    expect(output).toContain('--no-shared-worktree-specs');
    expect(output).toContain('--no-open');
  });
});
