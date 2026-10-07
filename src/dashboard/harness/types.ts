// src/dashboard/harness/types.ts
//
// The wire shapes of the harness control pane (design.md Data Models). One typed
// home for the setup file, launch records, pointer lines, HUD to-dos, the overview
// rows and the server/client message unions.
import type { RunModel, AgentProfile } from '../../watch/ledger.js';
import type { RoutingDecision } from '../../core/spec-routing-deriver.js';
import type { RunDetail } from '../shell/types.js';

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
  | { type: 'harness-run-detail'; projectId: string; data: RunDetail | null }
  | { type: 'overview-rows'; data: { rows: OverviewRow[] } }
  | { type: 'overview-todos'; data: { todos: Todo[] } };

export type ViewMessage =             // client to server
  | { type: 'harness-subscribe' | 'harness-unsubscribe'; projectId: string }
  | { type: 'overview-subscribe' | 'overview-unsubscribe' };
