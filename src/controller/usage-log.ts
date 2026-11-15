/**
 * Usage log (`usage-log.jsonl`): one line per rate-limit reading, bounded to the
 * last 8 days, reduced to a burn (D7) and a per-run attribution (D8) for the
 * usage view (design C1).
 */

import { appendFileSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { controllerHome } from './state.js';

export interface UsageLogLine {
  v: 1;
  ts: string;
  sevenDay: { utilization: number };
  run: string | null;
}

const MAX_BYTES = 256 * 1024;
const RETENTION_MS = 8 * 24 * 60 * 60 * 1000;
const BURN_WINDOW_MS = 24 * 60 * 60 * 1000;

export function usageLogPath(): string {
  return join(controllerHome(), 'usage-log.jsonl');
}

function parseLine(raw: string): UsageLogLine | null {
  if (raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const candidate = parsed as { ts?: unknown; sevenDay?: { utilization?: unknown }; run?: unknown };
  if (typeof candidate.ts !== 'string') return null;
  const utilization = candidate.sevenDay?.utilization;
  if (typeof utilization !== 'number') return null;
  return {
    v: 1,
    ts: candidate.ts,
    sevenDay: { utilization },
    run: typeof candidate.run === 'string' ? candidate.run : null,
  };
}

/** Rewrite `path` keeping only lines at or after `now() - 8 days`, once it passes 256 KiB. */
function compact(path: string, now: () => Date): void {
  if (statSync(path).size <= MAX_BYTES) return;
  const cutoff = now().getTime() - RETENTION_MS;
  const kept = readFileSync(path, 'utf8')
    .split('\n')
    .filter((raw) => {
      const parsed = parseLine(raw);
      return parsed !== null && Date.parse(parsed.ts) >= cutoff;
    });
  const tmp = join(dirname(path), `.usage-log.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tmp, kept.length > 0 ? kept.join('\n') + '\n' : '');
  renameSync(tmp, path);
}

export function appendUsageLine(line: UsageLogLine, now: () => Date = () => new Date()): void {
  try {
    const path = usageLogPath();
    appendFileSync(path, JSON.stringify(line) + '\n');
    compact(path, now);
  } catch (err) {
    console.error('appendUsageLine failed:', err);
  }
}

export function readUsageLog(nowMs: number): UsageLogLine[] {
  const path = usageLogPath();
  if (!existsSync(path)) return [];
  const cutoff = nowMs - RETENTION_MS;
  const lines: UsageLogLine[] = [];
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const parsed = parseLine(raw);
    if (parsed === null) continue;
    if (Date.parse(parsed.ts) < cutoff) continue;
    lines.push(parsed);
  }
  return lines.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}

export function computeBurn(lines: UsageLogLine[], nowMs: number): number | null {
  const sorted = [...lines].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  const cutoff = nowMs - BURN_WINDOW_MS;
  let anchorIndex = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (Date.parse(sorted[i].ts) <= cutoff) anchorIndex = i;
  }
  if (anchorIndex === -1) return null;
  let sum = 0;
  for (let i = anchorIndex; i < sorted.length - 1; i++) {
    sum += Math.max(0, sorted[i + 1].sevenDay.utilization - sorted[i].sevenDay.utilization);
  }
  return sum * 100;
}

export function attributedUse(lines: UsageLogLine[], runId: string): number {
  const sorted = [...lines].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  let sum = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i + 1].run !== runId) continue;
    sum += Math.max(0, sorted[i + 1].sevenDay.utilization - sorted[i].sevenDay.utilization);
  }
  return sum;
}
