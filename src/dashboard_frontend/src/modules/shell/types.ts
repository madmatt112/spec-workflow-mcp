// src/dashboard_frontend/src/modules/shell/types.ts
//
// Wire shapes for the shell pages. The frontend compiles apart from the server
// (the root tsconfig excludes src/dashboard_frontend/**), so it cannot import
// the server's types. These are copied by hand from src/dashboard/shell/types.ts
// and, for LedgerEvent and ActivityEvent, from src/watch/ledger.ts. Keep them in
// step. PhaseRow and LaunchRecord reuse the existing harness hand copy.
import type { PhaseRow, LaunchRecord } from '../harness/types';

// --- Row types copied from src/watch/ledger.ts ---

export interface LedgerEvent {
  ts: string;
  type: string;
  run?: string;
  spec?: string;
  [key: string]: string | undefined;
}

export interface ActivityEvent {
  ts: string;
  agent: string;
  event: 'tool' | 'agent.start' | 'agent.stop';
  run?: string;
  session?: string;
  agentId?: string;
  tool?: string;
  summary?: string;
  tokens?: number;
}

// --- Shell wire shapes copied from src/dashboard/shell/types.ts ---

export type WaitKind = 'gate' | 'ruling' | 'retro' | 'exited' | 'quiet';

export interface Wait {
  kind: WaitKind;
  projectId: string;
  projectName: string;
  spec: string | null;
  since: string;            // ISO time the age runs from
  summary: string;          // the one-line detail of the row
  detail:
    | { kind: 'gate'; gate: 'A' | 'B'; items: { header: string; question: string; options: string[] }[] | null; questions: string | null }
    | { kind: 'ruling'; phase: string; state: string; note: string }
    | { kind: 'retro'; count: number; lines: string[] }
    | { kind: 'exited'; exitCode: number | null; signal: string | null; endedAt: string | null; logPath: string }
    | { kind: 'quiet'; agent: string; lastTool: string | null; lastActivityAt: string };
}

export interface LiveRunRow {
  projectId: string;
  projectName: string;
  spec: string;
  runId: string;
  phase: string | null;
  detail: string;
  tokens: number;
  startedAt: string | null;
}

export interface IdleRow {
  projectId: string;
  projectName: string;
  launchable: string | null;
  disabledReason: string | null;
}

export interface ClosedRow {
  projectId: string;
  projectName: string;
  spec: string;
  closedOn: string;
}

export interface RunListRow {
  projectId: string;
  projectName: string;
  spec: string;
  runId: string | null;
  state: 'live' | 'ended' | 'stopped' | 'exited';
  phase: string | null;
  since: string | null;
}

export interface NowModel {
  waits: Wait[];
  live: LiveRunRow[];
  idle: IdleRow[];
  closed: ClosedRow[];
  runs: RunListRow[];
  launches: Record<string, { state: LaunchRecord['state']; pid: number; runId: string | null } | null>;
  generatedAt: string;
}

export interface SpecListRow {
  projectId: string;
  projectName: string;
  spec: string;
  state: 'live' | 'in-progress' | 'closed' | 'deferred' | 'not-started';
  phase: string | null;
  versions: { requirements: string | null; design: string | null; tasks: string | null };
  tasks: { done: number; total: number };
  prs: number[];
  deferrals: number;
  retro: string | null;
  updated: string | null;
}

export interface SpecDetail {
  order: number | null;
  dependsOn: string | null;
  runs: { runId: string; start: string; end: string | null; status: string | null; tokens: number }[];
  phases: PhaseRow[];
  deferrals: { id: string; title: string; status: string }[];
  files: { name: string; path: string; size: number; modified: string }[];
}

export interface RunDetail {
  spec: string;
  phaseStrip: { phase: string; version: string | null; rounds: number; approvedOn: string | null; live: boolean }[];
  taskMeta: Record<string, { risk: 'low' | 'high' | null; fixRounds: number | null }>;
  ledgerRows: LedgerEvent[];
  activityRows: ActivityEvent[];
}

export type ShellMessage =
  | { type: 'shell-now'; data: NowModel }
  | { type: 'shell-specs'; data: { rows: SpecListRow[] } };
