# Development Guide

This guide covers setting up a development environment, building the project, contributing code, and understanding the architecture of Spec Workflow MCP.

## Prerequisites

### Required Software

- **Node.js** 18.0 or higher
- **npm** 9.0 or higher
- **Git** for version control
- **TypeScript** knowledge helpful

### Recommended Tools

- **VSCode** with TypeScript extensions
- **Chrome/Edge DevTools** for dashboard debugging
- **Postman/Insomnia** for API testing

## Setting Up Development Environment

### 1. Clone the Repository

```bash
git clone https://github.com/madmatt112/spec-workflow-mcp.git
cd spec-workflow-mcp
```

### 2. Install Dependencies

```bash
npm install
```

This installs:
- MCP SDK
- TypeScript and build tools
- Express for dashboard server
- WebSocket libraries
- Testing frameworks

### 3. Build the Project

```bash
npm run build
```

This compiles TypeScript files to JavaScript in the `dist/` directory.

## Development Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode with auto-reload |
| `npm run build` | Build production bundle |
| `npm start` | Run production server |
| `npm test` | Run test suite |
| `npm run clean` | Remove build artifacts |
| `npm run lint` | Run code linter |
| `npm run format` | Format code with Prettier |

### Development Mode

```bash
npm run dev
```

Features:
- Auto-recompilation on file changes
- Hot reload for dashboard
- Detailed error messages
- Source maps for debugging

### Building for Production

```bash
npm run clean && npm run build
```

Optimizations:
- Minified JavaScript
- Optimized bundle size
- Production error handling
- Performance improvements

## Project Structure

```
spec-workflow-mcp/
├── src/                    # Source code
│   ├── index.ts           # MCP server entry point
│   ├── server.ts          # Dashboard server
│   ├── tools/             # MCP tool implementations
│   ├── prompts/           # Prompt templates
│   ├── utils/             # Utility functions
│   └── types/             # TypeScript type definitions
├── dist/                   # Compiled JavaScript
├── dashboard/             # Web dashboard files
│   ├── index.html         # Dashboard UI
│   ├── styles.css         # Dashboard styles
│   └── script.js          # Dashboard JavaScript
├── vscode-extension/      # VSCode extension
│   ├── src/               # Extension source
│   └── package.json       # Extension manifest
├── tests/                 # Test files
├── docs/                  # Documentation
└── package.json           # Project configuration
```

## Architecture Overview

### MCP Server Architecture

```
Client (AI) ↔ MCP Protocol ↔ Server ↔ File System
                              ↓
                          Dashboard
```

### Key Components

#### 1. MCP Server (`src/index.ts`)
- Handles MCP protocol communication
- Processes tool requests
- Manages project state
- File system operations

#### 2. Dashboard Server (`src/server.ts`)
- Serves web dashboard
- WebSocket connections
- Real-time updates
- HTTP API endpoints

#### 3. Tools (`src/tools/`)
Each tool is a separate module:
- Input validation
- Business logic
- File operations
- Response formatting

#### 4. Prompts (`src/prompts/`)
Template strings for:
- Document generation
- Workflow guidance
- Error messages
- User instructions

## Implementing New Features

### Adding a New Tool

1. **Create tool file** in `src/tools/`:

```typescript
// src/tools/my-new-tool.ts
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';

export const myNewTool: Tool = {
  name: 'my-new-tool',
  description: 'Description of what the tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter description' },
      param2: { type: 'number' }
    },
    required: ['param1']
  }
};

export async function myNewToolHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const { param1, param2 = 0 } = args;

  // Business logic here

  return {
    success: true,
    message: 'Tool response',
    data: {}
  };
}
```

2. **Register in index** (`src/tools/index.ts`): add the tool to the array returned
   by `registerTools()` and wire its handler into the `handleToolCall` switch:

```typescript
import { myNewTool, myNewToolHandler } from './my-new-tool.js';

// In registerTools(): include `myNewTool` in the returned array
// In handleToolCall(): add a `case 'my-new-tool'` that calls myNewToolHandler(args, context)
```

