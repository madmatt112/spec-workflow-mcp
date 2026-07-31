import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { specStatusHandler } from '../spec-status.js';
import { logImplementationHandler } from '../log-implementation.js';
import { approvalsHandler } from '../approvals.js';
import { _resetRootSelection } from '../root-selection.js';
import { ToolContext } from '../../types.js';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'fs/promises';

describe('Tool projectPath fallback behavior', () => {
  const mockContext: ToolContext = {
    projectPath: '/test/project/from/context',
    workspacePath: '/test/project/from/context',
    dashboardUrl: 'http://localhost:5000'
  };

  describe('spec-status tool', () => {
    it('should use context.projectPath when args.projectPath is not provided', async () => {
      const result = await specStatusHandler(
        { specName: 'test-spec' },
        mockContext
      );
      
      // Should not fail due to missing projectPath
      // The actual implementation will fail because the spec doesn't exist,
      // but we can verify the error is not about missing projectPath
      expect(result.success).toBe(false);
      expect(result.message).not.toContain('Project path is required but not provided');
    });

    it('should use args.projectPath when explicitly provided', async () => {
      const result = await specStatusHandler(
        { specName: 'test-spec', projectPath: '/override/path' },
        mockContext
      );
      
      // Should not fail due to missing projectPath
      expect(result.success).toBe(false);
      expect(result.message).not.toContain('Project path is required but not provided');
    });

    it('should fail if neither args.projectPath nor context.projectPath is provided', async () => {
      // Both roots empty: this fixture exercises the "no path at all" arm.
      const emptyContext: ToolContext = { projectPath: '', workspacePath: '' };
      
      const result = await specStatusHandler(
        { specName: 'test-spec' },
        emptyContext
      );
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Project path is required but not provided');
    });
  });

  describe('log-implementation tool', () => {
    it('should use context.projectPath when args.projectPath is not provided', async () => {
      const result = await logImplementationHandler(
        {
          specName: 'test-spec',
          taskId: '1.1',
          summary: 'Test implementation',
          filesModified: [],
          filesCreated: [],
          statistics: { linesAdded: 10, linesRemoved: 5 },
          artifacts: { functions: [] }
        },
        mockContext
      );
      
      // Should not fail due to missing projectPath
      expect(result.success).toBe(false);
      expect(result.message).not.toContain('Project path is required but not provided');
    });

    it('should fail if neither args.projectPath nor context.projectPath is provided', async () => {
      // Both roots empty: this fixture exercises the "no path at all" arm.
      const emptyContext: ToolContext = { projectPath: '', workspacePath: '' };
      
      const result = await logImplementationHandler(
        {
          specName: 'test-spec',
          taskId: '1.1',
          summary: 'Test implementation',
          filesModified: [],
          filesCreated: [],
          statistics: { linesAdded: 10, linesRemoved: 5 },
          artifacts: { functions: [] }
        },
        emptyContext
      );
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Project path is required but not provided');
    });
  });

  describe('approvals tool', () => {
    async function createTempProject(prefix: string): Promise<string> {
      const tempRoot = join(process.cwd(), '.tmp-test-approvals');
      await mkdir(tempRoot, { recursive: true });
      return mkdtemp(join(tempRoot, prefix));
    }

    it('should use context.projectPath for request action when args.projectPath is not provided', async () => {
      const result = await approvalsHandler(
        {
          action: 'request',
          title: 'Test approval',
          filePath: 'test.md',
          type: 'document',
          category: 'spec',
          categoryName: 'test-spec'
        },
        mockContext
      );
      
      // Should not fail due to missing projectPath
      expect(result.success).toBe(false);
      expect(result.message).not.toContain('Project path is required but not provided');
    });

    it('should use context.projectPath for status action when args.projectPath is not provided', async () => {
      const result = await approvalsHandler(
        {
          action: 'status',
          approvalId: 'test-id'
        },
        mockContext
      );
      
      // Should not fail due to missing projectPath
      expect(result.success).toBe(false);
      expect(result.message).not.toContain('Project path is required but not provided');
    });

    it('should fail if neither args.projectPath nor context.projectPath is provided', async () => {
      // Both roots empty: this fixture exercises the "no path at all" arm.
      const emptyContext: ToolContext = { projectPath: '', workspacePath: '' };
      
      const result = await approvalsHandler(
        {
          action: 'request',
          title: 'Test approval',
          filePath: 'test.md',
          type: 'document',
          category: 'spec',
          categoryName: 'test-spec'
        },
        emptyContext
      );
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('Project path is required but not provided');
    });

    it('should not report PathUtils.translatePath error for request action', async () => {
      const result = await approvalsHandler(
        {
          action: 'request',
          title: 'Test approval',
          filePath: 'test.md',
          type: 'document',
          category: 'spec',
          categoryName: 'test-spec'
        },
        mockContext
      );
      
      // The actual error should be about path validation, not about PathUtils
      expect(result.success).toBe(false);
      expect(result.message).not.toContain('PathUtils.translatePath is not a function');
      expect(result.message).not.toContain('PathUtils.translatePath is not available');
    });

    it('should not report PathUtils.translatePath error for status action', async () => {
      const result = await approvalsHandler(
        {
          action: 'status',
          approvalId: 'test-id'
        },
        mockContext
      );
      
      // The actual error should be about path validation, not about PathUtils
      expect(result.success).toBe(false);
      expect(result.message).not.toContain('PathUtils.translatePath is not a function');
      expect(result.message).not.toContain('PathUtils.translatePath is not available');
    });

    it('should not report PathUtils.translatePath error for delete action', async () => {
      const result = await approvalsHandler(
        {
          action: 'delete',
          approvalId: 'test-id'
        },
        mockContext
      );
      
      // The actual error should be about path validation, not about PathUtils
      expect(result.success).toBe(false);
      expect(result.message).not.toContain('PathUtils.translatePath is not a function');
      expect(result.message).not.toContain('PathUtils.translatePath is not available');
    });

    it('should block approval request for markdown with MDX-incompatible content', async () => {
      const tempProject = await createTempProject('specwf-mdx-');
      const relativePath = '.spec-workflow/specs/test-spec/requirements.md';
      const absolutePath = join(tempProject, relativePath);

      try {
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, '# Test\\n\\n- Threshold: <5%\\n', 'utf-8');

        const result = await approvalsHandler(
          {
            action: 'request',
            title: 'Review requirements',
            filePath: relativePath,
            type: 'document',
            category: 'spec',
            categoryName: 'test-spec'
          },
          { projectPath: tempProject, workspacePath: tempProject }
        );

        expect(result.success).toBe(false);
        expect(result.message).toContain('MDX compatibility errors');
        expect(result.nextSteps?.some(step => step.includes('mdx-compile-error'))).toBe(true);
      } finally {
        await rm(tempProject, { recursive: true, force: true });
      }
    });

    it('should block approval request for tasks markdown with MDX-incompatible content', async () => {
      const tempProject = await createTempProject('specwf-mdx-tasks-');
      const relativePath = '.spec-workflow/specs/test-spec/tasks.md';
      const absolutePath = join(tempProject, relativePath);

      try {
        await mkdir(dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, '# Tasks\\n\\n- [ ] 1. Check threshold <5%\\n', 'utf-8');

        const result = await approvalsHandler(
          {
            action: 'request',
            title: 'Review tasks',
            filePath: relativePath,
            type: 'document',
            category: 'spec',
            categoryName: 'test-spec'
          },
          { projectPath: tempProject, workspacePath: tempProject }
        );

        expect(result.success).toBe(false);
        expect(result.message).toContain('MDX compatibility errors');
        expect(result.nextSteps?.some(step => step.includes('mdx-compile-error'))).toBe(true);
      } finally {
        await rm(tempProject, { recursive: true, force: true });
      }
    });
  });

  // Every case above builds a context whose two roots are the same string, so
  // none of them can tell a tool that spends the workflow root apart from one
  // that spends the workspace — both reads land on the same directory. These
  // cases split the roots, give each one a decoy the other does not have, and
  // assert which directory each tool actually reached.
  describe('workflow root and workspace path that differ', () => {
    let tempRoot: string;
    let workflowRoot: string;
    let workspace: string;
    let splitContext: ToolContext;
    let warnSpy: ReturnType<typeof vi.spyOn>;

    async function seedSpec(root: string, specName: string): Promise<string> {
      const specDir = join(root, '.spec-workflow', 'specs', specName);
      await mkdir(specDir, { recursive: true });
      return specDir;
    }

    function logsDir(root: string, specName: string): string {
      return join(root, '.spec-workflow', 'specs', specName, 'Implementation Logs');
    }

    function logArgs(specName: string, extra: Record<string, unknown> = {}) {
      return {
        specName,
        taskId: '1',
        summary: 'Split-root log entry',
        filesModified: [],
        filesCreated: [],
        statistics: { linesAdded: 1, linesRemoved: 0 },
        artifacts: { functions: [] },
        ...extra
      };
    }

    beforeAll(async () => {
      tempRoot = await mkdtemp(join(tmpdir(), 'specwf-split-roots-'));
      workflowRoot = join(tempRoot, 'main-checkout');
      workspace = join(tempRoot, 'worktree');
      await mkdir(workflowRoot, { recursive: true });
      await mkdir(workspace, { recursive: true });

      splitContext = {
        projectPath: workflowRoot,
        workspacePath: workspace,
        dashboardUrl: 'http://localhost:5000'
      };

      // One spec that exists only on the workflow root, one only in the
      // workspace: whichever the tool finds names the root it read.
      await seedSpec(workflowRoot, 'workflow-only-spec');
      await seedSpec(workspace, 'workspace-only-spec');

      // Present under BOTH roots, so a tool reading the wrong one still finds
      // its tasks.md and succeeds — only the log's location gives it away.
      for (const [root, specName] of [
        [workflowRoot, 'log-spec'],
        [workspace, 'log-spec'],
        [workflowRoot, 'log-spec-override'],
        [workspace, 'log-spec-override']
      ] as const) {
        const specDir = await seedSpec(root, specName);
        await writeFile(join(specDir, 'tasks.md'), '# Tasks\n\n- [ ] 1. Do the thing\n', 'utf-8');
      }

      // Same relative filePath under both roots, different content: the
      // workflow root's copy is MDX-hostile, the workspace's is clean.
      const approvalSpecOnRoot = await seedSpec(workflowRoot, 'approval-spec');
      await writeFile(join(approvalSpecOnRoot, 'requirements.md'), '# Test\n\n- Threshold: <5%\n', 'utf-8');
      const approvalSpecInWorkspace = await seedSpec(workspace, 'approval-spec');
      await writeFile(join(approvalSpecInWorkspace, 'requirements.md'), '# Test\n\nNo angle brackets here.\n', 'utf-8');

      // selectRoots warns on every override; silence it rather than let it
      // print through the suite. Task 14 asserts the warning text itself.
      warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterAll(async () => {
      warnSpy?.mockRestore();
      _resetRootSelection();
      await rm(tempRoot, { recursive: true, force: true });
    });

    it('spec-status reads the workflow root, not the workspace', async () => {
      const found = await specStatusHandler({ specName: 'workflow-only-spec' }, splitContext);
      expect(found.success).toBe(true);

      const missed = await specStatusHandler({ specName: 'workspace-only-spec' }, splitContext);
      expect(missed.success).toBe(false);
      expect(missed.message).toContain('not found');
    });

    it('spec-status takes an override verbatim as the workflow root', async () => {
      // spec-status is deliberately NOT one of requirement 3.8's four tools:
      // it reads only `.spec-workflow`, so its override is not re-derived.
      const result = await specStatusHandler(
        { specName: 'workspace-only-spec', projectPath: workspace },
        splitContext
      );
      expect(result.success).toBe(true);
    });

    it('log-implementation writes under the workflow root when the roots differ', async () => {
      const result = await logImplementationHandler(logArgs('log-spec'), splitContext);
      expect(result.success).toBe(true);

      expect(await readdir(logsDir(workflowRoot, 'log-spec'))).toHaveLength(1);
      await expect(readdir(logsDir(workspace, 'log-spec'))).rejects.toThrow();
    });

    it('log-implementation lets an override displace the context workflow root', async () => {
      // The temp workspace is not inside a git repository, so selectRoots
      // degrades the derivation to the override verbatim (and warns). What
      // matters here is that the context's workflow root is no longer used.
      _resetRootSelection();
      const result = await logImplementationHandler(
        logArgs('log-spec-override', { projectPath: workspace }),
        splitContext
      );
      expect(result.success).toBe(true);

      expect(await readdir(logsDir(workspace, 'log-spec-override'))).toHaveLength(1);
      await expect(readdir(logsDir(workflowRoot, 'log-spec-override'))).rejects.toThrow();
    });

    it('approvals resolves a relative filePath against the workflow root', async () => {
      const result = await approvalsHandler(
        {
          action: 'request',
          title: 'Review requirements',
          filePath: '.spec-workflow/specs/approval-spec/requirements.md',
          type: 'document',
          category: 'spec',
          categoryName: 'approval-spec'
        },
        splitContext
      );

      // Only the workflow root's copy carries the MDX-incompatible content.
      expect(result.success).toBe(false);
      expect(result.message).toContain('MDX compatibility errors');
    });

    it('approvals resolves a relative filePath against an override', async () => {
      const result = await approvalsHandler(
        {
          action: 'request',
          title: 'Review requirements',
          filePath: '.spec-workflow/specs/approval-spec/requirements.md',
          type: 'document',
          category: 'spec',
          categoryName: 'approval-spec',
          projectPath: workspace
        },
        splitContext
      );

      // The workspace's copy is clean, so the MDX gate does not fire.
      expect(result.message).not.toContain('MDX compatibility errors');
    });
  });
});
