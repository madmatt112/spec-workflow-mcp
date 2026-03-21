import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';

export const decompositionGuideTool: Tool = {
  name: 'decomposition-guide',
  description: `Load guide for decomposing steering documents into a complete set of specs.

# Instructions
Call when the user wants to break their project into specs after steering docs are complete.
Returns the spec decomposition methodology — principles for identifying spec boundaries,
ordering dependencies, and producing a decomposition document.`,
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false
  },
  annotations: {
    title: 'Decomposition Guide',
    readOnlyHint: true,
  }
};

export async function decompositionGuideHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  return {
    success: true,
    message: 'Spec decomposition guide loaded — use this methodology to break the project into specs',
    data: {
      guide: getDecompositionGuide(),
      dashboardUrl: context.dashboardUrl
    },
    nextSteps: [
      'Read all steering docs from .spec-workflow/steering/',
      'Ask user if there is existing code to account for',
      'Apply the decomposition methodology to produce a spec breakdown',
      'Surface open questions to the user before finalizing',
      'Save decomposition to .spec-workflow/spec-decomposition/decomposition.md'
    ]
  };
}

export function getDecompositionGuide(): string {
  return `# Spec Decomposition Methodology

## Purpose

This guide provides principles for decomposing a project — described by its steering documents
(product.md, tech.md, structure.md) — into a complete, ordered set of specs. Each spec will
later go through the standard spec workflow (Requirements → Design → Tasks → Implementation).

## Core Principle

**Each spec should produce a system state where you can do something you couldn't do before,
and verify it end-to-end.**

Not a technical layer. Not a product feature bullet point. A demonstrable capability.

## Decomposition Principles

### 1. The Reviewability Test

If the spec is too big for a human to meaningfully review the requirements, design, and task
breakdown in a single sitting, it is too big. This is the most practical heuristic for sizing.

### 2. INVEST Criteria at the Spec Level

- **Independent**: Each spec should be buildable and verifiable without waiting for unfinished
  specs (dependencies on *completed* specs are fine).
- **Negotiable**: Scope details are refined during the spec's own requirements and design phases.
- **Valuable**: Each spec delivers user-visible or system-verifiable value on its own.
- **Estimable**: The scope is clear enough to reason about effort.
- **Small**: Small enough to hold in your head; large enough to be meaningful.
- **Testable**: There is a concrete end-to-end verification for the spec's deliverable.

### 3. Vertical Slicing

Each spec must cut through the full stack needed to deliver its capability. Never split by
technical layer:

**Wrong**: "database schema spec" + "API layer spec" + "UI spec" for the same feature.
**Right**: One spec that delivers the feature end-to-end, touching database, API, and UI.

The exception is foundational infrastructure that genuinely has no user-facing value on its own
(e.g., project scaffolding, CI pipeline). These should be absorbed into the first spec that
needs them, not separated into their own spec.

### 4. Dependency Ordering

Specs should form a directed acyclic graph (DAG). For each spec, identify:
- What it depends on (which earlier specs must be complete)
- What depends on it (which later specs it unblocks)

Prefer orderings that deliver user-visible value early. Front-load specs that unblock the most
downstream work.

### 5. Cross-Spec Conventions

Identify patterns that apply across multiple specs and document them once:
- Schema evolution strategy (e.g., migration numbering)
- API versioning or OpenAPI conventions
- Shared type definitions or interfaces
- Error handling patterns
- Naming conventions

These are not specs themselves — they are conventions that specs follow.

### 6. What Is NOT a Spec

Some items from steering docs lack independent deliverable value:
- **Pure infrastructure**: CI/CD setup, Docker configuration, linting — absorb into the first
  spec that needs the infrastructure.
- **Technical layers**: "Set up the database" or "Configure the SSE broker" — these are
  components within a spec, not standalone deliverables.
- **Trivial features**: If the implementation is a few lines of code with no design decisions,
  it belongs inside a related spec, not as its own.

Call these out explicitly so they don't get lost — document where each non-spec item lands.

### 7. Existing Code Awareness

If the project has existing code:
- Scan the codebase to understand what is already built.
- Identify specs that are partially or fully implemented.
- Note which specs require refactoring existing code vs. building new.
- Account for existing patterns and conventions that new specs should follow.

### 8. Open Questions Protocol

During decomposition, ambiguities and design decisions will surface. For each:
- Document the question clearly.
- Explain why it matters for spec boundaries or ordering.
- Suggest options if possible.
- **Present all open questions to the user before finalizing the decomposition.**
  The user may provide answers, directives to leave questions unresolved, or indicate
  that a question should be resolved during a specific spec's design phase.

## Decomposition Process

1. **Read all steering docs** to understand the full scope.
2. **Identify capabilities** — what distinct things should the system do?
3. **Group into specs** — each spec delivers one or more related capabilities end-to-end.
4. **Check sizing** — apply the reviewability test. Split specs that are too large; merge
   specs that are too small to be independently valuable.
5. **Order by dependencies** — build the DAG. Identify the critical path.
6. **Identify cross-spec conventions** — extract shared patterns.
7. **Flag what is NOT a spec** — assign non-spec items to their parent specs.
8. **Surface open questions** — present to the user for guidance.
9. **Write the decomposition document** with all findings.

## Output Structure

The decomposition document should include (adapt to fit the project):

- **Per-spec entries**: Name, scope description, what it delivers, end-to-end verification,
  dependencies on other specs, and any design considerations for this spec specifically.
- **Dependency graph**: Visual representation (mermaid DAG recommended) of spec ordering.
- **Cross-spec conventions**: Shared patterns and rules.
- **What is NOT a spec**: Items absorbed into other specs, with rationale.
- **Open questions**: Unresolved decisions with context and options.

## Sources

These principles are drawn from:
- INVEST criteria (originally for user stories, applied here at spec granularity)
- The reviewability test (intent-driven.dev)
- Vertical slicing (ThoughtWorks spec-driven development analysis)
- Practical examples from spec-driven development tooling (Kiro, spec-kit, Zencoder)`;
}
