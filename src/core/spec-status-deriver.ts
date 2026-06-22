import { SpecData } from '../types.js';

export interface DerivedSpecStatus {
  /** Phase the spec is currently in: requirements | design | tasks | implementation | completed */
  currentPhase: string;
  /** Fine-grained status: requirements-needed | design-needed | tasks-needed | ready-for-implementation | implementing | completed */
  overallStatus: string;
}

/**
 * Derive a spec's current phase and overall status from its parsed phase/progress data.
 *
 * This is the single source of truth for spec status, shared by the spec-status tool
 * (single spec) and the INDEX roadmap generator (multi-spec roll-up). Do not duplicate
 * this logic — call this function instead.
 */
export function deriveSpecStatus(spec: SpecData): DerivedSpecStatus {
  if (!spec.phases.requirements.exists) {
    return { currentPhase: 'requirements', overallStatus: 'requirements-needed' };
  }
  if (!spec.phases.design.exists) {
    return { currentPhase: 'design', overallStatus: 'design-needed' };
  }
  if (!spec.phases.tasks.exists) {
    return { currentPhase: 'tasks', overallStatus: 'tasks-needed' };
  }
  if (spec.taskProgress && spec.taskProgress.pending > 0) {
    return { currentPhase: 'implementation', overallStatus: 'implementing' };
  }
  if (spec.taskProgress && spec.taskProgress.total > 0 && spec.taskProgress.completed === spec.taskProgress.total) {
    return { currentPhase: 'completed', overallStatus: 'completed' };
  }
  return { currentPhase: 'implementation', overallStatus: 'ready-for-implementation' };
}
