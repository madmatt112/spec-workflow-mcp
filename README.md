# Spec Workflow MCP (madmatt112 fork)

A Model Context Protocol (MCP) server for structured spec-driven development with real-time dashboard and VSCode extension.

## Fork Notice

This is a hard fork of [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp), diverged from upstream version `2.2.6` on **2026-03-13**. It is **not tracking upstream** and will not be merged back. All issues/PRs should be filed against this repository.

The `.spec-workflow/` directory layout, tool names, config keys, and `SPEC_WORKFLOW_HOME` environment variable remain identical to upstream, so existing state from upstream `2.2.x` migrates in place.

## What This Fork Adds

Four features not present in upstream:

- **Adversarial Review** — automated oppositional review of spec documents (requirements / design / tasks / steering / decomposition). Spawns fresh-context CLI subagents (defaults to Claude CLI; configurable for any LLM CLI) to generate and execute adversarial prompts against spec content. Dashboard button, in-card progress stepper, versioning / retry, review memory for tracking prior critiques.
- **Spec Decomposition** — required workflow phase that forces task breakdown before implementation. New `decomposition-guide` tool with dashboard integration and adversarial-review eligibility.
- **Deferred Decisions Tracker** — new `deferrals` tool and dashboard UI for recording decisions that are intentionally punted during spec authoring.
- **Task Review** — new `review-task` and `get-task-review` tools that spawn a fresh-context dashboard agent to review completed task implementations before they're marked done.

## Key Features

- **Structured Development Workflow** — Sequential spec creation (Requirements → Design → Tasks) with required decomposition phase.
- **Real-Time Web Dashboard** — Monitor specs, tasks, and progress with live updates.
- **VSCode Extension** — Integrated sidebar dashboard (build-from-source for this fork; see below).
- **Approval Workflow** — Full approval process with revisions and adversarial review.
- **Task Progress Tracking** — Visual progress bars and detailed status.
- **Implementation Logs** — Searchable logs of all task implementations with code statistics.

## 🚀 Quick Start

### Step 1: Add to your AI tool

Add to your MCP configuration (see client-specific setup below):

```json
{
  "mcpServers": {
    "spec-workflow": {
      "command": "npx",
      "args": ["-y", "@madmatt112org/spec-workflow-mcp@latest", "/path/to/your/project"]
    }
  }
}
```

### Step 2: Choose your interface

**Option A: Web Dashboard** (Required for CLI users)

Start the dashboard (runs on port 5000 by default):
```bash
npx -y @madmatt112org/spec-workflow-mcp@latest --dashboard
```

The dashboard will be accessible at: http://localhost:5000

> **Note:** Only one dashboard instance is needed. All your projects will connect to the same dashboard.

**Option B: VSCode Extension** (Build from source)

The fork's extension is not yet published to the VSCode Marketplace. Build and side-install:

```bash
cd vscode-extension
npm install
npm run package    # produces a .vsix file
code --install-extension spec-workflow-mcp-<version>.vsix
```

## 📝 How to Use

Simply mention spec-workflow in your conversation:

- **"Create a spec for user authentication"** — Creates complete spec workflow
- **"List my specs"** — Shows all specs and their status
- **"Execute task 1.2 in spec user-auth"** — Runs a specific task

[See more examples →](docs/PROMPTING-GUIDE.md)

## 🔧 MCP Client Setup

<details>
<summary><strong>Augment Code</strong></summary>

Configure in your Augment settings:
```json
{
  "mcpServers": {
    "spec-workflow": {
      "command": "npx",
      "args": ["-y", "@madmatt112org/spec-workflow-mcp@latest", "/path/to/your/project"]
    }
  }
}
```
</details>

<details>
<summary><strong>Claude Code CLI</strong></summary>

Add to your MCP configuration:
```bash
claude mcp add spec-workflow npx @madmatt112org/spec-workflow-mcp@latest -- /path/to/your/project
```

**Important Notes:**
- The `-y` flag bypasses npm prompts for smoother installation
- The `--` separator ensures the path is passed to the spec-workflow script, not to npx
- Replace `/path/to/your/project` with your actual project directory path

