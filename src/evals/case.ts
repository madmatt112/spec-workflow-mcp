import { existsSync, readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { reportSchema, type EvalPhase } from './schemas.js';
import { GRADERS } from './graders/index.js';

export interface EvalBrief {
  template: string;
  file: string;
  taskId?: string;
  values: Record<string, unknown>;
  wire?: Record<string, string>;
}

export interface EvalFixtureCommit {
  message: string;
  tree: string;
}

export interface EvalFixtureWorktree {
  dir: string;
  branch: string;
}

export interface EvalFixtureSpec {
  commits: EvalFixtureCommit[];
  preCommitHook?: string;
  worktrees?: EvalFixtureWorktree[];
}

export interface EvalGrader {
  name: string;
  args: Record<string, unknown>;
}

export interface EvalCase {
  id: string;
  role: string;
  phase: EvalPhase;
  spec: string;
  turnCap: number;
  cwd?: string;
  evidence: string;
  briefs: EvalBrief[];
  fixture: EvalFixtureSpec;
  graders: EvalGrader[];
}

export class CaseError extends Error {
  constructor(problems: string[]) {
    super(problems.join('\n'));
    this.name = 'CaseError';
  }
}

const REQUIRED_KEYS = ['id', 'role', 'phase', 'spec', 'turnCap', 'evidence', 'briefs', 'fixture', 'graders'];
const OPTIONAL_KEYS = ['cwd'];
const KNOWN_KEYS = new Set([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);
const PHASES = new Set(['implementation', 'document', 'closeout']);

/** `harness/evals` under this module's package root, resolved as `harnessDir` does (src/controller/step.ts:146-150). */
export function casesRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(resolve(here, '..', '..'), 'harness', 'evals');
}

/** Sorted ids of the directories under `root` that hold a `case.json`. */
export function listCaseIds(root: string = casesRoot()): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'case.json')))
    .map((entry) => entry.name)
    .sort();
}

export function loadCase(id: string, root: string = casesRoot()): EvalCase {
  const caseDir = join(root, id);
  const raw = JSON.parse(readFileSync(join(caseDir, 'case.json'), 'utf8')) as Record<string, unknown>;
  const problems: string[] = [];

  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) problems.push(`unknown key: ${key}`);
  }
  for (const key of REQUIRED_KEYS) {
    if (!(key in raw)) problems.push(`missing key: ${key}`);
  }

  if (typeof raw.id === 'string' && raw.id !== id) {
    problems.push(`id "${raw.id}" does not match directory "${id}"`);
  }

  const phase = raw.phase as string;
  if (typeof phase !== 'string' || !PHASES.has(phase)) {
    problems.push(`phase "${phase}" is not implementation, document or closeout`);
  }

  const role = raw.role as string;
  if (reportSchema(phase as EvalPhase, role) === undefined) {
    problems.push(`no report schema for phase "${phase}" role "${role}"`);
  }

  const turnCap = raw.turnCap;
  if (typeof turnCap !== 'number' || !Number.isInteger(turnCap) || turnCap <= 0) {
    problems.push(`turnCap ${JSON.stringify(turnCap)} is not a positive integer`);
  }

  const graders = Array.isArray(raw.graders) ? (raw.graders as EvalGrader[]) : [];
  for (const grader of graders) {
    if (!(grader.name in GRADERS)) {
      problems.push(`unregistered grader: ${grader.name}`);
    }
  }

  const fixture = raw.fixture as EvalFixtureSpec | undefined;
  for (const commit of fixture?.commits ?? []) {
    if (!existsSync(join(caseDir, commit.tree))) {
      problems.push(`fixture tree does not exist: ${commit.tree}`);
    }
  }

  const spec = raw.spec as string;
  if (typeof spec !== 'string' || !spec.startsWith('eval-')) {
    problems.push(`spec "${spec}" does not start with "eval-"`);
  }

  if (problems.length > 0) throw new CaseError(problems);

  return raw as unknown as EvalCase;
}