### Adding Dashboard Features

The dashboard is a **React** frontend (`src/dashboard_frontend/`) served by a
**Fastify** backend (`src/dashboard/multi-server.ts`) — not a plain HTML/JS page.

1. **Add a page** (`src/dashboard_frontend/src/modules/pages/MyNewPage.tsx`):

```tsx
import React from 'react';

export default function MyNewPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">My New Page</h1>
      {/* Page content */}
    </div>
  );
}
```

2. **Register the route** in the app/router (`src/dashboard_frontend/src/modules/app/`):

```tsx
<Route path="/my-page" element={<MyNewPage />} />
```

3. **Add a backend endpoint** (`src/dashboard/multi-server.ts`). Endpoints are
   project-scoped under `/api/projects/:projectId/...`:

```typescript
this.app.get('/api/projects/:projectId/my-endpoint', async (request, reply) => {
  const { projectId } = request.params as { projectId: string };
  const project = this.projectManager.getProject(projectId);
  if (!project) return reply.code(404).send({ error: 'Project not found' });
  const data = await this.getMyData(project);
  return { success: true, data };
});
```

Run the dashboard dev server with hot reload via `npm run dev:dashboard`
(Vite, default `http://localhost:5173`).

### Working with the VS Code Extension

```bash
cd vscode-extension
npm install
code .          # then press F5 to launch the Extension Development Host
```

Add a command by registering it in `src/extension.ts` and declaring it under
`contributes.commands` in `package.json`:

```typescript
// src/extension.ts
const myCommand = vscode.commands.registerCommand('spec-workflow.myCommand', async () => {
  vscode.window.showInformationMessage('My command executed!');
});
context.subscriptions.push(myCommand);
```

### Tool Development Guidelines

- **Validate inputs** and return a structured failure rather than throwing:
  ```typescript
  if (!projectPath) {
    return { success: false, message: 'projectPath is required',
             nextSteps: ['Provide absolute path to project root'] };
  }
  ```
- **Catch errors** and return `{ success: false, message }` with helpful `nextSteps`.
- **Use the consistent `ToolResponse` shape**: `{ success, message, data?, nextSteps? }`.
- **Use `PathUtils`** for all path work (cross-platform):
  `PathUtils.getSpecPath(projectPath, specName)`, `PathUtils.toUnixPath(filePath)`.

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/tools/my-tool.test.ts

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Writing Tests

Create test files next to source files:

Tests call the exported **handler function** (`myNewToolHandler(args, context)`), not
a `.handler` property. Handlers return `{ success, message, data? }`.

```typescript
// src/tools/my-new-tool.test.ts
import { describe, it, expect } from 'vitest';
import { myNewToolHandler } from './my-new-tool';

const ctx = { projectPath: '/tmp/project' } as any; // ToolContext

describe('myNewToolHandler', () => {
  it('should process input correctly', async () => {
    const result = await myNewToolHandler({ param1: 'test' }, ctx);
    expect(result.success).toBe(true);
  });

  it('should handle errors', async () => {
    const result = await myNewToolHandler({ param1: null }, ctx);
    expect(result.success).toBe(false);
    expect(result.message).toBeDefined();
  });
});
```

### Integration Testing

Test complete workflows:

```typescript
// tests/integration/workflow.test.ts
describe('Complete Workflow', () => {
  it('should create spec from start to finish', async () => {
    // Create requirements
    // Approve requirements
    // Create design
    // Approve design
    // Create tasks
    // Verify structure
  });
});
```

## Debugging

### Debug MCP Server

1. **Add debug output**:

```typescript
console.error('[DEBUG]', 'Tool called:', toolName, params);
```

2. **Use VSCode debugger**:

```json
// .vscode/launch.json
{
  "type": "node",
  "request": "launch",
  "name": "Debug MCP Server",
  "program": "${workspaceFolder}/dist/index.js",
  "args": ["/path/to/test/project"],
  "console": "integratedTerminal"
}
```

### Debug Dashboard

