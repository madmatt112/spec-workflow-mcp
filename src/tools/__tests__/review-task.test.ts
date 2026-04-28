import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path, { join } from 'path';
import { tmpdir } from 'os';
import { reviewTaskHandler } from '../review-task.js';
import { ToolContext } from '../../types.js';
import { ImplementationLogManager } from '../../dashboard/implementation-log-manager.js';

describe('review-task handler', () => {
  let tempDir: string;
  let context: ToolContext;
  let specPath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'review-task-test-'));
    specPath = join(tempDir, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specPath, { recursive: true });
    context = { projectPath: tempDir };

    // Create a minimal tasks.md
    await fs.writeFile(join(specPath, 'tasks.md'), [
      '# Tasks',
      '',
      '- [-] 1. Implement feature',
      '  _Requirements: REQ-001_',
      '  _Prompt: Role: Developer | Task: Build it | Restrictions: No new deps | Success: Tests pass_',
      '',
      '- [ ] 2. Another task',
    ].join('\n'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createImplLog() {
    const logManager = new ImplementationLogManager(specPath);
    await logManager.addLogEntry({
      taskId: '1',
      timestamp: new Date().toISOString(),
      summary: 'Implemented feature',
      filesModified: ['src/handler.ts'],
      filesCreated: ['src/new-file.ts'],
      statistics: { linesAdded: 50, linesRemoved: 5, filesChanged: 2 },
      artifacts: {
        functions: [{ name: 'handleRequest', purpose: 'Handle request', location: 'src/handler.ts:10', isExported: true }],
      },
    });
  }

  describe('prepare action', () => {
    it('should fail if no implementation log exists', async () => {
      const result = await reviewTaskHandler(
        { action: 'prepare', specName: 'test-spec', taskId: '1' },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('No implementation log');
    });

    it('should fail if task does not exist', async () => {
      await createImplLog();
      const result = await reviewTaskHandler(
        { action: 'prepare', specName: 'test-spec', taskId: '999' },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('should return review context and methodology', async () => {
      await createImplLog();
      const result = await reviewTaskHandler(
        { action: 'prepare', specName: 'test-spec', taskId: '1' },
        context
      );
      expect(result.success).toBe(true);
      expect(result.data.taskContext).toBeDefined();
      expect(result.data.implementationSummary).toBeDefined();
      expect(result.data.filesToReview).toContain(join(tempDir, 'src/handler.ts'));
      expect(result.data.methodology).toContain('Review Methodology');
      expect(result.data.methodology).toContain('No new deps');
      expect(result.data.methodology).toContain('Tests pass');
    });

    it('should write a prepare marker', async () => {
      await createImplLog();
      await reviewTaskHandler(
        { action: 'prepare', specName: 'test-spec', taskId: '1' },
        context
      );

      // Check marker file exists
      const reviewsDir = join(specPath, 'reviews');
      const files = await fs.readdir(reviewsDir);
      expect(files.some(f => f.startsWith('.prepare-'))).toBe(true);
    });

    describe('hygiene signal integration', () => {
      const ORIGINAL_ITEM_9 = '9. **Hygiene**: Hardcoded secrets, leftover debug code (console.log, TODO/FIXME from this task), commented-out code, unused imports or variables introduced by this task. Mark findings from items 7-9 with category: "hygiene".';

      async function seedLogWithFiles(filesModified: string[], filesCreated: string[] = []) {
        const logManager = new ImplementationLogManager(specPath);
        await logManager.addLogEntry({
          taskId: '1',
          timestamp: new Date().toISOString(),
          summary: 'Implemented feature',
          filesModified,
          filesCreated,
          statistics: { linesAdded: 10, linesRemoved: 0, filesChanged: filesModified.length + filesCreated.length },
          artifacts: {},
        });
      }

      it('(a) returns hygieneSignals with correct line numbers and patterns', async () => {
        const relPath = 'src/dirty.ts';
        const absPath = join(tempDir, relPath);
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, [
          'function foo() {',
          "  console.log('debug');",
          '  // TODO: x',
          '}',
        ].join('\n'));
        await seedLogWithFiles([relPath]);

        const result = await reviewTaskHandler(
          { action: 'prepare', specName: 'test-spec', taskId: '1' },
          context
        );

        expect(result.success).toBe(true);
        const signals = result.data.hygieneSignals;
        expect(signals).toHaveLength(2);
        const consoleSig = signals.find((s: any) => s.pattern === 'console')!;
        const todoSig = signals.find((s: any) => s.pattern === 'todo')!;
        expect(consoleSig.line).toBe(2);
        expect(todoSig.line).toBe(3);
      });

      it('(b) clean task returns empty hygieneSignals AND original item 9 text', async () => {
        const relPath = 'src/clean.ts';
        const absPath = join(tempDir, relPath);
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, [
          'export function add(a: number, b: number) {',
          '  return a + b;',
          '}',
        ].join('\n'));
        await seedLogWithFiles([relPath]);

        const result = await reviewTaskHandler(
          { action: 'prepare', specName: 'test-spec', taskId: '1' },
          context
        );

        expect(result.success).toBe(true);
        expect(result.data.hygieneSignals).toEqual([]);
        expect(result.data.methodology).toContain(ORIGINAL_ITEM_9);
      });

      it('(c) methodology contains triage directive when signals are present', async () => {
        const relPath = 'src/dirty.ts';
        const absPath = join(tempDir, relPath);
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, "console.log('hi');");
        await seedLogWithFiles([relPath]);

        const result = await reviewTaskHandler(
          { action: 'prepare', specName: 'test-spec', taskId: '1' },
          context
        );

        expect(result.success).toBe(true);
        expect(result.data.methodology).toContain('Pre-computed hygiene signals are attached in');
      });

      it('(d) every signal has an absolute file path', async () => {
        const relPath = 'src/dirty.ts';
        const absPath = join(tempDir, relPath);
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, [
          "console.log('a');",
          '// TODO: y',
          'debugger;',
        ].join('\n'));
        await seedLogWithFiles([relPath]);

        const result = await reviewTaskHandler(
          { action: 'prepare', specName: 'test-spec', taskId: '1' },
          context
        );

        expect(result.success).toBe(true);
        const signals = result.data.hygieneSignals;
        expect(signals.length).toBeGreaterThan(0);
        for (const signal of signals) {
          expect(path.isAbsolute(signal.file)).toBe(true);
        }
      });
    });
  });

  describe('record action', () => {
    it('should fail without prepare marker', async () => {
      await createImplLog();
      const result = await reviewTaskHandler(
        { action: 'record', specName: 'test-spec', taskId: '1', verdict: 'pass', summary: 'OK', findings: [] },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('prepare');
    });

    it('should reject pass verdict with findings', async () => {
      await createImplLog();
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);

      const result = await reviewTaskHandler(
        {
          action: 'record', specName: 'test-spec', taskId: '1',
          verdict: 'pass', summary: 'OK',
          findings: [{ severity: 'info', title: 'Note', description: 'Something' }]
        },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('zero findings');
    });

    it('should reject fail verdict without criticals', async () => {
      await createImplLog();
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);

      const result = await reviewTaskHandler(
        {
          action: 'record', specName: 'test-spec', taskId: '1',
          verdict: 'fail', summary: 'Bad',
          findings: [{ severity: 'warning', title: 'Warn', description: 'Not critical' }]
        },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('critical finding');
    });

    it('should reject findings verdict with criticals', async () => {
      await createImplLog();
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);

      const result = await reviewTaskHandler(
        {
          action: 'record', specName: 'test-spec', taskId: '1',
          verdict: 'findings', summary: 'Issues',
          findings: [{ severity: 'critical', title: 'Crit', description: 'Bad' }]
        },
        context
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('fail');
    });

    it('should record a passing review', async () => {
      await createImplLog();
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);

      const result = await reviewTaskHandler(
        { action: 'record', specName: 'test-spec', taskId: '1', verdict: 'pass', summary: 'All checks passed', findings: [] },
        context
      );
      expect(result.success).toBe(true);
      expect(result.data.verdict).toBe('pass');
      expect(result.data.version).toBe(1);
      expect(result.data.criticalCount).toBe(0);
    });

    it('should record a failing review with severity counts', async () => {
      await createImplLog();
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);

      const result = await reviewTaskHandler(
        {
          action: 'record', specName: 'test-spec', taskId: '1',
          verdict: 'fail', summary: 'Critical bug',
          findings: [
            { severity: 'critical', title: 'Bug', description: 'desc' },
            { severity: 'warning', title: 'Warn', description: 'desc' },
            { severity: 'info', title: 'Note', description: 'desc' },
          ]
        },
        context
      );
      expect(result.success).toBe(true);
      expect(result.data.criticalCount).toBe(1);
      expect(result.data.warningCount).toBe(1);
      expect(result.data.infoCount).toBe(1);
    });

    it('should increment version on re-review', async () => {
      await createImplLog();

      // First review
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);
      await reviewTaskHandler(
        { action: 'record', specName: 'test-spec', taskId: '1', verdict: 'fail', summary: 'Bad', findings: [{ severity: 'critical', title: 'X', description: 'Y' }] },
        context
      );

      // Second review
      await reviewTaskHandler({ action: 'prepare', specName: 'test-spec', taskId: '1' }, context);
      const result = await reviewTaskHandler(
        { action: 'record', specName: 'test-spec', taskId: '1', verdict: 'pass', summary: 'Fixed', findings: [] },
        context
      );
      expect(result.data.version).toBe(2);
    });
  });
});
