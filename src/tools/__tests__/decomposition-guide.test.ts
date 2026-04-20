import { describe, it, expect } from 'vitest';
import { decompositionGuideHandler } from '../decomposition-guide.js';
import { ToolContext } from '../../types.js';

describe('decomposition-guide tool', () => {
  const context: ToolContext = { projectPath: '/tmp/fake' };

  it('returns success', async () => {
    const result = await decompositionGuideHandler({}, context);
    expect(result.success).toBe(true);
  });

  it('returns guide content with key principles', async () => {
    const result = await decompositionGuideHandler({}, context);
    const guide = result.data.guide;

    expect(guide).toContain('INVEST');
    expect(guide).toContain('Vertical Slicing');
    expect(guide).toContain('Reviewability Test');
    expect(guide).toContain('Dependency Ordering');
    expect(guide).toContain('What Is NOT a Spec');
    expect(guide).toContain('Open Questions Protocol');
  });

  it('includes next steps', async () => {
    const result = await decompositionGuideHandler({}, context);
    expect(result.nextSteps).toBeDefined();
    expect(result.nextSteps!.length).toBeGreaterThan(0);
  });
});