1. **Browser DevTools**:
   - Open dashboard in browser
   - Press F12 for DevTools
   - Check Console for errors
   - Monitor Network tab for WebSocket

2. **Add logging**:

```javascript
console.log('WebSocket message:', message);
console.log('State update:', newState);
```

## Code Style and Standards

### TypeScript Guidelines

- Use strict mode
- Define interfaces for data structures
- Avoid `any` type
- Use async/await over callbacks

### File Organization

- One component per file
- Group related functionality
- Clear naming conventions
- Comprehensive comments

### Naming Conventions

- **Files**: kebab-case (`my-tool.ts`)
- **Classes**: PascalCase (`SpecManager`)
- **Functions**: camelCase (`createSpec`)
- **Constants**: UPPER_SNAKE (`MAX_RETRIES`)

## Contributing

### Contribution Process

1. **Fork repository**
2. **Create feature branch**:
   ```bash
   git checkout -b feature/my-feature
   ```
3. **Make changes**
4. **Write tests**
5. **Run tests and lint**:
   ```bash
   npm test
   npm run lint
   ```
6. **Commit changes**:
   ```bash
   git commit -m "feat: add new feature"
   ```
7. **Push branch**:
   ```bash
   git push origin feature/my-feature
   ```
8. **Create Pull Request**

### Commit Message Format

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Formatting
- `refactor:` Code restructuring
- `test:` Testing
- `chore:` Maintenance

Examples:
```
feat: add approval revision workflow
fix: resolve dashboard WebSocket reconnection issue
docs: update configuration guide
```

### Pull Request Guidelines

- Clear description
- Reference related issues
- Include screenshots for UI changes
- Ensure all tests pass
- Update documentation

## Publishing

### NPM Package

Releases do not go through a plain local `npm publish`. The npm package is published
by a gated GitHub Actions workflow that enforces plugin/package version sync and
registry uniqueness, requires a matching git tag, and publishes via OIDC. See the
[Publishing to npm section in the README](../README.md#-publishing-to-npm) and the
workflows under `.github/workflows/` for the exact gates and dispatch steps.

### VSCode Extension

1. **Update extension version** in `vscode-extension/package.json`

2. **Build extension**:
   ```bash
   cd vscode-extension
   npm run package
   ```

3. **Publish to marketplace**:
   ```bash
   vsce publish
   ```

## Performance Optimization

### Server Performance

- Use caching for file reads
- Implement debouncing for file watchers
- Optimize WebSocket message batching
- Lazy load large documents

### Dashboard Performance

- Minimize DOM updates
- Use virtual scrolling for long lists
- Implement progressive rendering
- Optimize WebSocket reconnection

## Security Considerations

### Input Validation

Always validate tool inputs:

```typescript
if (!params.specName || typeof params.specName !== 'string') {
  throw new Error('Invalid spec name');
}

// Sanitize file paths
const safePath = path.normalize(params.path);
if (safePath.includes('..')) {
  throw new Error('Invalid path');
}
```

### File System Security

- Restrict operations to project directory
- Validate all file paths
- Use safe file operations
- Implement permission checks

## Troubleshooting Development Issues

### Common Build Errors

| Error | Solution |
|-------|----------|
| TypeScript errors | Run `npm run build` to see detailed errors |
| Module not found | Check imports and run `npm install` |
| Port already in use | Change port or kill existing process |
| WebSocket connection failed | Check server is running and port is correct |

### Development Tips

1. **Use TypeScript strict mode** for better type safety
2. **Enable source maps** for easier debugging
3. **Use nodemon** for auto-restart during development
4. **Test file operations** in isolated directory
5. **Monitor performance** with Chrome DevTools

## Resources

- [MCP SDK Documentation](https://github.com/anthropics/mcp-sdk)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Node.js Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [VSCode Extension API](https://code.visualstudio.com/api)

## Related Documentation

- [Configuration Guide](CONFIGURATION.md) - Server configuration
- [User Guide](USER-GUIDE.md) - Using the server
- [Tools Reference](TOOLS-REFERENCE.md) - Tool documentation
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues