import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { openRunLedger, newRunId, checkpoint, StepUsage } from '../ledger.js';
import { buildModel, parseJsonl, LedgerEvent } from '../../watch/ledger.js';
import { render } from '../../watch/render.js';
import { gateOrRuling } from '../../dashboard/shell/waits.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function tmpDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** A clock that returns the given ISO stamps in order, one per row written. */
function clockFrom(isos: string[]): () => Date {
  let i = 0;
  return () => new Date(isos[i++]);
}

function readRows(path: string): LedgerEvent[] {
  return parseJsonl<LedgerEvent>(readFileSync(path, 'utf8'));
}

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf-8' });
}

function initRepo(): string {
  const repo = tmpDir('ctrl-ckpt-');
  git(repo, ['init', '-q']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'user.name', 'Test']);
  return repo;
}

// A complete controller implementation run covering every row type the module writes.
const RUN = 'run-20260912-190000';
const SPEC = 's';
const IMPL_TS = [
  '2026-09-12T19:00:00.000Z', // run.start
  '2026-09-12T19:00:10.000Z', // spawn.start orchestrator
  '2026-09-12T19:00:20.000Z', // phase.start
  '2026-09-12T19:01:00.000Z', // task.pick
  '2026-09-12T19:01:05.000Z', // spawn.start implementer
  '2026-09-12T19:06:00.000Z', // spawn.end implementer
  '2026-09-12T19:06:01.000Z', // spawn.usage implementer
  '2026-09-12T19:06:10.000Z', // note
  '2026-09-12T19:06:20.000Z', // task.done
  '2026-09-12T19:10:00.000Z', // spawn.end orchestrator
  '2026-09-12T19:10:05.000Z', // phase.end
  '2026-09-12T19:10:10.000Z', // run.end
];

/** Write the full implementation run through the module and return the ledger path. */
function writeImplRun(): string {
  const dir = tmpDir('ctrl-ledger-');
  const led = openRunLedger({ specDir: dir, runId: RUN, spec: SPEC, now: clockFrom(IMPL_TS) });
  led.runStart({ model: 'fable-5-1', codeRoot: '/home/x/.claude/worktrees/s', worktree: 'yes', headless: 'yes', setup: 'controller' });
  led.spawnStart({ agent: 'sdd-implementation-orchestrator', role: 'implementation phase, spawn 1' });
  led.phaseStart('implementation', { mode: 'normal', budget: '6 tasks', state: 'tasks 2/8' });
  led.taskPick({ task: '3', title: 'API errors and query layer' });
  led.spawnStart({ agent: 'sdd-implementer', role: 'implement task 3' });
  led.spawnEnd({
    agent: 'sdd-implementer',
    usage: { input: 10000, output: 4000, cacheRead: 40000, cacheWrite5m: 20000, cacheWrite1h: 10000 },
    model: 'claude-opus-4-8',
    agentId: 'a1',
  });
  led.spawnUsage({ agent: 'sdd-implementer', role: 'implement task 3', result: 'logged: yes/3', phase: 'implementation', task: '3' });
  led.note('ruling: proceed despite flaky e2e');
  led.taskDone({ task: '3', rounds: 1, outcome: 'pass' });
  led.spawnEnd({
    agent: 'sdd-implementation-orchestrator',
    usage: { input: 50, output: 500, cacheRead: 1000000, cacheWrite5m: 0, cacheWrite1h: 80000 },
    model: 'claude-opus-4-8',
    agentId: 'o1',
  });
  led.phaseEnd('implementation', { result: 'complete', state: 'tasks 3/8', note: 'budget' });
  led.runEnd('fable:s implementation tasks 3/8 - complete');
  return led.path;
}

