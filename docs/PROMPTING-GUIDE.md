# Prompting Guide

A comprehensive guide with examples and best practices for interacting with Spec Workflow MCP through AI assistants.

## Quick Reference

### Essential Commands

```
"Create a spec for [feature]"
"List all my specs"
"Show status of [spec-name]"
"Implement task [number] from [spec]"
"Create steering documents"
```

## Creating Specifications

### Basic Spec Creation

#### Simple Request
```
"Create a spec for user authentication"
```

The AI will create:
- Requirements document
- Design document (after approval)
- Task breakdown (after design approval)

#### Detailed Request
```
"Create a spec called payment-processing with:
- Credit card payments via Stripe
- PayPal integration
- Refund handling
- Webhook processing for payment events
- PCI compliance considerations"
```

#### From Existing Documentation
```
"Create a spec from the PRD in @product-requirements.md"
```

```
"Build a spec based on the design document at @figma-export.md"
```

### Advanced Spec Creation

#### With Technical Constraints
```
"Create a spec for real-time notifications that:
- Uses WebSockets for live updates
- Falls back to polling for older browsers
- Handles up to 10,000 concurrent connections
- Maintains message ordering
- Includes offline queue support"
```

#### With Acceptance Criteria
```
"Create a spec for search functionality with these acceptance criteria:
- Results appear within 200ms
- Supports fuzzy matching
- Includes filters for date, category, and author
- Shows relevance scoring
- Handles typos and synonyms"
```

#### Microservice Specification
```
"Create a spec for an inventory microservice that:
- Exposes REST API
- Uses PostgreSQL for storage
- Publishes events to Kafka
- Implements CQRS pattern
- Includes health check endpoints"
```

## Managing Specifications

### Listing and Status

#### Get Overview
```
"List all my specs"
"Show me all specs and their progress"
"Which specs are waiting for approval?"
"What specs are currently in progress?"
```

#### Specific Status
```
"Show the status of the user-auth spec"
"What's the progress on payment-processing?"
"Show me what's left to do in the notification spec"
"Which tasks are completed in user-profile?"
```

#### Filtering
```
"Show me specs that are over 50% complete"
"List specs waiting for my approval"
"Which specs have no tasks completed yet?"
"Show blocked or stuck specs"
```

### Document Management

#### Viewing Documents
```
"Show me the requirements for user-auth"
"Display the design document for payments"
"What are the tasks for the notification system?"
"Show all documents for the search spec"
```

#### Updating Documents
```
"Update the user-auth requirements to include 2FA"
"Revise the payment design to use Stripe Connect"
"Add a task for security testing to user-profile"
"Update requirements based on the feedback: [feedback]"
```

## Implementation Prompts

### Individual Tasks

#### Basic Implementation
```
"Implement task 1.2 from user-auth"
"Complete task 2.1.3 in the payment spec"
"Work on the next pending task in notifications"
```

#### With Context
```
"Implement task 1.2 from user-auth using TypeScript and Express"
"Complete the database migration task using Prisma"
"Implement the API endpoint task following REST conventions"
```

### Batch Implementation

#### By Section
```
"Implement all database tasks from user-auth"
"Complete all frontend tasks in the dashboard spec"
"Work through all API tasks for payments"
```

#### By Priority
```
"Implement all critical tasks first"
"Complete the MVP tasks from user-profile"
"Focus on tasks needed for the demo"
```

#### Sequential
```
"Implement tasks 1.1 through 1.5 from user-auth"
"Complete all subtasks under section 2"
"Work through the setup tasks in order"
```

### Implementation Strategies

#### Test-Driven
```
"For task 1.2, write tests first then implement"
"Implement task 2.1 with full test coverage"
"Create unit tests while implementing the service task"
```

#### With Documentation
```
"Implement task 1.3 and document the API"
"Complete the authentication task with inline comments"
"Implement and create usage examples for task 2.2"
```

## Steering Documents

### Creating Steering

#### Complete Set
```
"Create steering documents for my e-commerce project"
"Set up steering for a SaaS application"
"Create project guidance for a mobile app"
```

#### Individual Documents
```
"Create a product steering document focusing on user experience"
"Create technical steering for a microservices architecture"
"Create structure steering for a monorepo setup"
```

#### From Context
```
"Create steering documents based on @project-brief.md"
"Generate steering from our technical decisions in @architecture.md"
```

### Updating Steering

```
"Update product steering to include B2B features"
"Revise technical steering to use GraphQL instead of REST"
"Update structure steering for the new module system"
```

