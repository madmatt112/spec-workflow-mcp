import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// End-to-end gate scenario (Req 9.2, design's End-to-end strategy). Nothing is
// mocked: one temp dir is both roots, real git drives the range, and the
// settings file disables typecheck so `tsc` never spawns. Every assertion goes
// through `reviewTaskHandler`, `getTaskReviewHandler` and `specStatusHandler`.
import { reviewTaskHandler, _resetReviewWarnings } from '../review-task.js';
import { getTaskReviewHandler } from '../get-task-review.js';
import { specStatusHandler } from '../spec-status.js';
import { ImplementationLogManager } from '../../dashboard/implementation-log-manager.js';
import { ToolContext } from '../../types.js';

const SPEC_NAME = 'gate-e2e';

function gitCmd(dir: string, args: string[]): void {
  execFileSync('git', args, {
    cwd: dir,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function gitInit(dir: string): void {
  gitCmd(dir, ['init', '-q', '-b', 'main']);
  gitCmd(dir, ['config', 'user.email', 'test@example.com']);
  gitCmd(dir, ['config', 'user.name', 'Test']);
  gitCmd(dir, ['config', 'commit.gpgsign', 'false']);
}

function gitCommit(dir: string, msg: string): string {
  gitCmd(dir, ['add', '-A']);
  gitCmd(dir, ['commit', '-q', '-m', msg]);
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: dir,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    encoding: 'utf-8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

// Task blocks that never match /\b(tests?)\b/i, so risk rule c stays silent on
// these non-test paths (docs/a.md, docs/b.md).
const TASKS_MD = [
  '# Tasks',
  '',
  '- [-] 1. Add documentation page A',
  '  _Requirements: REQ-001_',
  '  _Prompt: Task: Write docs A | Restrictions: none | Success: it works_',
  '',
  '- [-] 2. Update the auth module',
  '  _Requirements: REQ-002_',
  '  _Prompt: Task: Edit auth | Restrictions: none | Success: it works_',
  '',
  '- [-] 3. Add documentation page B',
  '  _Requirements: REQ-003_',
  '  _Prompt: Task: Write docs B | Restrictions: none | Success: it works_',
  '',
].join('\n');

const AGENT_RULES = ['# Agent rules', '', '## Sensitive paths', '', '- src/auth.ts', ''].join('\n');

describe('review-gate end-to-end', () => {
  let tempDir: string;
  let specPath: string;
  let context: ToolContext;

  beforeEach(async () => {
    _resetReviewWarnings();
    tempDir = await fs.mkdtemp(join(tmpdir(), 'review-gate-e2e-'));
    specPath = join(tempDir, '.spec-workflow', 'specs', SPEC_NAME);
    context = { projectPath: tempDir, workspacePath: tempDir };

    // Spec store: agent-rules (one sensitive path), typecheck disabled, tasks 1-3.
    await fs.mkdir(specPath, { recursive: true });
    await fs.writeFile(join(tempDir, '.spec-workflow', 'agent-rules.md'), AGENT_RULES);
    await fs.writeFile(
      join(tempDir, '.spec-workflow', 'adversarial-settings.json'),
      JSON.stringify({ features: { typecheck: false } }, null, 2),
    );
    await fs.writeFile(join(specPath, 'requirements.md'), '# Requirements\n');
    await fs.writeFile(join(specPath, 'design.md'), '# Design\n');
    await fs.writeFile(join(specPath, 'tasks.md'), TASKS_MD);

    // C0: a .gitignore hiding the spec store, plus the sensitive src/auth.ts.
    gitInit(tempDir);
    await fs.writeFile(join(tempDir, '.gitignore'), '.spec-workflow/\nnode_modules/\n');
    await fs.mkdir(join(tempDir, 'src'), { recursive: true });
    await fs.mkdir(join(tempDir, 'docs'), { recursive: true });
    await fs.writeFile(join(tempDir, 'src/auth.ts'), 'export const auth = 1;\n');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function addLog(taskId: string, modified: string[], created: string[]): Promise<void> {
    const logManager = new ImplementationLogManager(specPath);
    await logManager.addLogEntry({
      taskId,
      timestamp: new Date().toISOString(),
      summary: `Implemented task ${taskId}`,
      filesModified: modified,
      filesCreated: created,
      statistics: { linesAdded: 1, linesRemoved: 0, filesChanged: 1 },
      artifacts: {},
    });
  }

  it('runs the three-task scenario and reports all three reviewed', async () => {
    const c0 = gitCommit(tempDir, 'C0');

    // --- Case 1: a Markdown-only edit gates pass/low and records reviewer: gate.
    await fs.writeFile(join(tempDir, 'docs/a.md'), '# Doc A\n\nContent.\n');
    await addLog('1', [], ['docs/a.md']);

    const g1 = await reviewTaskHandler(
      { action: 'gate', specName: SPEC_NAME, taskId: '1', baseRef: c0 },
      context,
    );
    expect(g1.success).toBe(true);
    expect(g1.data.gate).toBe('pass');
    expect(g1.data.risk).toBe('low');
    expect(g1.data.recorded).not.toBeNull();
    expect(g1.data.touched.paths).toEqual(['docs/a.md']);

    const r1 = await getTaskReviewHandler({ specName: SPEC_NAME, taskId: '1' }, context);
    expect(r1.success).toBe(true);
    expect(r1.data.review.reviewer).toBe('gate');

    const c1 = gitCommit(tempDir, 'C1');

    // --- Case 2: touching the sensitive path scores high and records nothing.
    await fs.writeFile(join(tempDir, 'src/auth.ts'), 'export const auth = 2;\n');
    await addLog('2', ['src/auth.ts'], []);

    const g2 = await reviewTaskHandler(
      { action: 'gate', specName: SPEC_NAME, taskId: '2', baseRef: c1 },
      context,
    );
    expect(g2.success).toBe(true);
    expect(g2.data.risk).toBe('high');
    expect(g2.data.reasons).toContain('sensitive-path: src/auth.ts matches src/auth.ts');
    expect(g2.data.recorded).toBeNull();

    // A high-risk item goes through prepare/record; the first review is version 1.
    await reviewTaskHandler({ action: 'prepare', specName: SPEC_NAME, taskId: '2' }, context);
    const rec2 = await reviewTaskHandler(
      { action: 'record', specName: SPEC_NAME, taskId: '2', verdict: 'pass', summary: 'ok', findings: [] },
      context,
    );
    expect(rec2.success).toBe(true);
    expect(rec2.data.version).toBe(1);

    const c2 = gitCommit(tempDir, 'C2');

    // --- Case 3: a failing check fails the gate and writes no review file.
    await fs.writeFile(join(tempDir, 'docs/b.md'), '# Doc B\n\nContent.\n');
    await addLog('3', [], ['docs/b.md']);

    const failCheck = `node -e "console.log('boom'); process.exit(1)"`;
    const g3 = await reviewTaskHandler(
      { action: 'gate', specName: SPEC_NAME, taskId: '3', baseRef: c2, checks: [failCheck] },
      context,
    );
    expect(g3.success).toBe(true);
    expect(g3.data.gate).toBe('fail');
    expect(g3.data.checks[0].output).toBe('boom');
    expect(g3.data.recorded).toBeNull();

    // No review file exists for task 3 yet.
    const noReview = await getTaskReviewHandler({ specName: SPEC_NAME, taskId: '3' }, context);
    expect(noReview.success).toBe(false);

    // Fix the check and re-gate: pass/low records the review.
    const passCheck = `node -e "process.exit(0)"`;
    const g3b = await reviewTaskHandler(
      { action: 'gate', specName: SPEC_NAME, taskId: '3', baseRef: c2, checks: [passCheck] },
      context,
    );
    expect(g3b.success).toBe(true);
    expect(g3b.data.gate).toBe('pass');
    expect(g3b.data.recorded).not.toBeNull();

    const r3 = await getTaskReviewHandler({ specName: SPEC_NAME, taskId: '3' }, context);
    expect(r3.success).toBe(true);
    expect(r3.data.review.reviewer).toBe('gate');

    // --- All tasks complete; spec-status reports three reviews.
    await fs.writeFile(join(specPath, 'tasks.md'), TASKS_MD.replace(/\[-\]/g, '[x]'));

    const status = await specStatusHandler({ specName: SPEC_NAME }, context);
    expect(status.success).toBe(true);
    expect(status.data.reviewCoverage.reviewed).toBe(3);
  });
});
