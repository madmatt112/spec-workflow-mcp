// src/dashboard/shell/types.ts
//
// One typed home for the shell's server-to-client wire shapes (design.md C1,
// Data Models). Types only, no runtime code. The frontend keeps a hand copy in
// src/dashboard_frontend/src/modules/shell/types.ts, because root tsc excludes
// the frontend.
import type { PhaseRow } from '../../watch/ledger.js';
import type { StagedAction } from '../../advisor/actions.js';
import type { ControllerDeploy } from '../../controller/deploy.js';

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
  /** When the run became paused or waiting; set only while it is. */
  pausedAt?: string;
  tokens: number;
  created: string;
  updated: string;
  /** One read per PR for the dashboard (design D5); undefined when the record has none. */
  prReads?: ControllerPrRead[];
  /** Is this process currently driving the run (design C4/C5)? Never written to `run.json`. */
  driven: boolean;
  /** The run's last heartbeat (design C3), when it has one. */
  lastActivity?: string;
  /** Who is holding the run paused, when it is (design C8); undefined when not held. */
  holdBy?: 'operator' | 'deploy';
  /** `run.inFlight !== undefined` (design C3, Data Models). */
  inFlight?: boolean;
  /** `run.inFlight?.startedAt` (design C3, Data Models); absent when the step predates it. */
  stepStarted?: string;
  /** `run.inFlight?.task` (design C3, Data Models). */
  task?: string;
  /** The C2 branch read for a stopped run; `run.branch !== ''` for a moving one (design C3). */
  branchPresent?: boolean;
  /** `!branchHeld(run, allRuns)` (design C3). */
  discardAllowed?: boolean;
}

export type ShellMessage =
  | { type: 'shell-specs'; data: { rows: SpecListRow[] } }
  | { type: 'controller-waits'; data: { waits: ControllerWait[] } }
  | { type: 'controller-runs'; data: { runs: ControllerRun[] } }
  | { type: 'controller-actions'; data: { actions: StagedAction[] } }
  | { type: 'controller-deploy'; data: { deploy: ControllerDeploy | null } };
