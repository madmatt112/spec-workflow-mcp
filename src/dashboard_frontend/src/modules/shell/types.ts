// src/dashboard_frontend/src/modules/shell/types.ts
//
// Wire shapes for the shell pages. The frontend compiles apart from the server
// (the root tsconfig excludes src/dashboard_frontend/**), so it cannot import
// the server's types. These are copied by hand from src/dashboard/shell/types.ts.
// Keep them in step.

// --- Shell wire shapes copied from src/dashboard/shell/types.ts ---

/** One Specs-block line's harness state (design.md C3, Data Models). */
export type SpecWord = 'live' | 'closed' | 'deferred' | 'next' | 'stopped' | 'not started';

/** One decomposition heading's line on the Specs block (design.md C3, Data Models). */
export interface SpecLine {
  number: string;
  spec: string;
  word: SpecWord;
  fact: string | null;
}

/** One store's Specs block: every decomposition heading's line (design.md C3, Data Models). */
export interface SpecBlock {
  projectId: string;
  projectName: string;
  lines: SpecLine[];
}

// Hand copy of src/dashboard/shell/types.ts UsageRunLine (task 7); keep in step.
export interface UsageRunLine {
  runId: string;
  projectId: string;
  projectName: string;
  spec: string;
  phase: string | null;
  tokens: number;
  /** `total − completed` of the spec's `tasks.md`; null outside the implementation phase. */
  remaining: number | null;
  /** `null` reads "not known yet" (design D20). */
  fit: 'fits' | 'does-not-fit' | null;
}

// Hand copy of src/dashboard/shell/types.ts UsageView (task 7); keep in step.
export interface UsageView {
  window: { utilization: number; resetsAt: string } | null;
  /** Percentage points over the last 24 h; null with no anchor line. */
  burn: number | null;
  runs: UsageRunLine[];
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
  task?: string;
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
  detail?: string;
}

/** Live task-row read for the ruling view (design C5, Data Models). */
export type WaitTaskRow =
  | {
      state: 'ok';
      id: string;
      title: string;
      success: string | null;
      tdd: boolean;
      risk: 'low' | 'medium' | 'high' | null;
      files: string[];
    }
  | { state: 'not-found'; id: string }
  | { state: 'no-task' };

/** One hunk of a diff file (design C6, Data Models). */
export interface DiffHunk {
  header: string;
  lines: { kind: 'add' | 'del' | 'ctx'; text: string }[];
}

/** One file of a diff commit (design C6, Data Models). */
export interface DiffFile {
  path: string;
  binary: boolean;
  hunks: DiffHunk[];
  droppedLines: number;
}

/** One commit of a wait diff (design C6, Data Models). */
export interface DiffCommit {
  hash: string;
  subject: string;
  found: boolean;
  files: DiffFile[];
}

/** Live diff read for the ruling view (design C6, Data Models). */
export type WaitDiff =
  | { state: 'ok'; commits: DiffCommit[]; overflow: { count: number; paths: string[] } }
  | { state: 'worktree-gone' }
  | { state: 'run-gone' }
  | { state: 'no-commits' }
  | { state: 'unreadable'; error: string };

// --- Controller runs (controller-tasks.md T6/T10) ------------------------------
// Hand copy of src/dashboard/shell/types.ts and src/controller/runs.ts; keep in step.

export type ControllerRunStatus =
  | 'queued' | 'running' | 'merging' | 'paused' | 'waiting' | 'done' | 'abandoned' | 'error';

// Hand copy of PrRead in src/controller/state.ts; keep in step. Holds no path.
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

export interface ControllerRun {
  id: string;
  project: string;
  spec: string;
  status: ControllerRunStatus;
  phase?: string;
  stepKind?: string;
  pauseReason?: string;
  resumeAt?: string;
  /** When the run became paused or waiting; set only while it is. */
  pausedAt?: string;
  /** ISO time of an operator pause request; absent unless the operator holds the run. */
  pauseRequested?: string;
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

// --- Advisor staged actions (src/advisor/actions.ts; design C8) --------------
// Hand copy of StagedAction; keep in step.

export type StagedActionKind =
  | 'merge' | 'deploy' | 'launch' | 'answer' | 'deferral' | 'decomposition' | 'backlog';

export interface StagedAction {
  v: 1;
  id: string;
  kind: StagedActionKind;
  target: Record<string, unknown>;
  params: Record<string, unknown>;
  reason: string;
  conversation: string;
  created: string;
  state: 'staged' | 'running' | 'done' | 'refused' | 'failed' | 'dismissed';
  decided?: string;
  outcome?: { status: string; detail: string[] };
}

// Hand copy of DeployStage in src/controller/deploy.ts; keep in step.
export type DeployStage = 'wait' | 'build' | 'smoke' | 'gate' | 'swap' | 'restart' | 'done' | 'failed';

// Hand copy of ControllerDeploy in src/controller/deploy.ts; keep in step.
export interface ControllerDeploy {
  stage: DeployStage;
  runs: string[];
  started: string;
  commit?: string;
  error?: string;
}

export type ShellMessage =
  | { type: 'shell-specs'; data: { blocks: SpecBlock[] } }
  | { type: 'controller-waits'; data: { waits: ControllerWait[] } }
  | { type: 'controller-runs'; data: { runs: ControllerRun[] } }
  | { type: 'controller-actions'; data: { actions: StagedAction[] } }
  | { type: 'controller-deploy'; data: { deploy: ControllerDeploy | null } };
