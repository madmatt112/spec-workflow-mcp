import { join } from 'path';

/** A grader's read-only view of the run's fixture repository (Component 5). */
export interface FixtureView {
  root: string;
  bases: Record<string, string>;
  git(cwd: string, args: string[]): string;
}

export interface GradeInput {
  report: unknown;
  fixture: FixtureView;
}

export interface GradeResult {
  pass: boolean;
  reason: string;
}

export interface Grader {
  grade(input: GradeInput, args: Record<string, unknown>): GradeResult;
}

/** Runs git in the fixture repo named by `repo` ('.' for the root, else a worktree dir). */
export function gitIn(fixture: FixtureView, repo: string, args: string[]): string {
  const cwd = repo === '.' ? fixture.root : join(fixture.root, repo);
  return fixture.git(cwd, args);
}

interface ReportItem {
  id: string;
  status?: string;
  commit?: string;
  [key: string]: unknown;
}

/** Looks up a report item by `items[].id`; undefined when the report has no such item. */
export function findReportItem(report: unknown, id: string): ReportItem | undefined {
  const items = (report as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) return undefined;
  return items.find((item) => (item as { id?: unknown })?.id === id) as ReportItem | undefined;
}
