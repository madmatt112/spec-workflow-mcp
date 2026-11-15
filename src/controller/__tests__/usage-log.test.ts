import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, statSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  appendUsageLine,
  readUsageLog,
  computeBurn,
  attributedUse,
  usageLogPath,
  type UsageLogLine,
} from '../usage-log.js';

// Contract for src/controller/usage-log.ts (design C1; Requirement 3 AC1, AC3-5;
// Requirement 4 AC5-6). Each case below names its pre-condition, the call through
// the seam, the observable result and where the expected value comes from.
//
// 1. appendUsageLine, run id given
//    pre: fresh SDD_HOME, no file yet
//    call: appendUsageLine({ v:1, ts, sevenDay:{utilization}, run: 'run-x' })
//    result: the one written line parses with v:1, ts, sevenDay.utilization, run:'run-x'
//    source: design C1 line 29 (shape), Requirement 3 AC1
// 2. appendUsageLine, run null given
//    pre/call as above with run: null
//    result: parsed run === null
//    source: Requirement 3 AC1 ("null when the step has no run")
// 3. appendUsageLine, unwritable home
//    pre: SDD_HOME points at a regular file, not a directory
//    call: appendUsageLine(line)
//    result: does not throw; console.error called exactly once
//    source: design C1 line 29; Requirement 3 AC3
// 4. appendUsageLine, two sequential calls
//    pre: fresh SDD_HOME
//    call: appendUsageLine twice with distinct lines
//    result: file holds exactly two whole, independently parsable lines
//    source: design C1 "Post-conditions"; Requirement 3 AC4
// 5. appendUsageLine, compaction above 256 KiB
//    pre: usage-log.jsonl pre-seeded past 256 KiB with old (>8d) and recent (<=8d) lines
//    call: appendUsageLine(newRecentLine, now)
//    result: after the call, every surviving line's ts is within 8 days of now(); old lines gone
//    source: design C1 line 29, D14; _Prompt Success "a file over 256 KiB keeps only the lines of the last 8 days"
// 6. readUsageLog, torn line skipped
//    pre: file has one torn (unparsable) line between two valid lines
//    call: readUsageLog(nowMs)
//    result: only the two valid lines come back
//    source: design C1 line 30; _Prompt Success
// 7. readUsageLog, non-numeric utilisation skipped
//    pre: file has one line whose sevenDay.utilization is not a number
//    call: readUsageLog(nowMs)
//    result: that line is dropped, the valid one remains
//    source: design C1 line 30; _Prompt Success
// 8. readUsageLog, drops lines older than 8 days
//    pre: file has one line older than nowMs-8d and one within
//    call: readUsageLog(nowMs)
//    result: only the within-window line remains
//    source: design C1 line 30, D14
// 9. readUsageLog, sorts by ts ascending
//    pre: file has two valid lines written out of chronological order
//    call: readUsageLog(nowMs)
//    result: returned array is ordered earliest ts first
//    source: design C1 line 30
// 10. readUsageLog, no file gives []
//    pre: SDD_HOME with no usage-log.jsonl
//    call: readUsageLog(nowMs)
//    result: []
//    source: design C1 line 30
// 11. computeBurn, 24h-apart pair at the second line's clock
//    pre: two lines exactly 24h apart
//    call: computeBurn(lines, nowMs = second line's ts)
//    result: (u2-u1)*100
//    source: design C1 line 31; Requirement 4 AC6
// 12. computeBurn, reset inside the span sums only positive steps
//    pre: three lines anchor->dip->rise
//    call: computeBurn(lines, nowMs = newest ts)
//    result: only the positive step counted, in points
//    source: design C1 line 31
// 13. computeBurn, no anchor gives null
//    pre: all lines newer than nowMs-24h
//    call: computeBurn(lines, nowMs)
//    result: null
//    source: design C1 line 31; Requirement 4 AC5
// 14. attributedUse, two alternating runs
//    pre: lines alternate run A/B
//    call: attributedUse(lines, 'A') and attributedUse(lines, 'B')
//    result: each sums only the steps whose later line ends on its own run
//    source: design C1 line 32; _Prompt Success

let home: string;
let savedSddHome: string | undefined;

beforeEach(() => {
  savedSddHome = process.env.SDD_HOME;
  home = mkdtempSync(join(tmpdir(), 'sdd-usage-log-'));
  process.env.SDD_HOME = home;
});

