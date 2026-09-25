import { AGENT_PROFILES, PHASE_ORDER, RunModel, SpawnNode, formatTokens } from './ledger.js';

export interface RenderOptions {
  now: Date;
  width: number;
  color: boolean;
  /** Minutes of silence before the age badge turns amber, then red at three times this. */
  ageWarnMinutes?: number;
}

type Paint = (s: string) => string;
interface Palette { dim: Paint; ok: Paint; live: Paint; warn: Paint; bad: Paint; bold: Paint }

const ESC = String.fromCharCode(27) + '[';

function makePalette(color: boolean): Palette {
  const wrap = (code: string): Paint => (s: string) => (color ? `${ESC}${code}m${s}${ESC}0m` : s);
  return { dim: wrap('2'), ok: wrap('32'), live: wrap('36'), warn: wrap('33'), bad: wrap('31'), bold: wrap('1') };
}

function elapsed(fromTs: string | undefined, now: Date, toTs?: string): string {
  if (!fromTs) return '';
  const from = new Date(fromTs).getTime();
  const to = toTs ? new Date(toTs).getTime() : now.getTime();
  const s = Math.max(0, Math.floor((to - from) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

function clock(ts: string | undefined): string {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function clockSeconds(ts: string): string {
  const d = new Date(ts);
  return `${clock(ts)}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function fit(s: string, width: number): string {
  if (width <= 0) return '';
  return s.length > width ? `${s.slice(0, Math.max(0, width - 1))}~` : s;
}

const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '');
}

function padRight(s: string, width: number): string {
  const visible = stripAnsi(s).length;
  return visible >= width ? s : s + ' '.repeat(width - visible);
}

export function render(model: RunModel, opts: RenderOptions): string {
  const p = makePalette(opts.color);
  const width = Math.max(60, opts.width);
  const warnMin = opts.ageWarnMinutes ?? 5;
  const lines: string[] = [];
  const rule = p.dim('-'.repeat(width));

  // Header
  const runLabel = model.runId ? model.runId.replace(/^run-/, 'run ') : 'no run recorded';
  const up = model.runStartedAt ? `up ${elapsed(model.runStartedAt, opts.now, model.runEndedAt)}` : '';
  const left = [
    p.bold(model.spec),
    model.codeRoot ? p.dim(model.codeRoot.split('/').pop() ?? '') : '',
    model.worktree === 'yes' ? p.dim('worktree') : '',
    p.dim(runLabel),
    up ? p.dim(up) : '',
  ].filter(Boolean).join(p.dim(' | '));
  // The header `tokens` is the Anthropic (Max plan) figure; a DeepSeek spawn shows beside it
  // (D8). The `tokens 0` / `tokens -` branches stay keyed on the all-provider total.
  let right: string;
  if (model.tokensTotal > 0) {
    right = `${p.dim('tokens')} ${formatTokens(model.tokensByProvider.anthropic)}`;
    if (model.tokensByProvider.deepseek > 0) {
      right += ` ${p.dim('deepseek')} ${formatTokens(model.tokensByProvider.deepseek)}`;
    }
  } else {
    right = p.dim(model.hasActivity ? 'tokens 0' : 'tokens -');
  }
  lines.push(padRight(left, width - stripAnsi(right).length) + right);
  lines.push(rule);
  // The run's provider map on its own dim line, not truncated (D12).
  if (model.providers && model.providers !== 'none') {
    lines.push(p.dim(`providers ${model.providers}`));
  }

  // Finished or resumed phases: the last row of each phase wins; the live phase is drawn below.
  const lastRow = new Map<string, RunModel['phases'][number]>();
  for (const row of model.phases) lastRow.set(row.phase, row);
  const liveIndex = model.livePhase ? PHASE_ORDER.indexOf(model.livePhase.phase) : -1;
  for (const phase of PHASE_ORDER) {
    if (model.livePhase && model.livePhase.phase === phase) break;
    const row = lastRow.get(phase);
    if (!row) {
      if (liveIndex === -1) lines.push(p.dim(`o ${phase}`));
      continue;
    }
    const mark = row.result === 'approved' || row.result === 'complete' || row.result === 'closed' ? p.ok('+')
      : row.result === 'escalate' || row.result === 'error' ? p.bad('x') : p.warn('~');
    const head = `${mark} ${padRight(phase, 15)}${padRight(row.state, 12)}${padRight(row.result, 11)}`;
    lines.push(head + p.dim(fit(row.note, Math.max(10, width - 40))));
  }

  if (model.livePhase) {
    const lp = model.livePhase;
    const done = model.tasks.filter(t => t.status === 'done').length;
    // `items a/b` is the count at phase.start; items closed since then are picks marked done.
    const itemsAtStart = (lp.state ?? '').match(/^items (\d+)\/(\d+)$/);
    const state = lp.phase === 'implementation' && model.tasks.length > 0 ? `tasks ${done}/${model.tasks.length}`
      : itemsAtStart ? `items ${Number(itemsAtStart[1]) + model.picks.filter(pk => pk.done).length}/${itemsAtStart[2]}`
      : (lp.state ?? '');
    const orchestrators = model.spawns.filter(s => s.level === 1);
    const orch = orchestrators[orchestrators.length - 1];
    const spawnNo = orchestrators.length > 0 ? `spawn ${orchestrators.length}` : '';
    const meta = [lp.mode && lp.mode !== 'normal' ? lp.mode : '', spawnNo, lp.startedAt ? `since ${clock(lp.startedAt)}` : ''].filter(Boolean).join(' | ');
    lines.push(`${p.live('>')} ${p.bold(padRight(lp.phase, 14))} ${padRight(state, 14)} ${p.dim(meta)}`);

    if (orch) lines.push(agentLines(orch, 1, opts, p, warnMin, width));

    const rounds = model.rounds.filter(r => r.phase === lp.phase);
    if (rounds.length > 0) {
      lines.push(`  ${p.dim('rounds')} ${rounds.map(r => `${r.version ?? ''} r${r.round} ${r.verdict}`).join(p.dim(' -> '))}`);
    }

    const workers = model.spawns.filter(s => s.level === 2 && (!orch || new Date(s.startedAt).getTime() >= new Date(orch.startedAt).getTime()));
    const running = workers.filter(w => !w.endedAt);
    const finished = workers.filter(w => w.endedAt);

    if (lp.phase === 'implementation' && model.tasks.length > 0) {
      const doneTasks = model.tasks.filter(t => t.status === 'done');
      if (doneTasks.length > 0) {
        const last = doneTasks[doneTasks.length - 1];
        lines.push(`  ${p.ok('+')} ${p.dim(`${doneTasks.length} done, last`)} ${last.id}  ${fit(last.title, width - 24)}`);
      }
      const current = model.tasks.find(t => t.status === 'in-progress');
      if (current) {
        lines.push(`  ${p.live('>')} ${current.id}  ${fit(current.title, width - 30)}`);
        for (const w of running) lines.push(agentLines(w, 2, opts, p, warnMin, width));
        const lastFinished = finished.filter(w => w.task === current.id).slice(-1)[0];
        if (lastFinished && running.length === 0) lines.push(agentLines(lastFinished, 2, opts, p, warnMin, width));
      } else {
        for (const w of running) lines.push(agentLines(w, 2, opts, p, warnMin, width));
      }
      const queued = model.tasks.filter(t => t.status === 'open');
      for (const t of queued.slice(0, 3)) lines.push(p.dim(`  o ${t.id}  ${fit(t.title, width - 12)}`));
      if (queued.length > 3) lines.push(p.dim(`    ... ${queued.length - 3} more queued`));
    } else {
      // Phases without a tasks.md queue (close-out items, review rounds): what the
      // orchestrator picked in this run.
      const donePicks = model.picks.filter(pk => pk.done);
      const openPicks = model.picks.filter(pk => !pk.done);
      if (donePicks.length > 0) {
        const last = donePicks[donePicks.length - 1];
        lines.push(`  ${p.ok('+')} ${p.dim(`${donePicks.length} done, last`)} ${last.task}  ${fit(last.title, width - 24)}`);
      }
      if (openPicks.length === 1) {
        lines.push(`  ${p.live('>')} ${openPicks[0].task}  ${fit(openPicks[0].title, width - 30)}`);
      } else if (openPicks.length > 1) {
        lines.push(`  ${p.live('>')} ${fit(openPicks.map(pk => pk.task).join(' '), width - 24)}  ${p.dim(`${openPicks.length} items`)}`);
      }
      for (const w of running) lines.push(agentLines(w, 2, opts, p, warnMin, width));
      if (running.length === 0 && finished.length > 0) {
        lines.push(agentLines(finished[finished.length - 1], 2, opts, p, warnMin, width));
      }
    }
    for (const phase of PHASE_ORDER.slice(liveIndex + 1)) lines.push(p.dim(`o ${phase}`));
  } else if (model.status) {
    lines.push(`${p.dim('# stopped')} ${fit(model.status, width - 10)}`);
  } else if (!model.runId) {
    lines.push(p.dim('no harness-events.jsonl for this spec yet; the next run records one'));
  }

  // Ticker
  lines.push(rule);
  for (const t of model.ticker) lines.push(p.dim(`${clockSeconds(t.ts)}  `) + fit(t.text, width - 10));
  if (model.ticker.length === 0) lines.push(p.dim('no events yet'));
  const foot = model.hasActivity
    ? `* age since the agent's last tool call | amber ${warnMin} min | red ${warnMin * 3} min | q quit`
    : `no activity events yet (the plugin hook writes them from the first sdd-* tool call) | q quit`;
  lines.push(p.dim(fit(foot, width)));
  return lines.join('\n');
}

function agentLines(s: SpawnNode, level: 1 | 2, opts: RenderOptions, p: Palette, warnMin: number, width: number): string {
  const indent = level === 1 ? '  ' : '     ';
  const profile = AGENT_PROFILES[s.agent];
  const running = !s.endedAt;
  const failed = s.result ? /fail|fix-required|error|escalate/i.test(s.result) : false;
  const mark = running ? p.live('>') : failed ? p.bad('x') : p.ok('+');
  const dur = elapsed(s.startedAt, opts.now, s.endedAt);
  let badge = '';
  if (running) {
    if (!s.lastActivityAt) {
      badge = p.dim('* -');
    } else {
      const ageMin = (opts.now.getTime() - new Date(s.lastActivityAt).getTime()) / 60_000;
      const ageStr = `* ${elapsed(s.lastActivityAt, opts.now)}`;
      badge = ageMin >= warnMin * 3 ? p.bad(ageStr) : ageMin >= warnMin ? p.warn(ageStr) : p.ok(ageStr);
    }
  }
  const tokens = s.tokens ? p.dim(`${formatTokens(s.tokens)} tok`) : '';
  // The agent column fits the name shown (one orchestrator or one worker at a time); the
  // role takes what is left of the width after the fixed columns, between 16 and 30
  // characters, so a line does not wrap. The declared model and effort drop to a tier line
  // below, beside the actual model the run used.
  const agentW = Math.max(18, s.agent.length + 1);
  const roleW = Math.max(16, Math.min(30, width - indent.length - 2 - agentW - 20));
  const head = `${indent}${mark} ${p.bold(padRight(s.agent, agentW))}${padRight(fit(s.role, roleW), roleW + 1)}${padRight(dur, 8)} ${badge} ${tokens}`.trimEnd();
  const out = [head];
  // Tier line: what the agent files declare beside the model the run actually used; ` !=`
  // marks a substitution. Omitted when neither is known.
  // The declared text is the model and effort, plus the cache lifetime when the profile
  // names one that is not the `default` (the three orchestrators declare `1h`).
  let declared = profile ? `${profile.model} ${profile.effort}` : '';
  if (profile?.cacheTtl && profile.cacheTtl !== 'default') declared += ` ${profile.cacheTtl}`;
  const model = fit(s.model ?? '', 30);
  // The provider precedes the model when the run used a non-Anthropic one.
  const actual = s.provider && s.provider !== 'anthropic' ? `${s.provider} ${model}` : model;
  if (declared || actual) {
    const flag = profile && s.model && s.model !== profile.model ? ` ${p.bad('!=')}` : '';
    const pad = Math.max(23, stripAnsi(declared).length + 1);
    out.push(`${indent}   ${p.dim('declared')} ${padRight(declared, pad)}${p.dim('actual')} ${actual}${flag}`);
  }
  if (running && s.lastTool) {
    out.push(`${indent}   ${p.dim(padRight(s.lastTool, 6))} ${fit(s.lastSummary ?? '', width - indent.length - 10)}`);
  } else if (!running && s.result) {
    out.push(`${indent}   ${p.dim('->')} ${fit(s.result, width - indent.length - 6)}`);
  }
  return out.join('\n');
}
