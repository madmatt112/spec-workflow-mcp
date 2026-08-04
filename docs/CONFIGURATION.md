# Configuration Guide

This guide covers all configuration options for Spec Workflow MCP.

## Command-Line Options

### Basic Usage

```bash
npx -y @madmatt112org/spec-workflow-mcp@latest [project-path] [options]
```

### Available Options

| Option | Description | Example |
|--------|-------------|---------|
| `--help` | Show comprehensive usage information | `npx -y @madmatt112org/spec-workflow-mcp@latest --help` |
| `--dashboard` | Run dashboard-only mode (default port: 5000) | `npx -y @madmatt112org/spec-workflow-mcp@latest --dashboard` |
| `--port <number>` | Specify custom dashboard port (1024-65535) | `npx -y @madmatt112org/spec-workflow-mcp@latest --dashboard --port 8080` |
| `--no-open` | Don't auto-open browser when starting dashboard | `npx -y @madmatt112org/spec-workflow-mcp@latest --dashboard --no-open` |
| `--no-shared-worktree-specs` | Disable shared `.spec-workflow` in git worktrees (use workspace-local instead) | `npx -y @madmatt112org/spec-workflow-mcp@latest ~/worktree --no-shared-worktree-specs` |
| `--no-workspace-inference` | Don't infer the workspace from the launch directory; use the path argument's git top-level | `npx -y @madmatt112org/spec-workflow-mcp@latest ~/myproject --no-workspace-inference` |

### Important Notes

- **Single Dashboard Instance**: Only one dashboard runs at a time. All MCP servers connect to the same dashboard.
- **Default Port**: Dashboard uses port 5000 by default. Use `--port` only if 5000 is unavailable.
- **Separate Dashboard**: Always run the dashboard separately from MCP servers.
- **Boolean flags take no value.** `--dashboard`, `--help` / `-h`, `--no-open`, `--no-shared-worktree-specs` and `--no-workspace-inference` are rejected with an error if written as `--flag=value`. Pass them bare. Only `--port` accepts both `--port 3456` and `--port=3456`.

## Usage Examples

### Typical Workflow

1. **Start the Dashboard** (do this first, only once):
```bash
# Uses default port 5000
npx -y @madmatt112org/spec-workflow-mcp@latest --dashboard
```

2. **Start MCP Servers** (one per project, in separate terminals):
```bash
# Project 1
npx -y @madmatt112org/spec-workflow-mcp@latest ~/projects/app1

# Project 2
npx -y @madmatt112org/spec-workflow-mcp@latest ~/projects/app2

# Project 3
npx -y @madmatt112org/spec-workflow-mcp@latest ~/projects/app3
```

All projects will appear in the dashboard at http://localhost:5000

### Dashboard with Custom Port

Only use a custom port if port 5000 is unavailable:

```bash
# Start dashboard on port 8080
npx -y @madmatt112org/spec-workflow-mcp@latest --dashboard --port 8080
```

## Environment Variables

### SPEC_WORKFLOW_HOME

Override the default global state directory (`~/.spec-workflow-mcp`). This is useful for sandboxed environments where `$HOME` is read-only.

| Variable | Default | Description |
|----------|---------|-------------|
| `SPEC_WORKFLOW_HOME` | `~/.spec-workflow-mcp` | Directory for global state files |

**Files stored in this directory:**
- `activeProjects.json` - Project registry
- `activeSession.json` - Dashboard session info
- `settings.json` - Global settings
- `job-execution-history.json` - Job execution history
- `migration.log` - Implementation log migration tracking

**Usage examples:**

```bash
# Absolute path
SPEC_WORKFLOW_HOME=/workspace/.spec-workflow-mcp npx -y @madmatt112org/spec-workflow-mcp@latest /workspace

# Relative path (resolved against current working directory)
SPEC_WORKFLOW_HOME=./.spec-workflow-mcp npx -y @madmatt112org/spec-workflow-mcp@latest .

# For dashboard mode
SPEC_WORKFLOW_HOME=/workspace/.spec-workflow-mcp npx -y @madmatt112org/spec-workflow-mcp@latest --dashboard
```

**Sandboxed environments (e.g., Codex CLI):**

When running in sandboxed environments like Codex CLI with `sandbox_mode=workspace-write`, set `SPEC_WORKFLOW_HOME` to a writable location within your workspace:

```bash
SPEC_WORKFLOW_HOME=/workspace/.spec-workflow-mcp npx -y @madmatt112org/spec-workflow-mcp@latest /workspace
```

