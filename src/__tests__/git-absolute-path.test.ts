import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname, relative } from 'path';
import { fileURLToPath } from 'url';

// retro P2/F2, G2: a bare `git`/`diff` in a shell script or in harness command
// text is silently rewritten by the rtk shell hook, so the command uses the
// wrong output (self-update's BASE line, spec-lint, tdd-task-loop F5/F8). The
// Git rule in agent-rules.md ("Use /usr/bin/git in scripts") was unenforced, so
// lines kept slipping. This check greps scripts/*.sh and harness/*.md for a bare
// `git`/`diff` command and fails until each is pinned to /usr/bin/.
//
// Scope and skips (the finding allows a skip-regex for comments and prose):
// - `.sh`: every non-comment line is command text.
// - `.md`: only fenced ``` code blocks are command text; inline code and prose
//   (e.g. "diff your delta", `git add`) are skipped.
// - Node scripts (.cjs/.mjs) are out of scope: their execSync strings are not
//   shell and must stay cross-platform.
// - scripts/prototypes and scripts/one-off are throwaway design probes.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/**
 * The git/diff command words on one line that are not pinned to /usr/bin/.
 * A token counts as a command only in command position (line start or after a
 * shell separator); the `git diff` subcommand is exempt because a git command
 * word precedes it.
 */
export function bareGitDiff(line: string): string[] {
  const found: string[] = [];
  const re = /(^|[\s;&|(){}`])(\/usr\/bin\/)?(git|diff)\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m[2]) continue; // already /usr/bin/-pinned
    if (m[3] === 'diff') {
      const before = line.slice(0, m.index);
      if (/(^|[\s;&|(){}`])(\/usr\/bin\/)?git\b[^;&|]*$/.test(before)) continue; // git subcommand
    }
    found.push(m[3]);
  }
  return found;
}

/** `scripts/*.sh` (non-comment lines) and `harness/*.md` (fenced blocks only). */
function offenders(): string[] {
  const hits: string[] = [];
  const scan = (text: string, fencedOnly: boolean, rel: string): void => {
    let fenced = false;
    text.split('\n').forEach((line, i) => {
      if (/^\s*```/.test(line)) { fenced = !fenced; return; }
      if (fencedOnly && !fenced) return;
      if (!fencedOnly && /^\s*#/.test(line)) return;
      for (const cmd of bareGitDiff(line)) hits.push(`${rel}:${i + 1} bare ${cmd}`);
    });
  };
  const walk = (dir: string, visit: (abs: string) => void): void => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const abs = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(abs, visit); }
      else visit(abs);
    }
  };
  walk(join(repoRoot, 'scripts'), (abs) => {
    const rel = relative(repoRoot, abs);
    if (!abs.endsWith('.sh')) return;
    if (rel.includes('prototypes/') || rel.includes('one-off/')) return;
    scan(readFileSync(abs, 'utf-8'), false, rel);
  });
  walk(join(repoRoot, 'harness'), (abs) => {
    if (!abs.endsWith('.md')) return;
    scan(readFileSync(abs, 'utf-8'), true, relative(repoRoot, abs));
  });
  return hits;
}

describe('git absolute-path check (retro P2/F2, G2)', () => {
  it('flags a bare git/diff command and passes the pinned and subcommand forms', () => {
    expect(bareGitDiff('BASE="$(git rev-parse HEAD)"')).toEqual(['git']);
    expect(bareGitDiff('    git -C "$REPO" fetch origin')).toEqual(['git']);
    expect(bareGitDiff('diff a b')).toEqual(['diff']);
    expect(bareGitDiff('BASE="$(/usr/bin/git rev-parse HEAD)"')).toEqual([]);
    expect(bareGitDiff('/usr/bin/git -C "$R" diff --name-only x...y')).toEqual([]);
    expect(bareGitDiff('echo "$REPO/.git holds a digit, legit"')).toEqual([]);
    expect(bareGitDiff('the base-diff guard runs first')).toEqual([]);
  });

  it('every tracked script and harness command uses /usr/bin/git', () => {
    expect(offenders()).toEqual([]);
  });
});
