import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

// Integration test for harness/skills/sdd-continue/references/sdd-graph.sh
// (design Component 1, C1, D1, D2, D3; Requirement 1 criteria 1-4, Requirement 2
// criteria 4, 5, 7). It drives the real script with execFileSync on a temp git
// repo, patterned on src/__tests__/providers-map.test.ts:17-34 and
// src/__tests__/cache-ttl-probe.test.ts. A stub `graphify` on PATH exits 0,
// exits 1, or runs `exec sleep 5`, and writes ${GRAPHIFY_FORCE:-} to a file so
// the environment scrub can be checked. PATH holds only the stub dir (when the
// case has one), the dir of process.execPath and /usr/bin:/bin, so the real
// graphify never answers. Asserts use only exit status and stdout (node 20
// guaranteed fields, .spec-workflow/agent-rules.md:30-32).

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, '../../harness/skills/sdd-continue/references/sdd-graph.sh');
const NODE_DIR = dirname(process.execPath);

interface Run {
  status: number;
  stdout: string;
}

describe('sdd-graph.sh', () => {
  let base: string;
  let root: string;
  let home: string;
  let stub: string;
  let forceFile: string;

  // git identity supplied through the environment for the setup commits.
  const gitEnv = (): NodeJS.ProcessEnv => ({
    ...process.env,
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  });

  beforeEach(async () => {
    base = await fs.mkdtemp(join(tmpdir(), 'sdd-graph-'));
    root = join(base, 'root');
    home = join(base, 'home');
    stub = join(base, 'stub');
    forceFile = join(stub, 'force.txt');
    await fs.mkdir(root, { recursive: true });
    await fs.mkdir(home, { recursive: true });
    await fs.mkdir(stub, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(base, { recursive: true, force: true });
  });

  function git(args: string[]): string {
    return execFileSync('git', args, { cwd: root, env: gitEnv(), encoding: 'utf8' });
  }

  async function initRepo(): Promise<void> {
    git(['init', '-q']);
    git(['commit', '--allow-empty', '-q', '-m', 'init']);
  }

  function head(): string {
    return git(['rev-parse', 'HEAD']).trim();
  }

  async function writeGraph(body: string): Promise<void> {
    await fs.mkdir(join(root, 'graphify-out'), { recursive: true });
    await fs.writeFile(join(root, 'graphify-out', 'graph.json'), body);
  }

  // kind: 'ok' exits 0, 'fail' exits 1, 'sleep' runs exec sleep 5. Every variant
  // records ${GRAPHIFY_FORCE:-} to forceFile so the scrub can be inspected.
  async function writeStub(kind: 'ok' | 'fail' | 'sleep'): Promise<void> {
    const tail = kind === 'ok' ? 'exit 0' : kind === 'fail' ? 'exit 1' : 'exec sleep 5';
    const body = `#!/bin/bash\nprintf '%s' "\${GRAPHIFY_FORCE:-}" > "${forceFile}"\n${tail}\n`;
    const p = join(stub, 'graphify');
    await fs.writeFile(p, body);
    await fs.chmod(p, 0o755);
  }

  function env(withStub: boolean, extra: Record<string, string> = {}): NodeJS.ProcessEnv {
    const parts = withStub ? [stub, NODE_DIR, '/usr/bin', '/bin'] : [NODE_DIR, '/usr/bin', '/bin'];
    return { PATH: parts.join(':'), HOME: home, ...extra };
  }

  function run(args: string[], withStub: boolean, extra: Record<string, string> = {}): Run {
    try {
      const stdout = execFileSync('bash', [SCRIPT, ...args], { env: env(withStub, extra), encoding: 'utf8' });
      return { status: 0, stdout };
    } catch (e: any) {
      return { status: e.status as number, stdout: String(e.stdout ?? '') };
    }
  }

  describe('fact', () => {
    it('no graph file gives none and n/a', async () => {
      await writeStub('ok');
      const r = run(['fact', root, root], true);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe('GRAPH: none\nGRAPH_BEHIND: n/a\nGRAPH_BUILT_AT: n/a\n');
    });

    it('no graphify binary gives none', async () => {
      await writeGraph(JSON.stringify({ built_at_commit: 'abc1234' }));
      const r = run(['fact', root, root], false);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe('GRAPH: none\nGRAPH_BEHIND: n/a\nGRAPH_BUILT_AT: n/a\n');
    });

    it('two commits after built_at_commit give GRAPH_BEHIND: 2', async () => {
      await writeStub('ok');
      await initRepo();
      const base0 = head();
      git(['commit', '--allow-empty', '-q', '-m', 'one']);
      git(['commit', '--allow-empty', '-q', '-m', 'two']);
      await writeGraph(JSON.stringify({ built_at_commit: base0 }));
      const r = run(['fact', root, root], true);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe(`GRAPH: ${join(root, 'graphify-out', 'graph.json')}\nGRAPH_BEHIND: 2\nGRAPH_BUILT_AT: ${base0}\n`);
    });

    it('a missing built_at_commit key gives unknown', async () => {
      await writeStub('ok');
      await writeGraph(JSON.stringify({ other: true }));
      const r = run(['fact', root, root], true);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe(`GRAPH: ${join(root, 'graphify-out', 'graph.json')}\nGRAPH_BEHIND: unknown\nGRAPH_BUILT_AT: unknown\n`);
    });

    it('a JSON parse error gives unknown', async () => {
      await writeStub('ok');
      await writeGraph('{ not json');
      const r = run(['fact', root, root], true);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe(`GRAPH: ${join(root, 'graphify-out', 'graph.json')}\nGRAPH_BEHIND: unknown\nGRAPH_BUILT_AT: unknown\n`);
    });
  });

  describe('refresh', () => {
    it('exit 0 prints refresh ok and the HEAD sha', async () => {
      await writeStub('ok');
      await initRepo();
      const sha = head();
      const r = run(['refresh', root], true);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe(`refresh: ok\nGRAPH_BEHIND: 0\nGRAPH_BUILT_AT: ${sha}\n`);
    });

    it('a stub exit 1 prints refresh: failed exit 1', async () => {
      await writeStub('fail');
      const r = run(['refresh', root], true);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe('refresh: failed exit 1\n');
    });

    it('TIMEOUT_S 1 with a sleeping stub prints refresh: failed timeout 1s', async () => {
      await writeStub('sleep');
      const r = run(['refresh', root, '1'], true);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe('refresh: failed timeout 1s\n');
    });

    it('GRAPHIFY_FORCE=1 in the caller environment reaches the stub empty', async () => {
      await writeStub('ok');
      await initRepo();
      const r = run(['refresh', root], true, { GRAPHIFY_FORCE: '1' });
      expect(r.status).toBe(0);
      const recorded = await fs.readFile(forceFile, 'utf8');
      expect(recorded).toBe('');
    });
  });
});
