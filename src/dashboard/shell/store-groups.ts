// src/dashboard/shell/store-groups.ts
//
// Groups projects onto the `.spec-workflow` store they share (design.md C8),
// so the shell feed reads each store once per flush instead of once per
// listed project (Requirement 2.7). The representative is the project whose
// `originalProjectPath` is the store itself, else the first by `projectName`
// (localeCompare), then `projectId` (Requirement 2.5).
import type { ProjectContext } from '../project-manager.js';

export interface StoreGroup {
  workflowRootPath: string;
  projects: ProjectContext[];
  representative: ProjectContext;
}

function pickRepresentative(projects: ProjectContext[], workflowRootPath: string): ProjectContext {
  const own = projects.find((p) => p.originalProjectPath === workflowRootPath);
  if (own) return own;
  return [...projects].sort((a, b) => (
    a.projectName.localeCompare(b.projectName) || a.projectId.localeCompare(b.projectId)
  ))[0];
}

/** One group per distinct `workflowRootPath` among `projects`. */
export function groupByStore(projects: ProjectContext[]): StoreGroup[] {
  const byStore = new Map<string, ProjectContext[]>();
  for (const project of projects) {
    const list = byStore.get(project.workflowRootPath);
    if (list) list.push(project);
    else byStore.set(project.workflowRootPath, [project]);
  }

  const groups: StoreGroup[] = [];
  for (const [workflowRootPath, groupProjects] of byStore) {
    groups.push({
      workflowRootPath,
      projects: groupProjects,
      representative: pickRepresentative(groupProjects, workflowRootPath),
    });
  }
  return groups;
}