## Approval Workflows

### Requesting Feedback

#### With Specific Concerns
```
"Request approval for user-auth requirements - particularly check the security section"
"Ask for review of the payment design - focus on the error handling"
"Request feedback on the task breakdown - is it too granular?"
```

#### Revision Requests
```
"The requirements need more detail on:
- Error handling scenarios
- Performance requirements
- Security considerations
Please revise and resubmit"
```

### Approval Decisions

#### Approving
```
"Approve the user-auth requirements"
"The design looks good, approve it"
"Accept the task breakdown as is"
```

#### Requesting Changes
```
"Request changes to the requirements:
- Add multi-tenant support
- Include rate limiting
- Specify data retention policy"
```

#### Rejecting
```
"Reject the current design - we need to use event-driven architecture instead"
"Start over with the requirements - the scope is too broad"
```

## Bug Workflow

> **Note:** There is no dedicated bug tool in this fork — bugs are handled through the normal spec flow (create a spec, get approval, implement).

### Reporting Bugs

#### Detailed Report
```
"Create a bug report:
Title: Login fails with special characters
Steps: 1) Enter email with '+' 2) Submit form 3) See error
Expected: Login succeeds
Actual: 500 error
Priority: High
Environment: Production"
```

#### From Error Logs
```
"Create a bug report from this error: [paste stack trace]"
"Document this bug from the Sentry alert: [link]"
```

### Bug Resolution

#### Investigation
```
"Investigate the root cause of bug #45"
"Analyze why the payment webhook is failing"
"Debug the performance issue in the search endpoint"
```

#### Fix Implementation
```
"Create a fix for bug #45 in user authentication"
"Implement a solution for the payment timeout issue"
"Fix the memory leak in the notification service"
```

## Mid-Implementation Changes

### When Specs Change During Development

Requirements and designs often evolve during implementation. When this happens, you need to keep tasks.md aligned with the current spec while preserving completed work.

### Realigning Tasks After Spec Changes

There is no dedicated `refresh-tasks` tool. To realign work, edit the spec documents
directly (`requirements.md`, `design.md`, then `tasks.md`) and re-request approval for
the changed documents. Simply inform the AI about your changes and ask it to update the
affected documents:

#### Basic Task Realignment
```
"The requirements have been updated. Please edit tasks.md to align with the current requirements.md and design.md, then request approval."
```

#### Detailed Realignment with Context
```
"I've updated the spec with the following changes:
- Removed the reporting module
- Changed database from MongoDB to PostgreSQL
- Added social login feature

Please edit tasks.md to realign with these changes (and re-request approval):
1. Preserve all completed and in-progress tasks
2. Add migration tasks for the database change
3. Remove pending tasks for the reporting module
4. Add new tasks for social login"
```

#### Architecture Change Requiring Migration
```
"We're switching from REST API to GraphQL. Several REST endpoints are already implemented. Please update tasks.md with:
1. All completed REST work preserved
2. Migration tasks to wrap REST logic in GraphQL resolvers
3. New GraphQL implementation tasks
4. Cleanup tasks to remove REST after GraphQL is verified"
```

### Expected AI Behavior

When you request a task realignment, the AI will:

1. **Analyze Current State**
   - Read requirements.md and design.md for current spec
   - Identify completed, in-progress, and pending tasks
   - Determine what features have been added, removed, or changed

2. **Preserve Completed Work**
   - Keep all [x] completed tasks unchanged
   - Keep all [-] in-progress tasks unchanged
   - Add notes when completed work is for removed features

3. **Handle Architecture Changes**
   - Add migration tasks after completed work that needs updating
   - Create transition tasks for progressive migration
   - Include verification tasks before removing old implementation

4. **Update Pending Tasks**
   - Remove pending tasks for deleted features
   - Update pending tasks for changed requirements
   - Add new tasks for new features

5. **Maintain Task Structure**
   - Keep sequential numbering
   - Preserve task format
   - Include requirement references
   - Maintain dependency order

### Example Scenarios

#### Feature Removal
```
"We've decided to remove the reporting module from the spec. Update tasks.md accordingly."
```

Expected AI behavior:
- Keep all completed reporting tasks with their [x] status
- Keep all in-progress reporting tasks with their [-] status
- Remove only pending [ ] reporting tasks
- Add note: "_Note: Reporting feature removed from spec but completed work preserved_"

#### Architecture Change with Completed Work
```
"We're switching from MongoDB to PostgreSQL. Update the pending database tasks. Note that we've already implemented MongoDB schemas and connection logic."
```

