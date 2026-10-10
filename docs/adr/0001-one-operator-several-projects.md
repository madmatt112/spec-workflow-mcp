---
status: accepted
---
# The harness is built for one operator

The product started as a fork of a general spec tool (upstream 2.2.6, many MCP clients, a
VS Code extension, eleven locales, three plugins). On 2026-10-09 we decided it is built for
one operator running several projects, and carries no design weight for other users. It may
be published later if it turns out good, but nothing is kept or added for that reason.

## Consequences

- The VS Code extension, the manual-workflow tools and pages (guides, approval annotator,
  steering editor, kanban), the locales and the bundled MCP plugins are removed.
- Compatibility with the upstream `.spec-workflow` layout is no longer a constraint.
