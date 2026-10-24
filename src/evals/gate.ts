import { appendFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { controllerHome } from '../controller/state.js';
import { DeferralStorage } from '../core/deferral-storage.js';
import { runCases, type EvalCaseRecord, type RunCasesOpts } from './runner.js';
import { selectCases } from './select.js';

export interface RunGateOpts {
  repo: string;
  base: string;
  target: string;
  baseDist?: string;
  casesRoot?: string;
  overrides: string[];
  summaryFile: string;
  home?: string;
  step?: RunCasesOpts['step'];
}

export interface RunGateResult {
  exit: 0 | 1 | 2;
  record?: string;
}

function firstReason(c: EvalCaseRecord): string {
  for (const run of c.runs) {
    if (run.reasons.length > 0) return run.reasons[0];
  }
  return '';
}

/**
 * Selects, runs, applies overrides and decides the deploy (design Component 8, R3 AC2-3,
 * AC5, R4 AC2-5).
 */
export async function runGate(opts: RunGateOpts): Promise<RunGateResult> {
  const home = opts.home ?? controllerHome();
  const target12 = opts.target.slice(0, 12);

  const selected = await selectCases({
    repo: opts.repo, base: opts.base, target: opts.target, mode: 'exact', baseDist: opts.baseDist,
  });
  const selectedIds = new Set(selected.map((s) => s.id));

  const badOverrides = opts.overrides.filter((id) => !selectedIds.has(id));
  if (badOverrides.length > 0) {
    writeFileSync(opts.summaryFile, `override names no selected case: ${badOverrides.join(', ')}\n`);
    return { exit: 2 };
  }

  if (selectedIds.size === 0) return { exit: 0 };

  const resultsDir = join(home, 'evals', 'results');
  const before = existsSync(resultsDir) ? new Set(readdirSync(resultsDir)) : new Set<string>();

  const record = await runCases([...selectedIds], {
    liveCheckout: opts.repo, home, casesRoot: opts.casesRoot, step: opts.step,
  });

  const after = existsSync(resultsDir) ? readdirSync(resultsDir) : [];
  const newFile = after.find((f) => !before.has(f));
  const recordPath = newFile ? join(resultsDir, newFile) : undefined;

  const overrideSet = new Set(opts.overrides);

  const passedOverrides = opts.overrides.filter(
    (id) => record.cases.find((c) => c.id === id)?.verdict === 'pass',
  );
  if (passedOverrides.length > 0) {
    writeFileSync(opts.summaryFile, `override names a passed case: ${passedOverrides.join(', ')}\n`);
    return { exit: 2 };
  }

  const unnamedFailures = record.cases.filter((c) => c.verdict !== 'pass' && !overrideSet.has(c.id));
  if (unnamedFailures.length > 0) {
    const parts = unnamedFailures.map((c) => `${c.id} ${firstReason(c)}`);
    writeFileSync(opts.summaryFile, `${target12}: ${parts.join('; ')}; record ${recordPath}\n`);
    return { exit: 1, record: recordPath };
  }

  const overriddenFailing = record.cases.filter((c) => c.verdict !== 'pass' && overrideSet.has(c.id));
  if (overriddenFailing.length > 0) {
    mkdirSync(join(home, 'evals'), { recursive: true });
    const overridesLogPath = join(home, 'evals', 'overrides.log');
    const storage = new DeferralStorage(opts.repo);
    for (const c of overriddenFailing) {
      const reason = firstReason(c);
      const id = await storage.create({
        title: `Eval case ${c.id} overridden at ${target12}`,
        originSpec: null,
        originPhase: null,
        revisitTrigger: `eval case ${c.id} passes`,
        tags: ['eval-override'],
        supersedes: null,
        owner: 'harness',
        body: { context: '', decision: 'override at deploy', revisitCriteria: `case ${c.id} passes 3/3` },
      });
      const date = new Date().toISOString().slice(0, 10);
      await storage.update(id, {
        context: `- ${date} — deploy ${target12} overrode eval case ${c.id} (${c.verdict}, ${reason}); deferral ${id}.`,
      });
      appendFileSync(overridesLogPath, `${new Date().toISOString()}\t${target12}\t${c.id}\t${c.verdict}\n`);
    }
  }

  return { exit: 0, record: recordPath };
}
