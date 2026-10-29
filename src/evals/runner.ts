import { execFileSync } from 'child_process';
import { randomUUID } from 'crypto';
import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { runStep, type StepClassification, type StepUsage } from '../controller/step.js';
import { controllerHome } from '../controller/state.js';
import { harnessHandler } from '../tools/harness.js';
import { casesRoot as defaultCasesRoot, listCaseIds, loadCase, type EvalCase } from './case.js';
import { buildFixture, disposeFixture, type Fixture } from './fixture.js';
import { renderCaseBriefs } from './render.js';
import { reportSchema } from './schemas.js';
import { GRADERS } from './graders/index.js';
import type { FixtureView } from './graders/shared.js';

export type EvalVerdict = 'pass' | 'fail' | 'inconclusive';

export interface EvalRunRecord {
  n: number;
  verdict: EvalVerdict;
  classification: StepClassification | null;
  reasons: string[];
  logPath: string;
  usage: StepUsage;
}

export interface EvalCaseRecord {
  id: string;
  verdict: EvalVerdict;
  tokens: number;
  runs: EvalRunRecord[];
}

export interface EvalResultRecord {
  v: 1;
  commit: string;
  startedAt: string;
  endedAt: string;
  cases: EvalCaseRecord[];
}

export interface RunCasesOpts {
  liveCheckout: string;
  runs?: number;
  home?: string;
  casesRoot?: string;
  step?: typeof runStep;
  onLine?: (line: string) => void;
}

const ZERO_USAGE: StepUsage = { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 };

function packageRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, '..', '..');
}

function gitAt(dir: string, args: string[]): string {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
}

function currentCommit(): string {
  return gitAt(packageRoot(), ['rev-parse', 'HEAD']);
}

/** `true` for a path the self-update's move carve-out ignores (design D3, `scripts/sdd-self-update.sh:131-133`). */
function isCarvedOut(path: string): boolean {
  return path.startsWith('.spec-workflow/') || path === 'HANDOFF.md';
}

interface LiveSnapshot {
  head: string;
  dirty: string;
}

function snapshotLiveCheckout(dir: string): LiveSnapshot {
  const head = gitAt(dir, ['rev-parse', 'HEAD']);
  // Not `gitAt`: its `.trim()` would strip the leading status-code space off the
  // first line, shifting `slice(3)` and defeating the carve-out filter below.
  const raw = execFileSync('git', ['-C', dir, 'status', '--porcelain', '--untracked-files=all'], { encoding: 'utf8' });
  const dirty = raw
    .split('\n')
    .filter((line) => line.length > 0 && !isCarvedOut(line.slice(3)))
    .join('\n');
  return { head, dirty };
}

/** R2 AC6: a dirty-status difference, or a HEAD move touching a path outside the carve-out. */
function liveCheckoutChanged(before: LiveSnapshot, after: LiveSnapshot, dir: string): boolean {
  if (before.dirty !== after.dirty) return true;
  if (before.head !== after.head) {
    const changed = gitAt(dir, ['diff', '--name-only', before.head, after.head])
      .split('\n')
      .filter((line) => line.length > 0);
    if (changed.some((path) => !isCarvedOut(path))) return true;
  }
  return false;
}

