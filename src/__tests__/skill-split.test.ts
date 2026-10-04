import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Task 12 — document-phase skill split (design C8; Requirement 3 criteria 3 and 6).
//
// Frozen list of today's `##`/`###` rule heading texts for both skills' SKILL.md
// files, taken verbatim from the base commit (before any split moves text into
// references/*.md). A drift guard: splitting SKILL.md across reference files must
// not lose or duplicate a heading's text. Also asserts the document-phase SKILL.md
// stops naming `references/briefs.md` once its brief/prompt reads are routed
// through the `harness` `brief` kinds instead (Requirement 3 criterion 3).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const DOCUMENT_PHASE_DIR = join(ROOT, 'harness', 'skills', 'sdd-document-phase');
const IMPLEMENTATION_PHASE_DIR = join(ROOT, 'harness', 'skills', 'sdd-implementation-phase');

const DOCUMENT_PHASE_HEADINGS = [
  '## Standing rules',
  '## Step 0 — Orient',
  '## Step 1 — v1',
  '## Lint step',
  '## Gate A — emit after the v1 lint (requirements, `MODE: normal` only)',
  '## Step 2 — Review round',
  '## Step 3 — Revise to v(D+1)',
  '## Standoff check',
  '## Circling check',
  '## Cap convergence check',
  '## Step 4a — Cap: corrective pass at v(D+1)',
  '## Step 4b — Narrow check',
  '## Step 5 — Approve',
  '## Design scope-cut gate — before Step 5 in the design phase (`MODE: normal`)',
  '## Step 6 — Cleanup, then report',
  '## Gate B — assemble the veto list (tasks, `MODE: normal`, first approval)',
  '## Step R — Revision input',
  '## Budget',
  '## Legacy rules that stay in force',
];

const IMPLEMENTATION_PHASE_HEADINGS = [
  '## Standing rules',
  '## Step 0 — Orient',
  '## Per-task loop',
  '## Deferral bar',
  '## Design defect',
  '## Escalate',
  '## Resume recovery',
  '## Completion gate',
  '### Live verification',
  '### Reconcile a red PR',
  '## Repair',
  '## Stop conditions and their reports',
];

/** Number of files (SKILL.md plus references/*.md) in which `heading` appears
 * as an exact line. The criterion is satisfied when this is exactly 1. */
function locationCount(skillDir: string, heading: string): number {
  const skillLines = readFileSync(join(skillDir, 'SKILL.md'), 'utf-8').split('\n');
  let count = skillLines.includes(heading) ? 1 : 0;

  const refDir = join(skillDir, 'references');
  let refNames: string[];
  try {
    refNames = readdirSync(refDir).filter((n) => n.endsWith('.md'));
  } catch {
    refNames = [];
  }
  for (const name of refNames) {
    const lines = readFileSync(join(refDir, name), 'utf-8').split('\n');
    if (lines.includes(heading)) count += 1;
  }
  return count;
}

describe('document-phase and implementation-phase skill split (task 12, design C8)', () => {
  it('every document-phase heading is in SKILL.md or exactly one references/*.md file', () => {
    for (const heading of DOCUMENT_PHASE_HEADINGS) {
      expect(locationCount(DOCUMENT_PHASE_DIR, heading)).toBe(1);
    }
  });

  it('every implementation-phase heading is in SKILL.md or exactly one references/*.md file', () => {
    for (const heading of IMPLEMENTATION_PHASE_HEADINGS) {
      expect(locationCount(IMPLEMENTATION_PHASE_DIR, heading)).toBe(1);
    }
  });

  it('the document-phase SKILL.md does not name briefs.md', () => {
    const skillText = readFileSync(join(DOCUMENT_PHASE_DIR, 'SKILL.md'), 'utf-8');
    expect(skillText).not.toContain('briefs.md');
  });

  it('the implementation-phase SKILL.md does not name briefs.md (task 13, design C8; Requirement 3 criterion 3)', () => {
    const skillText = readFileSync(join(IMPLEMENTATION_PHASE_DIR, 'SKILL.md'), 'utf-8');
    expect(skillText).not.toContain('briefs.md');
  });
});