afterEach(() => {
  if (savedSddHome === undefined) delete process.env.SDD_HOME;
  else process.env.SDD_HOME = savedSddHome;
  rmSync(home, { recursive: true, force: true });
});

function readLines(path: string): string[] {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.length > 0);
}

function line(ts: string, utilization: number, run: string | null): UsageLogLine {
  return { v: 1, ts, sevenDay: { utilization }, run };
}

describe('appendUsageLine', () => {
  it('writes a line that parses with v, ts, sevenDay.utilization and the given run id', () => {
    appendUsageLine(line('2026-11-10T12:00:00.000Z', 0.42, 'run-a'));
    const rows = readLines(usageLogPath());
    expect(rows).toHaveLength(1);
    const parsed = JSON.parse(rows[0]);
    expect(parsed.v).toBe(1);
    expect(parsed.ts).toBe('2026-11-10T12:00:00.000Z');
    expect(parsed.sevenDay.utilization).toBe(0.42);
    expect(parsed.run).toBe('run-a');
  });

  it('writes null for run when null is given', () => {
    appendUsageLine(line('2026-11-10T12:00:00.000Z', 0.42, null));
    const rows = readLines(usageLogPath());
    const parsed = JSON.parse(rows[0]);
    expect(parsed.run).toBeNull();
  });

  it('does not throw and logs once when the home is a regular file', () => {
    rmSync(home, { recursive: true, force: true });
    writeFileSync(home, 'not a directory');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => appendUsageLine(line('2026-11-10T12:00:00.000Z', 0.5, null))).not.toThrow();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
      // Recreate so afterEach's rmSync on a directory does not error.
      rmSync(home, { force: true });
      mkdirSync(home, { recursive: true });
    }
  });

  it('gives two whole, independently parsable lines for two sequential calls', () => {
    appendUsageLine(line('2026-11-10T12:00:00.000Z', 0.4, 'run-a'));
    appendUsageLine(line('2026-11-10T13:00:00.000Z', 0.5, 'run-b'));
    const rows = readLines(usageLogPath());
    expect(rows).toHaveLength(2);
    const [first, second] = rows.map((r) => JSON.parse(r));
    expect(first.run).toBe('run-a');
    expect(second.run).toBe('run-b');
  });

  it('keeps only the lines of the last 8 days once the file passes 256 KiB', () => {
    mkdirSync(home, { recursive: true });
    const path = usageLogPath();
    const oldTs = '2026-09-01T00:00:00.000Z'; // far older than 8 days before "now"
    const recentTs = '2026-11-10T00:00:00.000Z'; // within 8 days before "now"
    const now = () => new Date('2026-11-14T00:00:00.000Z');

    let content = '';
    while (Buffer.byteLength(content, 'utf8') < 300 * 1024) {
      content += JSON.stringify(line(oldTs, 0.5, 'run-old')) + '\n';
    }
    const recentLinesWrittenBefore = 2;
    for (let i = 0; i < recentLinesWrittenBefore; i++) {
      content += JSON.stringify(line(recentTs, 0.6, `run-recent-${i}`)) + '\n';
    }
    writeFileSync(path, content);
    expect(statSync(path).size).toBeGreaterThan(256 * 1024);

    appendUsageLine(line('2026-11-14T00:00:00.000Z', 0.9, 'run-new'), now);

    const rows = readLines(path).map((r) => JSON.parse(r));
    expect(rows).toHaveLength(recentLinesWrittenBefore + 1);
    expect(rows.some((r) => r.run === 'run-old')).toBe(false);
    expect(rows.some((r) => r.run === 'run-new')).toBe(true);
  });
});

