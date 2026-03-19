**Title:** feat: add deferred decisions tracker

---

## Summary

Adds project-level tracking for decisions explicitly deferred during spec work. Deferrals get a dedicated MCP tool, file-based storage, and read-only dashboard API — making them discoverable across specs without re-reading every design document.

## Problem

Deferred decisions currently get embedded inline in design documents, making them invisible to future specs and unqueryable. A team starting a new spec has no way to discover what was punted from prior work without manually searching through every design doc. This feature gives deferrals a persistent, structured home outside any single spec.

## Changes

### MCP Tool

**`deferrals`** — Single tool with action-based dispatch (same pattern as `approvals`).

| Action | Purpose |
|--------|---------|
| `add` | Record a new deferred decision. Optionally supersedes an existing one. |
| `list` | List deferrals, filterable by status, originSpec, or tag |
| `get` | Get full deferral details including body sections |
| `resolve` | Mark as resolved with resolution note. Validates status is `deferred`. |
| `update` | Update mutable fields (title, revisitTrigger, tags, context, decision, revisitCriteria) |
| `delete` | Remove a deferral. Fails if referenced by another deferral's supersede chain. |

### Storage (`deferral-storage.ts`)

Each deferral is a single markdown file (`d-{8-hex}.md`) with YAML frontmatter for structured fields and markdown body sections for Context, Decision Deferred, and Revisit Criteria. ID generation uses truncated UUIDs with collision checks.

**Status transitions:** `deferred → resolved` and `deferred → superseded` only. Supersede chains maintain referential integrity — deleting a referenced deferral is blocked.

### Methodology Updates (`spec-workflow-guide.ts`)

- **Phase 2 (Design)**: When deferring a design decision, record it with the `deferrals` tool
- **Phase 4 (Implementation)**: Check deferred decisions at start; resolve any that the implementation naturally covers
- **Workflow Rules**: Deferrals are project-level artifacts that persist across specs

### Dashboard API

Read-only REST endpoints for future dashboard UI consumption:
- `GET /api/projects/:projectId/deferrals` (with status/originSpec/tag query params)
- `GET /api/projects/:projectId/deferrals/:id`

## How to Review

1. **`src/types.ts`** — the `Deferral` interface. Quick read, establishes the data model
2. **`src/core/deferral-storage.ts`** — file-based storage with YAML frontmatter parsing. Self-contained
3. **`src/tools/deferrals.ts`** — MCP tool handler with action dispatch
4. **`src/dashboard/multi-server.ts`** — two simple GET routes
5. **`src/tools/spec-workflow-guide.ts`** — methodology text additions
6. **Tests** (`__tests__/`) — 35 new tests covering storage and tool handler

## Testing

- `npm run build` succeeds
- `npm test` — all tests pass (35 new covering storage + tool handler)
- MCP tool: add deferral A, list, supersede A via adding B with `supersedes`, resolve B, attempt delete A (should fail — B references it), delete B, then delete A
- Verify `.spec-workflow/deferrals/` directory created on server init
- Dashboard: GET deferrals list and single deferral endpoints return correct data
