import { promises as fs } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { TaskReview, ReviewFinding } from '../types.js';

/**
 * Validate that verdict and findings are consistent.
 * Shared by review-task tool handler and TaskReviewRunner.
 */
export function validateVerdictConsistency(
  verdict: string,
  findings: ReviewFinding[]
): { valid: boolean; error?: string } {
  const criticalCount = findings.filter(f => f.severity === 'critical').length;

  if (verdict === 'pass' && findings.length > 0) {
    return { valid: false, error: 'Verdict "pass" requires zero findings. Use "findings" or "fail" if there are issues.' };
  }
  if (verdict === 'fail' && criticalCount === 0) {
    return { valid: false, error: 'Verdict "fail" requires at least one critical finding.' };
  }
  if (verdict === 'findings' && criticalCount > 0) {
    return { valid: false, error: 'Verdict "findings" cannot contain critical-severity items. Use "fail" instead.' };
  }

  return { valid: true };
}

/**
 * Manager for task review storage using markdown files with YAML frontmatter.
 * Each review is stored as an individual markdown file in the spec's "reviews" directory.
 */
export class TaskReviewManager {
  private specPath: string;
  private reviewsDir: string;

  constructor(specPath: string) {
    this.specPath = specPath;
    this.reviewsDir = join(specPath, 'reviews');
  }

  private async ensureReviewsDir(): Promise<void> {
    // One-time migration: rename Reviews/ → reviews/ on case-sensitive filesystems
    const oldDir = join(this.specPath, 'Reviews');
    try {
      const oldExists = await fs.stat(oldDir).then(() => true, () => false);
      const newExists = await fs.stat(this.reviewsDir).then(() => true, () => false);
      if (oldExists && !newExists) {
        await fs.rename(oldDir, this.reviewsDir);
        return;
      }
    } catch {
      // Ignore migration errors
    }

    await fs.mkdir(this.reviewsDir, { recursive: true });
  }

  /**
   * Determine the next version number for a task's review
   */
  async getNextVersion(taskId: string): Promise<number> {
    const existing = await this.getReviewsForTask(taskId);
    if (existing.length === 0) return 1;
    return Math.max(...existing.map(r => r.version)) + 1;
  }

  /**
   * Write a prepare marker file to gate the record action
   */
  async writePrepareMarker(taskId: string): Promise<void> {
    await this.ensureReviewsDir();
    const sanitized = taskId.replace(/[/.]/g, '-');
    const markerPath = join(this.reviewsDir, `.prepare-${sanitized}`);
    await fs.writeFile(markerPath, new Date().toISOString(), 'utf-8');
  }

