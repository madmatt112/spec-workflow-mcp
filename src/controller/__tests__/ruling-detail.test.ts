import { describe, it, expect } from 'vitest';
import { capPart, renderReview, buildRulingDetail, rulingCommits } from '../ruling-detail.js';
import type { TaskReview } from '../../types.js';

// Contract for src/controller/ruling-detail.ts (design.md C2; requirements 2.4-2.8,
// task 2's _Prompt Success line). Each case names its criterion letter.

function review(overrides: Partial<TaskReview> = {}): TaskReview {
  return {
    id: 'r1',
    taskId: '3',
    specName: 'dashboard-ruling-view',
    version: 1,
    timestamp: '2026-11-01T00:00:00.000Z',
    verdict: 'pass',
    summary: 'looks fine',
    findings: [],
    ...overrides,
  };
}

describe('capPart', () => {
  it('(a) returns the text unchanged at exactly the cap', () => {
    // pre: text.length === cap.
    // call: capPart(text, cap).
    // result: the text is returned byte-for-byte, with no dropped-count line.
    // source: task 2 Success — "capPart returns the text unchanged at exactly the cap".
    const text = 'x'.repeat(100);
    expect(capPart(text, 100)).toBe(text);
  });

  it('(b) one character over the cap gives the first cap characters, a newline and the dropped-1 marker', () => {
    // pre: text.length === cap + 1.
    // call: capPart(text, cap).
    // result: text.slice(0, cap) + "\n[1 characters dropped]".
    // source: task 2 Success — "one character over the cap gives the first `cap`
    // characters, a newline and `[1 characters dropped]`".
    const text = 'y'.repeat(101);
    expect(capPart(text, 100)).toBe(`${'y'.repeat(100)}\n[1 characters dropped]`);
  });

  it('(c) far over the cap names the full dropped count', () => {
    // pre: text.length === cap + 500.
    // call: capPart(text, cap).
    // result: text.slice(0, cap) + "\n[500 characters dropped]".
    // source: task 2 Success — "far over the cap names the full dropped count";
    // design C2 line 45, N = text.length - cap.
    const text = 'z'.repeat(600);
    expect(capPart(text, 100)).toBe(`${'z'.repeat(100)}\n[500 characters dropped]`);
  });
});

describe('renderReview', () => {
  it('(d) prints the header, the summary, and a finding with a file and line', () => {
    // pre: a TaskReview with one finding carrying both file and line.
    // call: renderReview(review).
    // result: line 0 is "v<version> — <verdict>", line 1 is the summary, line 2 is
    // "- [<severity>] <title> (<file>:<line>)", line 3 is the description.
    // source: design C2 line 46; task 2 Success "per finding `- [<severity>]
    // <title>` with ` (<file>:<line>)`".
    const r = review({
      version: 2,
      verdict: 'findings',
      summary: 'one issue found',
      findings: [
        {
          severity: 'critical',
          title: 'missing null check',
          file: 'src/foo.ts',
          line: 42,
          description: 'foo can be undefined here',
        },
      ],
    });
    const lines = renderReview(r).split('\n');
    expect(lines[0]).toBe('v2 — findings');
    expect(lines[1]).toBe('one issue found');
    expect(lines[2]).toBe('- [critical] missing null check (src/foo.ts:42)');
    expect(lines[3]).toBe('foo can be undefined here');
  });

  it('(e) renders a finding with a file but no line as " (<file>)"', () => {
    // pre: a TaskReview with one finding carrying file, no line.
    // call: renderReview(review).
    // result: the finding line ends " (<file>)" with no line number.
    // source: task 2 Success "` (<file>)` when there is no line".
    const r = review({
      findings: [
        {
          severity: 'warning',
          title: 'unused import',
          file: 'src/bar.ts',
          description: 'bar is imported but never used',
        },
      ],
    });
    const lines = renderReview(r).split('\n');
    expect(lines[2]).toBe('- [warning] unused import (src/bar.ts)');
    expect(lines[3]).toBe('bar is imported but never used');
  });

  it('(f) renders a finding with no file as the bare title, with the description on the next line', () => {
    // pre: a TaskReview with one finding carrying no file (and no line).
    // call: renderReview(review).
    // result: the finding line carries no location suffix; the description is
    // the very next line.
    // source: task 2 Success "nothing when there is no file, and the description
    // on the next line".
    const r = review({
      findings: [
        {
          severity: 'info',
          title: 'consider renaming',
          description: 'the name is misleading',
        },
      ],
    });
    const lines = renderReview(r).split('\n');
    expect(lines[2]).toBe('- [info] consider renaming');
    expect(lines[3]).toBe('the name is misleading');
  });
});

