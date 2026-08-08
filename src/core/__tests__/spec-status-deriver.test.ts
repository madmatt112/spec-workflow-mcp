import { describe, it, expect } from 'vitest';
import { deriveSpecStatus } from '../spec-status-deriver.js';
import { SpecData } from '../../types.js';

function makeSpec(p: {
  requirements?: boolean;
  design?: boolean;
  tasks?: boolean;
  progress?: { total: number; completed: number; pending: number; inProgress?: number; unparsed?: number };
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
    taskProgress: p.progress && { inProgress: 0, unparsed: 0, ...p.progress },
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

  // Regression: the implementation loop marks a task `[-]` before working on it, so the
  // last task leaves pending 0 and completed total-1. Without counting inProgress this
  // derived 'ready-for-implementation', which routes to the document loop, which
  // hard-stops back to the implementation loop — the two ping-pong.
  it('reports implementing when the only remaining task is in progress', () => {
    expect(deriveSpecStatus(makeSpec({
      requirements: true,
      design: true,
      tasks: true,
      progress: { total: 3, completed: 2, pending: 0, inProgress: 1 },
    }))).toEqual({ currentPhase: 'implementation', overallStatus: 'implementing' });
  });

  it('reports implementing when the first task is in progress and none are done', () => {
    expect(deriveSpecStatus(makeSpec({
      requirements: true,
      design: true,
      tasks: true,
      progress: { total: 3, completed: 0, pending: 2, inProgress: 1 },
    }))).toEqual({ currentPhase: 'implementation', overallStatus: 'implementing' });
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
