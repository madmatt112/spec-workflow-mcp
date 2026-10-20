// Contract for src/bootstrap/agent-rules.ts and the shipped template (design
// C5; Req 4 AC 1, 3, 4, 5, 7, 9). Three exports under test: templatePath,
// detectFacts, renderAgentRules. No collaborator inside the module is mocked:
// a per-test temp directory stands in for the repository top level, and the
// real shipped template file and the real readAgentRules/parseAgentRuleKey
// readers are used unmocked to prove the round trip.
//
// AC 4.1 — the shipped template's shape.
// 1. The template file exists and holds the five key lines and the four
//    headings, each heading followed by a one-line HTML comment.
//    Pre:  none; reads the real file at templatePath().
//    Call: readFileSync(templatePath(), 'utf-8')
//    Want: contains `worktree-per-change: required`, `worktree-setup:
//          `{{worktree-setup}}``, `tdd-test-command: `{{tdd-test-command}}``,
//          `merge-method: {{merge-method}}`, `merge: auto`, each at column 0;
//          and `## Checks`, `## Sensitive paths`, `## Generated paths`,
//          `## Prose paths`, each immediately followed by a `<!-- ... -->` line.
//    Src:  design.md C5 "Template, in order ..."; requirements.md Req 4 AC 1.
//
// AC 4.3 — detectFacts worktreeSetup order: override, package-lock.json,
// pnpm-lock.yaml, yarn.lock, else left out (null).
// 2. An override wins even when a lockfile is present.
//    Pre:  temp repo top holding package-lock.json.
//    Call: detectFacts(top, { worktreeSetup: 'custom setup' })
//    Want: facts.worktreeSetup === 'custom setup'
// 3. All three lockfiles present -> package-lock.json wins.
//    Pre:  temp repo top holding package-lock.json, pnpm-lock.yaml, yarn.lock.
//    Call: detectFacts(top, {})
//    Want: facts.worktreeSetup === 'npm ci'
// 4. pnpm-lock.yaml and yarn.lock present, no package-lock.json -> pnpm wins.
//    Pre:  temp repo top holding pnpm-lock.yaml, yarn.lock.
//    Call: detectFacts(top, {})
//    Want: facts.worktreeSetup === 'pnpm install'
// 5. Only yarn.lock present -> yarn wins.
//    Pre:  temp repo top holding yarn.lock.
//    Call: detectFacts(top, {})
//    Want: facts.worktreeSetup === 'yarn install'
// 6. No lockfile and no override -> left out (null).
//    Pre:  empty temp repo top.
//    Call: detectFacts(top, {})
//    Want: facts.worktreeSetup === null
//    Src (2-6): design.md C5 "applies Req 4 AC 3-5"; requirements.md Req 4 AC 3.
//
// AC 4.4 — detectFacts testCommand order: override, vitest in
// dependencies/devDependencies, jest, else left out; an unreadable manifest
// means no runner, not an error.
// 7. An override wins even when package.json lists vitest.
//    Pre:  temp repo top with package.json listing devDependencies.vitest.
//    Call: detectFacts(top, { testCommand: 'custom test' })
//    Want: facts.testCommand === 'custom test'
// 8. vitest listed -> 'npx vitest run {files}'.
//    Pre:  package.json devDependencies: { vitest: '1.0.0', jest: '1.0.0' }.
//    Call: detectFacts(top, {})
//    Want: facts.testCommand === 'npx vitest run {files}' (vitest checked first)
// 9. jest listed, no vitest -> 'npx jest {files}'.
//    Pre:  package.json dependencies: { jest: '1.0.0' }.
//    Call: detectFacts(top, {})
//    Want: facts.testCommand === 'npx jest {files}'
// 10. Neither listed, valid package.json -> left out (null).
//     Pre:  package.json with no vitest/jest.
//     Call: detectFacts(top, {})
//     Want: facts.testCommand === null
// 11. Unreadable (unparseable) package.json -> left out (null), does not throw.
//     Pre:  package.json containing invalid JSON text.
//     Call: detectFacts(top, {})
//     Want: does not throw; facts.testCommand === null
//     Src (7-11): design.md C5 "an unreadable manifest means no runner";
//           requirements.md Req 4 AC 4; brief Restrictions "an unreadable
//           package.json means no runner, not an error".
//
// AC 4.5 — mergeMethod: override, else 'merge'.
// 12. Override 'squash' wins.
//     Pre:  none.
//     Call: detectFacts(top, { mergeMethod: 'squash' })
//     Want: facts.mergeMethod === 'squash'
// 13. No override -> defaults to 'merge'.
//     Pre:  none.
//     Call: detectFacts(top, {})
//     Want: facts.mergeMethod === 'merge'
//     Src (12-13): requirements.md Req 4 AC 5.
//
// AC 4.9 — rendered output has no unfilled `{{...}}` placeholder; a null
// fact's line is dropped; a filled single-brace `{files}` token survives.
// 14. Mixed facts (one null, one filled, mergeMethod non-default) render with
//     no placeholder left, the null fact's line dropped, and the filled
//     `{files}` token intact.
//     Pre:  the real shipped template; facts = { worktreeSetup: null,
//           testCommand: 'npx vitest run {files}', mergeMethod: 'squash' }.
//     Call: renderAgentRules(template, facts)
//     Want: no match for /\{\{[a-z-]+\}\}/; no line starting `worktree-setup:`;
//           contains `tdd-test-command: `npx vitest run {files}``;
//           contains `merge-method: squash`.
//     Src:  design.md C5 "drops each line whose placeholder has a null fact
//           and fills the rest"; "the single-brace {files} ... is not
//           template syntax"; requirements.md Req 4 AC 9.
//
// AC 4.7 — on a rendered file, readAgentRules returns worktree 'yes', merge
// 'auto', the written mergeMethod and worktreeSetup; parseAgentRuleKey
// returns the written test command, or null when left out.
// 15. All facts present -> readAgentRules and parseAgentRuleKey round-trip.
//     Pre:  render the real template with facts = { worktreeSetup: 'npm ci',
//           testCommand: 'npx vitest run {files}', mergeMethod: 'squash' };
//           write the result to <tmp>/.spec-workflow/agent-rules.md.
//     Call: readAgentRules(join(tmp, '.spec-workflow')); and
//           parseAgentRuleKey(rendered, 'tdd-test-command')
//     Want: readAgentRules(...) === { worktree: 'yes', merge: 'auto',
//           mergeMethod: 'squash', worktreeSetup: 'npm ci', ... };
//           parseAgentRuleKey(...) === 'npx vitest run {files}'
// 16. testCommand left out -> parseAgentRuleKey returns null.
//     Pre:  render the real template with facts.testCommand = null.
//     Call: parseAgentRuleKey(rendered, 'tdd-test-command')
//     Want: null
//     Src (15-16): design.md C5 post-conditions "readAgentRules and
//           parseAgentRuleKey return the Req 4 AC 7 values"; requirements.md
//           Req 4 AC 7.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { detectFacts, renderAgentRules, templatePath } from '../agent-rules.js';
import { readAgentRules } from '../../dashboard/harness/run-setup.js';
import { parseAgentRuleKey } from '../../core/gate-rules.js';

