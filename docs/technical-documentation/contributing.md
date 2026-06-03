# Contributing Guidelines

> **Welcome!** This guide will help you contribute effectively to the Spec Workflow MCP project.

## 🚀 Quick Start for Contributors

### 1. Setup Development Environment
```bash
# Fork and clone the repository
git clone https://github.com/your-username/spec-workflow-mcp.git
cd spec-workflow-mcp

# Install dependencies
npm install

# Install VS Code extension dependencies (optional)
cd vscode-extension
npm install
cd ..

# Build everything to verify setup
npm run build
```

### 2. Development Workflow
```bash
# Start MCP server in development mode
npm run dev

# In another terminal, start dashboard
npm run dev:dashboard

# Make your changes
# Test thoroughly
# Create pull request
```

## 🎯 How to Contribute

### Areas Where We Need Help

**🔧 Core Features**
- New MCP tools and functionality
- Performance optimizations
- Cross-platform compatibility improvements

**📱 Dashboard & UI**
- New dashboard features
- UI/UX improvements
- Accessibility enhancements

**📚 Documentation**
- Code examples and tutorials
- API documentation improvements
- Translation to other languages

**🧪 Testing**
- Unit test coverage
- Integration test scenarios  
- Manual testing on different platforms

**🐛 Bug Fixes**
- Reported issues in GitHub
- Edge cases and error handling
- Performance bottlenecks

## 📋 Contribution Types

### 1. Bug Reports
**Before Creating an Issue**:
- Search existing issues first
- Try the [troubleshooting guide](troubleshooting.md)
- Test with the latest version

**Good Bug Report Template**:
```markdown
## Bug Description
Brief description of the issue

## Environment
- OS: [Windows 11 / macOS 14 / Ubuntu 22.04]
- Node.js: [version]
- MCP Client: [Claude Desktop / Cursor / etc.]

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior  
What actually happens

## Additional Context
- Error messages
- Screenshots
- Logs
```

### 2. Feature Requests
**Good Feature Request Template**:
```markdown
## Feature Description
Clear description of the proposed feature

## Problem It Solves
What problem does this address?

## Proposed Solution
How should it work?

## Alternatives Considered
Other approaches you've considered

## Implementation Ideas
Any thoughts on how to implement this
```

### 3. Code Contributions

#### Pull Request Process
1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/my-feature`
3. **Make** your changes following our coding standards
4. **Test** your changes thoroughly
5. **Document** new functionality
6. **Submit** a pull request with clear description

#### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature  
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Manual testing completed
- [ ] Cross-platform tested (if applicable)

## Documentation
- [ ] Code is documented
- [ ] README updated (if needed)
- [ ] API docs updated (if needed)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] No merge conflicts
```

## 🎨 Coding Standards

### TypeScript Guidelines

**File Organization**:
```typescript
// 1. External library imports
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { readFile } from 'fs/promises';

// 2. Internal imports
import { ToolContext, ToolResponse } from '../types.js';
import { PathUtils } from '../core/path-utils.js';

// 3. Type definitions
interface LocalInterface {
  // ...
}

// 4. Constants
const CONSTANTS = {
  // ...
};

// 5. Main implementation
export class MyClass {
  // ...
}
```

**Function Structure**:
```typescript
/**
 * Brief description of what the function does
 * @param param1 Description of parameter
 * @param param2 Description of parameter  
 * @returns Description of return value
 */
export async function myFunction(
  param1: string,
  param2: number
): Promise<MyReturnType> {
  // Input validation
  if (!param1) {
    throw new Error('param1 is required');
  }
  
  try {
    // Main logic
    const result = await doSomething(param1, param2);
    return result;
  } catch (error: any) {
    // Error handling
    throw new Error(`Operation failed: ${error.message}`);
  }
}
```

**Error Handling Pattern**:
```typescript
// MCP Tool error handling
export async function myToolHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  try {
    // Validation
    const { requiredParam } = args;
    if (!requiredParam) {
      return {
        success: false,
        message: 'requiredParam is required',
        nextSteps: ['Provide the required parameter']
      };
    }
    
    // Implementation
    const result = await doWork(requiredParam);
    
    return {
      success: true,
      message: 'Operation completed successfully',
      data: result,
      nextSteps: ['Next recommended action']
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Operation failed: ${error.message}`,
      nextSteps: [
        'Check input parameters',
        'Verify file permissions',
        'Try again or contact support'
      ]
    };
  }
}
```

### React Component Guidelines

**Component Structure**:
```typescript
// src/dashboard_frontend/src/components/MyComponent.tsx
import React, { useState, useEffect } from 'react';

interface MyComponentProps {
  data: DataType[];
  onAction: (item: DataType) => void;
  className?: string;
}

export default function MyComponent({ 
  data, 
  onAction, 
  className = '' 
}: MyComponentProps) {
  const [localState, setLocalState] = useState<StateType>({});
  
  useEffect(() => {
    // Side effects
  }, [data]);
  
  const handleClick = (item: DataType) => {
    // Event handlers
    onAction(item);
  };
  
  return (
    <div className={`base-styles ${className}`}>
      {data.map(item => (
        <div key={item.id} onClick={() => handleClick(item)}>
          {item.name}
        </div>
      ))}
    </div>
  );
}
```

**Styling Guidelines**:
```typescript
// Use Tailwind CSS classes
<div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
    Title
  </h2>
</div>

// Custom CSS only when Tailwind is insufficient
// Add to src/modules/theme/theme.css
```

### File and Directory Naming

```
// Files
kebab-case.ts         ✅ Good
PascalCase.ts         ❌ Avoid
snake_case.ts         ❌ Avoid