describe('openRunLedger row formats', () => {
  it('writes ts/run/spec/type first and every count as a string', () => {
    const lines = readFileSync(writeImplRun(), 'utf8').trim().split('\n');
    for (const line of lines) {
      expect(line).toMatch(/^\{"ts":"[^"]+","run":"run-20260912-190000","spec":"s","type":"[a-z.]+"/);
    }
    const spawnEnd = lines.find((l) => l.includes('"type":"spawn.end"') && l.includes('"agent":"sdd-implementer"'))!;
    // tokens = input+output+cacheRead+cacheWrite5m+cacheWrite1h; cacheWrite = 5m+1h; all quoted strings.
    expect(spawnEnd).toContain('"input":"10000"');
    expect(spawnEnd).toContain('"output":"4000"');
    expect(spawnEnd).toContain('"cacheWrite":"30000"');
    expect(spawnEnd).toContain('"cacheRead":"40000"');
    expect(spawnEnd).toContain('"tokens":"84000"');
    expect(spawnEnd).toContain('"cacheWrite5m":"20000"');
    expect(spawnEnd).toContain('"cacheWrite1h":"10000"');
    expect(spawnEnd).toContain('"model":"claude-opus-4-8"');
    expect(spawnEnd).toContain('"agentId":"a1"');
  });

  it('writes a usage field of `unknown` and an unknown-tainted sum as `unknown`', () => {
    const dir = tmpDir('ctrl-ledger-');
    const led = openRunLedger({ specDir: dir, runId: RUN, spec: SPEC, now: clockFrom(['2026-09-12T19:00:00.000Z']) });
    const usage: StepUsage = { input: 'unknown', output: 4000, cacheRead: 40000, cacheWrite5m: 20000, cacheWrite1h: 10000 };
    led.spawnEnd({ agent: 'sdd-implementer', usage });
    const line = readFileSync(led.path, 'utf8').trim();
    expect(line).toContain('"input":"unknown"');
    expect(line).toContain('"tokens":"unknown"');
    // cacheWrite has no unknown addends, so it is still a number.
    expect(line).toContain('"cacheWrite":"30000"');
  });
});

describe('every row type round-trips through the watch model', () => {
  const path = writeImplRun();
  const rows = readRows(path);
  const model = buildModel({ spec: SPEC, ledger: rows, activity: [] });

  it('reads the run header, phases and status', () => {
    expect(model.runId).toBe(RUN);
    expect(model.model).toBe('fable-5-1');
    expect(model.worktree).toBe('yes');
    expect(model.headless).toBe('yes');
    expect(model.livePhase).toBeUndefined(); // run.end present
    expect(model.status).toContain('complete');
    expect(model.phases.some((p) => p.phase === 'implementation' && p.result === 'complete' && p.state === 'tasks 3/8')).toBe(true);
  });

  it('reads spawns, tokens, picks and the note', () => {
    const impl = model.spawns.find((s) => s.agent === 'sdd-implementer')!;
    expect(impl.level).toBe(2);
    expect(impl.role).toBe('implement task 3'); // from the folded spawn.usage
    expect(impl.result).toBe('logged: yes/3');
    expect(impl.tokens).toBe(84000);
    expect(impl.input).toBe(10000);
    expect(impl.cacheWrite).toBe(30000);
    const orch = model.spawns.find((s) => s.agent === 'sdd-implementation-orchestrator')!;
    expect(orch.level).toBe(1);
    expect(orch.tokens).toBe(1080550);
    expect(model.tokensTotal).toBe(84000 + 1080550);
    expect(model.picks).toEqual([{ task: '3', title: 'API errors and query layer', done: true, outcome: 'pass' }]);
  });

  it('round-trips the round, note and run.end rows through the parser', () => {
    expect(rows.some((e) => e.type === 'note' && e.text === 'ruling: proceed despite flaky e2e')).toBe(true);
    expect(rows.some((e) => e.type === 'run.end' && e.status === 'fable:s implementation tasks 3/8 - complete')).toBe(true);
    // A note that lands in the last four events does surface in the model ticker.
    expect(model.ticker.some((t) => t.text.startsWith('phase.end'))).toBe(true);
  });
});

describe('a module-written ledger renders like a real run', () => {
  it('equals the rendered output of the real fixture ledger (replayed through the API)', () => {
    const real = readRows(join(HERE, 'fixtures', 'real-closeout-run.jsonl'));
    const dir = tmpDir('ctrl-ledger-');
    const nonReport = real.filter((e) => e.type !== 'spawn.report'); // spawn.report is a hook row; not a controller row
    const led = openRunLedger({
      specDir: dir,
      runId: real[0].run!,
      spec: real[0].spec!,
      now: clockFrom(nonReport.map((e) => e.ts)),
    });
    const num = (v: string | undefined): StepUsage['input'] => (v === undefined || v === 'unknown' ? 'unknown' : Number(v));
    for (const e of nonReport) {
      switch (e.type) {
        case 'run.start': {
          const { ts, run, spec, type, ...fields } = e;
          void ts; void run; void spec; void type;
          led.runStart(fields as Record<string, string>);
          break;
        }
        case 'run.end': led.runEnd(e.status ?? ''); break;
        case 'phase.start': led.phaseStart(e.phase ?? '', { mode: e.mode, budget: e.budget, state: e.state }); break;
        case 'phase.end': led.phaseEnd(e.phase ?? '', { result: e.result ?? '', state: e.state, note: e.note }); break;
        case 'round': led.round({ phase: e.phase ?? '', round: e.round ?? '', verdict: e.verdict ?? '', version: e.version }); break;
        case 'spawn.start': led.spawnStart({ agent: e.agent ?? '', role: e.role ?? '', model: e.model, provider: e.provider }); break;
        case 'spawn.end': led.spawnEnd({
          agent: e.agent ?? '',
          usage: { input: num(e.input), output: num(e.output), cacheRead: num(e.cacheRead), cacheWrite5m: num(e.cacheWrite5m), cacheWrite1h: num(e.cacheWrite1h) },
          model: e.model,
          agentId: e.agentId,
        }); break;
        case 'spawn.usage': led.spawnUsage({ agent: e.agent ?? '', role: e.role, result: e.result, phase: e.phase, task: e.task, round: e.round }); break;
        case 'task.pick': led.taskPick({ task: e.task ?? '', title: e.title ?? '' }); break;
        case 'task.done': led.taskDone({ task: e.task ?? '', rounds: e.rounds, outcome: e.outcome }); break;
        case 'note': led.note(e.text ?? ''); break;
      }
    }
    const spec = real[0].spec!;
    const opts = { now: new Date('2026-10-08T23:00:00.000Z'), width: 100, color: false };
    const mine = render(buildModel({ spec, ledger: readRows(led.path), activity: [] }), opts);
    const fixture = render(buildModel({ spec, ledger: real, activity: [] }), opts);
    expect(mine).toBe(fixture);
    // The token total is carried intact, not zeroed.
    expect(mine).toMatch(/tokens \d/);
  });

  it('renders the live spawn tree from a mid-phase prefix', () => {
    // Replay only the first five rows of the implementation run: a live phase with an open worker.
    const dir = tmpDir('ctrl-ledger-');
    const led = openRunLedger({ specDir: dir, runId: RUN, spec: SPEC, now: clockFrom(IMPL_TS.slice(0, 5)) });
    led.runStart({ model: 'fable-5-1', codeRoot: '/home/x/.claude/worktrees/s', worktree: 'yes', headless: 'yes' });
    led.spawnStart({ agent: 'sdd-implementation-orchestrator', role: 'implementation phase, spawn 1' });
    led.phaseStart('implementation', { mode: 'normal', budget: '6 tasks', state: 'tasks 2/8' });
    led.taskPick({ task: '3', title: 'API errors and query layer' });
    led.spawnStart({ agent: 'sdd-implementer', role: 'implement task 3' });
    const out = render(buildModel({ spec: SPEC, ledger: readRows(led.path), activity: [] }), { now: new Date('2026-09-12T19:12:00.000Z'), width: 120, color: false });
    expect(out).toContain('> implementation tasks 2/8');
    expect(out).toMatch(/> sdd-implementation-orchestrator\s+implementation phase, spawn 1/);
    expect(out).toContain('> 3  API errors and query layer');
    expect(out).toMatch(/> sdd-implementer\s+implement task 3/);
  });
});

describe('now-model / waits read a controller run as live', () => {
  it('sees run.start without run.end as live, and the gate/ruling for a parked run', () => {
    const dir = tmpDir('ctrl-ledger-');
    const isos = [
      '2026-09-12T19:00:00.000Z', // run.start
      '2026-09-12T19:00:20.000Z', // phase.start
      '2026-09-12T19:05:00.000Z', // round
      '2026-09-12T19:30:00.000Z', // phase.end gate-a
      '2026-09-12T19:30:05.000Z', // run.end
    ];
    const led = openRunLedger({ specDir: dir, runId: RUN, spec: SPEC, now: clockFrom(isos) });
    led.runStart({ model: 'fable-5-1', worktree: 'no', headless: 'yes', setup: 'controller' });
    led.phaseStart('requirements', { mode: 'normal', budget: '4 review rounds', state: 'v0' });
    led.round({ phase: 'requirements', round: 1, verdict: 'iterate 0/2/4', version: 'v2' });

    // run.start and no run.end: the shared model (both now-model.ts and waits.ts build it) is live.
    const live = buildModel({ spec: SPEC, ledger: readRows(led.path), activity: [] });
    expect(live.livePhase?.phase).toBe('requirements');
    expect(live.livePhase?.budget).toBe('4 review rounds');
    expect(live.rounds).toEqual([{ phase: 'requirements', round: '1', verdict: 'iterate 0/2/4', version: 'v2' }]);

    // A gate-a phase.end with no later phase.start is the gate wait waits.ts derives.
    led.phaseEnd('requirements', { result: 'gate-a', state: 'v1' });
    const gr = gateOrRuling(readRows(led.path));
    expect(gr?.kind).toBe('gate');
    expect(gr?.row.result).toBe('gate-a');

    // run.end flips the shared model to not-live.
    led.runEnd('x:s requirements v1 - gate-a');
    const ended = buildModel({ spec: SPEC, ledger: readRows(led.path), activity: [] });
    expect(ended.livePhase).toBeUndefined();
    expect(ended.status).toContain('gate-a');
  });
});

describe('newRunId', () => {
  it('formats run-<YYYYMMDD>-<HHMMSS> in UTC', () => {
    expect(newRunId(new Date('2026-10-08T21:10:04.000Z'))).toBe('run-20261008-211004');
    expect(newRunId(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe('run-20260102-030405');
  });
});

describe('checkpoint', () => {
  it('commits the spec store with the caller message and returns the sha', async () => {
    const repo = initRepo();
    try {
      writeFileSync(join(repo, 'doc.md'), 'hi');
      const sha = await checkpoint({ specStoreRoot: repo, message: 'docs(sdd): foo requirements v1' });
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
      expect(git(repo, ['log', '--format=%s', '-1']).trim()).toBe('docs(sdd): foo requirements v1');
      expect(git(repo, ['rev-parse', 'HEAD']).trim()).toBe(sha);
      expect(git(repo, ['status', '--porcelain']).trim()).toBe('');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('awaits the serialize hook and commits inside it', async () => {
    const repo = initRepo();
    try {
      writeFileSync(join(repo, 'doc.md'), 'x');
      const order: string[] = [];
      let committedInsideLock = false;
      const serialize = async <T>(fn: () => Promise<T>): Promise<T> => {
        order.push('acquire');
        const result = await fn();
        committedInsideLock = git(repo, ['log', '--oneline']).trim().length > 0;
        order.push('release');
        return result;
      };
      const sha = await checkpoint({ specStoreRoot: repo, message: 'docs(sdd): bar design v2' }, serialize);
      expect(order).toEqual(['acquire', 'release']);
      expect(committedInsideLock).toBe(true);
      expect(git(repo, ['rev-parse', 'HEAD']).trim()).toBe(sha);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });

  it('stages only the given paths', async () => {
    const repo = initRepo();
    try {
      writeFileSync(join(repo, 'a.txt'), 'a');
      writeFileSync(join(repo, 'b.txt'), 'b');
      await checkpoint({ specStoreRoot: repo, message: 'docs(sdd): baz tasks v1', paths: ['a.txt'] });
      expect(git(repo, ['ls-tree', '--name-only', 'HEAD']).trim()).toBe('a.txt');
      expect(git(repo, ['status', '--porcelain']).trim()).toBe('?? b.txt');
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  });
});
