// src/dashboard/shell/types.ts
//
// One typed home for the shell's server-to-client wire shapes (design.md C1,
// Data Models). Types only, no runtime code. The frontend keeps a hand copy in
// src/dashboard_frontend/src/modules/shell/types.ts, because root tsc excludes
// the frontend.
import type { LedgerEvent, ActivityEvent, PhaseRow } from '../../watch/ledger.js';

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
  state: 'live' | 'ended';
  phase: string | null;
  since: string | null;
}

export interface NowModel {
  waits: Wait[];
  live: LiveRunRow[];
  idle: IdleRow[];
  closed: ClosedRow[];
  runs: RunListRow[];
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

/**
 * One Usage-page row per closed spec (design.md C9, Requirement 3). `w` and
 * `wUnknown` come from `buildUsageReport`; `wPerTask` and `pctOfBaseline` are null
 * when they cannot be computed (no usage, no tasks, no or zero baseline). The
 * frontend keeps a hand copy in src/dashboard_frontend/src/modules/shell/types.ts.
 */
export interface UsageSpecRow {
  projectId: string;
  projectName: string;
  spec: string;
  closeDate: string | null;
  w: number | null;
  wUnknown: number;
  tasks: number;
  wPerTask: number | null;
  baseline: number | null;
  pctOfBaseline: number | null;
}

export interface RunDetail {
  spec: string;
  phaseStrip: { phase: string; version: string | null; rounds: number; approvedOn: string | null; live: boolean }[];
  taskMeta: Record<string, { risk: 'low' | 'high' | null; fixRounds: number | null }>;
  ledgerRows: LedgerEvent[];
  activityRows: ActivityEvent[];
}

// --- Controller waits (controller-design.md §7; T4) ---------------------------
// The design §7 wire shape, minus the `specDir` the server strips. The frontend
// keeps a hand copy in src/dashboard_frontend/src/modules/shell/types.ts.

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

/** The advisor's typed second opinion (design C7, Data Models). */
export interface ControllerWaitOpinion {
  picks: { question: string; pick: string; reason: string }[];
  summary: string;
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
  opinion?: ControllerWaitOpinion;
  opinionStatus?: { state: 'running' | 'failed'; at: string; reason?: string };
  state: 'open' | 'answered' | 'expired';
  proposals?: string[];
}

/**
 * One read of a pull request by the merge pass, path-free for the wire (design
 * C1/C3). Hand copy of `PrRead` in src/controller/state.ts; keep in step. Holds
 * no path — `repo` is a basename.
 */
export interface ControllerPrRead {
  kind: 'run' | 'closeout';
  repo: string;
  number: number;
  url?: string;
  ci: 'green' | 'pending' | 'red' | 'unreadable';
  mergeable?: string;
  verdict: 'merged' | 'waiting' | 'not-ready' | 'blocked' | 'unreadable' | 'failed';
  reasons: string[];
  sha?: string;
  /** The package names this PR head adds over its base (design C2, R4); absent when empty or unread. */
  newDependencies?: string[];
  at: string;
}

/** One controller run, path-free for the wire (controller-tasks.md T6; §17). */
export interface ControllerRun {
  id: string;
  project: string;
  spec: string;
  status: 'queued' | 'running' | 'merging' | 'paused' | 'waiting' | 'done' | 'abandoned' | 'error';
  phase?: string;
  stepKind?: string;
  pauseReason?: string;
  resumeAt?: string;
  tokens: number;
  created: string;
  updated: string;
  /** One read per PR for the dashboard (design D5); undefined when the record has none. */
  prReads?: ControllerPrRead[];
}

/**
 * One step's latest live tool activity for a run (controller-tasks.md T10;
 * controller-design.md §4). The Run page's "Live now" line reads the entry whose
 * `runId` matches the run. The frontend keeps a hand copy.
 */
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
