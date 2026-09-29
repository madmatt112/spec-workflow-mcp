import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';

// Integration test for the NOT-YET-EXISTING
// harness/skills/sdd-continue/references/sdd-run-setup.sh (design C9, D9, D10;
// Requirement 2 criteria 1, 2, 3, 4, 6, 9, 11). It drives the real script with
// execFileSync over temp spec-store directories, in the execFileSync style of
// src/__tests__/providers-map.test.ts:17-34, and asserts only on the exit
// status, stdout and stderr (node 20 guaranteed fields,
// .spec-workflow/agent-rules.md:30-32).

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, '../../harness/skills/sdd-continue/references/sdd-run-setup.sh');

interface Run {
  status: number;
  stdout: string;
  stderr: string;
}

function run(storeRoot: string, activeSpec: string, rulesPath: string, env: NodeJS.ProcessEnv): Run {
  try {
    const stdout = execFileSync('bash', [SCRIPT, storeRoot, activeSpec, rulesPath], { env, encoding: 'utf8' });
    return { status: 0, stdout, stderr: '' };
  } catch (e: any) {
    return { status: e.status as number, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') };
  }
}

describe('sdd-run-setup.sh', () => {
  let dir: string;
  let withKey: NodeJS.ProcessEnv;
  let noKey: NodeJS.ProcessEnv;
  let runFilePath: string;
  let missingRulesPath: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(join(tmpdir(), 'run-setup-'));
    runFilePath = join(dir, 'harness-run.json');
    missingRulesPath = join(dir, 'does-not-exist.md');
    withKey = { ...process.env, DEEPSEEK_API_KEY: 'fake-key-not-real' };
    noKey = { ...process.env };
    delete noKey.DEEPSEEK_API_KEY;
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function writeRunFile(body: unknown): Promise<void> {
    await fs.writeFile(runFilePath, JSON.stringify(body));
  }

  // Contract: pre-condition -> SPEC_STORE_ROOT has no harness-run.json.
  // Test -> run(storeRoot, activeSpec, rulesPath) i.e.
  //   `bash sdd-run-setup.sh STORE SPEC RULES`.
  // Observable result -> exit 0, stdout is exactly `setup=none`.
  // Expected value source -> design.md:138 ("no file: setup=none") and
  //   Requirement 2 criterion 11 (no file, no overrides/setup key emitted).
  it('prints setup=none and exits 0 when no harness-run.json exists (Req 2.11)', () => {
    const r = run(dir, 'harness-control-pane', missingRulesPath, withKey);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('setup=none');
  });

  // Contract: pre-condition -> harness-run.json whose spec differs from the
  //   active spec argument.
  // Test -> run(storeRoot, activeSpec, rulesPath).
  // Observable result -> exit 0, stdout names both specs, and the file is
  //   still present afterwards.
  // Expected value source -> design.md:139 ("another spec: setup=mismatch
  //   file=<spec> active=<spec>") and Requirement 2 criterion 2 (the
  //   supervisor keeps the file and runs as if it did not exist).
  it('prints setup=mismatch naming both specs, exits 0 and keeps the file (Req 2.2)', async () => {
    await writeRunFile({
      spec: 'some-other-spec',
      writtenAt: '2026-01-01T00:00:00.000Z',
      supervisorModel: 'claude-opus-5-5',
      worktree: 'no',
      gates: 'block',
      roles: {},
    });
    const r = run(dir, 'harness-control-pane', missingRulesPath, withKey);
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('setup=mismatch file=some-other-spec active=harness-control-pane');
    expect(existsSync(runFilePath)).toBe(true);
  });

  describe('applied harness-run.json with an orchestrator, a worker and a deepseek reviewer', () => {
    async function writeApplied(): Promise<void> {
      await writeRunFile({
        spec: 'harness-control-pane',
        writtenAt: '2026-01-01T00:00:00.000Z',
        supervisorModel: 'claude-opus-5-5',
        worktree: 'yes',
        gates: 'record',
        roles: {
          'sdd-implementation-orchestrator': { model: 'claude-sonnet-5', provider: 'anthropic' },
          'sdd-checker': { model: 'claude-opus-4-8', provider: 'anthropic' },
          'sdd-reviewer': { model: 'deepseek-v4-pro', provider: 'deepseek' },
        },
      });
    }

    // Contract: pre-condition -> the applied fixture above, matching active spec.
    // Test -> run(storeRoot, activeSpec, rulesPath).
    // Observable result -> exit 0, stdout contains a `written=` line equal to
    //   the file's writtenAt value, and never the file's supervisorModel value.
    // Expected value source -> design.md:140 (`written=`) and Requirement 2
    //   criterion 1 (the supervisor names the time the file was written);
    //   design D9 (design.md:280, supervisorModel is never surfaced).
    it('prints setup=applied and a written= line equal to writtenAt, never the supervisorModel (Req 2.1, D9)', async () => {
      await writeApplied();
      const r = run(dir, 'harness-control-pane', missingRulesPath, withKey);
      expect(r.status).toBe(0);
      const lines = r.stdout.trim().split('\n');
      expect(lines).toContain('setup=applied');
      expect(lines).toContain('written=2026-01-01T00:00:00.000Z');
      expect(r.stdout).not.toContain('claude-opus-5-5');
    });

    // Contract: pre-condition -> the applied fixture, whose roles include one
    //   agent name ending `-orchestrator`.
    // Test -> run(storeRoot, activeSpec, rulesPath).
    // Observable result -> the `orchestrators=` line lists only that agent as
    //   `agent=model`.
    // Expected value source -> design.md:140 (`orchestrators=<agent>=<model>,…|none`,
    //   an orchestrator is a name ending `-orchestrator`, src/watch/ledger.ts:294)
    //   and Requirement 2 criterion 3 (the file's model for an orchestrator).
    it('prints an orchestrators= line naming only the -orchestrator role (Req 2.3)', async () => {
      await writeApplied();
      const r = run(dir, 'harness-control-pane', missingRulesPath, withKey);
      expect(r.status).toBe(0);
      const lines = r.stdout.trim().split('\n');
      expect(lines).toContain('orchestrators=sdd-implementation-orchestrator=claude-sonnet-5');
    });

    // Contract: pre-condition -> the applied fixture, whose roles include one
    //   non-orchestrator anthropic worker and one deepseek role.
    // Test -> run(storeRoot, activeSpec, rulesPath).
    // Observable result -> the `workers=` line lists only the anthropic
    //   worker, and the `providers=` line equals the merged value
    //   sdd-providers.sh prints for the same roles.
    // Expected value source -> design.md:140 (`workers=<agent>=<model>,…|none`
    //   anthropic workers only, and `providers=<merged>`) and Requirement 2
    //   criterion 4 (a worker override reaches the orchestrator's model
    //   parameter for anthropic, and the merged provider map for deepseek).
    it('prints a workers= line for the anthropic worker and a providers= line from the merge (Req 2.4)', async () => {
      await writeApplied();
      const r = run(dir, 'harness-control-pane', missingRulesPath, withKey);
      expect(r.status).toBe(0);
      const lines = r.stdout.trim().split('\n');
      expect(lines).toContain('workers=sdd-checker=claude-opus-4-8');
      expect(lines).toContain('providers=sdd-checker:anthropic,sdd-reviewer:deepseek:deepseek-v4-pro');
    });

    // Contract: pre-condition -> the applied fixture with three overridden
    //   roles.
    // Test -> run(storeRoot, activeSpec, rulesPath).
    // Observable result -> the `overrides=` line lists every role as
    //   `agent:model:provider`, joined by commas.
    // Expected value source -> the task's Prompt line ("overrides= (every role
    //   as agent:model:provider, joined by commas)") and Requirement 2
    //   criterion 9 (the run.start row's overrides key, built from this line).
    it('prints an overrides= line with every role as agent:model:provider (Req 2.9)', async () => {
      await writeApplied();
      const r = run(dir, 'harness-control-pane', missingRulesPath, withKey);
      expect(r.status).toBe(0);
      const lines = r.stdout.trim().split('\n');
      expect(lines).toContain(
        'overrides=sdd-implementation-orchestrator:claude-sonnet-5:anthropic,sdd-checker:claude-opus-4-8:anthropic,sdd-reviewer:deepseek-v4-pro:deepseek',
      );
    });
  });

  // Contract: pre-condition -> harness-run.json matching the active spec,
  //   with a deepseek role whose model is a Claude model id (breaks
  //   Requirement 1 criterion 6: a deepseek role must hold one of the two
  //   DeepSeek models).
  // Test -> run(storeRoot, activeSpec, rulesPath).
  // Observable result -> exit 2, one `setup: ` stderr line, no stdout, and
  //   the run file is deleted.
  // Expected value source -> the task's Prompt line ("a role that breaks Req
  //   1.6 ... exits 2 with one setup: REASON stderr line") and Requirement 2
  //   criterion 6 (refuse before any ledger row and delete harness-run.json).
  it('a deepseek role holding a Claude model exits 2 with a setup: line and deletes the file (Req 2.6)', async () => {
    await writeRunFile({
      spec: 'harness-control-pane',
      writtenAt: '2026-01-01T00:00:00.000Z',
      supervisorModel: 'claude-opus-5-5',
      worktree: 'no',
      gates: 'block',
      roles: {
        'sdd-reviewer': { model: 'claude-sonnet-5', provider: 'deepseek' },
      },
    });
    const r = run(dir, 'harness-control-pane', missingRulesPath, withKey);
    expect(r.status).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).toMatch(/^setup: /);
    expect(existsSync(runFilePath)).toBe(false);
  });

  // Contract: pre-condition -> harness-run.json matching the active spec,
  //   with a valid deepseek role but no DEEPSEEK_API_KEY in the environment.
  // Test -> run(storeRoot, activeSpec, rulesPath) with env lacking the key.
  // Observable result -> exit 3, a stderr line naming the missing key
  //   (passed through from sdd-providers.sh), no stdout, and the run file
  //   is deleted.
  // Expected value source -> the task's Prompt line ("run ... sdd-providers.sh
  //   ... and pass its exit code and stderr through on failure") and
  //   Requirement 2 criterion 6 (delete harness-run.json on refusal); the
  //   exit-3/stderr shape is sdd-providers.sh's own documented behaviour
  //   (harness/skills/sdd-continue/references/sdd-providers.sh:129-131).
  it('a deepseek role with no DEEPSEEK_API_KEY exits 3 and deletes the file (Req 2.6)', async () => {
    await writeRunFile({
      spec: 'harness-control-pane',
      writtenAt: '2026-01-01T00:00:00.000Z',
      supervisorModel: 'claude-opus-5-5',
      worktree: 'no',
      gates: 'block',
      roles: {
        'sdd-reviewer': { model: 'deepseek-v4-pro', provider: 'deepseek' },
      },
    });
    const r = run(dir, 'harness-control-pane', missingRulesPath, noKey);
    expect(r.status).toBe(3);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('DEEPSEEK_API_KEY');
    expect(existsSync(runFilePath)).toBe(false);
  });
});