**Alternative for Windows (if the above doesn't work):**
```bash
claude mcp add spec-workflow cmd.exe /c "npx @madmatt112org/spec-workflow-mcp@latest /path/to/your/project"
```
</details>

<details>
<summary><strong>Claude Desktop</strong></summary>

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "spec-workflow": {
      "command": "npx",
      "args": ["-y", "@madmatt112org/spec-workflow-mcp@latest", "/path/to/your/project"]
    }
  }
}
```

> **Important:** Run the dashboard separately with `--dashboard` before starting the MCP server.

</details>

<details>
<summary><strong>Cline/Claude Dev</strong></summary>

Add to your MCP server configuration:
```json
{
  "mcpServers": {
    "spec-workflow": {
      "command": "npx",
      "args": ["-y", "@madmatt112org/spec-workflow-mcp@latest", "/path/to/your/project"]
    }
  }
}
```
</details>

<details>
<summary><strong>Continue IDE Extension</strong></summary>

Add to your Continue configuration:
```json
{
  "mcpServers": {
    "spec-workflow": {
      "command": "npx",
      "args": ["-y", "@madmatt112org/spec-workflow-mcp@latest", "/path/to/your/project"]
    }
  }
}
```
</details>

<details>
<summary><strong>Cursor IDE</strong></summary>

Add to your Cursor settings (`settings.json`):
```json
{
  "mcpServers": {
    "spec-workflow": {
      "command": "npx",
      "args": ["-y", "@madmatt112org/spec-workflow-mcp@latest", "/path/to/your/project"]
    }
  }
}
```
</details>

<details>
<summary><strong>OpenCode</strong></summary>

Add to your `opencode.json` configuration file:
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "spec-workflow": {
      "type": "local",
      "command": ["npx", "-y", "@madmatt112org/spec-workflow-mcp@latest", "/path/to/your/project"],
      "enabled": true
    }
  }
}
```
</details>

<details>
<summary><strong>Windsurf</strong></summary>

Add to your `~/.codeium/windsurf/mcp_config.json` configuration file:
```json
{
  "mcpServers": {
    "spec-workflow": {
      "command": "npx",
      "args": ["-y", "@madmatt112org/spec-workflow-mcp@latest", "/path/to/your/project"]
    }
  }
}
```
</details>

<details>
<summary><strong>Codex</strong></summary>

Add to your `~/.codex/config.toml` configuration file:
```toml
[mcp_servers.spec-workflow]
command = "npx"
args = ["-y", "@madmatt112org/spec-workflow-mcp@latest", "/path/to/your/project"]
```
</details>

## 🐳 Docker Deployment

Run the dashboard in a Docker container for isolated deployment:

```bash
# Using Docker Compose (recommended)
cd containers
docker-compose up --build

# Or using Docker CLI
docker build -f containers/Dockerfile -t spec-workflow-mcp .
docker run -p 5000:5000 -v "./workspace/.spec-workflow:/workspace/.spec-workflow:rw" spec-workflow-mcp
```

The dashboard will be available at: http://localhost:5000

[See Docker setup guide →](containers/README.md)

## 🔒 Security

Spec-Workflow MCP includes enterprise-grade security features suitable for corporate environments:

### ✅ Implemented Security Controls

| Feature | Description |
|---------|-------------|
| **Localhost Binding** | Binds to `127.0.0.1` by default, preventing network exposure |
| **Rate Limiting** | 120 requests/minute per client with automatic cleanup |
| **Audit Logging** | Structured JSON logs with timestamp, actor, action, and result |
| **Security Headers** | X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, CSP, Referrer-Policy |
| **CORS Protection** | Restricted to localhost origins by default |
| **Docker Hardening** | Non-root user, read-only filesystem, dropped capabilities, resource limits |

### ⚠️ Not Yet Implemented

| Feature | Workaround |
|---------|------------|
| **HTTPS/TLS** | Use a reverse proxy (nginx, Apache) with TLS certificates |
| **User Authentication** | Use a reverse proxy with Basic Auth or OAuth2 Proxy for SSO |

### For External/Network Access

If you need to expose the dashboard beyond localhost, we recommend:

1. **Keep dashboard on localhost** (`127.0.0.1`)
2. **Use nginx or Apache** as a reverse proxy with:
   - TLS/HTTPS termination
   - Basic authentication or OAuth2
