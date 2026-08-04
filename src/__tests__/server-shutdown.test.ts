import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SpecWorkflowMCPServer } from '../server.js';
import { ProjectRegistry, generateProjectId } from '../core/project-registry.js';
import { SPEC_WORKFLOW_HOME_ENV } from '../core/global-dir.js';

/**
 * Requirement 1.13, at the level that owns it: `SpecWorkflowMCPServer.stop()`.
 *
 * `ProjectRegistry` has tests for both removal paths — by path and by id — and
 * they pass whichever one the server calls, so none of them constrains the
 * server. This does. The discriminating scenario is the one the requirement was
 * written for: a workspace reached through a symlink that is removed while the
 * server that registered it is still running (`git worktree remove`). `realpath`
 * then fails, so an id recomputed from the path is the fallback's id rather than
 * the one the entry was written under, and unregistering by path strands the
 * entry in the registry forever.
 *
 * Built on a real filesystem — a real symlink, a real `rm` — because the whole
 * failure lives in what `realpath` does before and after the directory goes;
 * a stub for it would be a restatement of the bug, not a test for it.
 *
 * Windows is skipped: the fixture needs a directory symlink.
 */
describe.skipIf(process.platform === 'win32')('SpecWorkflowMCPServer.stop() — requirement 1.13', () => {
  const roots: string[] = [];
  const originalEnv = { ...process.env };
  let root: string;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let stdinListenersBefore: Map<string, Function[]>;

  const STDIN_EVENTS = ['end', 'error', 'data'] as const;

  beforeEach(async () => {
    // realpath-normalized, so the only symlink in play is the one built below —
    // and so the root is not under `/var`, which `validateProjectPath` refuses.
    const created = await fs.mkdtemp(join(tmpdir(), 'specwf-server-shutdown-'));
    root = await fs.realpath(created);
    roots.push(root);
    const globalDir = join(root, 'global');
    await fs.mkdir(globalDir, { recursive: true });
    process.env[SPEC_WORKFLOW_HOME_ENV] = globalDir;

    // `initialize` wires `transport.onclose` to `stop()` followed by
    // `process.exit(0)`, and `stop()` closes the transport — so shutting the
    // server down in-process reaches that handler. Only the process kill is
    // stubbed; the unregistration under test runs for real.
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    stdinListenersBefore = new Map(
      STDIN_EVENTS.map((event) => [event, [...process.stdin.listeners(event)]])
    );
  });

  afterEach(() => {
    // `initialize` adds stdin handlers that call `process.exit`, and `stop()`
    // only removes the transport's own. Leaving the rest attached would arm a
    // process kill for the remainder of the worker's life.
    for (const event of STDIN_EVENTS) {
      const before = stdinListenersBefore.get(event) ?? [];
      for (const listener of process.stdin.listeners(event)) {
        if (!before.includes(listener)) {
          process.stdin.off(event, listener as (...args: any[]) => void);
        }
      }
    }
    errorSpy.mockRestore();
    exitSpy.mockRestore();
    process.env = { ...originalEnv };
  });

  // Vitest workers never emit a process `exit`, so teardown must be explicit.
  afterAll(async () => {
    for (const dir of roots) {
      await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  });

  /** `<root>/real/<name>`, also reachable as `<root>/link/<name>`. */
  async function symlinkedWorkspace(name: string): Promise<{ physical: string; viaLink: string }> {
    const realParent = join(root, 'real');
    const physical = join(realParent, name);
    await fs.mkdir(physical, { recursive: true });
    const linkParent = join(root, 'link');
    await fs.symlink(realParent, linkParent, 'dir').catch((error: any) => {
      if (error.code !== 'EEXIST') throw error;
    });
    return { physical, viaLink: join(linkParent, name) };
  }

  it('unregisters a symlinked worktree that was removed while the server was running', async () => {
    const mainRepo = join(root, 'real', 'main-repo');
    await fs.mkdir(mainRepo, { recursive: true });
    const { physical, viaLink } = await symlinkedWorkspace('feature-a');

    const server = new SpecWorkflowMCPServer();
    await server.initialize(mainRepo, viaLink);

    const registry = new ProjectRegistry();
    const registeredId = generateProjectId(physical);
    expect(await registry.getProjectById(registeredId)).not.toBeNull();

    // The worktree goes while the server is still up — `git worktree remove`.
    await fs.rm(physical, { recursive: true, force: true });

    // The premise: from here on, the path no longer names the registered id.
    // If this ever stops holding, the assertion below has stopped discriminating.
    expect(generateProjectId(viaLink)).not.toBe(registeredId);

    await server.stop();

    expect(
      (await registry.getAllProjects()).map((project) => project.projectPath),
      'stop() left the removed worktree in the registry: it must unregister by the id cached at ' +
      'registration, not by recomputing one from a path realpath can no longer resolve'
    ).toEqual([]);
    expect(await registry.getProjectById(registeredId)).toBeNull();
  }, 30000);

  it('still unregisters a workspace that is intact at shutdown', async () => {
    // The cached id has to be the id the entry was written under in the ordinary
    // case too — caching the wrong value would fail here and nowhere else.
    const { physical } = await symlinkedWorkspace('feature-b');

    const server = new SpecWorkflowMCPServer();
    await server.initialize(physical, physical);

    const registry = new ProjectRegistry();
    expect(await registry.getProjectById(generateProjectId(physical))).not.toBeNull();

    await server.stop();

    expect(await registry.getAllProjects()).toEqual([]);
  }, 30000);
});
