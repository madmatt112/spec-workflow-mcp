# File Structure & Organization

> **Quick Reference**: [Directory Layout](#-directory-layout) | [File Naming](#-file-naming) | [Path Utilities](#-path-utilities)

## 📁 Directory Layout

### Project Root Structure
```
project-root/
├── .spec-workflow/                    # All MCP workflow data
│   ├── specs/                         # Specification documents
│   │   └── feature-name/              # Individual specification
│   │       ├── requirements.md        # Requirements document
│   │       ├── design.md              # Design document
│   │       ├── tasks.md               # Tasks document
│   │       └── reviews/               # Adversarial prompts/analyses/memory + task reviews
│   ├── steering/                      # Project guidance documents
│   │   ├── product.md                 # Product vision & strategy
│   │   ├── tech.md                    # Technical standards
│   │   └── structure.md               # Code organization
│   ├── spec-decomposition/            # Project-level spec breakdown (fork)
│   │   └── decomposition.md
│   ├── templates/                     # Built-in document templates
│   ├── user-templates/                # Optional custom template overrides
│   ├── approvals/                     # Approval workflow data
│   │   └── category-name/             # Grouped by category (spec name / steering / decomposition)
│   │       └── approval-id.json       # Individual approval data
│   ├── archive/                       # Completed/archived specs
│   │   └── specs/                     # Archived specification docs
│   ├── adversarial-settings.json      # Review/runner config (optional)
│   └── config.toml                    # Project-specific configuration (optional, deprecated)
├── [your existing project files]      # Your actual project
├── package.json                       # Your project dependencies
└── README.md                          # Your project documentation
```

### MCP Server Source Structure

**Core Implementation Files** (locations confirmed from codebase analysis):

| File Path | Purpose | Key Features |
|-----------|---------|--------------|
| `src/server.ts` | MCP server initialization | Tool registration, project registry |
| `src/tools/index.ts` | Tool registry & dispatcher | Registers all 11 tools |
| `src/core/path-utils.ts` | Cross-platform paths | Windows/Unix path handling |
| `src/core/project-registry.ts` | Project registration | Global project tracking |
| `src/dashboard/approval-storage.ts` | Approval records | JSON file persistence |
| `src/dashboard/multi-server.ts` | Multi-project dashboard | WebSocket, file watching, review endpoints |

**Template System** (static content, no AI generation):
```
src/
├── core/                             # Core business logic
│   ├── archive-service.ts            # Spec archiving functionality
│   ├── parser.ts                     # Spec parsing & analysis
│   ├── path-utils.ts                 # Cross-platform path handling
│   ├── project-registry.ts           # Global project tracking
│   ├── task-parser.ts                # Task management & parsing
│   ├── adversarial-settings.ts       # Review/runner settings loader (fork)
│   ├── deferral-storage.ts           # Deferred-decisions store (fork)
│   ├── task-review-manager.ts        # Task review persistence (fork)
│   ├── task-diff.ts / typecheck.ts   # Task review signals (fork)
│   ├── hygiene-signals.ts            # Adversarial hygiene signals (fork)
│   └── path-denylist.ts              # Review path denylist (fork)
├── tools/                            # MCP tool implementations (11 tools)
│   ├── index.ts                      # Tool registry & dispatcher
│   ├── spec-workflow-guide.ts        # Workflow instructions
│   ├── steering-guide.ts             # Steering doc instructions
│   ├── decomposition-guide.ts        # Decomposition methodology (fork)
│   ├── spec-status.ts                # Get spec status
│   ├── approvals.ts                  # Request / status / delete approvals
│   ├── log-implementation.ts         # Record task implementation
│   ├── deferrals.ts                  # Deferred decisions (fork)
│   ├── adversarial-review.ts         # Scaffold a document critique (fork)
│   ├── adversarial-response.ts       # Respond to a critique (fork)
│   ├── review-task.ts                # Review a task's implementation (fork)
│   └── get-task-review.ts            # Retrieve task review findings (fork)
├── dashboard/                        # Dashboard backend
│   ├── multi-server.ts               # Multi-project Fastify server
│   ├── approval-storage.ts           # Approval persistence
│   ├── implementation-log-manager.ts # Implementation log persistence
│   ├── adversarial-runner.ts         # Background adversarial review runner (fork)
│   ├── task-review-runner.ts         # Background task review runner (fork)
│   ├── watcher.ts                    # File system watching
│   ├── utils.ts                      # Dashboard utilities
│   └── public/                       # Static assets
├── dashboard_frontend/              # React dashboard frontend
│   ├── src/
│   │   ├── modules/
│   │   │   ├── api/                 # API communication layer
│   │   │   ├── app/                 # Main application component
│   │   │   ├── approvals/           # Approval UI components
│   │   │   ├── editor/              # Markdown editor
│   │   │   ├── markdown/            # Markdown rendering
│   │   │   ├── modals/              # Modal dialog components
│   │   │   ├── notifications/       # Toast notifications
│   │   │   ├── pages/               # Main page components
│   │   │   ├── theme/               # Styling & themes
│   │   │   └── ws/                  # WebSocket integration
│   │   ├── main.tsx                 # React application entry
│   │   └── App.tsx                  # Root application component
│   ├── index.html                   # HTML template
│   ├── vite.config.ts               # Vite build configuration
│   └── tailwind.config.js           # Tailwind CSS config
├── markdown/                        # Document templates
│   └── templates/
│       ├── requirements-template.md  # Requirements document template
│       ├── design-template.md       # Design document template
│       ├── tasks-template.md        # Tasks document template
│       ├── product-template.md      # Product vision template
│       ├── tech-template.md         # Technical standards template
│       └── structure-template.md    # Code structure template
├── server.ts                       # Main MCP server class
├── index.ts                        # CLI entry point & argument parsing
└── types.ts                        # TypeScript type definitions
```

### VS Code Extension Structure  
```
vscode-extension/
├── src/
│   ├── extension.ts                 # Extension entry point
│   ├── extension/
│   │   ├── providers/               # VS Code providers
│   │   │   └── SidebarProvider.ts   # Sidebar webview provider
│   │   ├── services/                # Business logic services
│   │   │   ├── ApprovalCommandService.ts      # Approval commands
│   │   │   ├── ApprovalEditorService.ts       # Approval editor integration
│   │   │   ├── ArchiveService.ts              # Archive functionality
│   │   │   ├── CommentModalService.ts         # Comment modal handling
│   │   │   ├── FileWatcher.ts                 # File system watching
│   │   │   └── SpecWorkflowService.ts         # Main workflow service
│   │   ├── types.ts                 # Extension type definitions
│   │   └── utils/                   # Utility functions
│   │       ├── colorUtils.ts        # Color manipulation
│   │       ├── logger.ts            # Logging functionality
│   │       └── taskParser.ts        # Task parsing for extension
│   └── webview/                     # Webview components (React)
│       ├── App.tsx                  # Main webview application
│       ├── components/              # Reusable UI components
│       ├── hooks/                   # React hooks
│       ├── lib/                     # Utility libraries
│       └── main.tsx                 # Webview entry point
├── webview-assets/                  # Static webview assets
│   └── sounds/                      # Audio notification files
│       ├── approval-pending.wav     # Approval request sound
│       └── task-completed.wav       # Task completion sound
├── icons/                          # Extension icons
│   ├── activity-bar-icon.svg       # Activity bar icon
│   └── spec-workflow.svg           # General extension icon
├── package.json                    # Extension manifest & dependencies
└── README.md                       # Extension documentation
```

## 📋 File Naming Conventions

### Specification Names
- **Format**: `kebab-case` (lowercase with hyphens)
- **Examples**: ✅ `user-authentication`, `payment-flow`, `admin-dashboard`
- **Invalid**: ❌ `UserAuth`, `payment_flow`, `Admin Dashboard`

### Document Files
- **Requirements**: `requirements.md`
- **Design**: `design.md` 
- **Tasks**: `tasks.md`
- **Product**: `product.md`
- **Tech**: `tech.md`
- **Structure**: `structure.md`

### Approval Files
- **Format**: `{spec-name}-{document}-{timestamp}.json`
- **Example**: `user-auth-requirements-20241215-143022.json`
- **Auto-generated**: System creates these automatically

## 🛠️ Path Utilities

### Cross-Platform Path Handling

The system uses `PathUtils` class for consistent path handling across Windows, macOS, and Linux:

```typescript
export class PathUtils {
  // Get workflow root directory
  static getWorkflowRoot(projectPath: string): string {
    return normalize(join(projectPath, '.spec-workflow'));
  }

  // Get spec directory path
  static getSpecPath(projectPath: string, specName: string): string {
    return normalize(join(projectPath, '.spec-workflow', 'specs', specName));
  }

  // Get steering documents path
  static getSteeringPath(projectPath: string): string {
    return normalize(join(projectPath, '.spec-workflow', 'steering'));
  }

  // Convert to platform-specific path
  static toPlatformPath(path: string): string {
    return path.split('/').join(sep);
  }

  // Convert to Unix-style path (for JSON/API)
  static toUnixPath(path: string): string {
    return path.split(sep).join('/');
  }
}
```

### Common Path Operations

```typescript
// Examples of PathUtils usage

// Get spec path
const specPath = PathUtils.getSpecPath('/project', 'user-auth');
// Result: /project/.spec-workflow/specs/user-auth

// Get requirements file path
const reqPath = join(specPath, 'requirements.md');
// Result: /project/.spec-workflow/specs/user-auth/requirements.md

// Get relative path for API responses  
const relativePath = PathUtils.toUnixPath(reqPath.replace(projectPath, ''));
// Result: .spec-workflow/specs/user-auth/requirements.md
```

## 📂 Directory Creation & Management

### Auto-Created Directories

The system automatically creates these directories as needed:

```typescript
// Directories created during initialization
const directories = [
  '.spec-workflow/',
  '.spec-workflow/specs/',
  '.spec-workflow/steering/',
  '.spec-workflow/templates/',
  '.spec-workflow/user-templates/',
  '.spec-workflow/archive/',
  '.spec-workflow/archive/specs/'
];

// Directories created on-demand
const onDemandDirectories = [
  '.spec-workflow/approvals/',
  '.spec-workflow/approvals/{category-name}/',
  '.spec-workflow/specs/{spec-name}/',
  '.spec-workflow/specs/{spec-name}/reviews/',
  '.spec-workflow/spec-decomposition/'
];
```

### Directory Validation

```typescript
export async function validateProjectPath(projectPath: string): Promise<string> {
  // Resolve to absolute path
  const absolutePath = resolve(projectPath);
  
  // Check if path exists
  await access(absolutePath, constants.F_OK);
  
  // Ensure it's a directory
  const stats = await stat(absolutePath);
  if (!stats.isDirectory()) {
    throw new Error(`Project path is not a directory: ${absolutePath}`);
  }
  
  return absolutePath;
}
```

### Cleanup & Maintenance

```typescript
// Archive completed specifications
export class SpecArchiveService {
  async archiveSpec(specName: string): Promise<void> {
    const sourceDir = PathUtils.getSpecPath(this.projectPath, specName);
    const archiveDir = PathUtils.getArchiveSpecPath(this.projectPath, specName);
    
    // Move spec to archive
    await fs.rename(sourceDir, archiveDir);
    
    // Clean up approvals
    const approvalsDir = PathUtils.getSpecApprovalPath(this.projectPath, specName);
    await fs.rm(approvalsDir, { recursive: true, force: true });
  }
}
```

## 🔒 File Permissions & Security

### Required Permissions

```bash
# Minimum required permissions
.spec-workflow/           # 755 (rwxr-xr-x)
├── specs/               # 755 (rwxr-xr-x)
├── steering/            # 755 (rwxr-xr-x)
├── approvals/           # 755 (rwxr-xr-x)
└── archive/             # 755 (rwxr-xr-x)
```

### Security Considerations

**File Access Restrictions**:
- ✅ Read/Write: Only within `.spec-workflow/` directory
- ✅ Read-Only: Project files (for analysis)
- ❌ Forbidden: System directories, parent directory traversal

**Path Traversal Prevention**:
```typescript
// All paths are normalized and validated
const safePath = normalize(join(projectPath, '.spec-workflow', userInput));

// Ensure path stays within project
if (!safePath.startsWith(projectPath)) {
  throw new Error('Path traversal attempt detected');
}
```

## 📊 Storage Considerations

### File Size Limits

| File Type | Typical Size | Max Recommended |
|-----------|-------------|-----------------|
| Requirements | 5-20 KB | 100 KB |
| Design | 10-50 KB | 200 KB |
| Tasks | 5-30 KB | 150 KB |
| Steering Docs | 5-20 KB | 100 KB |
| Approval Data | < 1 KB | 5 KB |
| Session Data | < 1 KB | 2 KB |

### Disk Usage Estimation

```typescript
// Typical project disk usage
interface DiskUsage {
  singleSpec: '50-200 KB';      // All 3 documents
  steeringDocs: '20-100 KB';    // All steering documents  
  approvalData: '1-10 KB';      // Per approval workflow
  sessionData: '< 1 KB';        // Session tracking
  totalTypical: '100-500 KB';   // For small-medium project
  totalLarge: '1-5 MB';         // For large project with many specs
}
```

### Cleanup Strategies

```bash
# Manual cleanup commands

# Remove completed approvals (older than 30 days)
find .spec-workflow/approvals -name "*.json" -mtime +30 -delete

# Archive old specifications
# (Move specs with all tasks completed to archive/)

# Full reset (nuclear option)
rm -rf .spec-workflow/
```

---

**Next**: [Dashboard System →](dashboard.md)