import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { DeferralStorage } from '../core/deferral-storage.js';
import { validateProjectPath } from '../core/path-utils.js';

export const deferralsTool: Tool = {
  name: 'deferrals',
  description: `Track decisions that are explicitly deferred during spec work.

# Instructions
Use this tool to record, query, and resolve deferred decisions. Deferrals are project-level artifacts that persist across specs.

Actions:
- 'add': Record a new deferred decision (optionally superseding an existing one). Warns if a likely-duplicate already exists.
- 'list': List deferrals with optional filters (status, originSpec, tag)
- 'get': Get full details of a specific deferral
- 'resolve': Mark a deferral as resolved
- 'update': Update mutable fields (title, revisitTrigger, tags, context, decision, revisitCriteria)
- 'merge': Fold a duplicate deferral into a canonical one (marks the duplicate superseded; preserves its context)
- 'delete': Remove a deferral (fails if referenced by another deferral)
- 'reindex': Normalize all on-disk deferral files to canonical frontmatter (repairs legacy/quoting drift)`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'list', 'get', 'resolve', 'update', 'merge', 'delete', 'reindex'],
        description: 'The action to perform'
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to the project root (optional - uses server context path if not provided)'
      },
      // add params
      title: {
        type: 'string',
        description: 'Title of the deferred decision (required for add)'
      },
      context: {
        type: 'string',
        description: 'Why this decision was deferred and what alternatives were considered (required for add)'
      },
      decision: {
        type: 'string',
        description: 'What specifically was not decided or not implemented (required for add)'
      },
      revisitTrigger: {
        type: 'string',
        description: 'Freeform description of when to revisit this decision (required for add)'
      },
      revisitCriteria: {
        type: 'string',
        description: 'What conditions should trigger revisiting this (optional for add, defaults to revisitTrigger)'
      },
      originSpec: {
        type: 'string',
        description: 'Spec that created this deferral (optional for add)'
      },
      originPhase: {
        type: 'string',
        enum: ['requirements', 'design', 'tasks', 'implementation'],
        description: 'Phase where decision was deferred (optional for add)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Freeform tags for filtering (optional for add/update)'
      },
      supersedes: {
        type: 'string',
        description: 'ID of deferral this one replaces — automatically marks old one as superseded (optional for add)'
      },
      // get/resolve/update/delete/merge params
      id: {
        type: 'string',
        description: 'Deferral ID (required for get, resolve, update, delete; the duplicate to fold for merge)'
      },
      // merge params
      into: {
        type: 'string',
        description: 'Canonical deferral ID to merge into (required for merge) — the deferral named by `id` becomes superseded by this one'
      },
      // resolve params
      resolution: {
        type: 'string',
        description: 'Brief note on how it was resolved (required for resolve)'
      },
      resolvedInSpec: {
        type: 'string',
        description: 'Spec that resolved this deferral (optional for resolve)'
      },
      // list params
      status: {
        type: 'string',
        enum: ['deferred', 'resolved', 'superseded'],
        description: 'Filter by status (optional for list, default: all statuses)'
      },
      tag: {
        type: 'string',
        description: 'Filter by tag — matches if deferral tags include this value (optional for list)'
      }
    },
    required: ['action']
  },
  annotations: {
    title: 'Deferrals',
    destructiveHint: true,
  }
};

