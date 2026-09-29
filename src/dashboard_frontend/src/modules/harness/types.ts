// src/dashboard_frontend/src/modules/harness/types.ts
//
// Wire shapes for the harness control pane pages. The frontend compiles apart
// from the server (the root tsconfig excludes src/dashboard_frontend/**, see
// ../../../../tsconfig.json), so it cannot import the server's types. These are
// copied by hand from src/dashboard/harness/types.ts and, for RunModel and the
// rows it references, from src/watch/ledger.ts. Keep them in step.

// --- Row types copied from src/watch/ledger.ts ---

export interface AgentProfile {
  model: string;
  effort: string;
  role: string;
  /** The declared prompt-cache lifetime; absent when the profile omits it or it is `default`. */
  cacheTtl?: string;
}

export interface PhaseRow {
  phase: string;
  state: string;
  result: string;
  note: string;
  date?: string;
}

export interface SpawnNode {
  agent: string;
  role: string;
  phase?: string;
  task?: string;
  round?: string;
  startedAt: string;
  endedAt?: string;
  result?: string;
  tokens?: number;
  model?: string;
  /** The provider that ran this spawn; absent means Anthropic. */
  provider?: string;
  input?: number;
  output?: number;
  cacheWrite?: number;
  cacheRead?: number;
  lastActivityAt?: string;
  lastTool?: string;
  lastSummary?: string;
  /** The Claude Code agent id from the hook's spawn.end, when it carried one. */
  agentId?: string;
  /** Orchestrators are spawned by the supervisor; everything else by an orchestrator. */
  level: 1 | 2;
}

export interface TaskRow {
  id: string;
  title: string;
  status: 'done' | 'in-progress' | 'open';
}

export interface RoundRow {
  phase: string;
  round: string;
  verdict: string;
  version?: string;
}

/** A `task.pick` of the current run (a task id or a close-out item such as `P3`). */
export interface PickRow {
  task: string;
  title: string;
  done: boolean;
  outcome?: string;
}

export interface TickerLine {
  ts: string;
  text: string;
}

export interface RunModel {
  spec: string;
  runId?: string;
  runStartedAt?: string;
  runEndedAt?: string;
  status?: string;
  model?: string;
  codeRoot?: string;
  worktree?: string;
  headless?: string;
  phases: PhaseRow[];
  livePhase?: { phase: string; mode?: string; budget?: string; state?: string; startedAt: string };
  spawns: SpawnNode[];
  rounds: RoundRow[];
  tasks: TaskRow[];
  /** Items the orchestrator picked in this run; the queue for phases without a tasks.md. */
  picks: PickRow[];
  ticker: TickerLine[];
  tokensTotal: number;
  /** The run's provider map (`agent:provider[:model],...`), from run.start; absent or `none` when every role is Anthropic. */
  providers?: string;
  /** tokensTotal split by provider: the Anthropic figure the header prints as `tokens`, and DeepSeek beside it. */
  tokensByProvider: { anthropic: number; deepseek: number };
  /** True when at least one activity event exists for the run (the hook is installed). */
  hasActivity: boolean;
}

// --- RoutingDecision copied from src/core/spec-routing-deriver.ts ---

export type RoutingState =
  | 'active'
  | 'ambiguous'
  | 'all-on-disk-complete'
  | 'all-deferred'
  | 'no-specs';

export interface RoutingDecision {
  state: RoutingState;
  spec: string | null;
  reason: string;
  candidates: string[];
  warnings: string[];
}

// --- Harness wire shapes copied from src/dashboard/harness/types.ts ---

export type Provider = 'anthropic' | 'deepseek';

export interface HarnessRunFile {     // <spec store>/.spec-workflow/harness-run.json
  spec: string;
  writtenAt: string;                  // ISO 8601 UTC
  supervisorModel: string;
  worktree: 'yes' | 'no';
  gates: 'block' | 'record';
  roles: Record<string, { model: string; provider: Provider }>; // differing roles only
}

export interface SetupInput {
  spec: string; supervisorModel: string; worktree: 'yes' | 'no'; gates: 'block' | 'record';
  roles: Record<string, { model: string; provider?: Provider }>;
}

export interface ValidationError { field: string; value: string; error: string }

export interface SpecRow {
  name: string; bucket: 'active' | 'deferred' | 'other';
  currentPhase: string; overallStatus: string;
  progress: { total: number; completed: number }; routed: boolean;
}

export interface HandoffRouting { spec: string; phase: string | null; state: string | null; result: string | null }

export interface RoleRow {
  agent: string; role: string; declaredModel: string; effort: string;
  defaultModel: string; defaultProvider: Provider; providerEditable: boolean;
}

export interface SetupView {
  specs: SpecRow[];                   // active, deferred, other (INDEX order)
  routing: RoutingDecision;           // src/core/spec-routing-deriver.ts:20-30
  handoff: HandoffRouting | null;
  launchable: string | null; disabledReason: string | null;
  supervisor: { model: string; effort: 'high' };   // 'claude-opus-5-5'
  roles: RoleRow[];                   // empty without profiles
  worktree: 'yes' | 'no'; gates: 'block' | 'record';
  modelAliases: string[]; deepseekModels: string[]; eligibleRoles: string[];
  saved: HarnessRunFile | null;       // display-only notice
}

export interface LaunchRecord {       // <global dir>/harness/launches/<projectId>.json
  projectId: string; workflowRoot: string; spec: string;
  pid: number; pgid: number; cwd: string; worktree: 'yes' | 'no';
  logPath: string; launchedAt: string; setupWrittenAt: string;
  runId: string | null;
  state: 'running' | 'stopping' | 'stopped' | 'exited';
  exitCode: number | null; signal: string | null;
  stopRequestedAt: string | null; endedAt: string | null;
  note: string | null;                // 'found gone after dashboard restart'
}

export interface PointerLine { mainCheckout: string; specDir: string; runId: string }

export interface Todo {
  id: string; title: string; owner: string; blocks: string; note: string;
  since: string; done: boolean; priority: string;
}

export interface OverviewRow {
  projectId: string; projectName: string; state: 'running' | 'idle';
  spec: string | null; livePhase: string | null; runId: string | null;
  lastRow: { ts: string; type: string; text: string } | null;
  newestTs: string | null; waiting: boolean;
}

export type HarnessMessage =          // server to client
  | { type: 'harness-model'; projectId: string; data: { spec: string | null; model: RunModel | null;
      profiles: Record<string, AgentProfile>; launch: LaunchRecord | null } }
  | { type: 'harness-log'; projectId: string; data: { launchedAt: string; lines: string[]; reset: boolean } }
  | { type: 'harness-gates'; projectId: string; data: { spec: string | null; gateA: string | null; gateB: string | null } }
  | { type: 'overview-rows'; data: { rows: OverviewRow[] } }
  | { type: 'overview-todos'; data: { todos: Todo[] } };

export type ViewMessage =             // client to server
  | { type: 'harness-subscribe' | 'harness-unsubscribe'; projectId: string }
  | { type: 'overview-subscribe' | 'overview-unsubscribe' };