3. **Configure firewall rules** to restrict access

```nginx
# Example nginx reverse proxy with auth
server {
    listen 443 ssl;
    server_name dashboard.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    auth_basic "Dashboard Access";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

[See Docker security guide →](containers/README.md#security-configuration)

## 🔒 Sandboxed Environments

For sandboxed environments (e.g., Codex CLI with `sandbox_mode=workspace-write`) where `$HOME` is read-only, use the `SPEC_WORKFLOW_HOME` environment variable to redirect global state files to a writable location:

```bash
SPEC_WORKFLOW_HOME=/workspace/.spec-workflow-mcp npx -y @madmatt112org/spec-workflow-mcp@latest /workspace
```

[See Configuration Guide →](docs/CONFIGURATION.md#environment-variables)

## ⚙️ Reviewer Configuration

The dashboard's adversarial-review and task-review subagents read their per-runner configuration from `.spec-workflow/adversarial-settings.json`. This section covers the **runner/model** keys; the same file also holds dashboard-managed keys (`requiredPhases`, `customPreamble`, `reviewMethodology`, `responseMethodology`) documented in [docs/CONFIGURATION.md](docs/CONFIGURATION.md#adversarial-review-settings). The runner config uses a **grouped per-runner shape** with a legacy top-level fallback:

```json
{
  "adversarial": { "model": "claude-opus-4-7" },
  "taskReview":  { "model": "claude-haiku-4-5" },
  "features":    { "typecheck": true },
  "model":       "claude-sonnet-4-6",
  "cli":         "claude",
  "cliArgs":     ["--print", "--output-format", "stream-json", "--verbose"]
}
```

- `adversarial.model` / `taskReview.model` — per-runner model overrides. The grouped shape extends naturally for future per-runner settings (e.g. `cliArgs`) without a config migration.
- `model` — legacy top-level fallback used when a runner's per-runner override is absent. Stays valid indefinitely; there is no deprecation timeline.
- `features.typecheck` — boolean kill switch for the `tsc --noEmit` pre-computation that `review-task action: prepare` runs against TypeScript projects. Defaults to enabled; set to `false` to disable.
- `cli` / `cliArgs` — global CLI command and arguments used to spawn both runners. Per-runner overrides are not implemented in v1.

**Precedence ladder** (per-runner): per-runner override (`adversarial.model` / `taskReview.model`) > legacy top-level `model` > undefined (no `--model` flag passed; CLI default applies).

**Empty-string clears the override**: setting `adversarial.model: ""` or `taskReview.model: ""` is treated as "explicitly cleared" — the runner falls back to the legacy `model`, or to undefined if legacy is absent. This is the documented way to disable a per-runner override without removing the key.

### Retry behavior

When a review is retried from the dashboard, the retry runner reuses **the model the initial run was invoked with**, looked up from the prior runner job. This keeps per-review telemetry and billing consistent across the initial and retry attempts. Per-retry model overrides are intentionally not supported.

**Server-restart fallback**: if the dashboard server restarts between an initial review and its retry, the prior runner job is gone (jobs live in an in-memory map that does not persist across restarts). The retry handler falls back to re-resolving the model from current settings, logging `[spec-workflow] retry: prior job not found in runner, re-resolving model from settings` once per process. This is documented degraded behavior; persisting jobs across restarts is out of scope for v1.

Only `model` is pinned across retry; `cli` and `cliArgs` always reflect current settings, so editing `cliArgs` between an initial run and its retry causes the retry to use the edited `cliArgs` while still using the initial run's `model`.

If you upgrade the CLI binary or `claude-cli` package between an initial run and its retry AND the model name from the initial run is no longer valid (deprecated, renamed), the retry will fail inside the spawned process with the CLI's "unknown model" error — recover by clearing the prior job (trigger a fresh initial run, or restart the dashboard server to clear the in-memory job map).

### Limitations

**Concurrent prepare against the same project is unsupported in v1.** Running two `review-task action: prepare` invocations against the same project simultaneously may corrupt the typecheck buildinfo cache. Recovery: `rm <projectPath>/.spec-workflow/.cache/tsc.tsbuildinfo`.

## 📚 Documentation

- [Configuration Guide](docs/CONFIGURATION.md) - Command-line options, config files
- [User Guide](docs/USER-GUIDE.md) - Comprehensive usage examples
- [Workflow Process](docs/WORKFLOW.md) - Development workflow and best practices
- [Autonomous Usage](docs/AUTONOMOUS-USAGE.md) - Non-interactive / headless operation
- [Interfaces Guide](docs/INTERFACES.md) - Dashboard and VSCode extension details
- [Prompting Guide](docs/PROMPTING-GUIDE.md) - Advanced prompting examples
- [Tools Reference](docs/TOOLS-REFERENCE.md) - Complete tools documentation
- [Development](docs/DEVELOPMENT.md) - Contributing and development setup
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions

## 📁 Project Structure

```
your-project/
  .spec-workflow/
    approvals/
    archive/
    specs/
    steering/
    templates/
    user-templates/
    config.example.toml
