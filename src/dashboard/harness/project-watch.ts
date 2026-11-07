// src/dashboard/harness/project-watch.ts
//
// The handoff-routing parser (design.md C5 interfaces; task 19 design C6: the
// per-project harness watch is gone, but `run-setup.ts` and
// `overview-watch.ts` still import this pure parser from this module). It
// imports nothing from the dashboard server.
import { parseHandoffActiveSpec } from '../../watch/ledger.js';
import type { HandoffRouting } from './types.js';

/**
 * The HANDOFF routing header, or null when the document names no active spec.
 * `spec` comes from `parseHandoffActiveSpec` (src/watch/ledger.ts:219-223).
 * `phase`, `state` and `result` come from the live-phase line of
 * harness/skills/sdd-continue/references/formats.md:76 (`Live phase **X**,
 * state **Y**, last result **Z**.`, with or without the leading `> ` marker);
 * each is null when the line or its field is missing.
 */
export function parseHandoffRouting(md: string | undefined): HandoffRouting | null {
  const spec = parseHandoffActiveSpec(md);
  if (!spec) return null;
  const field = (re: RegExp): string | null => {
    const m = md!.match(re);
    return m ? m[1].trim() : null;
  };
  return {
    spec,
    phase: field(/Live phase \*\*([^*]+)\*\*/),
    state: field(/state \*\*([^*]+)\*\*/),
    result: field(/last result \*\*([^*]+)\*\*/),
  };
}
