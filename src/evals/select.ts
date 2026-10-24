import { execFileSync, spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, posix } from 'path';
import { pathToFileURL } from 'url';
import { harnessHandler } from '../tools/harness.js';
import type { EvalCase } from './case.js';
import { buildFixture, disposeFixture } from './fixture.js';
import { renderCaseBriefs, type BriefHandler } from './render.js';

export interface SelectCasesOpts {
  repo: string;
  base: string;
  target: string;
  mode: 'exact' | 'provisional';
  baseDist?: string;
}

export interface SelectedCase {
  id: string;
  reasons: string[];
  provisional: boolean;
}

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

function diffNameOnly(repo: string, base: string, target: string): Set<string> {
  const out = git(repo, ['diff', '--name-only', base, target]);
  return new Set(out.split('\n').filter((line) => line.length > 0));
}

/** Sorted ids of every `harness/evals/<id>/case.json` present at `target`. */
function listCaseIdsAtTarget(repo: string, target: string): string[] {
  const out = execFileSync(
    'git',
    ['-C', repo, 'ls-tree', '-r', '--name-only', target, '--', 'harness/evals/'],
    { encoding: 'utf8' },
  );
  const ids = new Set<string>();
  for (const line of out.split('\n')) {
    const match = line.match(/^harness\/evals\/([^/]+)\/case\.json$/);
    if (match) ids.add(match[1]);
  }
  return [...ids].sort();
}

function readFileAt(repo: string, rev: string, path: string): string | undefined {
  try {
    return execFileSync('git', ['-C', repo, 'show', `${rev}:${path}`], { encoding: 'utf8' });
  } catch {
    return undefined;
  }
}

function readJsonAt(repo: string, rev: string, path: string): unknown {
  const raw = readFileAt(repo, rev, path);
  if (raw === undefined) return undefined;
  return JSON.parse(raw);
}

/** `harness/agent-profiles.json`'s entry for `role` differs after parsing both commits; missing counts as `undefined`. */
function profileChanged(repo: string, base: string, target: string, role: string): boolean {
  const path = 'harness/agent-profiles.json';
  const baseProfiles = readJsonAt(repo, base, path) as Record<string, unknown> | undefined;
  const targetProfiles = readJsonAt(repo, target, path) as Record<string, unknown> | undefined;
  return JSON.stringify(baseProfiles?.[role]) !== JSON.stringify(targetProfiles?.[role]);
}

/** Every relative (`./` or `../`) import path a source string names. */
function relativeImportPaths(source: string): string[] {
  const paths: string[] = [];
  const regex = /from\s+['"](\.\.?\/[^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) paths.push(match[1]);
  return paths;
}

/** `src/evals/graders/<name>.ts` changed, or a relative import it names, one hop, changed (design D4). */
function graderChanged(repo: string, target: string, changed: Set<string>, name: string): boolean {
  const graderPath = `src/evals/graders/${name}.ts`;
  if (changed.has(graderPath)) return true;

  const source = readFileAt(repo, target, graderPath);
  if (source === undefined) return false;

  const dir = posix.dirname(graderPath);
  for (const rel of relativeImportPaths(source)) {
    const tsRel = rel.endsWith('.js') ? `${rel.slice(0, -3)}.ts` : rel;
    const resolved = posix.normalize(posix.join(dir, tsRel));
    if (changed.has(resolved)) return true;
  }
  return false;
}

/** Extracts `target`'s `harness/evals/<id>/` into a fresh temp directory via `git archive` piped to `tar` (no checkout). */
function archiveCaseDir(repo: string, target: string, id: string, destParent: string): string {
  const archive = execFileSync('git', ['-C', repo, 'archive', target, `harness/evals/${id}`], {
    maxBuffer: 1024 * 1024 * 64,
  });
  const result = spawnSync('tar', ['-x', '-C', destParent], { input: archive });
  if (result.status !== 0) {
    throw new Error(`tar extract failed: ${result.stderr?.toString() ?? ''}`);
  }
  return join(destParent, 'harness', 'evals', id);
}

/**
 * Renders the case's briefs with `baseDist`'s `harnessHandler` and with this build's own, and
 * returns a `brief <template>` reason per template whose text differs. An unset `baseDist`, a
 * failed import or a base render throw returns `brief: base render unavailable` instead
 * (design Component 7 post-condition 5, Error Handling 8).
 */
async function briefReasonsForCase(
  repo: string,
  target: string,
  id: string,
  baseDist: string | undefined,
): Promise<string[]> {
  const workDir = mkdtempSync(join(tmpdir(), 'eval-select-archive-'));
  try {
    let baseHandler: BriefHandler;
    try {
      if (!baseDist) throw new Error('no baseDist given');
      const mod = (await import(pathToFileURL(join(baseDist, 'tools', 'harness.js')).href)) as {
        harnessHandler: BriefHandler;
      };
      baseHandler = mod.harnessHandler;
    } catch {
      return ['brief: base render unavailable'];
    }

    const caseDir = archiveCaseDir(repo, target, id, workDir);
    const c = JSON.parse(readFileSync(join(caseDir, 'case.json'), 'utf8')) as EvalCase;

    const fixture = buildFixture(c, caseDir);
    try {
      const scratch = join(workDir, 'scratch');
      mkdirSync(scratch, { recursive: true });

      let baseTexts: Record<string, string>;
      try {
        ({ texts: baseTexts } = await renderCaseBriefs(c, fixture, scratch, baseHandler));
      } catch {
        return ['brief: base render unavailable'];
      }

      const { texts: targetTexts } = await renderCaseBriefs(c, fixture, scratch, harnessHandler);

      const reasons: string[] = [];
      for (const template of Object.keys(targetTexts)) {
        if (baseTexts[template] !== targetTexts[template]) reasons.push(`brief ${template}`);
      }
      return reasons;
    } finally {
      disposeFixture(fixture);
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

/**
 * Chooses the eval cases a deploy between `base` and `target` should run (design Component 7,
 * R3 AC1, AC6). Case ids and definitions are read through `git ls-tree` and `git show`, never a
 * checkout.
 */
export async function selectCases(opts: SelectCasesOpts): Promise<SelectedCase[]> {
  const { repo, base, target, mode, baseDist } = opts;

  const changed = diffNameOnly(repo, base, target);
  const ids = listCaseIdsAtTarget(repo, target);
  const briefSourceChanged =
    changed.has('src/tools/brief-templates.ts') || changed.has('src/tools/harness.ts');

  const selected: SelectedCase[] = [];

  for (const id of ids) {
    const reasons: string[] = [];
    let provisional = false;

    const casePrefix = `harness/evals/${id}/`;
    if ([...changed].some((path) => path.startsWith(casePrefix))) reasons.push('case');

    const c = JSON.parse(readFileAt(repo, target, `${casePrefix}case.json`) as string) as EvalCase;

    if (changed.has(`harness/agents/${c.role}.md`)) reasons.push('role');

    if (profileChanged(repo, base, target, c.role)) reasons.push('profile');

    const graderNames = [...new Set(c.graders.map((g) => g.name))];
    for (const name of graderNames) {
      if (graderChanged(repo, target, changed, name)) reasons.push(`grader ${name}`);
    }

    if (mode === 'exact') {
      reasons.push(...(await briefReasonsForCase(repo, target, id, baseDist)));
    } else if (briefSourceChanged) {
      reasons.push('brief source');
      provisional = true;
    }

    if (reasons.length > 0) selected.push({ id, reasons, provisional });
  }

  return selected;
}