  /**
   * Check if a prepare marker exists for this task
   */
  async hasPrepareMarker(taskId: string): Promise<boolean> {
    const sanitized = taskId.replace(/[/.]/g, '-');
    const markerPath = join(this.reviewsDir, `.prepare-${sanitized}`);
    try {
      await fs.access(markerPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Remove the prepare marker after recording a review
   */
  async removePrepareMarker(taskId: string): Promise<void> {
    const sanitized = taskId.replace(/[/.]/g, '-');
    const markerPath = join(this.reviewsDir, `.prepare-${sanitized}`);
    try {
      await fs.unlink(markerPath);
    } catch {
      // Ignore if already removed
    }
  }

  /**
   * Save a review to disk as a markdown file with YAML frontmatter
   */
  async saveReview(review: Omit<TaskReview, 'id' | 'version' | 'timestamp'>): Promise<TaskReview> {
    await this.ensureReviewsDir();

    const version = await this.getNextVersion(review.taskId);
    const id = randomUUID();
    const timestamp = new Date().toISOString();

    const fullReview: TaskReview = {
      ...review,
      id,
      version,
      timestamp,
    };

    const fileName = this.generateFileName(fullReview.taskId, version, timestamp);
    const filePath = join(this.reviewsDir, fileName);
    const markdown = this.reviewToMarkdown(fullReview);

    await fs.writeFile(filePath, markdown, 'utf-8');

    // Clean up the prepare marker
    await this.removePrepareMarker(review.taskId);

    return fullReview;
  }

  /**
   * Get all reviews for a specific task, sorted by version ascending
   */
  async getReviewsForTask(taskId: string): Promise<TaskReview[]> {
    const all = await this.loadAllReviews();
    return all
      .filter(r => r.taskId === taskId)
      .sort((a, b) => a.version - b.version);
  }

  /**
   * Get the latest review for a task (highest version)
   */
  async getLatestReview(taskId: string): Promise<TaskReview | null> {
    const reviews = await this.getReviewsForTask(taskId);
    return reviews.length > 0 ? reviews[reviews.length - 1] : null;
  }

  /**
   * Load all reviews from the reviews directory
   */
  async loadAllReviews(): Promise<TaskReview[]> {
    await this.ensureReviewsDir();

    try {
      const files = await fs.readdir(this.reviewsDir);
      const mdFiles = files.filter(f => f.startsWith('review-') && f.endsWith('.md'));
      const reviews: TaskReview[] = [];

      for (const file of mdFiles) {
        try {
          const content = await fs.readFile(join(this.reviewsDir, file), 'utf-8');
          const review = this.parseReviewMarkdown(content);
          if (review) reviews.push(review);
        } catch {
          // Skip unparseable files
        }
      }

      return reviews;
    } catch {
      return [];
    }
  }

  private generateFileName(taskId: string, version: number, timestamp: string): string {
    const sanitizedTaskId = taskId.replace(/[/.]/g, '-');
    const ts = timestamp.replace(/[:.Z]/g, '').slice(0, 15);
    return `review-${sanitizedTaskId}_v${version}_${ts}.md`;
  }

  private reviewToMarkdown(review: TaskReview): string {
    const criticalCount = review.findings.filter(f => f.severity === 'critical').length;
    const warningCount = review.findings.filter(f => f.severity === 'warning').length;
    const infoCount = review.findings.filter(f => f.severity === 'info').length;

    let md = `---\n`;
    md += `id: ${review.id}\n`;
    md += `taskId: "${review.taskId}"\n`;
    md += `specName: ${review.specName}\n`;
    md += `version: ${review.version}\n`;
    md += `verdict: ${review.verdict}\n`;
    md += `timestamp: ${review.timestamp}\n`;
    md += `criticalCount: ${criticalCount}\n`;
    md += `warningCount: ${warningCount}\n`;
    md += `infoCount: ${infoCount}\n`;
    md += `---\n\n`;

    md += `# Task Review: Task ${review.taskId} (v${review.version})\n\n`;
    md += `**Spec:** ${review.specName}\n`;
    md += `**Reviewed:** ${review.timestamp}\n`;
    md += `**Verdict:** ${review.verdict}\n\n`;
    md += `---\n\n`;

    md += `## Summary\n\n${review.summary}\n\n`;

    if (review.findings.length === 0) {
      md += `## Findings\n\n_No findings — clean review._\n`;
    } else {
      md += `## Findings\n\n`;
      for (const finding of review.findings) {
        const tag = finding.severity.toUpperCase();
        const cat = finding.category && finding.category !== 'spec-compliance'
          ? ` [${finding.category}]` : '';
        md += `### ${tag}${cat}: ${finding.title}\n`;
        if (finding.file) {
          md += `- **File:** ${finding.file}${finding.line ? `:${finding.line}` : ''}\n`;
        }
        md += `- **Issue:** ${finding.description}\n`;
        if (finding.taskRequirement) {
          md += `- **Task Requirement:** ${finding.taskRequirement}\n`;
        }
        if (finding.classification) {
          md += `- **Classification:** ${finding.classification}\n`;
        }
        md += `\n`;
      }
    }

    return md;
  }

  private parseReviewMarkdown(content: string): TaskReview | null {
    try {
      // Parse YAML frontmatter
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) return null;

      const fm = fmMatch[1];
      const get = (key: string): string => {
        const match = fm.match(new RegExp(`^${key}:\\s*"?([^"\\n]*)"?`, 'm'));
        return match ? match[1].trim() : '';
      };

      const id = get('id');
      const taskId = get('taskId');
      const specName = get('specName');
      const version = parseInt(get('version')) || 0;
      const verdict = get('verdict') as TaskReview['verdict'];
      const timestamp = get('timestamp');

      if (!id || !taskId || !specName || !verdict) return null;

      // Parse summary from markdown body
      const summaryMatch = content.match(/## Summary\n\n([\s\S]*?)(?:\n\n## |\n\n_No findings)/);
      const summary = summaryMatch ? summaryMatch[1].trim() : '';

      // Parse findings from markdown body
      const findings: ReviewFinding[] = [];
      const findingPattern = /### (CRITICAL|WARNING|INFO)(?:\s*\[([^\]]+)\])?:\s*(.+)/g;
      let match;

      while ((match = findingPattern.exec(content)) !== null) {
        const severity = match[1].toLowerCase() as ReviewFinding['severity'];
        const category = match[2] as ReviewFinding['category'] | undefined;
        const title = match[3].trim();

        // Extract details from the lines following the heading
        const afterHeading = content.slice(match.index + match[0].length);
        const nextHeadingIdx = afterHeading.search(/\n### /);
        const block = nextHeadingIdx >= 0
          ? afterHeading.slice(0, nextHeadingIdx)
          : afterHeading;

        const fileMatch = block.match(/- \*\*File:\*\*\s*(.+)/);
        const issueMatch = block.match(/- \*\*Issue:\*\*\s*(.+)/);
        const reqMatch = block.match(/- \*\*Task Requirement:\*\*\s*(.+)/);
        const classMatch = block.match(/- \*\*Classification:\*\*\s*(novel|compounding|recurring)/);

        let file: string | undefined;
        let line: number | undefined;
        if (fileMatch) {
          const fileParts = fileMatch[1].trim().match(/^(.+?):(\d+)$/);
          if (fileParts) {
            file = fileParts[1];
            line = parseInt(fileParts[2]);
          } else {
            file = fileMatch[1].trim();
          }
        }

        findings.push({
          severity,
          title,
          file,
          line,
          description: issueMatch ? issueMatch[1].trim() : '',
          taskRequirement: reqMatch ? reqMatch[1].trim() : undefined,
          category: category || 'spec-compliance',
          classification: classMatch ? (classMatch[1] as 'novel' | 'compounding' | 'recurring') : undefined,
        });
      }

      return { id, taskId, specName, version, timestamp, verdict, summary, findings };
    } catch {
      return null;
    }
  }

  getReviewsDir(): string {
    return this.reviewsDir;
  }
}