> **Multi-worktree use requires an absolute value.** A relative `SPEC_WORKFLOW_HOME` is resolved against `process.cwd()`, and each worktree's MCP server runs from its own worktree. A relative value therefore gives every worktree a private project registry and the dashboard — which resolves the same relative value against *its* working directory — sees none of them. Relative values remain supported for the single-checkout case; they are unsupported when more than one worktree of a repository is running at once.

### SPEC_WORKFLOW_WORKSPACE

Set the **workspace path** explicitly: the checkout whose code is diffed, typechecked and handed to spawned review agents. This is the top of the workspace precedence ladder and overrides inference.

| Variable | Default | Description |
|----------|---------|-------------|
| `SPEC_WORKFLOW_WORKSPACE` | (inferred) | Explicit workspace path, overriding inference |

```bash
SPEC_WORKFLOW_WORKSPACE=/home/user/myproject-feature npx -y @madmatt112org/spec-workflow-mcp@latest /home/user/myproject
```

Behaviour:

- The value must name an **existing directory**. If it does not, the server logs a warning, ignores the value, and falls through to inference rather than aborting startup.
- If it names a directory in a **different repository** from the path argument, the server warns and uses it anyway — specs then come from one project while git, typechecks and spawned agents run in another.
- It is **ignored in `--dashboard` mode**, which has no workspace of its own.
- It is set automatically on the agents the dashboard spawns, so a review agent always runs in the workspace its job named. You do not need to set it for that case.

### SPEC_WORKFLOW_SHARED_ROOT

Override the automatic git worktree detection. By default, when running in a git worktree, specs are stored in the main repository's `.spec-workflow/` directory so all worktrees share the same specs.

| Variable | Default | Description |
|----------|---------|-------------|
| `SPEC_WORKFLOW_SHARED_ROOT` | (auto-detected) | Override the project root for spec storage |

**Automatic behavior (no env var set):**

- **Main git repo**: Specs stored in `<project>/.spec-workflow/`
- **Git worktree**: Specs stored in `<main-repo>/.spec-workflow/` (shared with all worktrees)
- **Non-git directory**: Specs stored in `<project>/.spec-workflow/`

**When to use this variable:**

Use `SPEC_WORKFLOW_SHARED_ROOT` to override the automatic detection:

```bash
# Force specs to be stored in the current worktree (opt-out of sharing)
SPEC_WORKFLOW_SHARED_ROOT=$(pwd) npx -y @madmatt112org/spec-workflow-mcp@latest .

# Force a specific shared location
SPEC_WORKFLOW_SHARED_ROOT=/path/to/shared/specs npx -y @madmatt112org/spec-workflow-mcp@latest ~/my-worktree
```

Notes:

