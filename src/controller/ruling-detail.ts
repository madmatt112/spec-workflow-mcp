import type { TaskReview } from '../types.js';

export const DETAIL_REPORT_CAP = 12_000;
export const DETAIL_REVIEW_CAP = 8_000;

export function capPart(text: string, cap: number): string {
  if (text.length <= cap) return text;
  const dropped = text.length - cap;
  return `${text.slice(0, cap)}\n[${dropped} characters dropped]`;
}

export function renderReview(review: TaskReview): string {
  const lines = [`v${review.version} — ${review.verdict}`, review.summary];
  for (const finding of review.findings) {
    const location = finding.file
      ? finding.line !== undefined
        ? ` (${finding.file}:${finding.line})`
        : ` (${finding.file})`
      : '';
    lines.push(`- [${finding.severity}] ${finding.title}${location}`);
    lines.push(finding.description);
  }
  return lines.join('\n');
}

export function buildRulingDetail(
  report: string | undefined,
  review: TaskReview | null,
): string | undefined {
  if (!report && !review) return undefined;
  const parts: string[] = [];
  if (report) parts.push(`## Worker report\n\n${capPart(report, DETAIL_REPORT_CAP)}`);
  if (review) parts.push(`## Task review\n\n${capPart(renderReview(review), DETAIL_REVIEW_CAP)}`);
  return parts.join('\n\n');
}

export function rulingCommits(red: string | undefined, later: string[]): string[] {
  if (red === undefined) return later;
  return [red, ...later.filter((commit) => commit !== red)];
}