describe('buildRulingDetail', () => {
  it('(g) returns undefined when neither a report nor a review is given', () => {
    // pre: report undefined, review null.
    // call: buildRulingDetail(undefined, null).
    // result: undefined.
    // source: task 2 Success "returns `undefined` with neither part".
    expect(buildRulingDetail(undefined, null)).toBeUndefined();
  });

  it('(h) holds only "## Worker report" when only a report is given', () => {
    // pre: report defined, review null.
    // call: buildRulingDetail(report, null).
    // result: "## Worker report\n\n" + the report, with no "## Task review" heading.
    // source: task 2 Success "only `## Worker report` with a report".
    const report = 'implementer finished the task';
    const out = buildRulingDetail(report, null);
    expect(out).toBe(`## Worker report\n\n${report}`);
    expect(out).not.toContain('## Task review');
  });

  it('(i) holds only "## Task review" when only a review is given', () => {
    // pre: report undefined, review defined.
    // call: buildRulingDetail(undefined, review).
    // result: "## Task review\n\n" + renderReview(review), with no "## Worker report" heading.
    // source: task 2 Success "only `## Task review` with a review".
    const r = review({ version: 1, verdict: 'pass', summary: 'all good', findings: [] });
    const out = buildRulingDetail(undefined, r);
    expect(out).toBe(`## Task review\n\nv1 — pass\nall good`);
    expect(out).not.toContain('## Worker report');
  });

  it('(j) orders the worker report before the task review, with a blank line between them', () => {
    // pre: both a report and a review are given.
    // call: buildRulingDetail(report, review).
    // result: "## Worker report" part, then a blank line, then "## Task review" part,
    // in that order.
    // source: task 2 Success "both in that order with a blank line between".
    const report = 'implementer finished the task';
    const r = review({ version: 1, verdict: 'pass', summary: 'all good', findings: [] });
    const out = buildRulingDetail(report, r);
    expect(out).toBe(
      `## Worker report\n\n${report}\n\n## Task review\n\nv1 — pass\nall good`,
    );
  });

  it('(k) caps the worker report part at 12,000 characters', () => {
    // pre: a report 500 characters longer than the 12,000-character cap.
    // call: buildRulingDetail(report, null).
    // result: the worker-report part holds the first 12,000 characters, a
    // newline and "[500 characters dropped]".
    // source: task 2 Success "the report is capped at 12,000 ... characters";
    // design C2 line 44, DETAIL_REPORT_CAP = 12_000.
    const report = 'a'.repeat(12500);
    const out = buildRulingDetail(report, null);
    expect(out).toBe(`## Worker report\n\n${'a'.repeat(12000)}\n[500 characters dropped]`);
  });

  it('(l) caps the task review part at 8,000 characters', () => {
    // pre: a review whose rendered text is 1,010 characters longer than the
    // 8,000-character cap (a long summary, no findings).
    // call: buildRulingDetail(undefined, review).
    // result: the task-review part holds the first 8,000 characters of the
    // rendered review, a newline and "[1010 characters dropped]".
    // source: task 2 Success "the review ... at 8,000 ... characters"; design C2
    // line 44, DETAIL_REVIEW_CAP = 8_000.
    const longSummary = 'b'.repeat(9000);
    const r = review({ version: 1, verdict: 'pass', summary: longSummary, findings: [] });
    const fullRendered = `v1 — pass\n${longSummary}`; // 10 + 9000 = 9010 chars
    const out = buildRulingDetail(undefined, r);
    expect(out).toBe(
      `## Task review\n\n${fullRendered.slice(0, 8000)}\n[1010 characters dropped]`,
    );
  });
});

describe('rulingCommits', () => {
  it('(m) puts the red commit first, ahead of the later commits', () => {
    // pre: a defined red commit and a later-commits list that does not contain it.
    // call: rulingCommits(red, later).
    // result: [red, ...later], order otherwise unchanged.
    // source: task 2 Success "puts the red commit first".
    expect(rulingCommits('abc1234', ['def5678', 'ghi9012'])).toEqual([
      'abc1234',
      'def5678',
      'ghi9012',
    ]);
  });

  it('(n) leaves the red commit out when it is undefined', () => {
    // pre: red undefined, a later-commits list.
    // call: rulingCommits(undefined, later).
    // result: the later-commits list alone, order unchanged.
    // source: task 2 Success "leaves it out when undefined".
    expect(rulingCommits(undefined, ['def5678', 'ghi9012'])).toEqual(['def5678', 'ghi9012']);
  });

  it('(o) drops a later duplicate of the red commit, keeping order', () => {
    // pre: a defined red commit that also appears again inside the later-commits
    // list.
    // call: rulingCommits(red, later).
    // result: the duplicate is dropped; the red commit stays first and the
    // remaining later commits keep their order.
    // source: task 2 Success "drops a later duplicate keeping order".
    expect(rulingCommits('abc1234', ['def5678', 'abc1234', 'ghi9012'])).toEqual([
      'abc1234',
      'def5678',
      'ghi9012',
    ]);
  });
});
