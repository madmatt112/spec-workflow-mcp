// src/dashboard/harness/launch-guard.ts
//
// Compares a spec's file list with each store project's code root, so a Next
// tile can warn when the files it would launch on are not under this
// project's repository (design.md C2, Data Models; Requirement 2).
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { parseTasksFromMarkdown } from '../../core/task-parser.js';
import { decompositionEntry } from './run-setup.js';
import type { ProjectContext } from '../project-manager.js';

export type GuardProject = Pick<ProjectContext, 'projectId' | 'projectName' | 'projectPath' | 'workspacePath'>;

export interface LaunchGuard {
  state: 'clear' | 'warn' | 'no-list';
  source: 'tasks' | 'decomposition' | 'none';
  listed: number;      // paths left after the filters
  compared: number;    // listed paths at least one store project holds
  held: number;        // compared paths under this project's code root
  useProject?: string; // project id; set only when state is 'warn'
}

const BACKTICK_TOKEN = /`([^`]+)`/g;
const TRAILING_LINE_SUFFIX = /:\d+(?:-\d+)?$/;

function decompositionPaths(entry: string): string[] {
  const paths: string[] = [];
  for (const match of entry.matchAll(BACKTICK_TOKEN)) {
    const token = match[1];
    if (!token.includes('/')) continue;
    paths.push(token.replace(TRAILING_LINE_SUFFIX, ''));
  }
  return paths;
}

/**
 * The file list for `spec`: the union of `task.files` from `tasks.md`
 * (source `tasks`) when it exists, else the backticked repository paths of
 * the spec's decomposition entry (source `decomposition`), else source
 * `none` with no paths (design C2 "File list, by source").
 */
export function specFileList(workflowRoot: string, spec: string): { source: LaunchGuard['source']; paths: string[] } {
  const tasksPath = join(workflowRoot, 'specs', spec, 'tasks.md');
  if (existsSync(tasksPath)) {
    const { tasks } = parseTasksFromMarkdown(readFileSync(tasksPath, 'utf-8'));
    const paths: string[] = [];
    const seen = new Set<string>();
    for (const task of tasks) {
      for (const file of task.files ?? []) {
        if (seen.has(file)) continue;
        seen.add(file);
        paths.push(file);
      }
    }
    return { source: 'tasks', paths };
  }

  const entry = decompositionEntry(workflowRoot, spec);
  if (entry !== null) {
    return { source: 'decomposition', paths: decompositionPaths(entry) };
  }

  return { source: 'none', paths: [] };
}

/** Drops a path that cannot name a location under a code root (NFR Security). */
function isSafePath(path: string): boolean {
  if (path.startsWith('/')) return false;
  if (path.split('/').includes('..')) return false;
  if (path.startsWith('~')) return false;
  if (/\s/.test(path)) return false;
  if (path.includes('*') || path.includes('<')) return false;
  if (path.startsWith('.spec-workflow/')) return false;
  return true;
}

/**
 * Compares `spec`'s file list against every project's code root and reports
 * whether `project` is the right tile to launch on (design C2 "Compare
 * rule"). Reads only `existsSync`/`readFileSync` under the workflow root and
 * the store projects' `workspacePath`s: no git call, no model call.
 */
export function evaluateLaunchGuard(spec: string, project: GuardProject, storeProjects: GuardProject[]): LaunchGuard {
  const workflowRoot = join(project.projectPath, '.spec-workflow');
  const { source, paths } = specFileList(workflowRoot, spec);
  const listedPaths = paths.filter(isSafePath);
  const listed = listedPaths.length;

  if (listed === 0) {
    return { state: 'no-list', source, listed: 0, compared: 0, held: 0 };
  }

  const holderCounts = new Map<string, number>();
  for (const p of storeProjects) holderCounts.set(p.projectId, 0);

  let compared = 0;
  for (const path of listedPaths) {
    const holders = storeProjects.filter((p) => existsSync(join(p.workspacePath, path)));
    if (holders.length === 0) continue;
    compared += 1;
    for (const holder of holders) {
      holderCounts.set(holder.projectId, (holderCounts.get(holder.projectId) ?? 0) + 1);
    }
  }

  const held = holderCounts.get(project.projectId) ?? 0;

  if (compared === 0) {
    return { state: 'clear', source, listed, compared: 0, held: 0 };
  }

  const maxCount = Math.max(...storeProjects.map((p) => holderCounts.get(p.projectId) ?? 0));
  if (maxCount <= held) {
    return { state: 'clear', source, listed, compared, held };
  }

  const topHolders = storeProjects
    .filter((p) => (holderCounts.get(p.projectId) ?? 0) === maxCount)
    .sort((a, b) => a.projectName.localeCompare(b.projectName));

  return { state: 'warn', source, listed, compared, held, useProject: topHolders[0].projectId };
}
