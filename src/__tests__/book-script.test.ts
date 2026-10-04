import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { harnessHandler } from '../tools/harness.js';
import type { ToolContext } from '../types.js';

// Integration test for the NOT-YET-EXISTING `book-script` brief kind (design
// C6 row, C7) and the `book.sh` bookkeeping script it writes (Requirement 6;
// Requirement 3 criterion 5; Requirement 4 criterion 4). `harnessHandler`
// renders `book.sh` into a temp git store that stands in for the run's scratch
// store; the store also doubles as the spec-store repo the commit segment
// commits into, holding `.spec-workflow/specs/<SPEC>` so the commit script's
// hard-coded path list (`harness/skills/sdd-document-phase/references/cleanup.md:81`)
// has something real to add. Stub `event.sh` and `retro.sh` sit beside
// `book.sh` in that store, never the supervisor's `EVENT_SCRIPT` path (brief).
// The script is driven with `execFileSync`, each segment passed as its own
// argv tokens with a literal `--` between segments
// (`harness/skills/sdd-continue/references/formats.md:123`), and assertions
// are made only on exit status and file contents (brief; design Testing
// Strategy, `src/__tests__/run-setup-script.test.ts:9-13` style).

const SPEC = 'my-spec';
const RUN_ID = 'run-20261003-100000';

interface Run {
  status: number;
  stdout: string;
  stderr: string;
}

function run(bookSh: string, args: string[], cwd: string): Run {
  try {
    const stdout = execFileSync('bash', [bookSh, ...args], { cwd, encoding: 'utf8' });
    return { status: 0, stdout, stderr: '' };
  } catch (e: any) {
    return { status: e.status as number, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? '') };
  }
}

function git(repo: string, args: string[]): string {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
}

/** Real `event.sh` body (`harness/skills/sdd-continue/references/formats.md:164-183`)
 * plus one sentinel line, so the test can prove `book.sh` only ever reaches the
 * ledger by calling this script (never by writing the jsonl file itself). */
function eventScriptBody(ledgerPath: string, invocationsLog: string): string {
  return [
    '#!/bin/bash',
    `export SDD_LEDGER="${ledgerPath}"`,
    `export SDD_RUN="${RUN_ID}"`,
    `export SDD_SPEC="${SPEC}"`,
    `echo "EVENT_CALLED $*" >> "${invocationsLog}"`,
    'node -e \'',
    'const [type, ...kv] = process.argv.slice(1);',
    'const e = { ts: new Date().toISOString(), run: process.env.SDD_RUN, spec: process.env.SDD_SPEC, type };',
    'for (const a of kv) { const i = a.indexOf("="); if (i > 0) e[a.slice(0, i)] = a.slice(i + 1); }',
    'require("fs").appendFileSync(process.env.SDD_LEDGER, JSON.stringify(e) + "\\n");',
    'process.stdout.write("event: " + type + " recorded\\n");',
    '\' "$@"',
    '',
  ].join('\n');
}

/** Real `retro.sh` body, verbatim (`.../formats.md:101-117`). */
function retroScriptBody(retroLogPath: string): string {
  return [
    '#!/bin/bash',
    `export SDD_RETRO_LOG="${retroLogPath}"`,
    '[ "$#" -eq 6 ] || { echo "retro.sh: need 6 arguments" >&2; exit 2; }',
    'for a in "$@"; do [ -n "$a" ] || { echo "retro.sh: empty argument" >&2; exit 2; }; done',
    'ts="$(date -u +%Y-%m-%dT%H:%M:%SZ)"',
    '{',
    '  printf \'\\n## %s · %s · %s · %s\\n\' "$ts" "$1" "$2" "$3"',
    '  printf \'%s\\nEvidence: %s\\nCost: %s\\n\' "$4" "$5" "$6"',
    '} >> "$SDD_RETRO_LOG"',
    '',
  ].join('\n');
}

