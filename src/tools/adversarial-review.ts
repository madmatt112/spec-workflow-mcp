import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { promises as fs } from 'fs';
import { join } from 'path';

export const adversarialReviewTool: Tool = {
  name: 'adversarial-review',
  description: `Prepare an adversarial review of a spec phase document, steering document, or spec decomposition.

# Instructions
Use this tool to set up an adversarial analysis of a requirements, design, tasks, steering,
or decomposition document. The tool writes a pre-built scaffold prompt to disk with PLACEHOLDER
blocks for the document-specific content, and returns the methodology, output paths, and context
needed to fill in the placeholders. The agent fills the placeholder blocks in the scaffold, then
launches a fresh-context subagent to execute it — context separation ensures genuinely critical output.

For decomposition reviews, use specName: "decomposition" and phase: "decomposition".`,
  inputSchema: {
    type: 'object',
    properties: {
      specName: {
        type: 'string',
        description: 'Name of the spec to review (kebab-case), "steering" for steering documents, or "decomposition" for spec decomposition'
      },
      phase: {
        type: 'string',
        description: 'Which document to target (e.g. requirements, design, tasks for specs; product, tech, structure for steering; decomposition for spec decomposition)'
      },
      filePath: {
        type: 'string',
        description: 'Relative path to the target file (optional — used for steering docs whose files live outside the steering directory)'
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to the project root (optional - uses server context path if not provided)'
      }
    },
    required: ['specName', 'phase'],
    additionalProperties: false
  },
  annotations: {
    title: 'Adversarial Review',
    readOnlyHint: false,
  }
};

