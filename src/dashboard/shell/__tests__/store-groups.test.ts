import { describe, it, expect } from 'vitest';
import { groupByStore } from '../store-groups.js';
import type { ProjectContext } from '../../project-manager.js';

// Contract for src/dashboard/shell/store-groups.ts (design.md C8; task 9
// _Prompt; Requirements 2.5, 2.7, NFR Performance).
//
// Reached only through `groupByStore(projects)`.
//
// Criterion "one group per store" (task 9 _Prompt: "one group per distinct
//   workflowRootPath"; Requirement 2.7 — the shell feed reads each distinct
//   store once per flush, not once per listed project):
//   Pre-condition: two projects whose `workflowRootPath` is the same string.
//   Test: groupByStore([a, b]).
//   Observable result: the returned array has length 1, and that one
//   group's `projects` contains both input projects' ids.
//   Expected-value source: the literal "one group per distinct
//   workflowRootPath" of the C8 interface sentence.
//
// Criterion "store's own project is representative" (task 9 _Prompt: "the
//   representative is the project whose originalProjectPath equals
//   workflowRootPath"; Requirement 2.5 — Specs rows are to carry the
//   representative project's identity):
//   Pre-condition: three projects sharing one `workflowRootPath`; one has
//   `originalProjectPath` equal to that `workflowRootPath`; the other two
//   do not, and sort before it by name and by id.
//   Test: groupByStore([a, b, c]).
//   Observable result: the group's `representative` is the project whose
//   `originalProjectPath` equals the `workflowRootPath`, not the
//   alphabetically-first one.
//   Expected-value source: the literal "the representative is the project
//   whose originalProjectPath equals workflowRootPath" of the C8 sentence.
//
// Criterion "fallback by name then id" (task 9 _Prompt: "else the first by
//   projectName (localeCompare), then projectId"):
//   Pre-condition: three projects sharing one `workflowRootPath`, none with
//   `originalProjectPath` equal to it; two share the same `projectName`
//   with different `projectId`s, the third has a lexicographically later
//   name.
//   Test: groupByStore([a, b, c]).
//   Observable result: the representative is the project with the
//   lexicographically earliest `projectName`; between the two sharing that
//   name, the one with the lexicographically earliest `projectId`.
//   Expected-value source: the literal "first by projectName
//   (localeCompare), then projectId" of the C8 sentence.

function project(overrides: {
  projectId: string;
  projectName?: string;
  workflowRootPath: string;
  originalProjectPath?: string;
}): ProjectContext {
  return {
    projectId: overrides.projectId,
    projectName: overrides.projectName ?? 'Project',
    projectPath: `/tmp/${overrides.projectId}`,
    workspacePath: `/tmp/${overrides.projectId}`,
    originalProjectPath: overrides.originalProjectPath ?? `/elsewhere/${overrides.projectId}`,
    workflowRootPath: overrides.workflowRootPath,
  } as ProjectContext;
}

describe('groupByStore', () => {
  it('gives one group for two projects on one store', () => {
    const a = project({ projectId: 'a', projectName: 'Alpha', workflowRootPath: '/store/shared' });
    const b = project({ projectId: 'b', projectName: 'Beta', workflowRootPath: '/store/shared' });

    const groups = groupByStore([a, b]);

    expect(groups).toHaveLength(1);
    expect(groups[0].workflowRootPath).toBe('/store/shared');
    expect(groups[0].projects.map((p: ProjectContext) => p.projectId).sort()).toEqual(['a', 'b']);
  });

  it("picks the store's own project as representative over an alphabetically earlier one", () => {
    const store = '/store/shared';
    const earlierName = project({ projectId: 'a', projectName: 'Alpha', workflowRootPath: store });
    const earlierId = project({ projectId: 'a0', projectName: 'Alpha', workflowRootPath: store });
    const own = project({ projectId: 'z', projectName: 'Zeta', workflowRootPath: store, originalProjectPath: store });

    const groups = groupByStore([earlierName, earlierId, own]);

    expect(groups).toHaveLength(1);
    expect(groups[0].representative.projectId).toBe('z');
  });

  it('falls back to the earliest projectName, then the earliest projectId', () => {
    const store = '/store/shared';
    const laterName = project({ projectId: 'x', projectName: 'Zebra', workflowRootPath: store });
    const sameNameLaterId = project({ projectId: 'b', projectName: 'Alpha', workflowRootPath: store });
    const sameNameEarlierId = project({ projectId: 'a', projectName: 'Alpha', workflowRootPath: store });

    const groups = groupByStore([laterName, sameNameLaterId, sameNameEarlierId]);

    expect(groups).toHaveLength(1);
    expect(groups[0].representative.projectId).toBe('a');
  });
});