Expected AI behavior:
- Preserve all completed MongoDB tasks exactly as written
- Preserve all in-progress MongoDB tasks exactly as written
- Add new migration tasks immediately after completed MongoDB work:
  - Migrate MongoDB schemas to PostgreSQL tables
  - Replace MongoDB connection logic with PostgreSQL client
  - Update database queries from MongoDB to PostgreSQL syntax
  - Migrate existing MongoDB data to PostgreSQL
  - Update environment configuration for PostgreSQL
  - Remove MongoDB dependencies after migration verified
- Update remaining pending database tasks to use PostgreSQL
- Maintain task numbering sequence

#### Feature Addition
```
"Add social login to the authentication spec. The requirements and design have been updated."
```

Expected AI behavior:
- Analyze current task structure for logical insertion point
- Add new social login tasks with appropriate numbering
- Reference the specific requirements for social login
- Ensure new tasks maintain dependency order
- If basic auth is already implemented, add integration tasks

### Handling Architecture Migrations

When architecture changes affect already-implemented code:

#### REST to GraphQL Migration
```
"We're changing from REST to GraphQL. Several REST endpoints are already implemented."
```

Expected task additions:
- Preserve completed REST endpoint tasks
- Add GraphQL schema definition tasks
- Add resolver implementation tasks
- Add migration tasks to wrap existing REST logic in GraphQL resolvers
- Add tasks to update client code to use GraphQL
- Add cleanup tasks to remove REST endpoints after GraphQL is verified

#### Monolith to Microservices Split
```
"We're splitting the monolithic user service into separate auth and profile services."
```

Expected task additions:
- Preserve completed monolithic service tasks
- Add service separation tasks
- Add inter-service communication tasks
- Add data migration tasks if databases are splitting
- Add deployment configuration tasks for new services
- Add cleanup tasks to remove monolithic code after services are verified

### Task Format for Migrations

Migration tasks should clearly indicate their purpose:

```
"After refreshing tasks, I see you've added:
- [ ] 2.4 Migrate MongoDB schemas to PostgreSQL tables
  - File: src/database/migrations/mongo-to-postgres.ts
  - Convert document schemas to relational tables
  - Map embedded documents to foreign key relationships
  - Preserve all existing data relationships
  - Purpose: Transition database layer to new architecture
  - _Leverage: Completed MongoDB schemas in tasks 2.1-2.3_
  - _Requirements: Design section 3.2_"
```

### Communicating Changes to AI

When informing the AI about spec changes:

#### Be Specific About Changes and Impact
```
"The payment processing requirements have changed. Stripe is now required instead of PayPal. We've already implemented PayPal webhook handlers. Please update tasks.md to reflect this change, including migration tasks."
```

#### Provide Context for Preservation and Migration
```
"Although we're moving from MongoDB to PostgreSQL, keep all completed MongoDB tasks since that work is already done. Add migration tasks to transition the implemented MongoDB code to PostgreSQL."
```

#### Request Validation
```
"After updating tasks.md, confirm that all requirements in requirements.md have corresponding tasks, migration paths exist for architecture changes, and that no pending tasks exist for removed features."
```

### Progressive Migration Strategy

For major architecture changes, the AI should create tasks that support progressive migration:

1. Implement new architecture alongside existing
2. Add compatibility layer tasks
3. Migrate functionality incrementally
4. Verify each migration step
5. Remove old implementation only after full verification

This ensures the application remains functional throughout the transition.

### Driving Realignment Directly

There is no `refresh-tasks` prompt or tool. To drive realignment, describe the change
and ask the AI to edit the spec documents directly, then re-approve:

```
"For the user-auth spec, we switched from JWT to OAuth2 for authentication. Please update requirements.md, design.md, and tasks.md to match, preserving all completed work, then request approval for the changed documents."
```

The AI will edit the affected spec documents while preserving all completed work, and
the updated documents go back through the normal approval gate.

## Advanced Patterns

### Multi-Spec Workflows

#### Related Specs
```
"Create a spec for admin-dashboard that integrates with:
- user-management spec
- analytics spec
- reporting spec"
```

#### Spec Dependencies
```
"Create a spec for notifications that depends on:
- user-auth being complete
- message-queue being implemented
- email-service being available"
```

### Incremental Development

#### MVP First
```
"Create an MVP spec for user-profiles with just:
- Basic profile creation
- Display name and avatar
- Public profile view
(We'll add social features later)"
```