describe('readUsageLog', () => {
  it('skips a torn line', () => {
    const path = usageLogPath();
    mkdirSync(home, { recursive: true });
    const good1 = JSON.stringify(line('2026-11-10T00:00:00.000Z', 0.3, null));
    const torn = '{"v":1,"ts":"2026-11-10T06:00:00.000Z"';
    const good2 = JSON.stringify(line('2026-11-10T12:00:00.000Z', 0.4, null));
    writeFileSync(path, `${good1}\n${torn}\n${good2}\n`);

    const rows = readUsageLog(Date.parse('2026-11-14T00:00:00.000Z'));
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.ts)).toEqual(['2026-11-10T00:00:00.000Z', '2026-11-10T12:00:00.000Z']);
  });

  it('skips a line with no numeric utilisation', () => {
    const path = usageLogPath();
    mkdirSync(home, { recursive: true });
    const good = JSON.stringify(line('2026-11-10T00:00:00.000Z', 0.3, null));
    const bad = JSON.stringify({ v: 1, ts: '2026-11-10T06:00:00.000Z', sevenDay: { utilization: 'nope' }, run: null });
    writeFileSync(path, `${good}\n${bad}\n`);

    const rows = readUsageLog(Date.parse('2026-11-14T00:00:00.000Z'));
    expect(rows).toHaveLength(1);
    expect(rows[0].ts).toBe('2026-11-10T00:00:00.000Z');
  });

  it('drops lines older than 8 days', () => {
    const path = usageLogPath();
    mkdirSync(home, { recursive: true });
    const old = JSON.stringify(line('2026-11-01T00:00:00.000Z', 0.2, null)); // >8d before now
    const within = JSON.stringify(line('2026-11-10T00:00:00.000Z', 0.3, null)); // <8d before now
    writeFileSync(path, `${old}\n${within}\n`);

    const rows = readUsageLog(Date.parse('2026-11-14T00:00:00.000Z'));
    expect(rows).toHaveLength(1);
    expect(rows[0].ts).toBe('2026-11-10T00:00:00.000Z');
  });

  it('sorts lines by ts ascending regardless of file order', () => {
    const path = usageLogPath();
    mkdirSync(home, { recursive: true });
    const later = JSON.stringify(line('2026-11-12T00:00:00.000Z', 0.5, null));
    const earlier = JSON.stringify(line('2026-11-10T00:00:00.000Z', 0.3, null));
    writeFileSync(path, `${later}\n${earlier}\n`);

    const rows = readUsageLog(Date.parse('2026-11-14T00:00:00.000Z'));
    expect(rows.map((r) => r.ts)).toEqual(['2026-11-10T00:00:00.000Z', '2026-11-12T00:00:00.000Z']);
  });

  it('gives [] when there is no file', () => {
    const rows = readUsageLog(Date.parse('2026-11-14T00:00:00.000Z'));
    expect(rows).toEqual([]);
  });
});

describe('computeBurn', () => {
  it('equals the second utilisation minus the first, in points, for two lines exactly 24h apart at the second line\'s clock', () => {
    const lines = [line('2026-11-13T00:00:00.000Z', 0.3, null), line('2026-11-14T00:00:00.000Z', 0.45, null)];
    const burn = computeBurn(lines, Date.parse('2026-11-14T00:00:00.000Z'));
    expect(burn).toBeCloseTo((0.45 - 0.3) * 100, 6);
  });

  it('sums only the positive steps when a reset falls inside the span', () => {
    const lines = [
      line('2026-11-13T00:00:00.000Z', 0.5, null), // anchor, 24h before newest
      line('2026-11-13T12:00:00.000Z', 0.1, null), // reset: step is negative, excluded
      line('2026-11-14T00:00:00.000Z', 0.4, null), // positive step: 0.3
    ];
    const burn = computeBurn(lines, Date.parse('2026-11-14T00:00:00.000Z'));
    expect(burn).toBeCloseTo(0.3 * 100, 6);
  });

  it('gives null when no line is at or before 24h ago', () => {
    const lines = [line('2026-11-13T18:00:00.000Z', 0.3, null), line('2026-11-14T00:00:00.000Z', 0.4, null)];
    const burn = computeBurn(lines, Date.parse('2026-11-14T00:00:00.000Z'));
    expect(burn).toBeNull();
  });
});

describe('attributedUse', () => {
  it('gives each run only the steps that end on its own lines, with two alternating runs', () => {
    const lines = [
      line('2026-11-14T00:00:00.000Z', 0.1, null),
      line('2026-11-14T01:00:00.000Z', 0.2, 'A'),
      line('2026-11-14T02:00:00.000Z', 0.25, 'B'),
      line('2026-11-14T03:00:00.000Z', 0.35, 'A'),
      line('2026-11-14T04:00:00.000Z', 0.4, 'B'),
    ];
    expect(attributedUse(lines, 'A')).toBeCloseTo(0.1 + 0.1, 6);
    expect(attributedUse(lines, 'B')).toBeCloseTo(0.05 + 0.05, 6);
  });
});
