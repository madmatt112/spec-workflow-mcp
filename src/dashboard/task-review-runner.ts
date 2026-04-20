import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { ReviewFinding } from '../types.js';
import { TaskReviewManager, validateVerdictConsistency } from '../core/task-review-manager.js';
import { PathUtils } from '../core/path-utils.js';
import { reviewTaskHandler } from '../tools/review-task.js';
import { ToolContext } from '../types.js';

export interface TaskReviewJob {
  id: string;
  projectId: string;
  specName: string;
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: string;
  completedAt?: string;
  error?: string;
  verdict?: string;
  version?: number;
}

interface RunOptions {
  projectId: string;
  specName: string;
  taskId: string;
  projectPath: string;
  model?: string;
  cli?: string;
  cliArgs?: string[];
}

const JOB_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CONCURRENT_PER_PROJECT = 2;

export class TaskReviewRunner extends EventEmitter {
  private jobs: Map<string, TaskReviewJob> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private timeouts: Map<string, NodeJS.Timeout> = new Map();

  getJob(jobId: string): TaskReviewJob | undefined {
    return this.jobs.get(jobId);
  }

  getJobsForProject(projectId: string): TaskReviewJob[] {
    return Array.from(this.jobs.values()).filter(j => j.projectId === projectId);
  }

  getActiveJobsForProject(projectId: string): TaskReviewJob[] {
    return this.getJobsForProject(projectId).filter(
      j => j.status === 'pending' || j.status === 'running'
    );
  }

  async run(opts: RunOptions): Promise<string> {
    const activeJobs = this.getActiveJobsForProject(opts.projectId);
    if (activeJobs.length >= MAX_CONCURRENT_PER_PROJECT) {
      throw new Error(`Maximum ${MAX_CONCURRENT_PER_PROJECT} concurrent task reviews per project. Wait for a running review to complete.`);
    }

    const duplicate = activeJobs.find(j => j.specName === opts.specName && j.taskId === opts.taskId);
    if (duplicate) {
      throw new Error(`A task review is already running for ${opts.specName}/task ${opts.taskId}`);
    }

    const jobId = randomUUID();
    const job: TaskReviewJob = {
      id: jobId,
      projectId: opts.projectId,
      specName: opts.specName,
      taskId: opts.taskId,
      status: 'pending',
      startedAt: new Date().toISOString(),
    };

    this.jobs.set(jobId, job);
    this.emit('job-update', job);

    this.executeJob(jobId, opts).catch(err => {
      console.error(`[TaskReviewRunner] Job ${jobId} failed:`, err);
    });

    return jobId;
  }

  private async executeJob(jobId: string, opts: RunOptions): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const specPath = PathUtils.getSpecPath(opts.projectPath, opts.specName);
    const reviewManager = new TaskReviewManager(specPath);

