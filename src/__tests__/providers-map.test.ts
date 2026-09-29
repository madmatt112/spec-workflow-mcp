import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

// Integration test for harness/skills/sdd-continue/references/sdd-providers.sh
// (design Component 1, D1, D17; Requirement 1 criteria 1-4, Requirement 4
// criterion 2, Requirement 6 criterion 4). It drives the real script with
// execFileSync on temp agent-rules.md files, with and without DEEPSEEK_API_KEY
// in env (pattern src/__tests__/hook-spawn-events.test.ts:36-41), and asserts
// only on the exit status, stdout and stderr (node 20 guaranteed fields,
// .spec-workflow/agent-rules.md:30-32).

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, '../../harness/skills/sdd-continue/references/sdd-providers.sh');
const RECORD = join(here, '../../docs/deepseek-preflight.md');

interface Run {
  status: number;
  stdout: string;
  stderr: string;
}

function run(path: string, env: NodeJS.ProcessEnv): Run {
  try {
    const stdout = execFileSync('bash', [SCRIPT, path], { env, encoding: 'utf8' });
    return { status: 0, stdout, stderr: '' };
  } catch (e: any) {
    return { status: e.status as number, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') };
  }
}

// The record's summary table row (b): sdd-reviser joins ELIGIBLE only when this
// preflight probe passed (design D17). The test reads the record and asserts the
// script's behaviour follows it, rather than hard-coding the eligible set.
function reviserPassedInRecord(): boolean {
  const text = readFileSync(RECORD, 'utf8');
  const bRow = text.split('\n').find((l) => /\(b\)/.test(l)) ?? '';
  return /eligible/i.test(bRow);
}

describe('sdd-providers.sh', () => {
  let dir: string;
  let withKey: NodeJS.ProcessEnv;
  let noKey: NodeJS.ProcessEnv;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'providers-map-'));
    withKey = { ...process.env, DEEPSEEK_API_KEY: 'fake-key-not-real' };
    noKey = { ...process.env };
    delete noKey.DEEPSEEK_API_KEY;
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function write(name: string, body: string): Promise<string> {
    const p = join(dir, name);
    await fs.writeFile(p, body);
    return p;
  }

  describe('providers=none (exit 0) for the four empty cases', () => {
    it('the literal path none', () => {
      const r = run('none', withKey);
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('providers=none');
    });

    it('a missing file', () => {
      const r = run(join(dir, 'does-not-exist.md'), withKey);
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('providers=none');
    });

    it('a file with no ## Providers heading', async () => {
      const p = await write('rules.md', '# Agent rules\n\nSome text and a\n\n## Layout\n\n- a bullet\n');
      const r = run(p, withKey);
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('providers=none');
    });

    it('a ## Providers section with no bullet before the next ## heading', async () => {
      const p = await write('rules.md', '## Providers\n\nNothing configured yet.\n\n## Layout\n\n- a bullet\n');
      const r = run(p, withKey);
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('providers=none');
    });
  });

  it('emits the two-row value in section order, unaffected by other sections', async () => {
    const p = await write(
      'rules.md',
      [
        '# Agent rules',
        '',
        '## Sensitive paths',
        '',
        '- src/core/approval-records.ts',
        '',
        '## Providers',
        '',
        '- sdd-reviewer: deepseek deepseek-v4-pro',
        '- sdd-checker: anthropic',
        '',
        '## Generated paths',
        '',
        '- plugins/',
        '',
      ].join('\n'),
    );
    const r = run(p, withKey);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('providers=sdd-reviewer:deepseek:deepseek-v4-pro,sdd-checker:anthropic');
    expect(r.stderr).toBe('');
  });

  describe('exit 2 with one stderr line and no stdout for each bad-row case', () => {
    const cases: Array<{ name: string; row: string }> = [
      { name: 'a bullet outside the row grammar', row: '- sdd-reviewer deepseek deepseek-v4-pro' },
      { name: 'an agent outside ELIGIBLE', row: '- sdd-planner: anthropic' },
      { name: 'an unknown provider', row: '- sdd-reviewer: openai' },
      { name: 'a deepseek row without a model', row: '- sdd-reviewer: deepseek' },
      { name: 'a deepseek row with a model outside the set', row: '- sdd-reviewer: deepseek deepseek-turbo' },
      { name: 'an anthropic row with a model', row: '- sdd-checker: anthropic deepseek-v4-pro' },
    ];

    for (const c of cases) {
      it(c.name, async () => {
        const p = await write('rules.md', `## Providers\n\n${c.row}\n`);
        const r = run(p, withKey);
        expect(r.status).toBe(2);
        expect(r.stdout).toBe('');
        expect(r.stderr).toMatch(/^providers: /);
      });
    }

    it('a duplicate agent', async () => {
      const p = await write('rules.md', '## Providers\n\n- sdd-reviewer: anthropic\n- sdd-reviewer: anthropic\n');
      const r = run(p, withKey);
      expect(r.status).toBe(2);
      expect(r.stdout).toBe('');
      expect(r.stderr).toMatch(/^providers: /);
    });
  });

  it('exit 3 naming the role and the key when a deepseek row has no key', async () => {
    const p = await write('rules.md', '## Providers\n\n- sdd-reviewer: deepseek deepseek-v4-pro\n');
    const r = run(p, noKey);
    expect(r.status).toBe(3);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('DEEPSEEK_API_KEY');
    expect(r.stderr).toContain('sdd-reviewer');
  });

  it('ELIGIBLE names sdd-reviser exactly when the record marks preflight (b) passed', async () => {
    const p = await write('rules.md', '## Providers\n\n- sdd-reviser: anthropic\n');
    const r = run(p, withKey);
    if (reviserPassedInRecord()) {
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('providers=sdd-reviser:anthropic');
    } else {
      expect(r.status).toBe(2);
      expect(r.stdout).toBe('');
      expect(r.stderr).toMatch(/^providers: /);
    }
  });

  // Task 14: optional RUN_FILE second argument (design C9, Requirement 2
  // criteria 4 and 6). Each test's contract:
  //   pre-condition -> the RULES and RUN_FILE fixtures written below
  //   call -> run2(rules, runFile, env), which execFileSync's the real
  //     script as `bash sdd-providers.sh RULES RUN_FILE`
  //   observable result -> the exit status, stdout and stderr
  //   expected value source -> design.md section C9's merge-then-validate
  //     description and the unchanged key-check/output lines it cites
  //     (script lines 67-75)
  describe('RUN_FILE second argument (design C9)', () => {
    function run2(rulesPath: string, runFilePath: string, env: NodeJS.ProcessEnv): Run {
      try {
        const stdout = execFileSync('bash', [SCRIPT, rulesPath, runFilePath], { env, encoding: 'utf8' });
        return { status: 0, stdout, stderr: '' };
      } catch (e: any) {
        return { status: e.status as number, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') };
      }
    }

    async function writeRunFile(
      name: string,
      roles: Record<string, { provider: string; model?: string }>,
    ): Promise<string> {
      return write(name, JSON.stringify({ roles }));
    }

    it('an eligible role flipped to deepseek where the rules have no Providers heading gives its row', async () => {
      const rules = await write('rules.md', '# Agent rules\n\nSome text and a\n\n## Layout\n\n- a bullet\n');
      const runFile = await writeRunFile('run.json', {
        'sdd-reviewer': { provider: 'deepseek', model: 'deepseek-v4-pro' },
      });
      const r = run2(rules, runFile, withKey);
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('providers=sdd-reviewer:deepseek:deepseek-v4-pro');
      expect(r.stderr).toBe('');
    });

    it('a missing rules file with a run file still validates the run-file roles', async () => {
      const rules = join(dir, 'does-not-exist.md');
      const runFile = await writeRunFile('run.json', { 'sdd-reviewer': { provider: 'openai' } });
      const r = run2(rules, runFile, withKey);
      expect(r.status).toBe(2);
      expect(r.stdout).toBe('');
      expect(r.stderr).toMatch(/^providers: /);
    });

    it('a non-eligible role set to deepseek exits 2', async () => {
      const rules = join(dir, 'does-not-exist.md');
      const runFile = await writeRunFile('run.json', {
        'sdd-planner': { provider: 'deepseek', model: 'deepseek-v4-pro' },
      });
      const r = run2(rules, runFile, withKey);
      expect(r.status).toBe(2);
      expect(r.stdout).toBe('');
      expect(r.stderr).toMatch(/^providers: /);
    });

    it('an unknown DeepSeek model exits 2', async () => {
      const rules = join(dir, 'does-not-exist.md');
      const runFile = await writeRunFile('run.json', {
        'sdd-reviewer': { provider: 'deepseek', model: 'deepseek-turbo' },
      });
      const r = run2(rules, runFile, withKey);
      expect(r.status).toBe(2);
      expect(r.stdout).toBe('');
      expect(r.stderr).toMatch(/^providers: /);
    });

    it('a deepseek role without DEEPSEEK_API_KEY exits 3', async () => {
      const rules = join(dir, 'does-not-exist.md');
      const runFile = await writeRunFile('run.json', {
        'sdd-reviewer': { provider: 'deepseek', model: 'deepseek-v4-pro' },
      });
      const r = run2(rules, runFile, noKey);
      expect(r.status).toBe(3);
      expect(r.stdout).toBe('');
      expect(r.stderr).toContain('DEEPSEEK_API_KEY');
      expect(r.stderr).toContain('sdd-reviewer');
    });

    it('a run-file role replaces the rules row of the same agent', async () => {
      const rules = await write('rules.md', '## Providers\n\n- sdd-reviewer: anthropic\n');
      const runFile = await writeRunFile('run.json', {
        'sdd-reviewer': { provider: 'deepseek', model: 'deepseek-v4-pro' },
      });
      const r = run2(rules, runFile, withKey);
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('providers=sdd-reviewer:deepseek:deepseek-v4-pro');
      expect(r.stderr).toBe('');
    });

    it('an anthropic role that is not eligible does not appear', async () => {
      const rules = join(dir, 'does-not-exist.md');
      const runFile = await writeRunFile('run.json', {
        'sdd-checker': { provider: 'anthropic' },
        'sdd-planner': { provider: 'anthropic' },
      });
      const r = run2(rules, runFile, withKey);
      expect(r.status).toBe(0);
      expect(r.stdout.trim()).toBe('providers=sdd-checker:anthropic');
      expect(r.stderr).toBe('');
    });

    it('an unreadable run file refuses with exit 2 and providers: bad run file', () => {
      const rules = join(dir, 'does-not-exist.md');
      const runFile = join(dir, 'no-run-here.json');
      const r = run2(rules, runFile, withKey);
      expect(r.status).toBe(2);
      expect(r.stdout).toBe('');
      expect(r.stderr.trim()).toBe('providers: bad run file');
    });

    it('a run file with bad JSON refuses with exit 2 and providers: bad run file', async () => {
      const rules = join(dir, 'does-not-exist.md');
      const runFile = await write('run.json', 'not json {');
      const r = run2(rules, runFile, withKey);
      expect(r.status).toBe(2);
      expect(r.stdout).toBe('');
      expect(r.stderr.trim()).toBe('providers: bad run file');
    });
  });
});
