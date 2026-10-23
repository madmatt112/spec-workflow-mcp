import { chmodSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { EvalCase } from './case.js';
import type { Fixture } from './fixture.js';
import { COMMIT_SCRIPT } from '../controller/phases/closeout.js';
import type { ToolContext, ToolResponse } from '../types.js';

export type BriefHandler = (args: any, context: ToolContext) => Promise<ToolResponse>;

export class RenderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RenderError';
  }
}

/** `{{fixture}}` -> `f.root`, `{{scratch}}` -> `scratch`, in every string value. */
function substitute(values: Record<string, unknown>, root: string, scratch: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    out[key] = typeof value === 'string'
      ? value.replaceAll('{{fixture}}', root).replaceAll('{{scratch}}', scratch)
      : value;
  }
  return out;
}

/**
 * Renders every brief a case names from the build under evaluation (design Component 3,
 * R1 AC2, requirements D1).
 */
export async function renderCaseBriefs(
  c: EvalCase,
  f: Fixture,
  scratch: string,
  handler: BriefHandler,
): Promise<{ launchBrief: string; texts: Record<string, string> }> {
  if (c.phase === 'closeout') {
    const scriptPath = join(scratch, 'closeout-commit.sh');
    writeFileSync(scriptPath, COMMIT_SCRIPT, 'utf-8');
    chmodSync(scriptPath, 0o755);
  }

  const toolContext: ToolContext = { projectPath: f.root, workspacePath: f.root };
  const renderedPaths: Record<string, string> = {};
  const texts: Record<string, string> = {};
  let launchBrief = '';

  for (const entry of c.briefs) {
    const values = substitute(entry.values, f.root, scratch);
    for (const [key, template] of Object.entries(entry.wire ?? {})) {
      const wired = renderedPaths[template];
      if (wired !== undefined) values[key] = wired;
    }
    const path = join(scratch, entry.file);
    const res = await handler(
      { action: 'brief', template: entry.template, specName: c.spec, taskId: entry.taskId, values: { ...values, path } },
      toolContext,
    );
    if (!res.success) throw new RenderError(res.message);

    const absolute = (res.data as { path: string }).path;
    renderedPaths[entry.template] = absolute;
    texts[entry.template] = readFileSync(absolute, 'utf-8');
    launchBrief = absolute;
  }

  return { launchBrief, texts };
}
