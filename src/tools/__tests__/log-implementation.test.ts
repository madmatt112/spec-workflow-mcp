import { describe, it, expect } from 'vitest';
import { logImplementationTool } from '../log-implementation.js';

describe('log-implementation tool schema', () => {
  it('requires every field on an integrations item', () => {
    const integrations = (logImplementationTool.inputSchema as any)
      .properties.artifacts.properties.integrations;
    expect(integrations.items.required).toEqual([
      'description',
      'frontendComponent',
      'backendEndpoint',
      'dataFlow',
    ]);
  });
});
