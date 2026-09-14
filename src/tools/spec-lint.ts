import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PathUtils } from '../core/path-utils.js';
import { selectRoots } from './root-selection.js';
import { validateMarkdownForMdx } from '../core/mdx-validator.js';
import { criteria, taskBlocks } from '../core/lint-markdown.js';
import { checkCitations } from '../core/lint-citations.js';
import { checkEars } from '../core/lint-ears.js';
import { DEFAULT_CAPS, parseWordCaps, checkDocWords, checkTaskWords } from '../core/lint-words.js';
import {
  checkTasksFormat,
  requirementIndex,
  checkRequirementIds,
  designComponents,
  checkCoverage,
  checkBridges,
} from '../core/lint-tasks.js';
import { finishLint, lintMessage, type LintCaps, type LintFinding } from '../core/lint-types.js';

/**
 * The `spec-lint` tool (design Component 1, requirements 1.1-1.9, 3.1-3.2, the
 * `agent-rules.md` read of 6.3, NFR Security). One read-only call lints a spec
 * document mechanically — citations, MDX, EARS, word caps, tasks shape,
 * requirement ids, coverage and bridges — so a reviewer round never spends
 * tokens on a wrong path, range or malformed task. It spawns no child process
 * and reads files only under the workspace, the spec store and the spec
 * directory, all through `PathUtils.safeJoin`.
 */
export const specLintTool: Tool = {
  name: 'spec-lint',
  description: `Lint a spec phase document mechanically and return structured findings.

# Instructions

Call this before a reviewer round to catch wrong citations, MDX compile errors, non-EARS
acceptance criteria, over-cap word counts and malformed tasks. Returns findings sorted by
line then rule, a severity summary, the rule ids that ran and the word caps in force. The
tool reads only the spec store and the workspace it is given; it never spawns a process.`,
  inputSchema: {
    type: 'object',
    properties: {
      specName: {
        type: 'string',
        description: 'Name of the specification (kebab-case)',
      },
      phase: {
        type: 'string',
        enum: ['requirements', 'design', 'tasks'],
        description: 'Which spec document to lint',
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to the workspace under review (optional - uses the server context roots if not provided). When provided it replaces the context workspace, and the shared workflow root holding .spec-workflow is derived from it.',
      },
    },
    required: ['specName', 'phase'],
    additionalProperties: false,
  },
  annotations: {
    title: 'Spec Lint',
    readOnlyHint: true,
  },
};

export async function specLintHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const { specName, phase } = args;

  // (1) Argument checks. `phase` must be one of the three accepted values (1.2).
  if (!specName || typeof specName !== 'string') {
    return { success: false, message: 'specName is required and must be a string' };
  }
  if (phase !== 'requirements' && phase !== 'design' && phase !== 'tasks') {
    return { success: false, message: 'phase is required and must be one of: requirements, design, tasks' };
  }

  // (2) Roots: the code root is `workspacePath`, the spec store `workflowRoot`.
  const { workflowRoot, workspacePath } = selectRoots(args, context);

  // (3) The document (1.4). Any read error is `success: false` naming the path.
  const specDir = PathUtils.getSpecPath(workflowRoot, specName);
  const docPath = PathUtils.safeJoin(specDir, `${phase}.md`);
  let content: string;
  try {
    content = await readFile(docPath, 'utf-8');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, message: `Failed to read ${docPath}: ${message}` };
  }
  const lines = content.split('\n');

  // (4) `agent-rules.md` for the cap override (6.3). ENOENT keeps the defaults;
  // any other error is a hard failure (1.5, as `src/tools/review-gate.ts:176-188`).
  let agentRules = '';
  const agentRulesPath = join(PathUtils.getWorkflowRoot(workflowRoot), 'agent-rules.md');
  try {
    agentRules = await readFile(agentRulesPath, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Failed to read agent-rules.md: ${message}` };
    }
  }

  // (5) Cap override: defaults merged with any valid bullet; one `caps-invalid`
  // per invalid entry.
  const parsed = parseWordCaps(agentRules);
  const caps: LintCaps = { ...DEFAULT_CAPS, ...parsed.caps };

  const findings: LintFinding[] = [];
  for (const { key, value } of parsed.invalid) {
    findings.push({
      file: '', line: 1, rule: 'caps-invalid', severity: 'info',
      message: `word cap \`${key}\` value \`${value}\` is not a positive integer; default kept`,
    });
  }

  // (6) MDX compile check (3.1).
  const mdx = await validateMarkdownForMdx(content);
  for (const issue of mdx.issues) {
    findings.push({
      file: '', line: issue.line, column: issue.column, rule: 'mdx', severity: 'error', message: issue.message,
    });
  }

  // (7) Citations, resolved over the workspace, the spec store and the spec
  // directory in order (2.3, 1.9).
  findings.push(...(await checkCitations(lines, [workspacePath, workflowRoot, specDir])));

  // (8) Per-phase checks.
  if (phase === 'requirements') {
    findings.push(...checkEars(criteria(lines)));
    findings.push(...checkDocWords(content, caps.requirements));
  } else if (phase === 'design') {
    findings.push(...checkDocWords(content, caps.design));
  } else {
    const blocks = taskBlocks(lines);
    findings.push(...checkTasksFormat(content));

    // Requirement ids: a missing/unreadable `requirements.md` degrades to the
    // 5.4 `info` finding (a null index).
    let index: Map<number, Set<number>> | null = null;
    try {
      const reqContent = await readFile(PathUtils.safeJoin(specDir, 'requirements.md'), 'utf-8');
      index = requirementIndex(reqContent.split('\n'));
    } catch {
      index = null;
    }
    findings.push(...checkRequirementIds(lines, index));

    findings.push(...checkTaskWords(lines, blocks, caps.task));

    // Coverage: a missing/unreadable `design.md` degrades to the 7.3 `info`
    // finding (a null component list).
    let components: ReturnType<typeof designComponents> = null;
    try {
      const designContent = await readFile(PathUtils.safeJoin(specDir, 'design.md'), 'utf-8');
      components = designComponents(designContent.split('\n'));
    } catch {
      components = null;
    }
    findings.push(...checkCoverage(lines, blocks, components));

    findings.push(...checkBridges(lines, blocks));
  }

  // (9) Assemble the response (1.6-1.8). No `nextSteps`.
  const data = finishLint(findings, phase, caps);
  return {
    success: true,
    message: lintMessage(specName, phase, data.summary),
    data,
    projectContext: {
      projectPath: workflowRoot,
      workflowRoot: PathUtils.getWorkflowRoot(workflowRoot),
      specName,
      dashboardUrl: context.dashboardUrl,
    },
  };
}
