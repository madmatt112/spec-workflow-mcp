# Workflow Process Guide

This guide explains the complete spec-driven development workflow and best practices for using Spec Workflow MCP.

## Overview

The spec-driven workflow follows a structured approach:

```
(Steering) → Decomposition → Requirements → Design → Tasks → Implementation
```

Each phase builds on the previous, ensuring systematic and well-documented
development. Steering documents are optional and created once per project; when they
exist, the workflow begins with **Decomposition** (breaking the project into a set of
specs) before any individual spec's Requirements. The canonical sequence is defined by
the `spec-workflow-guide` tool's returned methodology.

## Phase 1: Project Setup with Steering Documents

### Why Steering Documents?

Steering documents provide high-level guidance that keeps your project aligned and consistent. They act as a north star for all development decisions.

### Creating Steering Documents

```
"Create steering documents for my project"
```

This generates three key documents:

#### 1. Product Steering (`steering/product.md`)
- Product vision and mission
- Target users and personas
- Core features and priorities
- Success metrics and KPIs
- Non-goals and constraints

#### 2. Technical Steering (`steering/tech.md`)
- Architecture decisions
- Technology stack choices
- Performance requirements
- Security considerations
- Scalability approach

#### 3. Structure Steering (`steering/structure.md`)
- Project organization
- File and folder conventions
- Naming standards
- Module boundaries
- Documentation structure

### Best Practices for Steering

1. **Create early** - Set up steering before any specs
2. **Keep updated** - Revise as project evolves
3. **Reference often** - Use for decision making
4. **Share widely** - Ensure team alignment

## Phase 1.5: Decomposition

> **Fork addition.** Not present in upstream spec-workflow-mcp.

When steering documents exist, the workflow requires a **decomposition** step before
the first spec. It breaks the project (as described by the steering docs) into a
complete, ordered set of specs — each one a demonstrable capability you can verify
end-to-end, not a technical layer.

### How It Works

1. Call `decomposition-guide` to load the decomposition methodology.
2. Read the steering docs and ask whether there is existing code to account for.
3. Apply the methodology to produce a spec breakdown, surfacing open questions to the
   user before finalizing.
4. Write the result to `.spec-workflow/spec-decomposition/decomposition.md`.
5. Submit it for approval via `approvals` with `category: 'decomposition'` — it goes
   through the same approval cycle as any spec document, and can be
   adversarially reviewed (`specName: "decomposition"`, `phase: "decomposition"`).

Once the decomposition is approved, work the resulting specs in dependency order,
each through the standard Requirements → Design → Tasks → Implementation flow.

## Phase 2: Specification Creation

### The Three-Document System

Each spec consists of three sequential documents:

```
Requirements → Design → Tasks
```

### Requirements Document

**Purpose**: Define WHAT needs to be built

**Contents**:
- Feature overview
- User stories
- Functional requirements
- Non-functional requirements
- Acceptance criteria
- Constraints and assumptions

**Example Creation**:
```
"Create requirements for a user notification system that supports:
- Email notifications
- In-app notifications
- Push notifications
- User preferences
- Notification history"
```

### Design Document

**Purpose**: Define HOW it will be built

**Contents**:
- Technical architecture
- Component design
- Data models
- API specifications
- Integration points
- Implementation approach

**Automatic Generation**: Created after requirements approval

### Tasks Document

**Purpose**: Define the STEPS to build it

**Contents**:
- Hierarchical task breakdown
- Dependencies
- Effort estimates
- Implementation order
- Testing requirements

**Structure Example**:
```
1.0 Database Setup
  1.1 Create notification tables
  1.2 Set up indexes
  1.3 Create migration scripts

2.0 Backend Implementation
  2.1 Create notification service
    2.1.1 Email handler
    2.1.2 Push handler
  2.2 Create API endpoints
  2.3 Add authentication

3.0 Frontend Implementation
  3.1 Create notification components
  3.2 Integrate with API
  3.3 Add preference UI
```

