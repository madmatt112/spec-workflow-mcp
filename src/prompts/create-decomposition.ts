import { Prompt, PromptMessage } from '@modelcontextprotocol/sdk/types.js';
import { PromptDefinition } from './types.js';
import { ToolContext } from '../types.js';

const prompt: Prompt = {
  name: 'create-decomposition',
  title: 'Create Spec Decomposition',
  description: 'Guide for decomposing steering documents into a complete set of specs. Reads product.md, tech.md, and structure.md, then produces a spec breakdown with dependency ordering, cross-spec conventions, and open questions.',
  arguments: [
    {
      name: 'researchMode',
      description: 'If "true", research current SDD literature instead of using baked-in principles. Default: false (use baked-in methodology).',
      required: false
    }
  ]
};

async function handler(args: Record<string, any>, context: ToolContext): Promise<PromptMessage[]> {
  const researchMode = args.researchMode === 'true' || args.researchMode === true;

  const methodologyInstruction = researchMode
    ? `**Methodology — Research Mode:**
Before decomposing, search the web for current best practices in spec-driven development
decomposition (as of 2025-2026). Look for guidance on:
- How to size specs / features for AI-assisted development
- Vertical slicing vs. horizontal layering
- INVEST criteria applied at the feature/spec level
- The reviewability heuristic for spec sizing
Synthesize what you find into principles, then apply them to the steering docs.`
    : `**Methodology — Baked-in Principles:**
Call the \`decomposition-guide\` tool to load the spec decomposition methodology. Read and
follow the principles it provides.`;

  const messages: PromptMessage[] = [
    {
      role: 'user',
      content: {
        type: 'text',
        text: `Create a spec decomposition for this project by analyzing the steering documents.

**Context:**
- Project: ${context.projectPath}
${context.dashboardUrl ? `- Dashboard: ${context.dashboardUrl}` : ''}

## Step 1: Load Inputs

1. Read all steering docs from \`.spec-workflow/steering/\`:
   - \`product.md\` — project vision, goals, features
   - \`tech.md\` — technology decisions, architecture
   - \`structure.md\` — codebase organization, conventions

   If any steering doc is missing, inform the user and ask whether to proceed without it
   or create it first.

2. Ask the user: **"Is there existing code in this project that I should account for?"**
   - If yes: scan the codebase to understand what is already built, what patterns exist,
     and what functionality is in place. Factor this into the decomposition.
   - If no: proceed assuming a greenfield project.

## Step 2: Load Methodology

${methodologyInstruction}

## Step 3: Decompose

Apply the methodology to the steering docs. Produce a decomposition that includes:

- **Per-spec entries**: For each spec, describe:
  - Name (kebab-case)
  - What it delivers (concrete capabilities)
  - End-to-end verification (how to prove the spec is complete)
  - Dependencies on other specs
  - Notes and design considerations specific to this spec

- **Dependency graph**: A mermaid DAG showing spec ordering and relationships.

- **Cross-spec conventions**: Shared patterns, schema evolution rules, API conventions,
  or other project-wide decisions that apply across multiple specs.

- **What is NOT a spec**: Items from the steering docs that lack independent deliverable
  value. For each, document which spec absorbs it and why.

- **Open questions**: Ambiguities, design decisions, or scope boundary questions that
  surfaced during decomposition.

Adapt the structure to fit the project — these sections are guidance, not a rigid schema.

## Step 4: Open Questions

**IMPORTANT**: Before finalizing the decomposition, present all open questions to the user.
For each question:
- Explain the question and why it matters for spec boundaries or ordering
- Suggest options if possible
- Ask the user for guidance: a specific answer, a directive to leave it unresolved,
  or an indication that it should be resolved during a specific spec's design phase

Wait for user input before finalizing.

## Step 5: Save

Save the completed decomposition to:
\`.spec-workflow/spec-decomposition/decomposition.md\`

## Step 6: Scaffold (Optional)

Ask the user: **"Would you like me to create the spec directory structure?"**

If yes, create \`.spec-workflow/specs/{spec-name}/\` for each spec in the decomposition,
with a \`.gitkeep\` file in each.

## Step 7: Next Steps

Inform the user:
- The decomposition is a living document — update it as individual specs are built and
  design phases reveal new information.
- To run an adversarial review of the decomposition, use the \`adversarial-review\` tool
  with \`phase: 'decomposition'\`.
- To start building specs, use the standard spec workflow: \`create-spec\` prompt with
  the first spec from the dependency order.`
      }
    }
  ];

  return messages;
}

export const createDecompositionPrompt: PromptDefinition = {
  prompt,
  handler
};
