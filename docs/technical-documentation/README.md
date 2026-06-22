# Technical Documentation

> **Quick Reference**: Jump to what you need most → [Tools API](api-reference.md) | [Architecture](architecture.md) | [Developer Guide](developer-guide.md) | [Troubleshooting](troubleshooting.md)

## 📋 Table of Contents

### Core Documentation
- **[Architecture Overview](architecture.md)** - System design, components, and data flow
- **[MCP Tools API Reference](api-reference.md)** - Complete tool documentation with examples
- **[Developer Workflow Guide](developer-guide.md)** - Step-by-step development workflows
- **[Context Management](context-management.md)** - How context switching and caching works
- **[File Structure](file-structure.md)** - Project organization and directory layout
- **[Dashboard System](dashboard.md)** - Web dashboard and real-time features
- **[Troubleshooting & FAQ](troubleshooting.md)** - Common issues and solutions

### Quick Start Guides
- **[Contributing Guidelines](contributing.md)** - How to contribute to the project

## 🚀 Quick Start

### For AI Assistant Integration
```json
{
  "mcpServers": {
    "spec-workflow": {
      "command": "npx",
      "args": ["-y", "@madmatt112org/spec-workflow-mcp@latest", "/path/to/project"]
    }
  }
}
```

**Note**: To use the dashboard, start it separately in a terminal:
```bash
npx -y @madmatt112org/spec-workflow-mcp@latest --dashboard
```

### For Local Development
```bash
# Clone and setup
git clone <repository-url>
cd spec-workflow-mcp
npm install

# Start development server
npm run dev

# Build for production  
npm run build
```

## 🔍 Comprehensive Capability Analysis

### Critical Questions Answered

Based on comprehensive codebase analysis, here are definitive answers to key technical questions:

#### **Question 1: Web Scraping & Research Capabilities**
**Answer: No independent web scraping - leverages LLM's built-in web search**

| Aspect | This MCP | Other AI Agents | Expansion Opportunity |
|--------|----------|----------------|---------------------|
| **Web Scraping** | ❌ No independent capability | ✅ Custom scrapers (Puppeteer, Playwright) | 🔮 Could add structured scraping tools |
| **API Research** | ❌ Relies on LLM's web search | ✅ Direct API integrations | 🔮 Could add GitHub, Stack Overflow APIs |
| **Research Caching** | ❌ No research persistence | ✅ Advanced caching systems | 🔮 Could cache LLM research results |
| **Data Sources** | ✅ LLM's vast training data + real-time web | ❌ Limited to configured sources | ✅ Best of both worlds |

#### **Question 2: AI Calls & Context Window Management**
**Answer: Pure MCP - uses only connected LLM, no independent AI calls**

| Aspect | This MCP | Other AI Agents | Expansion Opportunity |
|--------|----------|----------------|---------------------|
| **AI Service Calls** | ❌ No independent AI calls | ✅ Multiple AI model integration | 🔮 Could add specialized AI services |
| **Context Management** | ❌ No LLM context manipulation | ✅ Advanced context strategies | 🔮 Could add context optimization |
| **Memory Management** | ❌ File-based only | ✅ Vector databases, embeddings | 🔮 Could add persistent memory |
| **Multi-Model Usage** | ❌ Single LLM connection | ✅ GPT-4 + Claude + Gemini | 🔮 Could add model routing |

#### **Question 3: Document Planning Process**
**Answer: Template-guided LLM intelligence - no separate AI planning**

| Aspect | This MCP | Other AI Agents | Expansion Opportunity |
|--------|----------|----------------|---------------------|
| **Planning Intelligence** | ✅ LLM reasoning with templates | ✅ Dedicated planning AI | 🔮 Could add adaptive workflows |
| **Template System** | ✅ Static but comprehensive | ❌ Often no structured templates | ✅ Structured advantage |
| **Workflow Adaptation** | ❌ Fixed sequence | ✅ Dynamic workflow generation | 🔮 Could add LLM-powered workflows |
| **Project Analysis** | ✅ LLM analyzes project context | ✅ Specialized analysis tools | 🔮 Could add deep code analysis |