export async function adversarialReviewHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const { specName, phase } = args;
  const projectPath = args.projectPath || context.projectPath;

  if (!specName || typeof specName !== 'string') {
    return { success: false, message: 'specName is required and must be a string' };
  }
  if (!phase || typeof phase !== 'string') {
    return { success: false, message: 'phase is required and must be a string' };
  }

  const workflowRoot = PathUtils.getWorkflowRoot(projectPath);

  // Determine paths based on document type
  const isSteering = specName === 'steering';
  const isDecomposition = specName === 'decomposition' || specName === 'spec-decomposition'
    || phase === 'decomposition'
    || (args.filePath && args.filePath.includes('spec-decomposition/'));

  let docDir: string;
  let targetFile: string;
  let reviewsDir: string;

  if (isDecomposition) {
    docDir = join(workflowRoot, 'spec-decomposition');
    targetFile = join(docDir, 'decomposition.md');
    reviewsDir = join(docDir, 'reviews');
  } else if (isSteering) {
    docDir = join(workflowRoot, 'steering');
    targetFile = args.filePath
      ? join(projectPath, args.filePath)
      : join(docDir, `${phase}.md`);
    reviewsDir = join(docDir, 'reviews');
  } else {
    docDir = join(workflowRoot, 'specs', specName);
    targetFile = join(docDir, `${phase}.md`);
    reviewsDir = join(docDir, 'reviews');
  }

  // Validate target file exists
  try {
    await fs.access(targetFile);
  } catch {
    return {
      success: false,
      message: `Target file not found: ${targetFile}`
    };
  }

  // Create reviews directory if needed
  await fs.mkdir(reviewsDir, { recursive: true });

  // Determine version by scanning existing files
  const versionPhase = isDecomposition ? 'decomposition' : phase;
  const version = await getNextVersion(reviewsDir, versionPhase);
  const versionSuffix = version === 1 ? '' : `-r${version}`;

  const promptOutputPath = join(reviewsDir, `adversarial-prompt-${versionPhase}${versionSuffix}.md`);
  const analysisOutputPath = join(reviewsDir, `adversarial-analysis-${versionPhase}${versionSuffix}.md`);

  // Find existing steering docs and prior phase docs as context
  const steeringDir = join(workflowRoot, 'steering');
  let steeringDocs: string[];
  let priorPhaseDocs: string[];

  if (isDecomposition) {
    // Decomposition reviews use steering docs as prior context
    steeringDocs = [];
    priorPhaseDocs = await findExistingFiles(steeringDir, ['product.md', 'tech.md', 'structure.md']);
  } else if (isSteering) {
    steeringDocs = [];
    priorPhaseDocs = [];
  } else {
    steeringDocs = await findExistingFiles(steeringDir, ['product.md', 'tech.md', 'structure.md']);
    priorPhaseDocs = await findPriorPhaseDocs(docDir, phase);
  }

  // Check for methodology override in settings
  const methodology = await getMethodologyOverride(workflowRoot, 'reviewMethodology') || getAdversarialReviewMethodology();

  // Memory context for v2+ reviews
  const memoryFilePath = join(reviewsDir, `adversarial-memory-${versionPhase}.md`);
  const latestAnalysisPath = version > 1
    ? await findLatestAnalysis(reviewsDir, versionPhase)
    : null;

  const scaffold = buildScaffoldedPrompt({
    specName: isDecomposition ? 'decomposition' : specName,
    phase: versionPhase,
    version,
    targetFile,
    analysisOutputPath,
    memoryFilePath,
    latestAnalysisPath,
  });

  try {
    await fs.writeFile(promptOutputPath, scaffold, 'utf-8');
  } catch (err) {
    return {
      success: false,
      message: `Failed to write scaffolded prompt: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  return {
    success: true,
    message: isDecomposition
      ? `Adversarial review prepared for spec decomposition (version ${version})`
      : `Adversarial review prepared for ${specName}/${phase}.md (version ${version})`,
    data: {
      targetFile,
      promptOutputPath,
      analysisOutputPath,
      version,
      phase,
      steeringDocs,
      priorPhaseDocs,
      methodology,
      memoryFilePath,
      latestAnalysisPath,
    },
    nextSteps: [
      'Read the target document',
      `Fill the PLACEHOLDER blocks in ${promptOutputPath}`,
      `Launch a fresh-context subagent with only: "Read and execute the instructions in ${promptOutputPath}"`,
      `The subagent will write its analysis to ${analysisOutputPath}`,
    ]
  };
}

async function getNextVersion(reviewsDir: string, phase: string): Promise<number> {
  try {
    const files = await fs.readdir(reviewsDir);
    const pattern = new RegExp(`^adversarial-analysis-${phase}(-r(\\d+))?\\.md$`);
    let maxVersion = 0;

    for (const file of files) {
      const match = file.match(pattern);
      if (match) {
        const ver = match[2] ? parseInt(match[2], 10) : 1;
        if (ver > maxVersion) maxVersion = ver;
      }
    }

    return maxVersion === 0 ? 1 : maxVersion + 1;
  } catch {
    return 1;
  }
}

async function findLatestAnalysis(reviewsDir: string, phase: string): Promise<string | null> {
  try {
    const files = await fs.readdir(reviewsDir);
    const pattern = new RegExp(`^adversarial-analysis-${phase}(-r(\\d+))?\\.md$`);
    let maxVersion = 0;
    let latestFile: string | null = null;

    for (const file of files) {
      const match = file.match(pattern);
      if (match) {
        const ver = match[2] ? parseInt(match[2], 10) : 1;
        if (ver > maxVersion) {
          maxVersion = ver;
          latestFile = join(reviewsDir, file);
        }
      }
    }

    return latestFile;
  } catch {
    return null;
  }
}

async function findExistingFiles(dir: string, filenames: string[]): Promise<string[]> {
  const found: string[] = [];
  for (const filename of filenames) {
    const filePath = join(dir, filename);
    try {
      await fs.access(filePath);
      found.push(filePath);
    } catch {
      // File doesn't exist, skip
    }
  }
  return found;
}

async function findPriorPhaseDocs(specDir: string, currentPhase: string): Promise<string[]> {
  const phaseOrder = ['requirements', 'design', 'tasks'];
  const currentIndex = phaseOrder.indexOf(currentPhase);
  const priorPhases = phaseOrder.slice(0, currentIndex);

  return findExistingFiles(specDir, priorPhases.map(p => `${p}.md`));
}

async function getMethodologyOverride(workflowRoot: string, key: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(join(workflowRoot, 'adversarial-settings.json'), 'utf-8');
    const settings = JSON.parse(raw);
    const value = settings[key];
    return typeof value === 'string' && value.trim() ? value : null;
  } catch {
    return null;
  }
}

export type PhaseGuidance = {
  persona: string;
  attackSurface: string;
  exampleAngles: string;
};

export const PHASE_ATTACK_ANGLES: Record<string, PhaseGuidance> = {
  requirements: {
    persona: 'senior technical product manager',
    attackSurface: 'Completeness, ambiguity, scope',
    exampleAngles: 'Missing user stories, unstated assumptions, scope creep risk, contradictions between stories, acceptance criteria that can\'t be tested',
  },
  design: {
    persona: 'staff engineer',
    attackSurface: 'Feasibility, consistency, edge cases',
    exampleAngles: 'Conflicts with steering docs, unaddressed failure modes, scaling bottlenecks, missing error paths, alternatives not considered',
  },
  tasks: {
    persona: 'senior delivery lead',
    attackSurface: 'Atomicity, ordering, coverage',
    exampleAngles: 'Tasks too large or too small, missing dependency edges, gaps between tasks and design, unclear completion criteria, tasks that don\'t map to any requirement',
  },
  decomposition: {
    persona: 'principal architect',
    attackSurface: 'Completeness, granularity, ordering',
    exampleAngles: 'Missing specs, over-scoped specs, wrong dependency order, horizontal instead of vertical slicing, INVEST violations (specs not independently valuable), cross-spec convention gaps, unresolved open questions that block implementation',
  },
  product: {
    persona: 'head of product',
    attackSurface: 'Vision clarity, user value, market fit',
    exampleAngles: 'Vague target users, unvalidated value propositions, missing success metrics, undifferentiated positioning, overlooked competitor capabilities',
  },
  tech: {
    persona: 'principal engineer',
    attackSurface: 'Architectural soundness, constraints, tradeoffs',
    exampleAngles: 'Unjustified technology choices, missing non-functional requirements, hidden integration costs, scalability ceilings, security or compliance gaps',
  },
  structure: {
    persona: 'engineering lead with deep codebase ownership',
    attackSurface: 'Organization, conventions, maintainability',
    exampleAngles: 'Inconsistent module layout, ambiguous ownership boundaries, conventions that conflict with the stack, missing patterns for shared concerns, hard-to-navigate hierarchies',
  },
};

const GENERIC_PHASE_GUIDANCE: PhaseGuidance = {
  persona: 'experienced senior reviewer',
  attackSurface: 'Completeness, consistency, and unstated assumptions',
  exampleAngles: 'Missing context, contradictions, ambiguous language, unaddressed failure modes, alternatives that were not considered',
};

export function buildScaffoldedPrompt(args: {
  specName: string;
  phase: string;
  version: number;
  targetFile: string;
  analysisOutputPath: string;
  memoryFilePath: string;
  latestAnalysisPath: string | null;
}): string {
  const { specName, phase, version, targetFile, analysisOutputPath, memoryFilePath, latestAnalysisPath } = args;
  const guidance = PHASE_ATTACK_ANGLES[phase] ?? GENERIC_PHASE_GUIDANCE;

  const base = `# Adversarial Review — ${specName}/${phase} (v${version})

You are a ${guidance.persona}. Your job is to tear apart this document and find every weakness — gaps, ambiguities, contradictions, unstated assumptions, failure modes that have not been considered. Do not validate or support. Use directive framing throughout.

## Target document
${targetFile}

## Analysis dimensions

<!-- PLACEHOLDER:ANALYSIS_DIMENSIONS
Replace this block with 3–6 numbered sections tailored to the target document.
Each section: a specific topic/decision + 3–5 directive bullets grounded in the
target document's actual content, not generic advice.

Attack surface for this phase: ${guidance.attackSurface}
Example angles: ${guidance.exampleAngles}
-->

## Closing deliverables
- Top N risks/gaps (3 for short docs, 5 for long)
- Top 3 conclusions to challenge or reverse, with reasoning
- What's missing — work that should be done before acting on this document

Be specific and concrete. Cite failure scenarios, not abstract risks. If something
is actually fine, say so briefly and move on.

## Output
Write your analysis to: ${analysisOutputPath}
`;

  if (version <= 1) {
    return base;
  }

  return `${base}
## Prior review context

<!-- PLACEHOLDER:PRIOR_REVIEW_CONTEXT
Read ${memoryFilePath} (if present) and ${latestAnalysisPath ?? '(no prior analysis on disk)'}. Replace this block with:
- Summary of prior findings
- Which were addressed, which persist
- Directive to focus on novel issues
- Classification scheme: novel / compounding / recurring
Then update the memory file per the methodology format.
-->
`;
}

function renderPhaseAttackAnglesTable(): string {
  const phaseLabels: Record<string, string> = {
    requirements: 'Requirements',
    design: 'Design',
    tasks: 'Tasks',
    decomposition: 'Decomposition',
    product: 'Product',
    tech: 'Tech',
    structure: 'Structure',
  };
  const rows = Object.entries(PHASE_ATTACK_ANGLES).map(([key, guidance]) => {
    const label = phaseLabels[key] ?? key;
    return `| **${label}** | ${guidance.attackSurface} | ${guidance.exampleAngles} |`;
  });
  return rows.join('\n');
}

export function getAdversarialReviewMethodology(): string {
  return `# Adversarial Review Methodology

## Technique

This follows the adversarial prompting technique where an AI critiques work in a fresh session
with no collaborative history, producing genuinely critical output rather than defending prior
contributions. The technique relies on **context separation** (fresh session) and **oppositional
framing** (the prompt directs the agent to attack, not validate).

Reference: https://www.fightingwithai.com/prompt-engineering/adversarial-prompting/

## How to Generate the Adversarial Prompt

Write a markdown file containing a prompt for a fresh agent session. The prompt must follow
this structure:

### Opening

- Assign the reviewing agent a **senior expert persona** relevant to the document's domain.
- State clearly that the agent's job is to find weaknesses, not to validate or support.
- Use oppositional framing: "tear apart", "stress-test", "find every gap", etc.

### Analysis Dimensions

Create **3-6 numbered sections**, each targeting a specific aspect of the document. These must
be **tailored to the document's actual content**, not generic. For each section:

- Name the specific topic or decision being targeted.
- Provide 3-5 bullet points with concrete attack angles: assumptions to challenge, failure
  modes to explore, missing considerations to surface, alternatives that were dismissed or ignored.
- Frame bullets as directives, not questions ("Challenge the claim that..." not "Do you think...").

**Phase-specific attack angles:**

| Phase | Primary attack surface | Example angles |
|---|---|---|
${renderPhaseAttackAnglesTable()}

If steering docs or prior phase docs exist, read them to ground the attack angles in the
project's actual constraints and decisions.

### Closing Deliverables

Ask the reviewing agent to conclude with:

- **Top N risks/gaps** (scaled to document size — 3 for a short doc, 5 for a long one)
- **Top 3 conclusions to challenge or reverse**, with specific reasoning
- **What's missing** — work that should be done before acting on the document

Include this directive: "Be specific and concrete. Cite failure scenarios, not abstract risks.
If something is actually fine, say so briefly and move on."

### Document Insertion Point

End the prompt by telling the reviewing agent where to write its analysis and providing
the target document path.

## What to Avoid

- **Don't make the prompt generic.** The analysis dimensions must reference specific topics,
  claims, and structures from the target document.
- **Don't include collaborative language.** No "please review" or "what do you think".
  Use directive framing throughout.
- **Don't leak context.** The prompt should not mention that it was generated by another AI
  or that there's a prior session. It should read as if a human architect wrote it.
- **Don't pad with praise directives.** No "highlight what's good". The entire point is
  oppositional analysis.

## Execution

After writing the prompt file, launch a fresh-context subagent. The subagent prompt must be
exactly: "Read and execute the instructions in <path-to-prompt-file>." Do not add any other
context, summary, or instructions.

## Working with Prior Review Context (v2+ Reviews)

When a memory file path and latest analysis path are provided (version 2+), the prompt
generation step has additional responsibilities:

### Reading Prior Context
- Read the memory file at the provided path (if it exists on disk — it won't exist for the
  first v2 review, but will for v3+).
- Read the latest analysis file to understand what was found in the most recent review.

### Updating the Memory File
After reading both, write an updated memory file that:
- Incorporates findings from the latest analysis into a cumulative record.
- Categorizes findings as: Accepted, Partially Accepted, Rejected, or Unresolved.
- Notes patterns and themes across iterations.
- Provides guidance for the next review's focus areas.

Use this format:
\`\`\`markdown
# Adversarial Review Memory — {phase}
Last updated: {date} (after v{N} review)

## Cumulative Findings Summary
### Accepted
- [finding]: [brief description, which version identified it]

### Partially Accepted
- [finding]: [brief description, user's stance]

### Rejected
- [finding]: [brief description, reason for rejection]

### Unresolved
- [finding]: [not yet responded to]

## Patterns & Themes
- [high-level observations about recurring issues]

## Guidance for Next Review
- Focus areas based on what's been found
- Areas that have been well-covered and don't need re-examination
\`\`\`

### Embedding Context in the Generated Prompt
Add a "## Prior Review Context" section to the generated adversarial prompt containing:
- A summary of what prior reviews found.
- Which findings were addressed and which persist.
- A directive to focus on novel issues, not re-discover known ones.
- Instruction to classify each finding as one of:
  - **Novel**: Not identified in any prior review.
  - **Compounding**: Builds on or deepens a prior finding.
  - **Recurring**: Same issue identified before but not yet resolved — severity should escalate.`;
}
