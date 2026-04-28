import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  adversarialReviewHandler,
  adversarialReviewTool,
  getAdversarialReviewMethodology,
  PHASE_ATTACK_ANGLES,
} from '../adversarial-review.js';
import { ToolContext } from '../../types.js';
import { join } from 'path';
import { tmpdir } from 'os';
import { promises as fs } from 'fs';

describe('adversarial-review tool', () => {
  const dirs: string[] = [];

  async function createTempProject(): Promise<string> {
    const dir = join(tmpdir(), `specwf-adv-review-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    await fs.mkdir(dir, { recursive: true });
    dirs.push(dir);
    return dir;
  }

  function ctx(projectPath: string): ToolContext {
    return { projectPath };
  }

  afterEach(async () => {
    for (const dir of dirs) {
      await fs.rm(dir, { recursive: true, force: true });
    }
    dirs.length = 0;
  });

  it('rejects missing specName', async () => {
    const result = await adversarialReviewHandler(
      { phase: 'requirements' },
      ctx('/tmp/fake')
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('specName is required');
  });

  it('rejects missing phase', async () => {
    const result = await adversarialReviewHandler(
      { specName: 'test' },
      ctx('/tmp/fake')
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('phase is required');
  });

  it('fails when target file does not exist', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specDir, { recursive: true });

    const result = await adversarialReviewHandler(
      { specName: 'test-spec', phase: 'requirements' },
      ctx(project)
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('Target file not found');
  });

  it('prepares review successfully for existing spec', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'requirements.md'), '# Requirements\n', 'utf-8');

    const result = await adversarialReviewHandler(
      { specName: 'test-spec', phase: 'requirements' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    expect(result.data.version).toBe(1);
    expect(result.data.phase).toBe('requirements');
    expect(result.data.methodology).toContain('Adversarial Review Methodology');
    expect(result.data.promptOutputPath).toContain('adversarial-prompt-requirements.md');
    expect(result.data.analysisOutputPath).toContain('adversarial-analysis-requirements.md');
    expect(result.data.memoryFilePath).toContain('adversarial-memory-requirements.md');
    expect(result.data.latestAnalysisPath).toBeNull();

    // reviews/ directory should have been created
    const stat = await fs.stat(join(specDir, 'reviews'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('increments version when analysis already exists', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    const reviewsDir = join(specDir, 'reviews');
    await fs.mkdir(reviewsDir, { recursive: true });
    await fs.writeFile(join(specDir, 'requirements.md'), '# Requirements\n', 'utf-8');
    await fs.writeFile(join(reviewsDir, 'adversarial-analysis-requirements.md'), '# Analysis v1\n', 'utf-8');

    const result = await adversarialReviewHandler(
      { specName: 'test-spec', phase: 'requirements' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    expect(result.data.version).toBe(2);
    expect(result.data.promptOutputPath).toContain('-r2.md');
    expect(result.data.analysisOutputPath).toContain('-r2.md');
    // Points to v1 file (no -rN suffix in filename)
    expect(result.data.latestAnalysisPath).toMatch(/adversarial-analysis-requirements\.md$/);
  });

  it('uses methodology override from settings', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'requirements.md'), '# Requirements\n', 'utf-8');
    await fs.writeFile(
      join(project, '.spec-workflow', 'adversarial-settings.json'),
      JSON.stringify({ reviewMethodology: 'Custom review instructions' }),
      'utf-8'
    );

    const result = await adversarialReviewHandler(
      { specName: 'test-spec', phase: 'requirements' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    expect(result.data.methodology).toBe('Custom review instructions');
  });

  it('falls back to default methodology when settings empty', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'requirements.md'), '# Requirements\n', 'utf-8');
    await fs.writeFile(
      join(project, '.spec-workflow', 'adversarial-settings.json'),
      JSON.stringify({ reviewMethodology: '' }),
      'utf-8'
    );

    const result = await adversarialReviewHandler(
      { specName: 'test-spec', phase: 'requirements' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    expect(result.data.methodology).toContain('Adversarial Review Methodology');
  });

  // --- Decomposition phase tests ---

  it('prepares review for decomposition document', async () => {
    const project = await createTempProject();
    const decompDir = join(project, '.spec-workflow', 'spec-decomposition');
    await fs.mkdir(decompDir, { recursive: true });
    await fs.writeFile(join(decompDir, 'decomposition.md'), '# Spec Decomposition\n', 'utf-8');

    const result = await adversarialReviewHandler(
      { specName: 'decomposition', phase: 'decomposition' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    expect(result.data.version).toBe(1);
    expect(result.data.targetFile).toContain('spec-decomposition/decomposition.md');
    expect(result.data.promptOutputPath).toContain('adversarial-prompt-decomposition.md');
    expect(result.data.analysisOutputPath).toContain('adversarial-analysis-decomposition.md');
    expect(result.message).toContain('spec decomposition');
  });

  it('uses steering docs as prior context for decomposition review', async () => {
    const project = await createTempProject();
    const decompDir = join(project, '.spec-workflow', 'spec-decomposition');
    const steeringDir = join(project, '.spec-workflow', 'steering');
    await fs.mkdir(decompDir, { recursive: true });
    await fs.mkdir(steeringDir, { recursive: true });
    await fs.writeFile(join(decompDir, 'decomposition.md'), '# Decomp\n', 'utf-8');
    await fs.writeFile(join(steeringDir, 'product.md'), '# Product\n', 'utf-8');
    await fs.writeFile(join(steeringDir, 'tech.md'), '# Tech\n', 'utf-8');

    const result = await adversarialReviewHandler(
      { specName: 'decomposition', phase: 'decomposition' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    expect(result.data.priorPhaseDocs).toHaveLength(2);
    expect(result.data.priorPhaseDocs[0]).toContain('product.md');
    expect(result.data.priorPhaseDocs[1]).toContain('tech.md');
    expect(result.data.steeringDocs).toHaveLength(0);
  });

  it('creates reviews dir inside spec-decomposition', async () => {
    const project = await createTempProject();
    const decompDir = join(project, '.spec-workflow', 'spec-decomposition');
    await fs.mkdir(decompDir, { recursive: true });
    await fs.writeFile(join(decompDir, 'decomposition.md'), '# Decomp\n', 'utf-8');

    await adversarialReviewHandler(
      { specName: 'decomposition', phase: 'decomposition' },
      ctx(project)
    );

    const stat = await fs.stat(join(decompDir, 'reviews'));
    expect(stat.isDirectory()).toBe(true);
  });

  it('includes decomposition attack angles in methodology', async () => {
    const project = await createTempProject();
    const decompDir = join(project, '.spec-workflow', 'spec-decomposition');
    await fs.mkdir(decompDir, { recursive: true });
    await fs.writeFile(join(decompDir, 'decomposition.md'), '# Decomp\n', 'utf-8');

    const result = await adversarialReviewHandler(
      { specName: 'decomposition', phase: 'decomposition' },
      ctx(project)
    );

    expect(result.data.methodology).toContain('Decomposition');
    expect(result.data.methodology).toContain('INVEST violations');
    expect(result.data.methodology).toContain('vertical slicing');
  });

  it('still requires specName for non-decomposition phases', async () => {
    const result = await adversarialReviewHandler(
      { phase: 'requirements' },
      ctx('/tmp/fake')
    );
    expect(result.success).toBe(false);
    expect(result.message).toContain('specName is required');
  });

  it('discovers prior phase docs', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'requirements.md'), '# Req\n', 'utf-8');
    await fs.writeFile(join(specDir, 'design.md'), '# Design\n', 'utf-8');
    await fs.writeFile(join(specDir, 'tasks.md'), '# Tasks\n', 'utf-8');

    const result = await adversarialReviewHandler(
      { specName: 'test-spec', phase: 'tasks' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    expect(result.data.priorPhaseDocs).toHaveLength(2);
    expect(result.data.priorPhaseDocs[0]).toContain('requirements.md');
    expect(result.data.priorPhaseDocs[1]).toContain('design.md');
  });

  // --- Memory context tests ---

  it('returns memoryFilePath for decomposition reviews', async () => {
    const project = await createTempProject();
    const decompDir = join(project, '.spec-workflow', 'spec-decomposition');
    await fs.mkdir(decompDir, { recursive: true });
    await fs.writeFile(join(decompDir, 'decomposition.md'), '# Decomp\n', 'utf-8');

    const result = await adversarialReviewHandler(
      { specName: 'decomposition', phase: 'decomposition' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    expect(result.data.memoryFilePath).toContain('adversarial-memory-decomposition.md');
  });

  it('returns latestAnalysisPath pointing to highest version', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    const reviewsDir = join(specDir, 'reviews');
    await fs.mkdir(reviewsDir, { recursive: true });
    await fs.writeFile(join(specDir, 'requirements.md'), '# Req\n', 'utf-8');
    await fs.writeFile(join(reviewsDir, 'adversarial-analysis-requirements.md'), 'v1\n', 'utf-8');
    await fs.writeFile(join(reviewsDir, 'adversarial-analysis-requirements-r2.md'), 'v2\n', 'utf-8');

    const result = await adversarialReviewHandler(
      { specName: 'test-spec', phase: 'requirements' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    expect(result.data.version).toBe(3);
    expect(result.data.latestAnalysisPath).toContain('adversarial-analysis-requirements-r2.md');
  });

  it('methodology includes prior review context section', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'requirements.md'), '# Req\n', 'utf-8');

    const result = await adversarialReviewHandler(
      { specName: 'test-spec', phase: 'requirements' },
      ctx(project)
    );

    expect(result.data.methodology).toContain('Working with Prior Review Context');
    expect(result.data.methodology).toContain('Novel');
    expect(result.data.methodology).toContain('Compounding');
    expect(result.data.methodology).toContain('Recurring');
  });

  // --- Scaffolded prompt file tests (Task 4) ---

  it('writes v1 scaffold with only the analysis-dimensions placeholder', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'requirements.md'), '# Req\n', 'utf-8');

    const result = await adversarialReviewHandler(
      { specName: 'test-spec', phase: 'requirements' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    const scaffold = await fs.readFile(result.data.promptOutputPath, 'utf-8');
    expect(scaffold).toContain('PLACEHOLDER:ANALYSIS_DIMENSIONS');
    expect(scaffold).not.toContain('PLACEHOLDER:PRIOR_REVIEW_CONTEXT');
    const outputParts = scaffold.split('## Output');
    expect(outputParts).toHaveLength(2);
    expect(outputParts[1]).toContain(result.data.analysisOutputPath);
  });

  it('writes v2 scaffold with both placeholder blocks referencing memory + latest analysis', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    const reviewsDir = join(specDir, 'reviews');
    await fs.mkdir(reviewsDir, { recursive: true });
    await fs.writeFile(join(specDir, 'requirements.md'), '# Req\n', 'utf-8');
    await fs.writeFile(
      join(reviewsDir, 'adversarial-analysis-requirements.md'),
      '# Analysis v1\n',
      'utf-8'
    );

    const result = await adversarialReviewHandler(
      { specName: 'test-spec', phase: 'requirements' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    expect(result.data.version).toBe(2);
    const scaffold = await fs.readFile(result.data.promptOutputPath, 'utf-8');
    expect(scaffold).toContain('PLACEHOLDER:ANALYSIS_DIMENSIONS');
    expect(scaffold).toContain('PLACEHOLDER:PRIOR_REVIEW_CONTEXT');
    const priorBlockMatch = scaffold.match(
      /<!-- PLACEHOLDER:PRIOR_REVIEW_CONTEXT[\s\S]*?-->/
    );
    expect(priorBlockMatch).not.toBeNull();
    const priorBlock = priorBlockMatch![0];
    expect(priorBlock).toContain(result.data.memoryFilePath);
    expect(priorBlock).toContain(result.data.latestAnalysisPath);
  });

  it('writes decomposition scaffold with phase-specific attack-surface and angles', async () => {
    const project = await createTempProject();
    const decompDir = join(project, '.spec-workflow', 'spec-decomposition');
    await fs.mkdir(decompDir, { recursive: true });
    await fs.writeFile(join(decompDir, 'decomposition.md'), '# Decomp\n', 'utf-8');

    const result = await adversarialReviewHandler(
      { specName: 'decomposition', phase: 'decomposition' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    expect(result.data.promptOutputPath).toContain(
      join('spec-decomposition', 'reviews', 'adversarial-prompt-decomposition.md')
    );
    const scaffold = await fs.readFile(result.data.promptOutputPath, 'utf-8');
    const guidance = PHASE_ATTACK_ANGLES['decomposition'];
    expect(scaffold).toContain(guidance.attackSurface);
    expect(scaffold).toContain(guidance.exampleAngles);
  });

  it('writes a generic scaffold for an unknown phase with all base sections present', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'bogus.md'), '# Bogus\n', 'utf-8');

    const result = await adversarialReviewHandler(
      { specName: 'test-spec', phase: 'bogus' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    const scaffold = await fs.readFile(result.data.promptOutputPath, 'utf-8');
    expect(scaffold).toMatch(/^# Adversarial Review/);
    expect(scaffold).toContain('You are a experienced senior reviewer');
    expect(scaffold).toContain('## Target document');
    expect(scaffold).toContain('## Analysis dimensions');
    expect(scaffold).toContain('PLACEHOLDER:ANALYSIS_DIMENSIONS');
    expect(scaffold).toContain('## Closing deliverables');
    expect(scaffold).toContain('## Output');
  });

  it('returns success: false with the underlying error when scaffold write fails', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'requirements.md'), '# Req\n', 'utf-8');

    const writeFileSpy = vi
      .spyOn(fs, 'writeFile')
      .mockRejectedValueOnce(new Error('disk full'));

    try {
      const result = await adversarialReviewHandler(
        { specName: 'test-spec', phase: 'requirements' },
        ctx(project)
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to write scaffolded prompt');
      expect(result.message).toContain('disk full');
    } finally {
      writeFileSpy.mockRestore();
    }
  });

  it('writes scaffold even when methodology is overridden, and methodology !== scaffold', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'requirements.md'), '# Req\n', 'utf-8');
    await fs.writeFile(
      join(project, '.spec-workflow', 'adversarial-settings.json'),
      JSON.stringify({ reviewMethodology: 'Custom override text' }),
      'utf-8'
    );

    const result = await adversarialReviewHandler(
      { specName: 'test-spec', phase: 'requirements' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    expect(result.data.methodology).toBe('Custom override text');
    const scaffold = await fs.readFile(result.data.promptOutputPath, 'utf-8');
    expect(scaffold).not.toBe(result.data.methodology);
    expect(scaffold).toContain('PLACEHOLDER:ANALYSIS_DIMENSIONS');
  });

  it('uses generic persona for unknown phase even when methodology is overridden', async () => {
    const project = await createTempProject();
    const specDir = join(project, '.spec-workflow', 'specs', 'test-spec');
    await fs.mkdir(specDir, { recursive: true });
    await fs.writeFile(join(specDir, 'bogus.md'), '# Bogus\n', 'utf-8');
    await fs.writeFile(
      join(project, '.spec-workflow', 'adversarial-settings.json'),
      JSON.stringify({ reviewMethodology: 'Custom override text' }),
      'utf-8'
    );

    const result = await adversarialReviewHandler(
      { specName: 'test-spec', phase: 'bogus' },
      ctx(project)
    );

    expect(result.success).toBe(true);
    expect(result.data.methodology).toBe('Custom override text');
    const scaffold = await fs.readFile(result.data.promptOutputPath, 'utf-8');
    expect(scaffold).toContain('You are a experienced senior reviewer');
  });

  it('methodology output contains every PHASE_ATTACK_ANGLES entry verbatim', () => {
    const methodology = getAdversarialReviewMethodology();
    for (const [phase, guidance] of Object.entries(PHASE_ATTACK_ANGLES)) {
      expect(methodology, `attackSurface missing for ${phase}`).toContain(guidance.attackSurface);
      expect(methodology, `exampleAngles missing for ${phase}`).toContain(guidance.exampleAngles);
    }
  });

  it('tool description mentions scaffold and placeholder', () => {
    const desc = adversarialReviewTool.description ?? '';
    expect(desc.toLowerCase()).toContain('scaffold');
    expect(desc.toLowerCase()).toContain('placeholder');
  });
});