#### **Question 4: Auto Review Process**
**Answer: Optional automated AI review (adversarial review + task review), with human approval as the final gate**

> **Fork note.** Upstream had no automated review. This fork adds **adversarial
> review** (independent, fresh-context critique of requirements/design/tasks/steering/
> decomposition documents) and **task review** (skeptical code review of a task's
> implementation). These can be driven by the connected LLM spawning a subagent, or
> run in the background by the dashboard launching a configurable LLM **CLI**
> subprocess (see `src/dashboard/adversarial-runner.ts`,
> `src/dashboard/task-review-runner.ts`). Human approval in the dashboard remains the
> gate that advances a phase.

| Aspect | This MCP | Other AI Agents | Expansion Opportunity |
|--------|----------|----------------|---------------------|
| **Review Automation** | ✅ Optional AI review (adversarial + task), human approval gate | ✅ Multi-stage AI review | 🔮 Could add more review dimensions |
| **Quality Assurance** | ✅ AI critique + Human oversight | ❌ AI-only (potential errors) | ✅ Best quality control |
| **Approval Workflows** | ✅ Dashboard/VS Code integration | ❌ Often CLI-only | ✅ Superior UX |
| **Review Intelligence** | ✅ Fresh-context adversarial + task review | ✅ Specialized review models | 🔮 Could add review templates |

#### **Question 5: Best Practice Standards**
**Answer: LLM built-in knowledge - no external standards fetching**

| Aspect | This MCP | Other AI Agents | Expansion Opportunity |
|--------|----------|----------------|---------------------|
| **Standards Source** | ✅ LLM's vast training knowledge | ✅ External standards APIs | 🔮 Could add standards integration |
| **Currency** | ✅ LLM can web search for latest | ❌ Static configurations | ✅ Always current |
| **Customization** | ❌ No project-specific standards | ✅ Custom rule engines | 🔮 Could add org standards |
| **Best Practices** | ✅ Industry-wide via LLM | ❌ Limited to pre-configured | ✅ Comprehensive coverage |

### Competitive Positioning Analysis

**Strengths vs Other AI Agents:**
```typescript
interface CompetitiveAdvantages {
  humanOversight: "Mandatory approval prevents runaway AI behavior";
  llmLeverage: "Uses full power of connected LLM without limitations";
  structuredOutput: "Templates ensure consistent, professional documentation";
  realTimeUI: "Dashboard and VS Code integration for seamless workflow";
  simplicity: "No complex setup or API key management required";
  reliability: "Proven workflow sequence with validation and error handling";
}
```

**Current Limitations vs Market Leaders:**
```typescript
interface LimitationsAnalysis {
  automationLevel: "Less automated than fully autonomous agents";
  integrationEcosystem: "Limited external service integrations";
  multiProject: "Single project scope vs enterprise-wide solutions";
  aiDiversity: "Single LLM vs multi-model approaches";
  workflowFlexibility: "Fixed sequence vs adaptive workflows";
}
```

**Expansion Opportunities Identified:**
```typescript
interface ExpansionRoadmap {
  immediateWins: {
    githubIntegration: "PR creation, issue sync, code analysis";
    qualityGates: "Optional automated quality checks";
    templateDynamism: "Project-type aware template selection";
  };
  
  mediumTerm: {
    multiProjectSupport: "Enterprise dashboard for multiple projects";
    advancedIntegrations: "Jira, Confluence, Slack notifications";
    workflowCustomization: "Configurable workflow sequences";
  };
  
  longTerm: {
    aiOrchestration: "Multi-agent coordination capabilities";
    predictiveAnalytics: "Project success prediction and risk analysis";
    enterpriseFeatures: "SSO, compliance, audit trails";
  };
}
```

## ⚠️ Technical Limitations & Capabilities

### What This MCP Does NOT Do