## Phase 3: Review and Approval

### Approval Workflow

1. **Document Creation** - The agent reads the template and writes the document
2. **Review Request** - The agent calls `approvals` (`action: request`) with the file path
3. **User Review** - Review in dashboard/extension
4. **Decision** - Approve, request changes (`needs-revision`), or reject
5. **Revision** (if needed) - The agent updates the document based on feedback
6. **Final Approval** - The agent confirms `approved` status, then deletes the approval

### Approval Rules the Agent Must Follow

The `spec-workflow-guide` returns these as hard rules:

- **Verbal approval is never accepted.** "Approved" in chat does not count — approval
  status must be read from the dashboard / VS Code extension via `approvals`
  (`action: status`).
- **Delete before proceeding.** After a document is `approved`, delete its approval
  (`action: delete`) before starting the next phase. Deleting a still-`pending`
  approval is blocked by the tool.
- **Revision cycle.** On `needs-revision`: update the document, delete the old
  approval, then request a new one with the **same** `filePath`.

These rules are written for an interactive, human-approved flow. Autonomous callers
override several of them — see [AUTONOMOUS-USAGE.md](AUTONOMOUS-USAGE.md) for which
constraints are actually enforced by the tools versus advisory.

### Making Approval Decisions

#### When to Approve
- Requirements are complete and clear
- Design solves the stated problem
- Tasks are logical and comprehensive
- No major concerns or gaps

#### When to Request Changes
- Missing important details
- Unclear specifications
- Better approach available
- Needs alignment with standards

#### When to Reject
- Fundamental misunderstanding
- Wrong approach entirely
- Requires complete rethink

### Providing Effective Feedback

Good feedback:
```
"The authentication flow should use JWT tokens instead of sessions.
Add rate limiting to the API endpoints.
Include error handling for network failures."
```

Poor feedback:
```
"This doesn't look right. Fix it."
```

### Adversarial Review (Optional)

For high-stakes specifications, an adversarial review adds an independent quality gate between approval and implementation. It uses a fresh-context subagent to critique the document without the biases accumulated during authoring.

#### When to Use

- Complex or safety-critical features
- Specifications that will be expensive to change post-implementation
- Documents where the author and reviewer are the same person
- Any phase where you want a second opinion before committing

#### How It Works

1. **Trigger** - Click "Adversarial Review" on a pending approval, or ask your AI assistant
2. **Prompt generation** - A subagent reads the document, steering docs, and prior phases to generate a tailored adversarial prompt
3. **Independent review** - A second subagent executes the prompt in a clean context, producing a structured critique
4. **Status update** - The approval moves to "needs-revision" with the analysis attached
5. **Response** - Your AI assistant reads the analysis, addresses valid findings, and resubmits the revised document

#### Review Cycle

The adversarial workflow integrates into the standard approval cycle:

```
Pending → Adversarial Review → Needs Revision → Revise & Resubmit → Pending → Approve
```

Each review is versioned (v1, v2, v3...) so you can run multiple rounds and compare
how the document evolved. Versioning is **unbounded** — there is no built-in cap or
"converged" verdict. For v2+ reviews a rolling memory file
(`reviews/adversarial-memory-<phase>.md`) carries prior findings forward so later
rounds attack fresh angles rather than re-discovering known issues.