#### Enhancement Specs
```
"Create an enhancement spec for user-auth adding:
- Social login (Google, GitHub)
- Biometric authentication
- Enhanced session management
- Account linking"
```

### Complex Scenarios

#### Migration Specs
```
"Create a spec for migrating from MongoDB to PostgreSQL:
- Document current schema
- Design new relational structure
- Plan zero-downtime migration
- Include rollback procedures"
```

#### Refactoring Specs
```
"Create a refactoring spec to:
- Split the monolith into services
- Extract shared components
- Improve test coverage to 80%
- Maintain backward compatibility"
```

#### Performance Specs
```
"Create a performance optimization spec:
- Profile current bottlenecks
- Design caching strategy
- Plan database indexing
- Implement monitoring"
```

## Workflow Combinations

### Complete Feature Flow
```
1. "Create steering documents for the project"
2. "Create a spec for user authentication"
3. "Review and approve requirements"
4. "Review and approve design"
5. "Implement task 1.1 - database schema"
6. "Implement task 1.2 - authentication service"
7. "Create tests for the authentication flow"
8. "Mark all tasks as complete"
```

### Parallel Development
```
"While I review the requirements, start drafting the API design"
"Create specs for both frontend and backend in parallel"
"Work on UI tasks while the backend team does API tasks"
```

### Iterative Refinement
```
1. "Create initial spec for search"
2. "Implement basic search (tasks 1-3)"
3. "Create enhancement spec for advanced search"
4. "Add filtering and sorting features"
5. "Create optimization spec for search performance"
```

## Context-Aware Prompts

### Using Project Context
```
"Create a spec that follows our existing patterns"
"Implement this task consistent with our codebase"
"Design this feature to integrate with our current architecture"
```

### Referencing Other Specs
```
"Create a spec similar to user-auth but for admin authentication"
"Use the same design patterns as in the payment spec"
"Follow the task structure from our notification spec"
```

### Building on Previous Work
```
"Extend the user-auth spec to include team management"
"Add GraphQL support to the existing REST API spec"
"Enhance the search spec with machine learning features"
```

## Tips for Effective Prompting

### Be Specific
❌ **Vague**: "Create a login spec"
✅ **Specific**: "Create a spec for email/password login with 2FA, remember me, and password reset"

### Provide Context
❌ **No context**: "Implement the task"
✅ **With context**: "Implement task 1.2 using our existing Express middleware and PostgreSQL database"

### Set Clear Expectations
❌ **Unclear**: "Make it better"
✅ **Clear**: "Improve the design to handle 10x current traffic with response times under 200ms"

### Use Incremental Requests
❌ **Too much**: "Create 5 specs and implement everything"
✅ **Incremental**: "Create the user-auth spec first, then we'll review before moving to the next"

### Reference Existing Work
❌ **Starting fresh**: "Create a new payment system"
✅ **Building on**: "Enhance our payment spec to add subscription billing"

## Common Patterns Library

### CRUD Operations
```
"Create a spec for CRUD operations on products including:
- Create with validation
- Read with pagination and filtering
- Update with optimistic locking
- Soft delete with recovery option"
```

### Authentication & Authorization
```
"Create an auth spec with:
- JWT-based authentication
- Role-based access control
- API key management
- Session handling
- Refresh token rotation"
```

### Real-time Features
```
"Create a spec for real-time chat:
- WebSocket connections
- Message persistence
- Typing indicators
- Read receipts
- Offline message queue"
```

### File Management
```
"Create a file upload spec:
- Chunked uploads for large files
- Progress tracking
- Resume capability
- Virus scanning
- CDN integration"
```

### Analytics & Reporting
```
"Create an analytics spec:
- Event tracking
- Custom dimensions
- Real-time dashboards
- Scheduled reports
- Data export options"
```

## Troubleshooting Prompts

### When Things Go Wrong
```
"Why is this spec not showing up?"
"Debug why the task isn't completing"
"What's blocking the approval?"
"Help me understand this error"
```

### Getting Unstuck
```
"What should I do next?"
"Show me what's blocking progress"
"What tasks can I work on while waiting?"
"How do I resolve this dependency?"
```

## Related Documentation

- [User Guide](USER-GUIDE.md) - General usage instructions
- [Workflow Process](WORKFLOW.md) - Understanding the workflow
- [Tools Reference](TOOLS-REFERENCE.md) - Complete tool documentation
- [Troubleshooting](TROUBLESHOOTING.md) - Solving common issues