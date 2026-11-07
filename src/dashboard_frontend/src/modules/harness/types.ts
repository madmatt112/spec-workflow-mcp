// src/dashboard_frontend/src/modules/harness/types.ts
//
// Wire shapes for launching a harness run (the Home page's Next tiles). The
// frontend compiles apart from the server (the root tsconfig excludes
// src/dashboard_frontend/**, see ../../../../tsconfig.json), so it cannot
// import the server's types. These are copied by hand from
// src/dashboard/harness/types.ts. Keep them in step.

export interface PhaseRow {
  phase: string;
  state: string;
  result: string;
  note: string;
  date?: string;
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
  launchableOrder: number | null;
  supervisor: { model: string; effort: 'high' };   // 'claude-opus-5-5'
  roles: RoleRow[];                   // empty without profiles
  worktree: 'yes' | 'no'; gates: 'block' | 'record';
  modelAliases: string[]; deepseekModels: string[]; eligibleRoles: string[];
}

export type ViewMessage =             // client to server
  { type: 'overview-subscribe' | 'overview-unsubscribe' };