describe('book-script brief kind and book.sh', () => {
  let tempDir: string;
  let context: ToolContext;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'book-script-'));
    context = { projectPath: tempDir, workspacePath: tempDir };
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  /** A fresh git repo standing in for the run's scratch store + spec-store repo. */
  async function makeStore(name: string): Promise<string> {
    const repo = join(tempDir, name);
    await fs.mkdir(repo, { recursive: true });
    git(repo, ['init', '-q', '-b', 'main', '.']);
    git(repo, ['config', 'user.email', 'fixture@example.com']);
    git(repo, ['config', 'user.name', 'Book Script Fixture']);
    await fs.writeFile(join(repo, 'README.md'), '# fixture\n');
    git(repo, ['add', 'README.md']);
    git(repo, ['commit', '-q', '-m', 'Initial commit']);
    return repo;
  }

  async function renderBookScript(
    repo: string,
    overrides: Partial<Record<string, string>> = {},
  ): Promise<string> {
    const values: Record<string, string> = {
      path: join(repo, 'book.sh'),
      eventScript: join(repo, 'event.sh'),
      retroScript: join(repo, 'retro.sh'),
      specDir: join(repo, '.spec-workflow', 'specs', SPEC),
      specStoreRepo: repo,
      codeRoot: repo,
      handoff: join(repo, '.spec-workflow', 'HANDOFF.md'),
      spec: SPEC,
      ...overrides,
    };
    const res = await harnessHandler(
      { action: 'brief', specName: SPEC, template: 'book-script', values },
      context,
    );
    expect(res.success).toBe(true);
    return (res.data as { path: string }).path;
  }

  // Contract: pre-condition -> a fresh git store with no book.sh rendered yet.
  // Test -> harnessHandler({ action: 'brief', template: 'book-script', ... }).
  // Observable result -> success: true and a book.sh file exists at the given
  //   path, executable by `bash`.
  // Expected value source -> design C6 row `book-script` ("write to scratch"),
  //   C7 ("Step 0 writes it with harness brief ... when the file is missing").
  it('renders book.sh at the given scratch path', async () => {
    const repo = await makeStore('render-store');
    const bookSh = await renderBookScript(repo);
    const stat = await fs.stat(bookSh);
    expect(stat.isFile()).toBe(true);
  });

  // Contract: pre-condition -> tasks.md with tasks 3, 5 and 7, all `[ ]`.
  // Test -> `bash book.sh check 5 doing`, then the same call again.
  // Observable result -> only task 5's checkbox becomes `[-]` (tasks 3 and 7
  //   stay `[ ]`); the second run leaves the file byte-identical (idempotent,
  //   no error).
  // Expected value source -> Requirement 4 criterion 4 (the batched
  //   bookkeeping locates the checkbox line itself); design C7 `check` row
  //   ("already landed when: the line is already in that state").
  it('check locates task 5\'s line by id and is idempotent on re-run (4.4)', async () => {
    const repo = await makeStore('check-store');
    const specDir = join(repo, '.spec-workflow', 'specs', SPEC);
    await fs.mkdir(specDir, { recursive: true });
    const tasksPath = join(specDir, 'tasks.md');
    const original = ['# Tasks', '', '- [ ] 3. Earlier task', '- [ ] 5. Add thing', '- [ ] 7. Later task', ''].join('\n');
    await fs.writeFile(tasksPath, original);
    const bookSh = await renderBookScript(repo, { specDir });

    const first = run(bookSh, ['check', '5', 'doing'], repo);
    expect(first.status).toBe(0);
    const afterFirst = await fs.readFile(tasksPath, 'utf-8');
    expect(afterFirst).toContain('- [-] 5. Add thing');
    expect(afterFirst).toContain('- [ ] 3. Earlier task');
    expect(afterFirst).toContain('- [ ] 7. Later task');

    const second = run(bookSh, ['check', '5', 'doing'], repo);
    expect(second.status).toBe(0);
    const afterSecond = await fs.readFile(tasksPath, 'utf-8');
    expect(afterSecond).toBe(afterFirst);
  });

  // Contract: pre-condition -> an empty ledger file and a stub `event.sh` that
  //   appends to it and logs each call it receives.
  // Test -> `bash book.sh event task.pick task=7 "title=Foo Bar"`.
  // Observable result -> the stub is invoked exactly once (its invocation
  //   log has exactly one line), and the ledger's one row has exactly the keys
  //   `ts, run, spec, type, task, title` with `type=task.pick`, `task=7`,
  //   `title=Foo Bar` unaltered from what was passed.
  // Expected value source -> Requirement 6 criterion 4 ("append rows only
  //   through EVENT_SCRIPT") and criterion 5 ("ledger row types and keys
  //   SHALL be unchanged"); design C7 `event` row.
  it('event routes only through the stub event.sh, keeping row type and keys unchanged (6.4, 6.5)', async () => {
    const repo = await makeStore('event-store');
    const ledgerPath = join(repo, 'harness-events.jsonl');
    const invocationsLog = join(repo, 'event-invocations.log');
    await fs.writeFile(ledgerPath, '');
    await fs.writeFile(invocationsLog, '');
    const eventScript = join(repo, 'event.sh');
    await fs.writeFile(eventScript, eventScriptBody(ledgerPath, invocationsLog));
    const bookSh = await renderBookScript(repo, { eventScript });

    const result = run(bookSh, ['event', 'task.pick', 'task=7', 'title=Foo Bar'], repo);
    expect(result.status).toBe(0);

    const invocations = (await fs.readFile(invocationsLog, 'utf-8')).trim().split('\n').filter(Boolean);
    expect(invocations.length).toBe(1);

    const rows = (await fs.readFile(ledgerPath, 'utf-8')).trim().split('\n').filter(Boolean);
    expect(rows.length).toBe(1);
    const row = JSON.parse(rows[0]);
    expect(Object.keys(row).sort()).toEqual(['run', 'spec', 'task', 'title', 'ts', 'type'].sort());
    expect(row.type).toBe('task.pick');
    expect(row.task).toBe('7');
    expect(row.title).toBe('Foo Bar');
    expect(row.run).toBe(RUN_ID);
  });

  // Contract: pre-condition -> a spec-store repo with a clean working tree
  //   (nothing staged, nothing changed since the initial commit).
  // Test -> `bash book.sh commit "docs(sdd): my-spec task 1"`.
  // Observable result -> exit 0 and no new commit is created (the commit log
  //   still shows only the initial commit) — the commit segment itself skips
  //   when nothing is staged, so the orchestrator needs no separate call into
  //   `cleanup.md`'s commit-script logic for this case.
  // Expected value source -> Requirement 3 criterion 5 (the close path's
  //   commit comes from the Requirement 6 batch script, not a `cleanup.md`
  //   read); design C7 `commit` row ("already landed when: nothing staged"),
  //   quoting `harness/skills/sdd-document-phase/references/cleanup.md:86`
  //   ("nothing to commit").
  it('commit skips without creating a commit when nothing is staged (3.5)', async () => {
    const repo = await makeStore('commit-skip-store');
    const bookSh = await renderBookScript(repo);

    const before = git(repo, ['log', '--oneline']);
    const result = run(bookSh, ['commit', 'docs(sdd): my-spec task 1'], repo);
    expect(result.status).toBe(0);
    const after = git(repo, ['log', '--oneline']);
    expect(after).toBe(before);
  });

  // Contract: pre-condition -> an unknown segment name.
  // Test -> `bash book.sh not-a-real-segment`.
  // Observable result -> exit code 2.
  // Expected value source -> design C7 Output bullet ("usage error exit 2")
  //   and Error Handling 7 ("Exit 2 (usage) is PHASE: error").
  it('exits 2 on an unknown segment name (usage error)', async () => {
    const repo = await makeStore('usage-error-store');
    const bookSh = await renderBookScript(repo);

    const result = run(bookSh, ['not-a-real-segment'], repo);
    expect(result.status).toBe(2);
  });

  // Contract: pre-condition -> a fully composed run (every segment: check,
  //   event, head, edit, changes, retro, state, commit, then a trailing
  //   event) with the spec-store repo's `.git/index.lock` held, so `commit`'s
  //   `git add` fails.
  // Test -> run the full composed `bash book.sh <segments>` command once with
  //   the lock held, then release the lock and run the exact same command
  //   again.
  // Observable result -> first run: exit 1, the failure output names the
  //   `commit` segment, and the trailing `event task.done` (after the failed
  //   commit) never lands in the ledger. Second run: exit 0, the ledger still
  //   has exactly one `task.pick` row (not doubled) and now exactly one
  //   `task.done` row, the retro log has exactly one entry for this run (not
  //   doubled), the checkbox and edited file are unchanged from the first
  //   run, and the commit now lands exactly once.
  // Expected value source -> Requirement 6 criterion 6 ("exit non-zero naming
  //   the step that failed ... no later segment runs") and criterion 7
  //   ("idempotent: every write it makes SHALL land exactly once across
  //   re-runs ... a re-run after a partial failure double-appends neither a
  //   ledger row ... nor the retro log, and never re-commits"); design C7
  //   Output bullet and Compositions.
  it('a partial failure exits 1 naming the failed segment; the re-run lands every step exactly once (6.6, 6.7)', async () => {
    const repo = await makeStore('idempotent-store');
    const specDir = join(repo, '.spec-workflow', 'specs', SPEC);
    await fs.mkdir(specDir, { recursive: true });
    const tasksPath = join(specDir, 'tasks.md');
    await fs.writeFile(
      tasksPath,
      ['# Tasks', '', '- [ ] 5. Add thing', ''].join('\n'),
    );
    const greetingPath = join(specDir, 'greeting.txt');
    await fs.writeFile(greetingPath, 'Hello OLDTEXT world\n');
    const promptPath = join(specDir, 'prompt.md');
    await fs.writeFile(promptPath, '# Prompt\n');
    const handoffPath = join(repo, '.spec-workflow', 'HANDOFF.md');
    await fs.mkdir(join(repo, '.spec-workflow'), { recursive: true });
    await fs.writeFile(handoffPath, '# HANDOFF\n');

    const ledgerPath = join(repo, 'harness-events.jsonl');
    const invocationsLog = join(repo, 'event-invocations.log');
    await fs.writeFile(ledgerPath, '');
    await fs.writeFile(invocationsLog, '');
    const eventScript = join(repo, 'event.sh');
    await fs.writeFile(eventScript, eventScriptBody(ledgerPath, invocationsLog));
    const retroLogPath = join(repo, 'retrospective-log.md');
    await fs.writeFile(retroLogPath, '# Retrospective log\n');
    const retroScript = join(repo, 'retro.sh');
    await fs.writeFile(retroScript, retroScriptBody(retroLogPath));

    const bookSh = await renderBookScript(repo, {
      specDir,
      eventScript,
      retroScript,
      handoff: handoffPath,
    });

    const args = [
      'check', '5', 'doing', '--',
      'event', 'task.pick', 'task=5', 'title=Add thing', '--',
      'head', '--',
      'edit', greetingPath, 'OLDTEXT', 'NEWTEXT', '--',
      'changes', 'design', '1', promptPath, '--',
      'retro', 'implementation', 'task 5', 'gotcha', 'testing retro', 'n/a', 'n/a', '--',
      'state', 'tasks 5/10', '--',
      'commit', 'docs(sdd): my-spec task 5', '--',
      'event', 'task.done', 'task=5',
    ];

    // Hold the index lock so `commit`'s `git add -A` fails.
    const lockPath = join(repo, '.git', 'index.lock');
    await fs.writeFile(lockPath, '');

    const first = run(bookSh, args, repo);
    expect(first.status).toBe(1);
    expect(first.stdout + first.stderr).toMatch(/commit/);
    expect(first.stdout + first.stderr).toMatch(/failed/);

    const rowsAfterFirst = (await fs.readFile(ledgerPath, 'utf-8')).trim().split('\n').filter(Boolean)
      .map((l) => JSON.parse(l));
    expect(rowsAfterFirst.filter((r) => r.type === 'task.pick').length).toBe(1);
    expect(rowsAfterFirst.filter((r) => r.type === 'task.done').length).toBe(0);

    const tasksAfterFirst = await fs.readFile(tasksPath, 'utf-8');
    expect(tasksAfterFirst).toContain('- [-] 5. Add thing');
    const greetingAfterFirst = await fs.readFile(greetingPath, 'utf-8');
    expect(greetingAfterFirst).toContain('NEWTEXT');
    expect(greetingAfterFirst).not.toContain('OLDTEXT');

    const logBeforeRetry = git(repo, ['log', '--oneline']);

    // Release the lock and re-run the exact same composed command.
    await fs.rm(lockPath);
    const second = run(bookSh, args, repo);
    expect(second.status).toBe(0);

    const rowsAfterSecond = (await fs.readFile(ledgerPath, 'utf-8')).trim().split('\n').filter(Boolean)
      .map((l) => JSON.parse(l));
    expect(rowsAfterSecond.filter((r) => r.type === 'task.pick').length).toBe(1);
    expect(rowsAfterSecond.filter((r) => r.type === 'task.done').length).toBe(1);

    const retroLogAfter = await fs.readFile(retroLogPath, 'utf-8');
    const markerCount = (retroLogAfter.match(new RegExp(`mark ${RUN_ID} [0-9a-f]{8}`, 'g')) ?? []).length;
    expect(markerCount).toBe(1);

    const tasksAfterSecond = await fs.readFile(tasksPath, 'utf-8');
    expect(tasksAfterSecond).toBe(tasksAfterFirst);
    const greetingAfterSecond = await fs.readFile(greetingPath, 'utf-8');
    expect(greetingAfterSecond).toBe(greetingAfterFirst);

    const logAfterRetry = git(repo, ['log', '--oneline']);
    expect(logAfterRetry).not.toBe(logBeforeRetry);
    const commitCount = logAfterRetry.split('\n').filter((l) => l.includes('docs(sdd): my-spec task 5')).length;
    expect(commitCount).toBe(1);
  });
});
