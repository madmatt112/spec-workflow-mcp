// src/dashboard/harness/project-watch.ts
//
// The per-project harness watch (design.md C5). This task ships only the two
// pure parsers the setup view (task 4) and the watch class (task 7) share; task
// 7 adds the `ProjectHarnessWatch` class to this module. The parsers import
// nothing from the dashboard server.
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

/** The trimmed body under a `## Gate A`/`## Gate B` heading, to the next `## ` heading. */
function gateSection(md: string, gate: 'A' | 'B'): string | null {
  const heading = `## Gate ${gate}`;
  const lines = md.split('\n');
  const start = lines.findIndex(l => l.trim() === heading);
  if (start === -1) return null;
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith('## ')) break;
    body.push(lines[i]);
  }
  const text = body.join('\n').trim();
  return text.length ? text : null;
}

/**
 * The `## Gate A` and `## Gate B` sections of a questions file. Each is the
 * trimmed text under its heading up to the next `## ` heading (or end of
 * input), and null when the heading or the input is missing.
 */
export function parseGateSections(md: string | undefined): { gateA: string | null; gateB: string | null } {
  if (!md) return { gateA: null, gateB: null };
  return { gateA: gateSection(md, 'A'), gateB: gateSection(md, 'B') };
}
