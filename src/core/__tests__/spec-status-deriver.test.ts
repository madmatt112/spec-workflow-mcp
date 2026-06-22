import { describe, it, expect } from 'vitest';
import { deriveSpecStatus } from '../spec-status-deriver.js';
import { SpecData } from '../../types.js';

function makeSpec(p: {
  requirements?: boolean;
  design?: boolean;
  tasks?: boolean;
  progress?: { total: number; completed: number; pending: number };
}): SpecData {
  return {
    name: 'demo',
    createdAt: '2020-01-01T00:00:00.000Z',
    lastModified: '2020-01-01T00:00:00.000Z',
    phases: {
      requirements: { exists: !!p.requirements },
      design: { exists: !!p.design },
      tasks: { exists: !!p.tasks },
      implementation: { exists: false },
    },
    taskProgress: p.progress,
  };
}

describe('deriveSpecStatus', () => {
  it('reports requirements when no requirements doc exists', () => {
    expect(deriveSpecStatus(makeSpec({}))).toEqual({
      currentPhase: 'requirements',
      overallStatus: 'requirements-needed',
    });
  });

  it('reports design when requirements exist but design does not', () => {
    expect(deriveSpecStatus(makeSpec({ requirements: true }))).toEqual({
      currentPhase: 'design',
      overallStatus: 'design-needed',
    });
  });

  it('reports tasks when requirements and design exist but tasks do not', () => {
    expect(deriveSpecStatus(makeSpec({ requirements: true, design: true }))).toEqual({
      currentPhase: 'tasks',
      overallStatus: 'tasks-needed',
    });
  });

  it('reports implementing when tasks remain pending', () => {
    expect(deriveSpecStatus(makeSpec({
      requirements: true,
      design: true,
      tasks: true,
      progress: { total: 3, completed: 1, pending: 2 },
    }))).toEqual({ currentPhase: 'implementation', overallStatus: 'implementing' });
  });

  it('reports completed when all tasks are done', () => {
    expect(deriveSpecStatus(makeSpec({
      requirements: true,
      design: true,
      tasks: true,
      progress: { total: 3, completed: 3, pending: 0 },
    }))).toEqual({ currentPhase: 'completed', overallStatus: 'completed' });
  });

  it('reports ready-for-implementation when tasks exist but the list is empty', () => {
    expect(deriveSpecStatus(makeSpec({
      requirements: true,
      design: true,
      tasks: true,
      progress: { total: 0, completed: 0, pending: 0 },
    }))).toEqual({ currentPhase: 'implementation', overallStatus: 'ready-for-implementation' });
  });
});
