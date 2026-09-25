import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

// Integration test for harness/skills/sdd-continue/references/sdd-cache-ttl.sh
// (design Component 6, C6, D6; Requirement 5 criteria 2 and 6). It drives the
// real probe with execFileSync, patterned on src/__tests__/providers-map.test.ts:17-34.
// A stub `claude` on PATH prints a set version or exits 1; PATH holds only the
// stub dir, the dir of process.execPath and /usr/bin:/bin, so the real `claude`
// never answers. The working directory is a temp code root and HOME a separate
// temp dir; FORCE_PROMPT_CACHING_5M, CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL and
// CLAUDE_CONFIG_DIR are absent unless a case sets them. Asserts use only exit
// status and stdout (node 20 guaranteed fields, .spec-workflow/agent-rules.md:30-32).

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, '../../harness/skills/sdd-continue/references/sdd-cache-ttl.sh');
const NODE_DIR = dirname(process.execPath);

interface Run {
  status: number;
  stdout: string;
}

describe('sdd-cache-ttl.sh', () => {
  let base: string;
  let root: string;
  let home: string;
  let stub: string;

  beforeEach(async () => {
    base = await fs.mkdtemp(join(tmpdir(), 'cache-ttl-'));
    root = join(base, 'root');
    home = join(base, 'home');
    stub = join(base, 'stub');
    await fs.mkdir(root, { recursive: true });
    await fs.mkdir(home, { recursive: true });
    await fs.mkdir(stub, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(base, { recursive: true, force: true });
  });

  // version === null makes the stub exit 1; otherwise it prints that version.
  async function writeStub(version: string | null): Promise<void> {
    const body = version === null ? '#!/bin/bash\nexit 1\n' : `#!/bin/bash\necho "${version} (Claude Code)"\n`;
    const p = join(stub, 'claude');
    await fs.writeFile(p, body);
    await fs.chmod(p, 0o755);
  }

  async function writeJson(dir: string, name: string, body: string): Promise<void> {
    await fs.mkdir(join(dir, '.claude'), { recursive: true });
    await fs.writeFile(join(dir, '.claude', name), body);
  }

  function env(extra: Record<string, string> = {}): NodeJS.ProcessEnv {
    return {
      PATH: `${stub}:${NODE_DIR}:/usr/bin:/bin`,
      HOME: home,
      ...extra,
    };
  }

  function run(extra: Record<string, string> = {}): Run {
    try {
      const stdout = execFileSync('bash', [SCRIPT], { cwd: root, env: env(extra), encoding: 'utf8' });
      return { status: 0, stdout };
    } catch (e: any) {
      return { status: e.status as number, stdout: String(e.stdout ?? '') };
    }
  }

  it('unknown when claude --version exits non-zero', async () => {
    await writeStub(null);
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=unknown');
  });

  it('unknown when claude prints no three-part version', async () => {
    await writeStub('build-abc');
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=unknown');
  });

  it('unsupported below 2.1.248', async () => {
    await writeStub('2.1.247');
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=unsupported');
  });

  it('per-agent at exactly 2.1.248 with nothing set', async () => {
    await writeStub('2.1.248');
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=per-agent');
  });

  it('per-agent on a supported version with no override', async () => {
    await writeStub('2.1.281');
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=per-agent');
  });

  it('FORCE_PROMPT_CACHING_5M reported with its value', async () => {
    await writeStub('2.1.281');
    const r = run({ FORCE_PROMPT_CACHING_5M: '1' });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=FORCE_PROMPT_CACHING_5M=1');
  });

  it('FORCE_PROMPT_CACHING_5M=0 is not an override', async () => {
    await writeStub('2.1.281');
    const r = run({ FORCE_PROMPT_CACHING_5M: '0' });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=per-agent');
  });

  it('FORCE_PROMPT_CACHING_5M wins over the environment variable', async () => {
    await writeStub('2.1.281');
    const r = run({ FORCE_PROMPT_CACHING_5M: '1', CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL: '1h' });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=FORCE_PROMPT_CACHING_5M=1');
  });

  it('CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL reported with its value', async () => {
    await writeStub('2.1.281');
    const r = run({ CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL: '1h' });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL=1h');
  });

  it('the environment variable wins over a settings file', async () => {
    await writeStub('2.1.281');
    await writeJson(root, 'settings.local.json', JSON.stringify({ subagentPromptCacheTtl: '1h' }));
    const r = run({ CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL: '5m' });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL=5m');
  });

  it('local settings win over project and user', async () => {
    await writeStub('2.1.281');
    await writeJson(root, 'settings.local.json', JSON.stringify({ subagentPromptCacheTtl: 'local' }));
    await writeJson(root, 'settings.json', JSON.stringify({ subagentPromptCacheTtl: 'project' }));
    await writeJson(home, 'settings.json', JSON.stringify({ subagentPromptCacheTtl: 'user' }));
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=subagentPromptCacheTtl=local');
  });

  it('project settings win over user when local has no key', async () => {
    await writeStub('2.1.281');
    await writeJson(root, 'settings.local.json', JSON.stringify({ other: true }));
    await writeJson(root, 'settings.json', JSON.stringify({ subagentPromptCacheTtl: 'project' }));
    await writeJson(home, 'settings.json', JSON.stringify({ subagentPromptCacheTtl: 'user' }));
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=subagentPromptCacheTtl=project');
  });

  it('user settings apply when no local or project file sets the key', async () => {
    await writeStub('2.1.281');
    await writeJson(home, 'settings.json', JSON.stringify({ subagentPromptCacheTtl: 'user' }));
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=subagentPromptCacheTtl=user');
  });

  it('a malformed higher-precedence file is skipped', async () => {
    await writeStub('2.1.281');
    await writeJson(root, 'settings.local.json', '{ not json');
    await writeJson(root, 'settings.json', JSON.stringify({ subagentPromptCacheTtl: 'project' }));
    const r = run();
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=subagentPromptCacheTtl=project');
  });

  it('CLAUDE_CONFIG_DIR points the user settings file, ignoring HOME', async () => {
    await writeStub('2.1.281');
    const configDir = join(base, 'config');
    await fs.mkdir(configDir, { recursive: true });
    await fs.writeFile(join(configDir, 'settings.json'), JSON.stringify({ subagentPromptCacheTtl: 'from-config' }));
    await writeJson(home, 'settings.json', JSON.stringify({ subagentPromptCacheTtl: 'from-home' }));
    const r = run({ CLAUDE_CONFIG_DIR: configDir });
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('cacheTtl=subagentPromptCacheTtl=from-config');
  });
});
