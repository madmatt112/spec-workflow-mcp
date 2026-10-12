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

// --- Controller waits (controller-design.md §7; T4) ---------------------------
// Hand copy of src/dashboard/shell/types.ts; keep them in step.

export type ControllerWaitKind =
  | 'gate-a' | 'gate-b' | 'retro-plan' | 'merge' | 'escalation' | 'error' | 'question';

export interface ControllerWaitQuestion {
  id: string;
  text: string;
  options?: string[];
  free?: boolean;
  recommended?: string;
  reason?: string;
}

export interface ControllerWaitAnswer {
  value: string;
  by: string;
  answered: string;
}

export interface ControllerWait {
  id: string;
  kind: ControllerWaitKind;
  run: string;
  project: string;
  spec: string;
  created: string;
  questions: ControllerWaitQuestion[];
  answer?: Record<string, ControllerWaitAnswer>;
  advice?: string;
  state: 'open' | 'answered' | 'expired';
  proposals?: string[];
}

// --- Controller runs and activity (controller-tasks.md T6/T10) ----------------
// Hand copy of src/dashboard/shell/types.ts and src/controller/runs.ts; keep in step.

export type ControllerRunStatus =
  | 'queued' | 'running' | 'merging' | 'paused' | 'waiting' | 'done' | 'abandoned' | 'error';

export interface ControllerRun {
  id: string;
  project: string;
  spec: string;
  status: ControllerRunStatus;
  phase?: string;
  stepKind?: string;
  pauseReason?: string;
  resumeAt?: string;
  tokens: number;
  created: string;
  updated: string;
}

export interface ControllerActivity {
  runId: string;
  stepId: string;
  role: string;
  tool: string;
  inputSummary: string;
  ts?: string;
}

export type ShellMessage =
  | { type: 'shell-now'; data: NowModel }
  | { type: 'shell-specs'; data: { rows: SpecListRow[] } }
  | { type: 'controller-waits'; data: { waits: ControllerWait[] } }
  | { type: 'controller-runs'; data: { runs: ControllerRun[] } }
  | { type: 'controller-activity'; data: { activity: ControllerActivity[] } };
