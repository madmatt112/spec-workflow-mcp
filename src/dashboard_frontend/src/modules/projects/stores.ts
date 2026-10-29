// Groups listed projects onto the `.spec-workflow` store they share
// (design.md C10), so the Sidebar counts and the Specs/Deferrals pages key
// on the store rather than on the listed project (Requirement 2). The
// representative is the project whose `projectPath` is the store itself,
// else the first by `projectName` (localeCompare), then `projectId` — the
// same rule the backend's `groupByStore` uses (design C8).
import type { Project } from './ProjectProvider';

export interface StoreGroup {
  store: string;
  representative: Project;
  projects: Project[];
  enabled: boolean;
}

function pickRepresentative(projects: Project[], store: string): Project {
  const own = projects.find((p) => p.projectPath === store);
  if (own) return own;
  return [...projects].sort((a, b) => (
    a.projectName.localeCompare(b.projectName) || a.projectId.localeCompare(b.projectId)
  ))[0];
}

/** One group per distinct `workflowRootPath` among `projects`. */
export function storeGroups(projects: Project[], enabled: (projectId: string) => boolean): StoreGroup[] {
  const byStore = new Map<string, Project[]>();
  for (const p of projects) {
    const list = byStore.get(p.workflowRootPath);
    if (list) list.push(p);
    else byStore.set(p.workflowRootPath, [p]);
  }

  const groups: StoreGroup[] = [];
  for (const [store, groupProjects] of byStore) {
    groups.push({
      store,
      representative: pickRepresentative(groupProjects, store),
      projects: groupProjects,
      enabled: groupProjects.some((p) => enabled(p.projectId)),
    });
  }
  return groups;
}

/** The project's store, else the id itself (the 2.5 s poll has not delivered it yet). */
export function storeOf(projects: Project[], projectId: string): string {
  const p = projects.find((pr) => pr.projectId === projectId);
  return p ? p.workflowRootPath : projectId;
}