// Directories  
kebab-case/           ✅ Good
PascalCase/          ❌ Avoid (except React components)
snake_case/          ❌ Avoid

// React Components
MyComponent.tsx       ✅ Good (PascalCase for components)
my-component.tsx      ❌ Avoid

// MCP Tools
my-tool.ts           ✅ Good
myTool.ts            ❌ Avoid
```

## 🧪 Testing Guidelines

### Manual Testing Checklist

**Before Submitting PR**:
- [ ] MCP server starts without errors
- [ ] Dashboard loads and displays data
- [ ] WebSocket connections work
- [ ] File changes trigger updates
- [ ] Approval workflow functions
- [ ] Cross-platform compatibility (if applicable)

**Test Scenarios**:
```bash
# 1. Basic MCP server functionality
npm run dev
# Connect AI client and test tools

# 2. Dashboard functionality
npm run dev:dashboard
# Test all pages and features

# 3. VS Code extension (if modified)
cd vscode-extension
# Press F5 in VS Code to test

# 4. Build process
npm run clean
npm run build
# Verify dist/ contents

# 5. CLI interface
node dist/index.js --help
node dist/index.js --dashboard
```

### Future Testing Framework

**Unit Tests** (planned):
```typescript
// Example test structure
describe('PathUtils', () => {
  describe('getSpecPath', () => {
    it('should create correct spec path', () => {
      const result = PathUtils.getSpecPath('/project', 'my-spec');
      expect(result).toBe('/project/.spec-workflow/specs/my-spec');
    });
    
    it('should handle special characters', () => {
      const result = PathUtils.getSpecPath('/project', 'user-auth');
      expect(result).toContain('user-auth');
    });
  });
});
```

## 📖 Documentation Standards

### Code Documentation

**JSDoc Comments**:
```typescript
/**
 * Creates a new specification document following the workflow sequence
 * 
 * @param projectPath - Absolute path to the project root
 * @param specName - Feature name in kebab-case (e.g., 'user-authentication')  
 * @param document - Which document to create: 'requirements' | 'design' | 'tasks'
 * @param content - Complete markdown content for the document
 * @returns Promise resolving to tool response with file path and next steps
 * 
 * @example
 * ```typescript
 * const response = await createSpecDoc({
 *   projectPath: '/my/project',
 *   specName: 'user-auth', 
 *   document: 'requirements',
 *   content: '# Requirements\n\n...'
 * });
 * ```
 * 
 * @throws {Error} When workflow order is violated (e.g., creating design before requirements)
 */
export async function createSpecDoc(...): Promise<ToolResponse> {
  // Implementation
}
```

**README Updates**:
- Update main README.md for user-facing changes
- Update technical documentation for developer changes
- Include code examples for new features

### API Documentation

**MCP Tool Documentation**:
```typescript
export const myNewToolTool: Tool = {
  name: 'my-new-tool',
  description: `Brief description of what this tool does.

# Instructions  
When to use this tool and how it fits in the workflow.

# Parameters
- param1: Description and format
- param2: Description and constraints

# Example Usage
Concrete example of how to use this tool.`,
  inputSchema: {
    // JSON Schema
  }
};
```

## 🔄 Development Workflow

### Branch Strategy

```bash
# Main branches
main                    # Stable release code
develop                 # Integration branch for features

# Feature branches  
feature/add-new-tool   # New features
bugfix/fix-approval    # Bug fixes
docs/update-api        # Documentation updates
chore/update-deps      # Maintenance tasks
```

### Commit Message Format

```bash
# Format: type(scope): description

feat(tools): add new spec validation tool
fix(dashboard): resolve WebSocket connection issues  
docs(api): update MCP tool documentation
chore(deps): update TypeScript to 5.3.0
refactor(parser): simplify task parsing logic

# Types: feat, fix, docs, style, refactor, test, chore
# Scope: tools, dashboard, core, docs, extension
```

### Release Process

**Version Bumping**:
```bash
# Patch release (bug fixes)
npm version patch

# Minor release (new features)  
npm version minor

# Major release (breaking changes)
npm version major
```

**Pre-release Checklist**:
- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated  
- [ ] Version bumped
- [ ] Build successful
- [ ] Manual testing completed

## 🤝 Community Guidelines

### Code of Conduct

**Our Standards**:
- **Be Respectful** - Treat everyone with respect and kindness
- **Be Inclusive** - Welcome contributors from all backgrounds
- **Be Constructive** - Provide helpful feedback and suggestions
- **Be Patient** - Remember that everyone is learning

**Unacceptable Behavior**:
- Harassment or discrimination
- Trolling or inflammatory comments
- Personal attacks
- Publishing private information

### Getting Help

**For Contributors**:
1. **Read this guide** and linked documentation
2. **Search existing issues** and discussions
3. **Ask in GitHub Discussions** for general questions
4. **Create an issue** for specific problems
5. **Join community channels** (if available)

**For Maintainers**:
- Respond to issues and PRs promptly
- Provide constructive feedback
- Help newcomers get started
- Maintain welcoming environment

## 🏆 Recognition

### Contributors

Contributors are recognized in:
- GitHub contributors list
- CHANGELOG.md for significant contributions
- README.md acknowledgments section

### Types of Contributions

**All contributions are valued**:
- 💻 **Code** - Features, bug fixes, improvements
- 📖 **Documentation** - Guides, examples, translations  
- 🐛 **Testing** - Bug reports, test cases, QA
- 💡 **Ideas** - Feature requests, design feedback
- 🎨 **Design** - UI/UX improvements, icons, graphics
- 📢 **Community** - Helping other users, spreading the word

---

**Thank you for contributing to Spec Workflow MCP!** 🎉

Every contribution, no matter how small, helps make this project better for everyone.