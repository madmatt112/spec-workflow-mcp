import { execFileSync } from 'child_process';
import { basename } from 'path';
import { scrubbedGitEnv } from '../core/git-utils.js';

/**
 * The four package.json sections a new runtime or build dependency can appear
 * in (design C2). A name anywhere in `after` but nowhere in `before` is new; a
 * name only moved between these sections, re-versioned or removed is not.
 */
export const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;

/** A read of the names a PR head adds, or one line of why it could not be read. */
export type NewDependenciesResult =
  | { ok: true; names: string[] }
  | { ok: false; reason: string };

/** The union of dependency names over the four sections of a manifest. A
 * missing or non-object manifest, or a non-object section, counts as empty. */
function sectionNames(manifest: unknown): Set<string> {
  const names = new Set<string>();
  if (manifest === null || typeof manifest !== 'object') {
    return names;
  }
  const record = manifest as Record<string, unknown>;
  for (const section of DEPENDENCY_SECTIONS) {
    const value = record[section];
    if (value === null || typeof value !== 'object') {
      continue;
    }
    for (const name of Object.keys(value as Record<string, unknown>)) {
      names.add(name);
    }
  }
  return names;
}

/**
 * The package names `after` adds over `before`: the union of names over the
 * four {@link DEPENDENCY_SECTIONS} of `after` minus the union over `before`,
 * sorted and unique (design C2, R4 AC 1-2). A name only moved between sections,
 * re-versioned or removed is not new. A missing or non-object side is empty.
 */
export function diffNewDependencies(before: unknown, after: unknown): string[] {
  const beforeNames = sectionNames(before);
  const afterNames = sectionNames(after);
  const added: string[] = [];
  for (const name of afterNames) {
    if (!beforeNames.has(name)) {
      added.push(name);
    }
  }
  return added.sort();
}

/** Runs git in `repoDir` and returns its stdout, or null when it fails. The
 * local-git pattern of `src/controller/merge.ts`: `execFileSync` with
 * `scrubbedGitEnv()`, never a `gh` call. */
function gitOrNull(repoDir: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', repoDir, ...args], {
      encoding: 'utf-8',
      env: scrubbedGitEnv(),
    });
  } catch {
    return null;
  }
}

/** The commit sha a ref resolves to, or null when it does not exist. */
function resolveCommit(repoDir: string, ref: string): string | null {
  const out = gitOrNull(repoDir, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  return out ? out.trim() : null;
}

/**
 * The package names the PR `head` adds over `baseBranch`, read from local git
 * with no GitHub call (design C2, R4 AC 1-2, AC 6). Resolves the base as
 * `origin/<baseBranch>` else `<baseBranch>`, takes the merge base with the
 * head, lists the changed `package.json` paths (`--no-renames`) and diffs both
 * sides; a missing base side is empty. A failed git call or a head manifest
 * that does not parse gives `ok: false` with one line of why. Never throws.
 */
export function readNewDependencies(
  repoDir: string,
  baseBranch: string,
  head: string
): NewDependenciesResult {
  try {
    const base =
      resolveCommit(repoDir, `origin/${baseBranch}`) ?? resolveCommit(repoDir, baseBranch);
    if (!base) {
      return { ok: false, reason: `cannot resolve base ref ${baseBranch}` };
    }
    const headCommit = resolveCommit(repoDir, head);
    if (!headCommit) {
      return { ok: false, reason: `cannot resolve head ref ${head}` };
    }

    const mergeBaseOut = gitOrNull(repoDir, ['merge-base', base, headCommit]);
    if (!mergeBaseOut) {
      return { ok: false, reason: `cannot find merge base of ${baseBranch} and ${head}` };
    }
    const mergeBase = mergeBaseOut.trim();

    const diffOut = gitOrNull(repoDir, [
      'diff',
      '--name-only',
      '--no-renames',
      mergeBase,
      headCommit,
    ]);
    if (diffOut === null) {
      return { ok: false, reason: `cannot diff ${mergeBase}..${head}` };
    }
    const paths = diffOut
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0 && basename(p) === 'package.json');

    const names = new Set<string>();
    for (const path of paths) {
      const afterText = gitOrNull(repoDir, ['show', `${headCommit}:${path}`]);
      if (afterText === null) {
        return { ok: false, reason: `cannot read ${path} at head` };
      }
      let afterManifest: unknown;
      try {
        afterManifest = JSON.parse(afterText);
      } catch {
        return { ok: false, reason: `head ${path} is not valid JSON` };
      }

      // A missing base side counts as empty: the manifest is new at head.
      const beforeText = gitOrNull(repoDir, ['show', `${mergeBase}:${path}`]);
      let beforeManifest: unknown;
      if (beforeText !== null) {
        try {
          beforeManifest = JSON.parse(beforeText);
        } catch {
          beforeManifest = undefined;
        }
      }

      for (const name of diffNewDependencies(beforeManifest, afterManifest)) {
        names.add(name);
      }
    }

    return { ok: true, names: [...names].sort() };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: message.split('\n')[0] || 'git call failed' };
  }
}