- A **relative** value is resolved to absolute against the working directory before use. Every `.spec-workflow` path derived from it would otherwise be re-resolved against whatever directory a later call happened to run in.
- It **outranks `--no-shared-worktree-specs`**. If both are given, the environment variable wins and the flag has no effect. See [Configuration Precedence](#workspace-and-workflow-root-precedence).

**Git worktree example:**

```bash
# In main repo: /home/user/myproject
git worktree add -b feature-branch ../myproject-feature

# Start MCP server in worktree - specs automatically shared with main repo
cd ../myproject-feature
npx -y @madmatt112org/spec-workflow-mcp@latest .
# Output: Git worktree detected.
#         workspacePath=/home/user/myproject-feature
#         workflowRootPath=/home/user/myproject

# Both the main repo and worktree see the same specs in /home/user/myproject/.spec-workflow/
```

## Git Worktree Configuration

Git worktrees are fully supported. The server tracks **two roots**, and understanding the split is most of what there is to know:

| Root | What lives there | Typical value in a worktree |
|------|------------------|-----------------------------|
| **Workspace path** | Code. The `git diff`, the `tsc --noEmit`, the resolution of file paths recorded in implementation logs, and the working directory of every spawned review agent. | The worktree |
| **Workflow root** | `.spec-workflow/` — specs, steering documents, approvals, implementation logs, settings, the typecheck cache directory. | The main checkout, shared by every worktree |

In the single-checkout case the two are the same directory and nothing below changes anything you already do.

### Setting Up a Worktree

The path argument in your MCP client configuration usually comes from a tracked file — `.mcp.json` is committed to git and is byte-identical in every worktree — so it names the main checkout no matter which worktree the agent is working in. The server therefore infers the workspace from the **directory the server was launched in**:

```bash
# Main repo at /home/user/myproject, worktree at /home/user/myproject-feature
git worktree add -b feature-branch ../myproject-feature
cd ../myproject-feature

# Launched from the worktree; the path argument names the main checkout
npx -y @madmatt112org/spec-workflow-mcp@latest /home/user/myproject
```

The server reports the outcome on stderr, once, after the roots settle:

```
Workspace inferred from the working directory. Pass --no-workspace-inference to disable.
workspacePath=/home/user/myproject-feature
workflowRootPath=/home/user/myproject
```

No configuration is required for this. A stock `.mcp.json` committed to the repository gives every worktree the correct workspace, because the only thing distinguishing one worktree's agent from another's is where it is standing.

Inference fires only when **all** of the following hold, and silently does nothing otherwise:

- The launch directory and the path argument are both inside a git work tree (`git rev-parse --show-toplevel` succeeds for both — a bare repository or a path inside a `.git` directory does not qualify).
- Their top-level directories **differ**.
- They are the **same repository** — git common directories compared directly, so a submodule is not "the same repository" as its superproject.

The inferred path is then validated as a usable project directory; if that fails, the server logs and falls back to the path argument's git top-level.

### Turning Inference Off

Use `--no-workspace-inference` when the launch directory is not the checkout you want reviewed — a wrapper script that `cd`s somewhere else, a scheduler that starts servers from a fixed directory, or any setup where the path argument is the authority:

```bash
npx -y @madmatt112org/spec-workflow-mcp@latest ~/myproject --no-workspace-inference
# Output: Workspace inference disabled. Using the project path argument.
#         workspacePath=/home/user/myproject
#         workflowRootPath=/home/user/myproject
```

The workspace then becomes the **git top-level of the path argument**, not the raw argument: passing a subdirectory of a repository resolves up to the repository root.

To pin the workspace to a specific directory instead of merely disabling inference, set [`SPEC_WORKFLOW_WORKSPACE`](#spec_workflow_workspace); it outranks inference and does not need the flag.

### Workspace and Workflow Root Precedence

**Workspace path** — first match wins:

1. `SPEC_WORKFLOW_WORKSPACE`, if it names an existing directory (ignored in `--dashboard` mode)
2. `--no-workspace-inference` → skip to 4
3. Inference from the launch directory, subject to the three conditions above (skipped in `--dashboard` mode)
4. The git top-level of the path argument

**Workflow root** — first match wins:

1. `SPEC_WORKFLOW_SHARED_ROOT`, resolved to absolute
2. `--no-shared-worktree-specs` → the resolved workspace path from above
3. The git root of the path argument (the main checkout, for a worktree)

### Default Mode: Shared Specs

By default, all worktrees of a repository share the same `.spec-workflow/` directory (stored in the main repo). However, each worktree registers as its own project in the dashboard with a distinct identity.

**Dashboard behavior:**
- Each worktree appears as a separate project in the project dropdown
- Project names show `repo · worktree` format (e.g., `myproject · feature-auth`)
- Approval file resolution prioritizes the worktree path, then falls back to shared workflow root

The **directory you launch from** decides which worktree you get, so each example below states it:

```bash
# Main repo, launched from the main checkout
cd ~/myproject
npx -y @madmatt112org/spec-workflow-mcp@latest ~/myproject
# Output: workspacePath=/home/user/myproject
#         workflowRootPath=/home/user/myproject
# Dashboard shows: "myproject"

# Worktree, launched from the worktree
cd ~/myproject-feature
npx -y @madmatt112org/spec-workflow-mcp@latest ~/myproject
# Output: Workspace inferred from the working directory. Pass --no-workspace-inference to disable.
#         workspacePath=/home/user/myproject-feature
#         workflowRootPath=/home/user/myproject
# Dashboard shows: "myproject · myproject-feature"
# Specs are shared from ~/myproject/.spec-workflow/
```

The second example's `cd` is what produces the worktree entry, not its path argument. Run the same command from `~/myproject` with `~/myproject-feature` as the argument and inference resolves the workspace to `~/myproject`: both roots become the main checkout and the dashboard shows `myproject`.

### Isolated Mode: Workspace-Local Specs

Use `--no-shared-worktree-specs` when you want each worktree to have its own independent `.spec-workflow/` directory:

```bash
# Launched from the worktree, with the worktree as the path argument
cd ~/myproject-feature
npx -y @madmatt112org/spec-workflow-mcp@latest ~/myproject-feature --no-shared-worktree-specs
# Output: Shared worktree specs disabled. Using workspace-local .spec-workflow.
#         workspacePath=/home/user/myproject-feature
#         workflowRootPath=/home/user/myproject-feature
# Specs stored in ~/myproject-feature/.spec-workflow/
```

The flag stores specs under the **resolved workspace**, so the launch directory decides where they land. Running this from `~/myproject` instead would infer `~/myproject` as the workspace and store the specs in `~/myproject/.spec-workflow/` — the opposite of what the flag was reached for.

**When to use isolated mode:**
- Different worktrees have completely different feature scopes
- You want to experiment with specs without affecting other worktrees
- Team members working on different worktrees need independent spec histories

The flag applies to whichever workspace was resolved, including an inferred one. `SPEC_WORKFLOW_SHARED_ROOT` outranks it: if both are set, the environment variable decides and the flag does nothing.

**Comparison:**

| Aspect | Default (Shared) | `--no-shared-worktree-specs` |
|--------|------------------|------------------------------|
| `.spec-workflow/` location | Main repo | Each worktree |
| Specs visible across worktrees | Yes | No |
| Dashboard project identity | Separate per worktree | Separate per worktree |
| Approval file resolution | Worktree → Main repo | Worktree only |

### Known Limitation: A Worktree Missing from the Dashboard

Starting two worktree servers at the same moment can leave one of them out of the dashboard's project dropdown. The dashboard watches `activeProjects.json` by path, while each registration writes a new file and renames it over that path — so two registrations landing close together can deliver only one change event.

Only the dashboard's live view is affected. The registry file itself is correct and contains both entries.

**Recovery:** restart the dashboard. It re-reads the registry on startup, so every registered worktree reappears. Staggering the two server starts avoids it in the first place.

### Typechecking in a Worktree

The `review-task` typecheck resolves its compiler from `<workspace>/node_modules/.bin/tsc` and compiles the workspace's own `tsconfig.json`. A **freshly created worktree has no `node_modules`**, so the typecheck reports `tsc-not-found` and returns no signal until you install dependencies in it:

```bash
cd ~/myproject-feature && npm install
```

The incremental build-info cache lives on the shared workflow root under `.spec-workflow/.cache/`, with one file per workspace (`tsc-<hash>.tsbuildinfo`), so worktrees do not overwrite each other's cache.

### Environment Inherited by git

The server removes `GIT_DIR`, `GIT_COMMON_DIR`, `GIT_WORK_TREE` and `GIT_INDEX_FILE` from the environment of every git command it runs and every agent it spawns. These variables are reachable from a git hook, from `git rebase --exec`, and from any parent process that exported them; left in place they make git report the same repository from unrelated directories, which silently sends a review's diff to the wrong tree.

This changes the `git --git-dir=$HOME/.dotfiles --work-tree=$HOME` dotfiles pattern, where the exported variables *are* the configuration. Under this server, resolution sees the directory's own repository instead. That is the intended answer here.

## Dashboard Session Management

The dashboard stores its session information in `~/.spec-workflow-mcp/activeSession.json` (or `$SPEC_WORKFLOW_HOME/activeSession.json` if set). This file:
- Enforces single dashboard instance
- Allows MCP servers to discover the running dashboard
- Automatically cleans up when dashboard stops

### Single Instance Enforcement

Only one dashboard can run at any time. If you try to start a second dashboard:

```
Dashboard is already running at: http://localhost:5000

You can:
  1. Use the existing dashboard at: http://localhost:5000
  2. Stop it first (Ctrl+C or kill PID), then start a new one

Note: Only one dashboard instance is needed for all your projects.
```

## Port Management

**Default Port**: 5000
**Custom Port**: Use `--port <number>` only if port 5000 is unavailable

### Port Conflicts

If port 5000 is already in use by another service:

```bash
Failed to start dashboard: Port 5000 is already in use.

This might be another service using port 5000.
To use a different port:
  spec-workflow-mcp --dashboard --port 8080
```

## Configuration File (Deprecated)

### Default Location

The server looks for configuration at: `<project-dir>/.spec-workflow/config.toml`

### File Format

Configuration uses TOML format. Here's a complete example:

```toml
# Project directory (defaults to current directory)
projectDir = "/path/to/your/project"

# Dashboard port (1024-65535)
port = 3456

# Run dashboard-only mode
dashboardOnly = false

# Interface language
# Options: en, ja, zh, es, pt, de, fr, ru, it, ko, ar
lang = "en"

# Sound notifications (VSCode extension only)
[notifications]
enabled = true
volume = 0.5

# Advanced settings
[advanced]
# WebSocket reconnection attempts
maxReconnectAttempts = 10

# File watcher settings
[watcher]
enabled = true
debounceMs = 300
```

### Configuration Options

#### Basic Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectDir` | string | Current directory | Project directory path |
| `port` | number | Ephemeral | Dashboard port (1024-65535) |
| `dashboardOnly` | boolean | false | Run dashboard without MCP server |
| `lang` | string | "en" | Interface language |

> **Note**: The `autoStartDashboard` option was removed in v2.0.0. The dashboard now uses a unified multi-project mode accessible via `--dashboard` flag.

#### Language Options

- `en` - English
- `ja` - Japanese (日本語)
- `zh` - Chinese (中文)
- `es` - Spanish (Español)
- `pt` - Portuguese (Português)
- `de` - German (Deutsch)
- `fr` - French (Français)
- `ru` - Russian (Русский)
- `it` - Italian (Italiano)
- `ko` - Korean (한국어)
- `ar` - Arabic (العربية)

### Creating a Custom Configuration

1. Copy the example configuration:
```bash
cp .spec-workflow/config.example.toml .spec-workflow/config.toml
```

2. Edit the configuration:
```toml
# My project configuration
projectDir = "/Users/myname/projects/myapp"
port = 3000
lang = "en"
```

3. Use the configuration:
```bash
# Uses .spec-workflow/config.toml automatically
npx -y @madmatt112org/spec-workflow-mcp@latest

# Or specify explicitly
npx -y @madmatt112org/spec-workflow-mcp@latest --config .spec-workflow/config.toml
```

## Configuration Precedence

Configuration values are applied in this order (highest to lowest priority):

1. **Command-line arguments** - Always take precedence
2. **Custom config file** - Specified with `--config`
3. **Default config file** - `.spec-workflow/config.toml`
4. **Built-in defaults** - Fallback values

### Example Precedence

```toml
# config.toml
port = 3000
```

```bash
# Command-line argument overrides config file
npx -y @madmatt112org/spec-workflow-mcp@latest --config config.toml --port 4000
# Result: port = 4000 (CLI wins)
```

## Environment-Specific Configurations

### Development Configuration

```toml
# dev-config.toml
projectDir = "./src"
port = 3000
lang = "en"

[advanced]
debugMode = true
verboseLogging = true
```

Usage:
```bash
npx -y @madmatt112org/spec-workflow-mcp@latest --config dev-config.toml
```

### Production Configuration

```toml
# prod-config.toml
projectDir = "/var/app"
port = 8080
lang = "en"

[advanced]
debugMode = false
verboseLogging = false
```

Usage:
```bash
npx -y @madmatt112org/spec-workflow-mcp@latest --config prod-config.toml
```

## Port Configuration

### Valid Port Range

Ports must be between 1024 and 65535.

### Ephemeral Ports

When no port is specified, the system automatically selects an available ephemeral port. This is recommended for:
- Development environments
- Multiple simultaneous projects
- Avoiding port conflicts

### Fixed Ports

Use fixed ports when you need:
- Consistent URLs for bookmarking
- Integration with other tools
- Team collaboration with shared configurations

### Port Conflict Resolution

If a port is already in use:

1. **Check what's using the port:**
   - Windows: `netstat -an | findstr :3000`
   - macOS/Linux: `lsof -i :3000`

2. **Solutions:**
   - Use a different port: `--port 3001`
   - Kill the process using the port
   - Omit `--port` to use an ephemeral port

## Multi-Project Setup

### Separate Configurations

Create project-specific configurations:

```bash
# Project A
project-a/
  .spec-workflow/
    config.toml  # port = 3000

# Project B
project-b/
  .spec-workflow/
    config.toml  # port = 3001
```

### Shared Configuration

Use a shared configuration with overrides:

```bash
# Shared base config
~/configs/spec-workflow-base.toml

# Project-specific overrides
npx -y @madmatt112org/spec-workflow-mcp@latest \
  --config ~/configs/spec-workflow-base.toml \
  --port 3000 \
  /path/to/project-a
```

## VSCode Extension Configuration

The VSCode extension has its own settings:

1. Open VSCode Settings (Cmd/Ctrl + ,)
2. Search for "Spec Workflow"
3. Configure:
   - Language preference
   - Sound notifications
   - Archive visibility
   - Auto-refresh interval

## Troubleshooting Configuration

### Configuration Not Loading

1. **Check file location:**
   ```bash
   ls -la .spec-workflow/config.toml
   ```

2. **Validate TOML syntax:**
   ```bash
   # Install toml CLI tool
   npm install -g @iarna/toml

   # Validate
   toml .spec-workflow/config.toml
   ```

3. **Check permissions:**
   ```bash
   # Ensure file is readable
   chmod 644 .spec-workflow/config.toml
   ```

### Common Issues

| Issue | Solution |
|-------|----------|
| Port already in use | Use different port or omit for ephemeral |
| Config file not found | Check path and use absolute path if needed |
| Invalid TOML syntax | Validate with TOML linter |
| Settings not applying | Check configuration precedence |

## Adversarial Review Settings

Adversarial review settings are stored per-project in `.spec-workflow/adversarial-settings.json`. These can be edited through the **Adversarial Analysis > Settings** tab in the dashboard or directly in the file.

### Settings File

This is the shape the dashboard **Adversarial Analysis > Settings** tab reads and
writes (see `src/dashboard/multi-server.ts`):

```json
{
  "customPreamble": "",
  "requiredPhases": {
    "requirements": false,
    "design": false,
    "tasks": false
  },
  "reviewMethodology": "",
  "responseMethodology": "",
  "model": "",
  "cli": "",
  "cliArgs": []
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `customPreamble` | string | "" | Additional context prepended to review prompts |
| `requiredPhases` | object | All false | Enforce adversarial review before approval per phase (`requirements`, `design`, `tasks`) |
| `reviewMethodology` | string | Built-in | Override the methodology returned by `adversarial-review` (top-level key, read by the tool) |
| `responseMethodology` | string | Built-in | Override the methodology returned by `adversarial-response` |
| `model` | string | "" | Model for background reviews: `"sonnet"`, `"opus"`, `"haiku"`, or a full model ID. Empty uses the CLI default |
| `cli` | string | `"claude"` | CLI executable for background reviews. Any LLM CLI that accepts a prompt as the final argument |
| `cliArgs` | string[] | `["--print", "--dangerously-skip-permissions"]` | Base arguments passed to the CLI before the prompt |

### Advanced: per-runner overrides

Beyond the dashboard-managed keys above, the settings loader
(`src/core/adversarial-settings.ts`) supports **hand-edited** per-runner overrides.
These are not exposed in the dashboard UI but take precedence over the flat `model`
when present:

```json
{
  "adversarial": { "model": "opus" },
  "taskReview":  { "model": "sonnet" },
  "features":    { "typecheck": true }
}
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `adversarial.model` | string | falls back to `model` | Model used specifically for adversarial document reviews |
| `taskReview.model` | string | falls back to `model` | Model used specifically for task (code) reviews |
| `features.typecheck` | boolean | `true` | Whether `review-task action: prepare` runs a `tsc --noEmit` typecheck signal |

The model precedence ladder (per-runner override > legacy top-level `model` >
unset), empty-string-clears-override semantics, and retry behavior are documented in
the [README's "Reviewer Configuration" section](../README.md).

### Agent CLI

The dashboard's one-click adversarial review spawns a background CLI process to run the review. By default it uses the Claude CLI (`claude --print --dangerously-skip-permissions`), but you can configure any LLM CLI that accepts a prompt as its final argument. The CLI must be able to read files from the project directory and write markdown output.

Example for a different CLI:
```json
{
  "cli": "my-llm-cli",
  "cliArgs": ["--non-interactive", "--output-format", "markdown"]
}
```

Note: The MCP tools (`adversarial-review`, `adversarial-response`) are LLM-agnostic and work with any agent. The CLI setting only affects background reviews triggered from the dashboard.

### Required Phases

When a phase is marked as required, the dashboard will prevent approval of that phase's document until an adversarial review has been completed. This is useful for enforcing quality gates on critical phases.

## Best Practices

1. **Use version control** for configuration files
2. **Document custom settings** in your project README
3. **Use ephemeral ports** in development
4. **Keep sensitive data** out of configuration files
5. **Create environment-specific** configurations
6. **Test configuration changes** before deploying

## Related Documentation

- [User Guide](USER-GUIDE.md) - Using the configured server
- [Interfaces Guide](INTERFACES.md) - Dashboard and extension settings
- [Troubleshooting](TROUBLESHOOTING.md) - Common configuration issues