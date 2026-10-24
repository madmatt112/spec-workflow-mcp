import { AUTHOR_SCHEMA, IMPLEMENTER_SCHEMA, VERIFIER_SCHEMA } from '../controller/phases/implementation.js';
import { DRAFTER_SCHEMA } from '../controller/phases/document.js';
import { BATCH_SCHEMA } from '../controller/phases/closeout.js';

export type EvalPhase = 'implementation' | 'document' | 'closeout';

const SCHEMAS: Record<string, Record<string, Record<string, unknown>>> = {
  implementation: {
    'sdd-test-author': AUTHOR_SCHEMA,
    'sdd-implementer': IMPLEMENTER_SCHEMA,
    'sdd-verifier': VERIFIER_SCHEMA,
  },
  document: {
    'sdd-drafter': DRAFTER_SCHEMA,
  },
  closeout: {
    'sdd-implementer': BATCH_SCHEMA,
  },
};

export function reportSchema(phase: EvalPhase, role: string): Record<string, unknown> | undefined {
  return SCHEMAS[phase]?.[role];
}