```

## 🛠️ Development

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

[See development guide →](docs/DEVELOPMENT.md)

## 📦 Publishing to npm

This package publishes to npm as `@madmatt112org/spec-workflow-mcp` via a manually-dispatched GitHub Actions workflow. Three gates run before any version reaches the registry.

### Version source

`package.json` `version` is the single source of truth. There is no auto-bump. Use `npm version` (preferred) or edit `package.json` directly:

```bash
npm version patch    # 3.0.0 → 3.0.1, also creates git tag v3.0.1
npm version minor    # 3.0.0 → 3.1.0
npm version major    # 3.0.0 → 4.0.0
```

`scripts/sync-plugin-version.js` keeps the `.claude-plugin/*.json` manifest versions in sync. After bumping, run `npm run sync:plugin-version` to update the manifests; CI runs `npm run check:plugin-version` and fails if they drift.

### Publish gates

The `Publish to npm` workflow (`.github/workflows/npm-publish.yml`) runs three jobs in sequence — every step must pass before the publish job runs:

1. **`test`** — calls `ci.yml` (typecheck, build, plugin-version sync check, full vitest suite).
2. **`preflight`**:
   - **Registry uniqueness**: aborts if `package.json` version is already published.
   - **Git tag check**: requires a `v<version>` tag pointing at the exact commit being run.
3. **`publish`** — `npm publish --access public --tag <input>`.

### Publishing steps

```bash
# 1. Bump version + create matching git tag
npm version patch          # or minor / major

# 2. Push commit and tag together
git push origin main --follow-tags

# 3. Trigger the workflow
#    GitHub → Actions → "Publish to npm" → "Run workflow"
#    tag input: latest (or beta / next for pre-release routing)
```

The `tag` input controls the npm dist-tag, not the version. For a first cautious release, dispatch with `next`, then promote later:

```bash
npm dist-tag add @madmatt112org/spec-workflow-mcp@<version> latest
```

### Required secrets

Set in `Settings → Secrets and variables → Actions`:

- `NPM_TOKEN` — npm Granular Access Token with read+write on `@madmatt112org/*`. 2FA-for-publish must be enabled on the npm account.

### Common failure modes

| Error | Cause | Fix |
|---|---|---|
| `Version X.Y.Z is already published` | Forgot to bump | `npm version patch` and re-dispatch |
| `Expected git tag vX.Y.Z does not exist` | Tag missing or not pushed | `git tag v<ver> && git push origin v<ver>` |
| `Tag points at <sha> but workflow is running on <sha>` | Tag is on a different commit | Move tag (`git tag -f v<ver>`) or run from the tagged commit |
| `403 Forbidden` from `npm publish` | Token lacks scope permission, or org membership wrong | Regenerate token with `@madmatt112org/*` scope |
| `check:plugin-version` fails in CI | Manifest versions drifted | `npm run sync:plugin-version`, commit, push |

## 📄 License

GPL-3.0

## Credit

Originally forked from [Pimzino/spec-workflow-mcp](https://github.com/Pimzino/spec-workflow-mcp) at version `2.2.6`. Upstream did not respond to feature PRs, so this fork carries the work forward independently. Released under the same GPL-3.0 license as upstream.