**Limited External Calls by the MCP server**:
- ❌ No web scraping or external research by the MCP *tool* handlers
- ✅ Tool handlers leverage the connected LLM's built-in knowledge and web search
- ⚠️ Exception: the **dashboard** can spawn a local LLM **CLI subprocess** to run
  background adversarial reviews and task reviews (configurable; off unless used).
  That subprocess in turn calls whatever LLM the CLI is configured for.

**AI review is opt-in, not absent**:
- ✅ Adversarial review and task review are first-class features in this fork
- ✅ They run either via the connected LLM spawning a subagent, or via a dashboard-
  launched CLI subprocess
- ❌ No always-on background AI processing — reviews run only when triggered

**No Context Window Management**:
- ❌ Does not extend or manage AI client context windows
- ❌ No conversation history or memory management
- ❌ No cross-session AI context preservation
- ✅ Provides structured project data for AI client consumption

**Human-Gated Approval System**:
- ✅ Optional automated AI review (adversarial + task review) informs the human
- ✅ Reviews can move an approval to `needs-revision` with findings attached
- ❌ Verbal approval not accepted
- ✅ The final approve/reject decision requires dashboard or VS Code interaction

### What This MCP Excels At

**Leveraging LLM Built-in Capabilities**:
- ✅ Provides structured templates for LLM to fill with intelligent content
- ✅ Supplies project context for LLM analysis and understanding
- ✅ Enables LLM to use its built-in knowledge for best practices
- ✅ Allows LLM to perform web research when generating content

**Structured Workflow Enforcement**:
- ✅ Enforces spec-driven development sequence
- ✅ Template-based document structure for consistent LLM output
- ✅ Workflow validation and blocking
- ✅ Human oversight integration for LLM-generated content

**Intelligent Project Data Management**:
- ✅ Efficient context loading for LLM consumption
- ✅ Real-time file watching and updates
- ✅ Cross-platform path handling
- ✅ Structured project organization that LLM can understand

**Enhanced Developer Experience**:
- ✅ Web dashboard for reviewing LLM-generated content
- ✅ VS Code extension integration
- ✅ Real-time WebSocket updates
- ✅ Comprehensive error handling

## 🎯 Key Concepts

### MCP Tools
The server registers **11 MCP tools** (see `src/tools/index.ts`). Spec documents are
written by the agent reading templates and writing files directly — there is no
`create-spec-doc` / `manage-tasks` tool. Full details in
[../TOOLS-REFERENCE.md](../TOOLS-REFERENCE.md).
- **Guides**: `spec-workflow-guide`, `steering-guide`, `decomposition-guide`
- **Status**: `spec-status`
- **Approval**: `approvals` (request / status / delete)
- **Review** (fork): `adversarial-review`, `adversarial-response`, `review-task`, `get-task-review`
- **Bookkeeping** (fork): `deferrals`, `log-implementation`

### File Organization
```
.spec-workflow/
├── specs/                # Specification documents (+ per-spec reviews/)
├── steering/             # Project guidance documents
├── spec-decomposition/   # Project-level spec breakdown + generated INDEX.md roadmap
├── templates/            # Built-in document templates
├── user-templates/       # Optional custom template overrides
├── approvals/            # Approval workflow data (grouped by category)
└── archive/              # Archived specifications
```

### Workflow Phases
1. **(Steering)** → 2. **Decomposition** → 3. **Requirements** → 4. **Design** →
   5. **Tasks** → 6. **Implementation**

Each document requires approval before proceeding to the next.

## 🔧 Development Workflow

### Adding a New MCP Tool
1. Create tool file in `src/tools/`
2. Export tool definition and handler
3. Register in `src/tools/index.ts`
4. Update API documentation
5. Add tests

### Dashboard Development
```bash
# Start dashboard in development mode
npm run dev:dashboard

# Build dashboard assets
npm run build:dashboard
```

### VSCode Extension Development
```bash
cd vscode-extension
npm install
npm run compile
# Press F5 in VSCode to launch extension host
```