The review can be triggered from the dashboard **or driven entirely by an agent**
(call `adversarial-review`, launch a fresh subagent on the generated prompt, then
`adversarial-response`). An autonomous loop can repeat this until a fresh reviewer
finds nothing actionable — an "iterate-until-clean" pattern the server supports but
does not itself enforce. See [AUTONOMOUS-USAGE.md](AUTONOMOUS-USAGE.md) and
[TOOLS-REFERENCE.md](TOOLS-REFERENCE.md#adversarial-review) for the mechanics
(including the Read-then-overwrite step on the generated prompt file).

#### Configuration

On the **Adversarial Analysis** page in the dashboard:

- **Required Phases** - Enforce adversarial review before approval for specific phases
- **Agent CLI** - Configure which LLM CLI runs background reviews (defaults to Claude CLI, but any compatible CLI works)
- **Model** - Choose which model runs the review (e.g., Opus for depth, Sonnet for speed)
- **Methodology** - Customize the review and response methodologies

## Phase 4: Implementation

### Task Execution Strategy

#### Sequential Implementation
Best for dependent tasks:
```
"Implement task 1.1 from user-auth spec"
"Now implement task 1.2"
"Continue with task 1.3"
```

#### Parallel Implementation
For independent tasks:
```
"Implement all UI tasks from the dashboard spec while I work on the backend"
```

#### Section-Based Implementation
For logical groupings:
```
"Implement all database tasks from the payment spec"
```

### Per-Task Completion Loop

Each task follows a fixed sequence. Task status lives in `tasks.md` markers
(`[ ]` pending, `[-]` in-progress, `[x]` completed) — the agent edits them directly.

1. Mark the task `[ ]` → `[-]`.
2. Implement it.
3. Call **`log-implementation`** (the `artifacts` field is **required** — the tool
   rejects the call without it). A task with no implementation log is not complete.
4. Get an **independent** code review — do not self-review:
   - With a dashboard: a human clicks *Review*, a fresh-context agent reviews, and you
     read the result with `get-task-review`.
   - Headless: call `review-task` yourself (`prepare` → read files → `record`). See
     [AUTONOMOUS-USAGE.md](AUTONOMOUS-USAGE.md#task-review-headless).
5. Only after the review passes, mark the task `[-]` → `[x]`.

Capture any discovery that affects a **future** spec with the `deferrals` tool
(`originPhase: implementation`) rather than expanding the current task.

### Progress Tracking

Monitor implementation through:
- Dashboard task view
- Progress bars
- Status indicators
- Completion percentages

### Handling Blockers

When blocked:
1. Document the blocker
2. Create a sub-task for resolution
3. Move to parallel tasks if possible
4. Update task status to "blocked"

## Phase 5: Verification

### Testing Strategy

After implementation:

1. **Unit Testing**
   ```
   "Create unit tests for the notification service"
   ```

2. **Integration Testing**
   ```
   "Create integration tests for the API endpoints"
   ```

3. **End-to-End Testing**
   ```
   "Create E2E tests for the complete notification flow"
   ```

### Documentation Updates

Keep documentation current:
```
"Update the API documentation for the new endpoints"
"Add usage examples to the README"
```

## File Structure and Organization

### Standard Project Structure

```
your-project/
├── .spec-workflow/
│   ├── steering/
│   │   ├── product.md
│   │   ├── tech.md
│   │   └── structure.md
│   ├── specs/
│   │   ├── user-auth/
│   │   │   ├── requirements.md
│   │   │   ├── design.md
│   │   │   └── tasks.md
│   │   └── payment-gateway/
│   │       ├── requirements.md
│   │       ├── design.md
│   │       ├── tasks.md
│   │       └── reviews/          # adversarial prompts/analyses/memory, task reviews
│   ├── spec-decomposition/
│   │   └── decomposition.md
│   └── approvals/
│       └── [approval tracking files, grouped by category]
├── src/
│   └── [your implementation]
└── tests/
    └── [your tests]
```

### Naming Conventions

**Spec Names**:
- Use kebab-case: `user-authentication`
- Be descriptive: `payment-processing` not `payments`
- Avoid versions: `user-profile` not `user-profile-v2`

**Document Names**:
- Always: `requirements.md`, `design.md`, `tasks.md`
- Consistent across all specs

## Advanced Workflows

### Feature Iterations

For evolving features:

1. Create initial spec
2. Implement MVP
3. Create enhancement spec
4. Reference original spec
5. Build on existing work

Example:
```
"Create an enhancement spec for user-auth that adds:
- Social login (Google, Facebook)
- Biometric authentication
- Session management improvements"
```

### Refactoring Workflow

1. **Document Current State**
   ```
   "Create a spec documenting the current authentication system"
   ```

2. **Design Improvements**
   ```
   "Design refactoring to improve authentication performance"
   ```

3. **Plan Migration**
   ```
   "Create migration tasks for the refactoring"
   ```

4. **Implement Gradually**
   ```
   "Implement refactoring tasks with backward compatibility"
   ```

### Bug Resolution Workflow

1. **Bug Report**
   ```
   "Create bug report for login timeout issue"
   ```

2. **Investigation**
   ```
   "Investigate root cause of bug #45"
   ```

3. **Solution Design**
   ```
   "Design fix for the timeout issue"
   ```

4. **Implementation**
   ```
   "Implement the bug fix"
   ```

5. **Verification**
   ```
   "Create regression tests for bug #45"
   ```

## Best Practices

### 1. Maintain Spec Granularity

**Good**: One spec per feature
- `user-authentication`
- `payment-processing`
- `notification-system`

**Poor**: Overly broad specs
- `backend-system`
- `all-features`

### 2. Sequential Document Creation

Always follow the order:
1. Requirements (what)
2. Design (how)
3. Tasks (steps)

Never skip ahead.

### 3. Complete Approval Before Implementation

- ✅ Approve requirements → Create design
- ✅ Approve design → Create tasks
- ✅ Review tasks → Start implementation
- ❌ Skip approval → Implementation issues

### 4. Keep Specs Updated

When requirements change:
```
"Update the requirements for user-auth to include SSO support"
```

### 5. Use Consistent Terminology

Maintain consistency across:
- Spec names
- Component names
- API terminology
- Database naming

### 6. Archive Completed Specs

Keep workspace clean:
```
"Archive the completed user-auth spec"
```

## Common Patterns

### MVP to Full Feature

1. Start with MVP spec
2. Implement core functionality
3. Create enhancement specs
4. Build incrementally
5. Maintain backward compatibility

### Microservices Development

1. Create service steering document
2. Define service boundaries
3. Create spec per service
4. Define integration points
5. Implement services independently

### API-First Development

1. Create API spec first
2. Design contracts
3. Generate documentation
4. Implement endpoints
5. Create client SDKs

## Troubleshooting Workflow Issues

### Specs Getting Too Large

**Solution**: Break into smaller specs
```
"Split the e-commerce spec into:
- product-catalog
- shopping-cart
- checkout-process
- order-management"
```

### Unclear Requirements

**Solution**: Request clarification
```
"The requirements need more detail on:
- User roles and permissions
- Error handling scenarios
- Performance requirements"
```

### Design Doesn't Match Requirements

**Solution**: Request revision
```
"The design doesn't address the multi-tenancy requirement.
Please revise to include tenant isolation."
```

## Integration with Development Process

### Git Workflow

1. Create feature branch per spec
2. Commit after each task completion
3. Reference spec in commit messages
4. PR when spec is complete

### CI/CD Integration

- Run tests for completed tasks
- Validate against requirements
- Deploy completed features
- Monitor against success metrics

For running the workflow itself non-interactively (CI, cron, autonomous agents),
including how the human-approval gate behaves when no dashboard is reachable, see
[AUTONOMOUS-USAGE.md](AUTONOMOUS-USAGE.md).

### Team Collaboration

- Share dashboard URL
- Assign specs to team members
- Review each other's specs
- Coordinate through approvals

## Related Documentation

- [User Guide](USER-GUIDE.md) - General usage instructions
- [Prompting Guide](PROMPTING-GUIDE.md) - Example prompts and patterns
- [Tools Reference](TOOLS-REFERENCE.md) - Complete tool documentation
- [Autonomous Usage](AUTONOMOUS-USAGE.md) - Non-interactive / headless operation
- [Interfaces Guide](INTERFACES.md) - Dashboard and extension details