function toFixtureView(f: Fixture): FixtureView {
  return {
    root: f.root,
    bases: f.bases,
    git: (cwd, args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim(),
  };
}

/** Runs every grader; a throw always gives `inconclusive`, distinct from a grader fail (Error Handling 3). */
function runGraders(c: EvalCase, report: unknown, view: FixtureView): { anyFail: boolean; anyThrow: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let anyFail = false;
  let anyThrow = false;
  for (const g of c.graders) {
    const grader = GRADERS[g.name];
    try {
      const result = grader.grade({ report, fixture: view }, g.args);
      if (!result.pass) {
        anyFail = true;
        reasons.push(result.reason);
      }
    } catch (err) {
      anyThrow = true;
      reasons.push(`grader ${g.name} threw: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { anyFail, anyThrow, reasons };
}

function sumUsage(u: StepUsage): number {
  return u.input + u.output + u.cacheRead + u.cacheWrite5m + u.cacheWrite1h;
}

function utcStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

/**
 * Runs each named case's role 3 times through the live `runStep`, one run after the
 * other, each on a fresh fixture, and writes the result record (design Component 6, R2).
 */
export async function runCases(ids: string[], opts: RunCasesOpts): Promise<EvalResultRecord> {
  const root = opts.casesRoot ?? defaultCasesRoot();
  const resolvedIds = ids.length > 0 ? ids : listCaseIds(root);
  const runs = opts.runs ?? 3;
  const home = opts.home ?? controllerHome();
  const step = opts.step ?? runStep;
  const onLine = opts.onLine ?? (() => {});

  const evalsHome = join(home, 'evals');
  const resultsDir = join(evalsHome, 'results');
  const logsBaseDir = join(evalsHome, 'logs');
  mkdirSync(resultsDir, { recursive: true });

  const startedAt = new Date().toISOString();
  const stamp = utcStamp();
  const commit = currentCommit();

  const caseRecords: EvalCaseRecord[] = [];

  for (const id of resolvedIds) {
    const c = loadCase(id, root);
    const caseDir = join(root, id);
    const runRecords: EvalRunRecord[] = [];

    for (let n = 1; n <= runs; n++) {
      const before = snapshotLiveCheckout(opts.liveCheckout);

      let fixture: Fixture | undefined;
      let runRecord: EvalRunRecord;
      try {
        const scratch = join('/tmp/scratchpad/sdd', c.spec);
        rmSync(scratch, { recursive: true, force: true });
        mkdirSync(scratch, { recursive: true });

        fixture = buildFixture(c, caseDir);
        const { launchBrief } = await renderCaseBriefs(c, fixture, scratch, harnessHandler);
        const logPath = join(logsBaseDir, stamp, `${id}-r${n}.jsonl`);

        const result = await step({
          role: c.role,
          briefPath: launchBrief,
          worktree: join(fixture.root, c.cwd ?? '.'),
          logPath,
          maxTurns: c.turnCap,
          sessionId: randomUUID(),
          schema: reportSchema(c.phase, c.role),
          noSessionPersistence: true,
          workspace: fixture.root,
          sharedRoot: fixture.root,
          mcpConfig: {
            mcpServers: {
              'spec-workflow': {
                command: process.execPath,
                args: [join(packageRoot(), 'dist', 'index.js'), fixture.root, '--no-register'],
              },
            },
          },
        });

        if (result.classification !== 'ok') {
          runRecord = {
            n,
            verdict: 'inconclusive',
            classification: result.classification,
            reasons: [`step classification: ${result.classification}`],
            logPath,
            usage: result.usage,
          };
        } else {
          const { anyFail, anyThrow, reasons } = runGraders(c, result.structuredOutput, toFixtureView(fixture));
          runRecord = {
            n,
            verdict: anyThrow ? 'inconclusive' : anyFail ? 'fail' : 'pass',
            classification: result.classification,
            reasons,
            logPath,
            usage: result.usage,
          };
        }
      } catch (err) {
        runRecord = {
          n,
          verdict: 'inconclusive',
          classification: null,
          reasons: [err instanceof Error ? err.message : String(err)],
          logPath: '',
          usage: ZERO_USAGE,
        };
      } finally {
        if (fixture) disposeFixture(fixture);
      }

      const after = snapshotLiveCheckout(opts.liveCheckout);
      if (liveCheckoutChanged(before, after, opts.liveCheckout)) {
        runRecord.verdict = 'fail';
        runRecord.reasons = [...runRecord.reasons, 'edited the live checkout'];
      }

      runRecords.push(runRecord);
    }

    const tokens = runRecords.reduce((sum, r) => sum + sumUsage(r.usage), 0);
    const verdict: EvalVerdict = runRecords.every((r) => r.verdict === 'pass')
      ? 'pass'
      : runRecords.some((r) => r.verdict === 'fail')
        ? 'fail'
        : 'inconclusive';
    caseRecords.push({ id, verdict, tokens, runs: runRecords });

    const passed = runRecords.filter((r) => r.verdict === 'pass').length;
    onLine(`eval ${id}: ${verdict} ${passed}/${runRecords.length}, ${tokens} tokens`);
  }

  const record: EvalResultRecord = {
    v: 1,
    commit,
    startedAt,
    endedAt: new Date().toISOString(),
    cases: caseRecords,
  };
  writeFileSync(join(resultsDir, `${stamp}-${commit.slice(0, 12)}.json`), JSON.stringify(record, null, 2));
  return record;
}
