import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ToolContext, ToolResponse } from '../types.js';
import { PathUtils } from '../core/path-utils.js';
import { IndexGenerator, IndexResult } from '../core/index-generator.js';

/** One-line summary of the routing decision, for the tool's message line. */
function describeRouting(result: IndexResult): string {
  const { state, spec, reason, warnings } = result.routing;
  const head = state === 'active' ? `${spec} — ${reason}` : `${state} — ${reason}`;
  return warnings.length > 0 ? `${head} (${warnings.length} warning(s), see data.routing.warnings)` : head;
}

export const specIndexTool: Tool = {
  name: 'spec-index',
  description: `Generate and maintain INDEX.md — the auto-generated, multi-spec roadmap.

# Instructions
INDEX.md lives at .spec-workflow/spec-decomposition/INDEX.md and is the project roadmap: every spec ordered by its first mention in decomposition.md, with status derived from each spec's documents (same derivation as spec-status). It is GENERATED, never hand-edited — regenerate it instead of editing it.

# Deciding what to work on next
Read the '## Next' section, or the 'routing' field of this tool's result. Do NOT infer the next spec from table order — '## Other specs' is sorted by directory creation time, which encodes no build intent. Branch on 'routing.state':
- 'active': work on 'routing.spec'.
- 'ambiguous': several unsequenced specs qualify and nothing declares their order. Stop and ask, or add them to decomposition.md.
- 'all-on-disk-complete': every spec on disk is Complete. This is NOT necessarily roadmap completion — check decomposition.md for a spec named there with no .spec-workflow/specs/<name>/ directory. Specs are created lazily, so the next one often does not exist yet and is invisible to this tool.
- 'all-deferred': specs exist but all are deferred. Nothing is complete.
- 'no-specs': no specs exist yet.
Any 'routing.warnings' mean the underlying task counts are unreliable — surface them rather than routing past them.

Actions:
- 'generate': (Re)write INDEX.md from current spec state. Safe to run anytime; idempotent.
- 'defer': Mark a spec as deferred — excluded from the active roadmap and shown in a Deferred section. Requires specName and reason. Regenerates INDEX.md.
- 'undefer': Clear a spec's deferred marker and return it to the active roadmap. Requires specName. Regenerates INDEX.md.

Note: this is about deferred SPECS (whole specs postponed in the build order). For deferred DECISIONS within a spec, use the separate 'deferrals' tool.`,
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['generate', 'defer', 'undefer'],
        description: 'The action to perform'
      },
      projectPath: {
        type: 'string',
        description: 'Absolute path to the project root (optional - uses server context path if not provided)'
      },
      specName: {
        type: 'string',
        description: 'Spec to defer/undefer (required for defer and undefer)'
      },
      reason: {
        type: 'string',
        description: 'Why the spec is deferred (required for defer)'
      }
    },
    required: ['action']
  },
  annotations: {
    title: 'Spec Index',
    readOnlyHint: false,
  }
};

export async function specIndexHandler(args: any, context: ToolContext): Promise<ToolResponse> {
  const projectPath = args.projectPath || context.projectPath;
  if (!projectPath) {
    return { success: false, message: 'Project path is required but not provided in context or arguments' };
  }

  try {
    const translatedPath = PathUtils.translatePath(projectPath);
    const generator = new IndexGenerator(translatedPath);

    switch (args.action) {
      case 'generate': {
        const result = await generator.generate();
        return {
          success: true,
          message:
            `Generated INDEX.md (${result.active} active, ${result.deferred} deferred, ${result.other} not in decomposition.md). ` +
            `Next: ${describeRouting(result)}`,
          data: result
        };
      }
      case 'defer': {
        if (!args.specName || !args.reason) {
          return { success: false, message: 'Missing required fields for defer. Required: specName, reason' };
        }
        await generator.defer(args.specName, args.reason);
        const result = await generator.generate();
        return {
          success: true,
          message: `Spec '${args.specName}' deferred. Next: ${describeRouting(result)}`,
          data: result
        };
      }
      case 'undefer': {
        if (!args.specName) {
          return { success: false, message: 'Missing required field: specName' };
        }
        await generator.undefer(args.specName);
        const result = await generator.generate();
        return {
          success: true,
          message: `Spec '${args.specName}' returned to active roadmap. Next: ${describeRouting(result)}`,
          data: result
        };
      }
      default:
        return { success: false, message: `Unknown action: ${args.action}. Use 'generate', 'defer', or 'undefer'.` };
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Spec index operation failed: ${msg}` };
  }
}
