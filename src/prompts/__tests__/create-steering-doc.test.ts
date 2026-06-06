import { describe, it, expect } from 'vitest';
import { createSteeringDocPrompt } from '../create-steering-doc.js';
import { ToolContext } from '../../types.js';

const ctx: ToolContext = { projectPath: '/tmp/project' };

describe('create-steering-doc prompt', () => {
  it('accepts design-system as a valid docType', async () => {
    const messages = await createSteeringDocPrompt.handler({ docType: 'design-system' }, ctx);
    const text = (messages[0].content as { text: string }).text;
    expect(text).toContain('design-system steering document');
    expect(text).toContain('.spec-workflow/steering/design-system.md');
    expect(text).toContain('.spec-workflow/templates/design-system-template.md');
  });

  it('still accepts the original steering doc types', async () => {
    for (const docType of ['product', 'tech', 'structure']) {
      const messages = await createSteeringDocPrompt.handler({ docType }, ctx);
      expect((messages[0].content as { text: string }).text).toContain(`${docType} steering document`);
    }
  });

  it('rejects an unknown docType', async () => {
    await expect(createSteeringDocPrompt.handler({ docType: 'security' }, ctx)).rejects.toThrow(
      /docType must be one of/
    );
  });

  it('requires docType', async () => {
    await expect(createSteeringDocPrompt.handler({}, ctx)).rejects.toThrow(/docType is a required argument/);
  });
});