async function makeRepo(files: Record<string, string>): Promise<string> {
  const dir = join(tmpdir(), `agent-rules-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  await fs.mkdir(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await fs.writeFile(join(dir, name), content, 'utf-8');
  }
  return dir;
}

function headingComments(text: string, heading: string): string {
  const lines = text.split(/\r?\n/);
  const idx = lines.findIndex((l) => l === heading);
  if (idx === -1) return '';
  for (let i = idx + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed === '') continue;
    return trimmed;
  }
  return '';
}

describe('the shipped agent-rules template', () => {
  let text: string;

  beforeEach(() => {
    text = readFileSync(templatePath(), 'utf-8');
  });

  it('holds the five key lines and the four headings, each with a comment', () => {
    expect(text).toMatch(/^worktree-per-change: required$/m);
    expect(text).toMatch(/^worktree-setup: `\{\{worktree-setup\}\}`$/m);
    expect(text).toMatch(/^tdd-test-command: `\{\{tdd-test-command\}\}`$/m);
    expect(text).toMatch(/^merge-method: \{\{merge-method\}\}$/m);
    expect(text).toMatch(/^merge: auto$/m);

    for (const heading of ['## Checks', '## Sensitive paths', '## Generated paths', '## Prose paths']) {
      expect(text).toContain(heading);
      expect(headingComments(text, heading)).toMatch(/^<!--.*-->$/);
    }
  });
});

describe('detectFacts worktreeSetup', () => {
  let dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.map((d) => fs.rm(d, { recursive: true, force: true })));
    dirs = [];
  });

  it('an override wins even when a lockfile is present', async () => {
    const top = await makeRepo({ 'package-lock.json': '{}' });
    dirs.push(top);

    const facts = detectFacts(top, { worktreeSetup: 'custom setup' });

    expect(facts.worktreeSetup).toBe('custom setup');
  });

  it('prefers package-lock.json over pnpm-lock.yaml and yarn.lock', async () => {
    const top = await makeRepo({
      'package-lock.json': '{}',
      'pnpm-lock.yaml': '',
      'yarn.lock': '',
    });
    dirs.push(top);

    const facts = detectFacts(top, {});

    expect(facts.worktreeSetup).toBe('npm ci');
  });

  it('prefers pnpm-lock.yaml over yarn.lock when there is no package-lock.json', async () => {
    const top = await makeRepo({ 'pnpm-lock.yaml': '', 'yarn.lock': '' });
    dirs.push(top);

    const facts = detectFacts(top, {});

    expect(facts.worktreeSetup).toBe('pnpm install');
  });

  it('falls back to yarn.lock when it is the only lockfile', async () => {
    const top = await makeRepo({ 'yarn.lock': '' });
    dirs.push(top);

    const facts = detectFacts(top, {});

    expect(facts.worktreeSetup).toBe('yarn install');
  });

  it('is left out (null) when there is no lockfile and no override', async () => {
    const top = await makeRepo({});
    dirs.push(top);

    const facts = detectFacts(top, {});

    expect(facts.worktreeSetup).toBeNull();
  });
});

describe('detectFacts testCommand', () => {
  let dirs: string[] = [];

  afterEach(async () => {
    await Promise.all(dirs.map((d) => fs.rm(d, { recursive: true, force: true })));
    dirs = [];
  });

  it('an override wins even when package.json lists vitest', async () => {
    const top = await makeRepo({
      'package.json': JSON.stringify({ devDependencies: { vitest: '1.0.0' } }),
    });
    dirs.push(top);

    const facts = detectFacts(top, { testCommand: 'custom test' });

    expect(facts.testCommand).toBe('custom test');
  });

  it('prefers vitest over jest when both are listed', async () => {
    const top = await makeRepo({
      'package.json': JSON.stringify({ devDependencies: { vitest: '1.0.0', jest: '1.0.0' } }),
    });
    dirs.push(top);

    const facts = detectFacts(top, {});

    expect(facts.testCommand).toBe('npx vitest run {files}');
  });

  it('falls back to jest when vitest is not listed', async () => {
    const top = await makeRepo({
      'package.json': JSON.stringify({ dependencies: { jest: '1.0.0' } }),
    });
    dirs.push(top);

    const facts = detectFacts(top, {});

    expect(facts.testCommand).toBe('npx jest {files}');
  });

  it('is left out (null) when neither vitest nor jest is listed', async () => {
    const top = await makeRepo({ 'package.json': JSON.stringify({ dependencies: {} }) });
    dirs.push(top);

    const facts = detectFacts(top, {});

    expect(facts.testCommand).toBeNull();
  });

  it('is left out (null), without throwing, when package.json is unreadable', async () => {
    const top = await makeRepo({ 'package.json': 'not valid json {{{' });
    dirs.push(top);

    expect(() => detectFacts(top, {})).not.toThrow();
    const facts = detectFacts(top, {});

    expect(facts.testCommand).toBeNull();
  });
});

describe('detectFacts mergeMethod', () => {
  it('an override wins', () => {
    const facts = detectFacts('/does/not/matter', { mergeMethod: 'squash' });

    expect(facts.mergeMethod).toBe('squash');
  });

  it('defaults to merge when there is no override', () => {
    const facts = detectFacts('/does/not/matter', {});

    expect(facts.mergeMethod).toBe('merge');
  });
});

describe('renderAgentRules', () => {
  it('drops a null fact\'s line, leaves no unfilled placeholder, and keeps a filled {files} token intact', () => {
    const template = readFileSync(templatePath(), 'utf-8');

    const rendered = renderAgentRules(template, {
      worktreeSetup: null,
      testCommand: 'npx vitest run {files}',
      mergeMethod: 'squash',
    });

    expect(rendered).not.toMatch(/\{\{[a-z-]+\}\}/);
    expect(rendered.split(/\r?\n/).some((l) => l.startsWith('worktree-setup:'))).toBe(false);
    expect(rendered).toContain('tdd-test-command: `npx vitest run {files}`');
    expect(rendered).toContain('merge-method: squash');
  });
});

describe('renderAgentRules round trip through the existing readers', () => {
  let tmpDir: string;
  let storeDir: string;

  beforeEach(async () => {
    tmpDir = join(tmpdir(), `agent-rules-roundtrip-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    storeDir = join(tmpDir, '.spec-workflow');
    await fs.mkdir(storeDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('readAgentRules and parseAgentRuleKey return the written facts when all are present', async () => {
    const template = readFileSync(templatePath(), 'utf-8');
    const rendered = renderAgentRules(template, {
      worktreeSetup: 'npm ci',
      testCommand: 'npx vitest run {files}',
      mergeMethod: 'squash',
    });
    await fs.writeFile(join(storeDir, 'agent-rules.md'), rendered, 'utf-8');

    const result = readAgentRules(storeDir);

    expect(result.worktree).toBe('yes');
    expect(result.merge).toBe('auto');
    expect(result.mergeMethod).toBe('squash');
    expect(result.worktreeSetup).toBe('npm ci');
    expect(parseAgentRuleKey(rendered, 'tdd-test-command')).toBe('npx vitest run {files}');
  });

  it('parseAgentRuleKey returns null for tdd-test-command when it is left out', () => {
    const template = readFileSync(templatePath(), 'utf-8');
    const rendered = renderAgentRules(template, {
      worktreeSetup: 'npm ci',
      testCommand: null,
      mergeMethod: 'merge',
    });

    expect(parseAgentRuleKey(rendered, 'tdd-test-command')).toBeNull();
  });
});
