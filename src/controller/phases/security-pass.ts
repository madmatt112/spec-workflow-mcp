import { createHash } from 'crypto';

// Pure module for the completion gate's security pass (design C6, R3 AC 4-5, 9, 13).
// Reads the security loop's resume state from the `security:` ledger notes the design
// Data Models section pins; does no I/O.

export interface SecurityFinding {
  title: string;
  file: string;
  command: string;
  output: string;
}

export interface SecuritySuspicion {
  title: string;
  file: string;
  why: string;
}

export type SecurityNext =
  | 'pass'
  | 'fix'
  | 'recheck'
  | 'adjudicate'
  | 'recheck-adjudicated'
  | 'escalate'
  | 'await-answer'
  | 'done';

export interface SecurityState {
  epoch: number;
  next: SecurityNext;
  fixRounds: number;
  open: SecurityFinding[];
  accepted: SecurityFinding[];
  answered: string[];
}

export const SECURITY_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          command: { type: 'string' },
          output: { type: 'string' },
        },
      },
    },
    suspicions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          why: { type: 'string' },
        },
      },
    },
    retro: { type: 'string' },
  },
} as const;

const OUTPUT_LIMIT = 400;

function asStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function noteTexts(rows: Record<string, unknown>[]): string[] {
  return rows.filter((r) => r.type === 'note').map((r) => asStr(r.text));
}

// Classify a security report: a finding reported with no reproduce command or no output
// becomes a suspicion (R3 AC 5); a kept finding's output is cut to 400 characters (R3 AC 4).
export function classifySecurityReport(report: unknown): {
  findings: SecurityFinding[];
  suspicions: SecuritySuspicion[];
} {
  const r = asObject(report);
  const findings: SecurityFinding[] = [];
  const suspicions: SecuritySuspicion[] = [];

  for (const raw of asArray(r.suspicions)) {
    const s = asObject(raw);
    suspicions.push({ title: asStr(s.title), file: asStr(s.file), why: asStr(s.why) });
  }

  for (const raw of asArray(r.findings)) {
    const f = asObject(raw);
    const title = asStr(f.title);
    const file = asStr(f.file);
    const command = asStr(f.command);
    const output = asStr(f.output);
    if (!command || !output) {
      suspicions.push({ title, file, why: 'reported without a reproduction' });
    } else {
      findings.push({ title, file, command, output: output.slice(0, OUTPUT_LIMIT) });
    }
  }

  return { findings, suspicions };
}

// The e2e pass stands until the next HANDOFF marker (design D8): true when the newest
// `e2e verification passed` note is newer than any `completion handoff written` note.
export function e2ePassStands(rows: Record<string, unknown>[]): boolean {
  const texts = noteTexts(rows);
  let passIdx = -1;
  let handoffIdx = -1;
  texts.forEach((t, i) => {
    if (t === 'e2e verification passed') passIdx = i;
    else if (t === 'completion handoff written') handoffIdx = i;
  });
  return passIdx > -1 && passIdx > handoffIdx;
}

type Stage =
  | 'pass'
  | 'fix-round'
  | 'recheck'
  | 'adjudicator'
  | 'recheck-adjudicated'
  | 'escalated'
  | 'done';

function stageOf(text: string): Stage | null {
  if (text.startsWith('security: done')) return 'done';
  if (text.startsWith('security: escalated')) return 'escalated';
  if (text.startsWith('security: recheck adjudicated')) return 'recheck-adjudicated';
  if (text.startsWith('security: recheck ')) return 'recheck';
  if (text.startsWith('security: adjudicator')) return 'adjudicator';
  if (text.startsWith('security: fix round')) return 'fix-round';
  if (text.startsWith('security: pass')) return 'pass';
  return null;
}

function parseFindings(json: string): SecurityFinding[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as SecurityFinding[]) : [];
  } catch {
    return [];
  }
}

function nextFor(stage: Stage | null, open: SecurityFinding[], fixRounds: number): SecurityNext {
  if (!stage) return 'pass';
  if (stage === 'fix-round') return 'recheck';
  if (stage === 'adjudicator') return 'recheck-adjudicated';
  if (stage === 'escalated') return 'await-answer';
  if (stage === 'done') return 'done';
  if (stage === 'recheck-adjudicated') return open.length === 0 ? 'done' : 'escalate';
  // 'pass' or 'recheck'
  if (open.length === 0) return 'done';
  return fixRounds < 2 ? 'fix' : 'adjudicate';
}

// Read the security loop's resume state. The round count and open findings come only from
// `security:` notes after the newest `security: epoch` note (R3 AC 9); `answered` and
// `accepted` read the whole run.
export function readSecurityState(rows: Record<string, unknown>[]): SecurityState {
  const texts = noteTexts(rows).filter((t) => t.startsWith('security:'));

  let epoch = 0;
  let epochIdx = -1;
  texts.forEach((t, i) => {
    const m = /^security: epoch (\d+)/.exec(t);
    if (m) {
      epoch = Number(m[1]);
      epochIdx = i;
    }
  });

  const scoped = texts.slice(epochIdx + 1);
  const fixRounds = scoped.filter((t) => t.startsWith('security: fix round')).length;

  let open: SecurityFinding[] = [];
  let stage: Stage | null = null;
  for (const t of scoped) {
    if (t.startsWith('security: open ')) open = parseFindings(t.slice('security: open '.length));
    const s = stageOf(t);
    if (s) stage = s;
  }

  const accepted: SecurityFinding[] = [];
  const answered: string[] = [];
  for (const t of texts) {
    if (t.startsWith('security: accepted ')) {
      accepted.push(...parseFindings(t.slice('security: accepted '.length)));
    }
    const am = /^security: answer (\S+) /.exec(t);
    if (am) answered.push(am[1]);
  }

  return { epoch, next: nextFor(stage, open, fixRounds), fixRounds, open, accepted, answered };
}

// Stable key for a suspicion: the first 8 hex characters of sha1(file + '|' + title).
export function suspicionKey(s: SecuritySuspicion): string {
  return createHash('sha1').update(`${s.file}|${s.title}`).digest('hex').slice(0, 8);
}