export async function deferralsHandler(
  args: Record<string, any>,
  context: ToolContext
): Promise<ToolResponse> {
  const projectPath = args.projectPath || context.projectPath;
  if (!projectPath) {
    return { success: false, message: 'Project path is required but not provided in context or arguments' };
  }

  try {
    const validatedPath = await validateProjectPath(projectPath);
    const storage = new DeferralStorage(validatedPath);

    switch (args.action) {
      case 'add':
        return await handleAdd(args, storage);
      case 'list':
        return await handleList(args, storage);
      case 'get':
        return await handleGet(args, storage);
      case 'resolve':
        return await handleResolve(args, storage);
      case 'update':
        return await handleUpdate(args, storage);
      case 'merge':
        return await handleMerge(args, storage);
      case 'delete':
        return await handleDelete(args, storage);
      case 'reindex':
        return await handleReindex(storage);
      default:
        return { success: false, message: `Unknown action: ${args.action}. Use 'add', 'list', 'get', 'resolve', 'update', 'merge', 'delete', or 'reindex'.` };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Deferrals operation failed: ${msg}` };
  }
}

async function handleAdd(args: Record<string, any>, storage: DeferralStorage): Promise<ToolResponse> {
  if (!args.title || !args.context || !args.decision || !args.revisitTrigger) {
    return { success: false, message: 'Missing required fields for add. Required: title, context, decision, revisitTrigger' };
  }

  // Duplicate detection: only when not already explicitly superseding something.
  const duplicates = args.supersedes
    ? []
    : await storage.findDuplicates(args.title, args.originSpec || null);

  const id = await storage.create({
    title: args.title,
    originSpec: args.originSpec || null,
    originPhase: args.originPhase || null,
    revisitTrigger: args.revisitTrigger,
    tags: args.tags || [],
    supersedes: args.supersedes || null,
    body: {
      context: args.context,
      decision: args.decision,
      revisitCriteria: args.revisitCriteria || args.revisitTrigger,
    },
  }, args.supersedes);

  if (duplicates.length > 0) {
    const top = duplicates[0];
    return {
      success: true,
      message: `Deferred decision recorded: ${id}. WARNING: ${duplicates.length} likely-duplicate deferral(s) already exist for this originSpec ` +
        `(closest: ${top.id} "${top.title}"). If this is the same decision, merge it: ` +
        `deferrals merge id=${id} into=${top.id} (or delete ${id} and supersede instead).`,
      data: { id, title: args.title, duplicates },
    };
  }

  return {
    success: true,
    message: `Deferred decision recorded: ${id}`,
    data: { id, title: args.title },
  };
}

async function handleList(args: Record<string, any>, storage: DeferralStorage): Promise<ToolResponse> {
  const deferrals = await storage.list({
    status: args.status,
    originSpec: args.originSpec,
    tag: args.tag,
  });

  const summary = deferrals.map(d => ({
    id: d.id,
    status: d.status,
    title: d.title,
    originSpec: d.originSpec,
    tags: d.tags,
    revisitTrigger: d.revisitTrigger,
    createdAt: d.createdAt,
  }));

  return {
    success: true,
    message: `Found ${deferrals.length} deferral(s)`,
    data: { deferrals: summary, total: deferrals.length },
  };
}

async function handleGet(args: Record<string, any>, storage: DeferralStorage): Promise<ToolResponse> {
  if (!args.id) {
    return { success: false, message: 'Missing required field: id' };
  }

  const deferral = await storage.get(args.id);
  if (!deferral) {
    if (await storage.fileExists(args.id)) {
      return {
        success: false,
        message: `Deferral ${args.id} exists on disk but its frontmatter could not be parsed. ` +
          `Run the 'reindex' action to normalize the deferrals store, then retry.`,
      };
    }
    return { success: false, message: `Deferral ${args.id} not found` };
  }

  return {
    success: true,
    message: `Deferral ${args.id}: ${deferral.title}`,
    data: deferral,
  };
}

async function handleResolve(args: Record<string, any>, storage: DeferralStorage): Promise<ToolResponse> {
  if (!args.id || !args.resolution) {
    return { success: false, message: 'Missing required fields for resolve. Required: id, resolution' };
  }

  await storage.resolve(args.id, args.resolution, args.resolvedInSpec);

  return {
    success: true,
    message: `Deferral ${args.id} resolved`,
    data: { id: args.id, resolution: args.resolution },
  };
}

async function handleUpdate(args: Record<string, any>, storage: DeferralStorage): Promise<ToolResponse> {
  if (!args.id) {
    return { success: false, message: 'Missing required field: id' };
  }

  const updates: Record<string, any> = {};
  for (const key of ['title', 'revisitTrigger', 'tags', 'context', 'decision', 'revisitCriteria']) {
    if (args[key] !== undefined) updates[key] = args[key];
  }

  if (Object.keys(updates).length === 0) {
    return { success: false, message: 'No fields to update. Updatable: title, revisitTrigger, tags, context, decision, revisitCriteria' };
  }

  await storage.update(args.id, updates);

  return {
    success: true,
    message: `Deferral ${args.id} updated`,
    data: { id: args.id, updatedFields: Object.keys(updates) },
  };
}

async function handleMerge(args: Record<string, any>, storage: DeferralStorage): Promise<ToolResponse> {
  if (!args.id || !args.into) {
    return { success: false, message: 'Missing required fields for merge. Required: id (duplicate to fold), into (canonical deferral)' };
  }

  await storage.merge(args.id, args.into);

  return {
    success: true,
    message: `Deferral ${args.id} merged into ${args.into} (${args.id} marked superseded)`,
    data: { from: args.id, into: args.into },
  };
}

async function handleReindex(storage: DeferralStorage): Promise<ToolResponse> {
  const result = await storage.reindex();

  let message = `Reindexed ${result.total} deferral(s); ${result.rewritten} normalized.`;
  if (result.unparseable.length > 0) {
    message += ` ${result.unparseable.length} file(s) could not be parsed: ${result.unparseable.join(', ')}`;
  }

  return { success: true, message, data: result };
}

async function handleDelete(args: Record<string, any>, storage: DeferralStorage): Promise<ToolResponse> {
  if (!args.id) {
    return { success: false, message: 'Missing required field: id' };
  }

  await storage.delete(args.id);

  return {
    success: true,
    message: `Deferral ${args.id} deleted`,
    data: { id: args.id },
  };
}