## 📚 Documentation Standards

- **Code Examples**: Always include working examples
- **Error Handling**: Document expected error conditions
- **Performance**: Note any performance considerations
- **Security**: Highlight security implications
- **Breaking Changes**: Mark breaking changes clearly

## 🤝 Getting Help

1. **Check the [Troubleshooting Guide](troubleshooting.md)** first
2. **Search existing [GitHub Issues](https://github.com/madmatt112/spec-workflow-mcp/issues)**
3. **Create a new issue** with detailed reproduction steps
4. **Join the community** for real-time support

---

## 📊 Technical Architecture Summary

### Pure MCP Server Design
This project implements a **pure Model Context Protocol (MCP) server** that:

| Aspect | Implementation | Details |
|--------|---------------|----------|
| **AI Integration** | Pure MCP server | Leverages connected LLM's built-in capabilities |
| **Web Research** | LLM built-in capability | LLM performs web search using its built-in features |
| **Context Management** | File-based structure | No LLM context window management |
| **Content Generation** | LLM-powered with templates | LLM fills templates using built-in knowledge & search |
| **Planning Process** | LLM reasoning + workflow validation | LLM plans content, MCP enforces structure |
| **Review System** | Human approval + optional AI review | Adversarial & task review; human approves in dashboard/VS Code |
| **Best Practices** | LLM built-in knowledge | LLM applies best practices from its training |
| **External Calls** | NPM version check; optional review CLI subprocess | Dashboard may spawn a local LLM CLI for background reviews |

### Key Files & Implementation
- **MCP Tools**: `src/tools/*.ts` - 11 registered tools (see `src/tools/index.ts`)
- **Templates**: `src/markdown/templates/*.md` - Static document structures  
- **Approval System**: `src/dashboard/approval-storage.ts` - Human approval records
- **Review Runners**: `src/dashboard/adversarial-runner.ts`, `task-review-runner.ts` - Background AI review
- **Context Loading**: `src/core/*.ts` - File-based context structuring
- **Web Dashboard**: `src/dashboard_frontend/` - React-based approval UI

### Performance Characteristics
- **Memory Usage**: 50KB templates + 10-100KB per spec context
- **File System**: Local `.spec-workflow/` directory only
- **Network**: Localhost dashboard + NPM version check
- **Scaling**: Linear per project, 50-100 specs recommended
- **Security**: Local-only, no external data transmission

## 📊 Market Analysis & Strategic Insights

### Competitive Landscape Analysis

**Category 1: Autonomous AI Agents (e.g., AutoGPT, LangChain Agents)**
```typescript
interface AutonomousAgents {
  capabilities: {
    webScraping: "Advanced - Custom scrapers, API integrations";
    aiCalls: "Multiple models, specialized AI services";
    automation: "Fully autonomous operation";
    integrations: "Extensive third-party ecosystem";
  };
  
  limitations: {
    humanOversight: "Limited or optional";
    reliability: "Can go off-track or produce errors";
    complexity: "Complex setup, API management";
    cost: "High due to multiple AI calls";
  };
  
  differentiator: "Full automation vs structured human-guided workflow";
}
```

**Category 2: Development Workflow Tools (e.g., GitHub Copilot, Cursor)**
```typescript
interface DevelopmentTools {
  capabilities: {
    codeGeneration: "Excellent within editors";
    contextAwareness: "Good for code context";
    realTimeAssistance: "Integrated development support";
    aiPowered: "Built-in LLM capabilities";
  };
  
  limitations: {
    workflowStructure: "Limited structured spec processes";
    documentationFocus: "Code-centric, not spec-driven";
    approvalProcess: "No formal review workflows";
    projectPlanning: "Limited high-level planning";
  };
  
  differentiator: "Code-first vs spec-driven development approach";
}
```

**Category 3: Project Management + AI (e.g., Notion AI, Linear)**
```typescript
interface ProjectManagementAI {
  capabilities: {
    projectTracking: "Excellent project organization";
    collaboration: "Team coordination features";
    aiAssistance: "AI-powered content generation";
    integration: "Extensive third-party connections";
  };
  
  limitations: {
    technicalDepth: "Limited technical specification focus";
    workflowEnforcement: "Flexible but not enforced";
    developerWorkflow: "Not developer-workflow optimized";
    codeIntegration: "Limited code context understanding";
  };
  
  differentiator: "General project management vs developer-specific workflows";
}
```

### Strategic Market Position

**Spec-Workflow-MCP's Unique Position:**
```typescript
interface MarketPosition {
  blueOcean: {
    category: "LLM-Enhanced Structured Development Workflows";
    uniqueValue: "Human-supervised LLM intelligence with enforced spec-driven process";
    targetUser: "Development teams needing structured processes with AI assistance";
  };
  
  competitiveAdvantages: {
    llmLeverage: "Full LLM power without additional API costs";
    humanOversight: "Prevents AI errors through mandatory approval";
    structuredProcess: "Enforces proven development methodology";
    simplicity: "No complex setup or API key management";
    realTimeUI: "Superior user experience with dashboard";
  };
  
  marketOpportunities: {
    enterpriseAdoption: "Companies wanting AI benefits with human control";
    consultingFirms: "Standardized processes across client projects";
    startups: "Structured development without overhead";
    education: "Teaching proper development workflows";
  };
}
```

### Expansion Strategy Insights

**Phase 1: Leverage Core Strengths**
```typescript
interface Phase1Strategy {
  buildOnStrengths: {
    enhanceHumanOversight: "Advanced approval workflows, review templates";
    improveStructure: "Dynamic templates, adaptive workflows";
    expandLLMUsage: "Better context utilization, smarter suggestions";
  };
  
  addressGaps: {
    basicIntegrations: "GitHub, GitLab, Bitbucket connections";
    qualityGates: "Optional automated checks before human review";
    teamFeatures: "Multi-developer coordination";
  };
}
```

**Phase 2: Strategic Differentiation**
```typescript
interface Phase2Strategy {
  uniqueCapabilities: {
    hybridIntelligence: "Best of LLM automation + human oversight";
    contextMastery: "Superior project context understanding";
    processExcellence: "Industry-leading structured workflows";
  };
  
  competitiveFeatures: {
    multiModelSupport: "Support multiple LLM providers";
    enterpriseFeatures: "SSO, compliance, audit trails";
    aiOrchestration: "Multi-agent coordination while maintaining oversight";
  };
}
```

### Strategic Recommendations for Creators

**Immediate Opportunities (0-6 months):**
1. **GitHub Integration**: Leverage LLM to create PRs, analyze codebases
2. **Quality Templates**: Add project-type detection for smarter templates  
3. **Team Coordination**: Multi-developer approval workflows
4. **Performance Analytics**: Track spec-to-delivery success rates

**Medium-term Differentiators (6-18 months):**
1. **Hybrid AI Workflows**: Optional automated gates with human oversight
2. **Enterprise Dashboard**: Multi-project management interface
3. **Advanced Integrations**: Jira, Slack, Confluence, CI/CD pipelines
4. **Predictive Analytics**: Project risk analysis using LLM insights

**Long-term Vision (18+ months):**
1. **AI Orchestration Platform**: Multi-agent coordination with human oversight
2. **Industry Templates**: Specialized workflows for different domains
3. **Compliance Integration**: SOX, GDPR, HIPAA workflow templates
4. **Educational Platform**: Teaching structured development at scale

### Market Validation Insights

**This analysis reveals that Spec-Workflow-MCP occupies a unique market position:**
- ✅ **Underserved Market**: Structured development workflows with AI enhancement
- ✅ **Clear Differentiation**: Human oversight + LLM power combination
- ✅ **Expansion Potential**: Multiple clear paths for feature enhancement
- ✅ **Strategic Moat**: Proven workflow methodology that competitors would struggle to replicate

Part of the @madmatt112org/spec-workflow-mcp fork documentation.