    try {
      // Step 1: Call prepare to get review context and methodology
      const context: ToolContext = { projectPath: opts.projectPath };
      const prepareResponse = await reviewTaskHandler(
        { action: 'prepare', specName: opts.specName, taskId: opts.taskId },
        context
      );

      if (!prepareResponse.success) {
        throw new Error(`Prepare failed: ${prepareResponse.message}`);
      }

      const { taskContext, implementationSummary, steeringExcerpt, filesToReview, methodology } = prepareResponse.data;

      // Load prior reviews and memory for iterative reviews (v2+)
      const priorReviews = await reviewManager.getReviewsForTask(opts.taskId);
      const hasPriorReviews = priorReviews.length > 0;
      const sanitizedTaskId = opts.taskId.replace(/[/.]/g, '-');
      const memoryFilePath = hasPriorReviews
        ? join(specPath, 'reviews', `memory-task-${sanitizedTaskId}.md`)
        : null;

      let priorReviewContext: string | null = null;
      let priorMemoryContent: string | null = null;
      if (hasPriorReviews) {
        // Last 2 versions only (prompt bloat cap)
        const recentVersions = priorReviews.slice(-2);
        priorReviewContext = this.formatPriorReviewContext(recentVersions);

        // Read existing memory file if it exists
        try {
          priorMemoryContent = await fs.readFile(memoryFilePath!, 'utf-8');
        } catch {
          priorMemoryContent = null;
        }
      }

      // Step 2: Build prompt and spawn fresh agent
      const timestamp = new Date().toISOString().replace(/[:.Z]/g, '').slice(0, 15);
      const outputPath = join(tmpdir(), `task-review-${opts.specName}-${opts.taskId}-${timestamp}.json`);
      const prompt = this.buildPrompt(opts.specName, opts.taskId, taskContext, implementationSummary, steeringExcerpt, filesToReview, methodology, outputPath, priorReviewContext, priorMemoryContent, memoryFilePath);

      job.status = 'running';
      this.emit('job-update', { ...job });

      try {
        await this.runAgent(jobId, opts.projectPath, prompt, opts);

        // Read and parse agent output
        let rawOutput: string;
        try {
          rawOutput = await fs.readFile(outputPath, 'utf-8');
        } catch {
          throw new Error(`Review agent completed but did not write output file at ${outputPath}`);
        }

        // Lenient JSON parsing: strip markdown fences
        let parsed: any;
        try {
          parsed = JSON.parse(this.stripMarkdownFences(rawOutput));
        } catch {
          // Save raw output for debugging
          const failedPath = join(tmpdir(), `task-review-failed-${opts.specName}-${opts.taskId}-${timestamp}.txt`);
          await fs.writeFile(failedPath, rawOutput, 'utf-8').catch(() => {});
          throw new Error(`Failed to parse agent output as JSON. Raw output saved to ${failedPath}`);
        }

        // Validate verdict/findings consistency
        const findings: ReviewFinding[] = Array.isArray(parsed.findings) ? parsed.findings : [];
        const verdict = parsed.verdict;
        const summary = parsed.summary || '';

        const validation = validateVerdictConsistency(verdict, findings);
        if (!validation.valid) {
          throw new Error(`Agent produced invalid verdict/findings: ${validation.error}`);
        }

        // Persist the review
        const review = await reviewManager.saveReview({
          taskId: opts.taskId,
          specName: opts.specName,
          verdict,
          summary,
          findings,
        });

        job.verdict = review.verdict;
        job.version = review.version;
        job.status = 'completed';
        job.completedAt = new Date().toISOString();
        this.emit('job-update', { ...job });

        // Clean up temp output file
        await fs.unlink(outputPath).catch(() => {});
      } finally {
        // Always clean up prepare marker in all terminal paths
        await reviewManager.removePrepareMarker(opts.taskId);
      }
    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message || 'Unknown error';
      job.completedAt = new Date().toISOString();
      this.emit('job-update', { ...job });
    } finally {
      this.cleanupProcess(jobId);
    }
  }

  private buildPrompt(
    specName: string,
    taskId: string,
    taskContext: any,
    implementationSummary: any,
    steeringExcerpt: string | null,
    filesToReview: string[],
    methodology: string,
    outputPath: string,
    priorReviewContext: string | null = null,
    priorMemoryContent: string | null = null,
    memoryFilePath: string | null = null
  ): string {
    const sections: string[] = [];

    sections.push(`You are a senior engineer conducting a critical code review of task ${taskId} ("${taskContext.description || ''}") from spec "${specName}". Your job is to find problems — not to validate or praise. Assume the implementation has issues until you prove otherwise. Be thorough, skeptical, and specific. If something is genuinely correct, acknowledge it briefly and move on to finding the next issue.`);
    sections.push('');
    sections.push('## Task Context');
    sections.push(JSON.stringify(taskContext, null, 2));
    sections.push('');
    sections.push('## Implementation Summary');
    sections.push(JSON.stringify(implementationSummary, null, 2));

    if (steeringExcerpt) {
      sections.push('');
      sections.push('## Tech Steering');
      sections.push(steeringExcerpt);
    }

    const hasPriorReviews = priorReviewContext !== null;
    if (hasPriorReviews) {
      sections.push('');
      sections.push('## Prior Review Context');
      sections.push('The last 2 review versions identified the following findings:');
      sections.push(priorReviewContext!);
      sections.push('');
      sections.push('## Prior Review Memory');
      sections.push(priorMemoryContent || 'No memory file yet — this is the first iterative review.');
      sections.push('');
      sections.push('## Memory File Update');
      sections.push(`After reviewing, write an updated memory file to: ${memoryFilePath}`);
      sections.push('');
      sections.push('Use this template:');
      sections.push('```markdown');
      sections.push(`# Task Review Memory — Task ${taskId} (${specName})`);
      sections.push('Last updated: {ISO timestamp} (after v{N} review)');
      sections.push('');
      sections.push('## Cumulative Findings Summary');
      sections.push('');
      sections.push('### Still Present (recurring/compounding in latest review)');
      sections.push('- v{X}, v{Y} [severity] Title (file.ts)');
      sections.push('');
      sections.push('### Addressed (present earlier, not found in latest)');
      sections.push('- v{X} [severity] Title (file.ts)');
      sections.push('');
      sections.push('### New in Latest Review (v{N})');
      sections.push('- [severity] Title (file.ts:line)');
      sections.push('');
      sections.push('## Patterns & Themes');
      sections.push('- High-level observations about recurring themes across reviews');
      sections.push('');
      sections.push('## Guidance for Next Review');
      sections.push('- Focus areas based on what has been found');
      sections.push('- Areas that have been well-covered and can be de-prioritized');
      sections.push('```');
      sections.push('');
      sections.push('Do not rewrite the entire memory file from scratch — preserve history from the prior memory content. Update only what changed: move Addressed items from "Still Present" into their own section, add new findings to "New in Latest Review", and refine Patterns/Guidance.');
    }

    sections.push('');
    sections.push('## Files to Review');
    sections.push(filesToReview.map(f => `- ${f}`).join('\n'));
    sections.push('');
    sections.push('## Review Methodology');
    sections.push(methodology);
    sections.push('');
    sections.push('## Instructions');
    sections.push('1. Read every file listed in "Files to Review".');
    sections.push('2. Evaluate each methodology checklist item. State what you checked and your conclusion.');
    sections.push('3. Determine a verdict:');
    sections.push('   - "pass": no findings at all');
    sections.push('   - "fail": at least one critical finding');
    sections.push('   - "findings": warnings/info only, no criticals');
    sections.push(`4. Write your results as JSON to: ${outputPath}`);
    sections.push('');
    sections.push('The JSON must match this exact schema:');
    const findingSchema: any = {
      severity: 'critical | warning | info',
      title: 'Short title of the finding',
      description: 'Detailed description of the issue',
      file: 'path/to/file.ts (optional)',
      line: 42,
      taskRequirement: 'Which requirement this relates to (optional)',
      category: 'spec-compliance | hygiene'
    };
    if (hasPriorReviews) {
      findingSchema.classification = 'novel | compounding | recurring';
    }
    sections.push(JSON.stringify({
      verdict: 'pass | fail | findings',
      summary: '1-2 sentence summary of the review outcome',
      findings: [findingSchema]
    }, null, 2));
    sections.push('');
    sections.push('- "pass" verdict MUST have an empty findings array');
    sections.push('- "fail" verdict MUST have at least one finding with severity "critical"');
    sections.push('- "findings" verdict MUST NOT have any findings with severity "critical"');
    sections.push('- Default category to "spec-compliance" unless the finding is about debug code, secrets, or similar hygiene issues');
    if (hasPriorReviews) {
      sections.push('- Each finding MUST include a `classification` field: "novel", "compounding", or "recurring"');
      sections.push(`- Also write an updated memory file to: ${memoryFilePath}`);
    }
    sections.push('');
    sections.push(hasPriorReviews
      ? 'Write ONLY the JSON file (to the output path) and the memory file (to the memory path). Do not output anything else.'
      : 'Write ONLY the JSON file. Do not output anything else.');

    return sections.join('\n');
  }

  private formatPriorReviewContext(reviews: any[]): string {
    const lines: string[] = [];
    for (const review of reviews) {
      lines.push(`### Version ${review.version} (${review.verdict}): ${review.summary}`);
      if (review.findings.length === 0) {
        lines.push('_No findings_');
      } else {
        for (const f of review.findings) {
          const loc = f.file ? ` (${f.file}${f.line ? `:${f.line}` : ''})` : '';
          const cat = f.category === 'hygiene' ? ' [hygiene]' : '';
          lines.push(`- [${f.severity}]${cat} ${f.title}${loc}`);
        }
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  private stripMarkdownFences(text: string): string {
    let cleaned = text.trim();
    // Remove ```json ... ``` or ``` ... ```
    const fenceMatch = cleaned.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }
    return cleaned;
  }

  private runAgent(jobId: string, cwd: string, prompt: string, opts: RunOptions): Promise<void> {
    const cli = opts.cli || 'claude';
    const baseArgs = opts.cliArgs || ['--print', '--dangerously-skip-permissions'];

    return new Promise((resolve, reject) => {
      const args = [...baseArgs];
      if (opts.model) {
        args.push('--model', opts.model);
      }
      args.push(prompt);

      const child = spawn(cli, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env },
      });

      this.processes.set(jobId, child);

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Agent process timed out after 15 minutes'));
      }, JOB_TIMEOUT_MS);
      this.timeouts.set(jobId, timeout);

      let stderr = '';
      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        this.timeouts.delete(jobId);
        this.processes.delete(jobId);

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Agent process exited with code ${code}${stderr ? `: ${stderr.slice(0, 500)}` : ''}`));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        this.timeouts.delete(jobId);
        this.processes.delete(jobId);

        if ((err as any).code === 'ENOENT') {
          reject(new Error(`CLI "${cli}" not found. Ensure it is installed and available in PATH.`));
        } else {
          reject(err);
        }
      });
    });
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return false;
    }

    this.cleanupProcess(jobId);
    job.status = 'failed';
    job.error = 'Cancelled by user';
    job.completedAt = new Date().toISOString();
    this.emit('job-update', { ...job });

    // Clean up prepare marker on cancel
    const specPath = PathUtils.getSpecPath(job.specName, job.specName);
    // Note: We can't easily derive projectPath from the job alone.
    // The prepare marker cleanup in the finally block of executeJob handles this.

    return true;
  }

  private cleanupProcess(jobId: string): void {
    const timeout = this.timeouts.get(jobId);
    if (timeout) {
      clearTimeout(timeout);
      this.timeouts.delete(jobId);
    }

    const process = this.processes.get(jobId);
    if (process) {
      try {
        process.kill('SIGTERM');
      } catch {
        // Process may already be dead
      }
      this.processes.delete(jobId);
    }
  }

  shutdown(): void {
    for (const [jobId] of this.processes) {
      this.cleanupProcess(jobId);
      const job = this.jobs.get(jobId);
      if (job && job.status !== 'completed' && job.status !== 'failed') {
        job.status = 'failed';
        job.error = 'Server shutting down';
        job.completedAt = new Date().toISOString();
        this.emit('job-update', { ...job });
      }
    }
  }
}
