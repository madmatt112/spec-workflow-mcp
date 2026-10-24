import { describe, it, expect } from 'vitest';
import { reportSchema, type EvalPhase } from '../schemas.js';
import { AUTHOR_SCHEMA, IMPLEMENTER_SCHEMA, VERIFIER_SCHEMA } from '../../controller/phases/implementation.js';
import { DRAFTER_SCHEMA } from '../../controller/phases/document.js';
import { BATCH_SCHEMA } from '../../controller/phases/closeout.js';

// Design Component 4 (src/evals/schemas.ts), R2 AC2: reportSchema(phase, role) returns the
// phase module's own report-schema object for five (phase, role) pairs, and undefined for
// every other pair. Identity (toBe), not structural equality, proves "the same object a
// live step gets" rather than a copy.

describe('reportSchema(phase, role)', () => {
  // Pre-condition: AUTHOR_SCHEMA is the module-private implementation-phase schema the
  // controller passes for the test-author step at runModelStep's AUTHOR_SCHEMA call.
  // Call: reportSchema('implementation', 'sdd-test-author').
  // Observable result: the identical AUTHOR_SCHEMA object.
  // Expected-value source: design.md Component 4, "implementation sdd-test-author -> AUTHOR_SCHEMA".
  it('returns the identical AUTHOR_SCHEMA for (implementation, sdd-test-author)', () => {
    expect(reportSchema('implementation', 'sdd-test-author')).toBe(AUTHOR_SCHEMA);
  });

  // Pre-condition: IMPLEMENTER_SCHEMA is already exported and passed for the implementer step.
  // Call: reportSchema('implementation', 'sdd-implementer').
  // Observable result: the identical IMPLEMENTER_SCHEMA object.
  // Expected-value source: design.md Component 4, "implementation sdd-implementer -> IMPLEMENTER_SCHEMA".
  it('returns the identical IMPLEMENTER_SCHEMA for (implementation, sdd-implementer)', () => {
    expect(reportSchema('implementation', 'sdd-implementer')).toBe(IMPLEMENTER_SCHEMA);
  });

  // Pre-condition: VERIFIER_SCHEMA is the module-private implementation-phase schema passed
  // for both the task verifier and the CI verifier steps.
  // Call: reportSchema('implementation', 'sdd-verifier').
  // Observable result: the identical VERIFIER_SCHEMA object.
  // Expected-value source: design.md Component 4, "implementation sdd-verifier -> VERIFIER_SCHEMA".
  it('returns the identical VERIFIER_SCHEMA for (implementation, sdd-verifier)', () => {
    expect(reportSchema('implementation', 'sdd-verifier')).toBe(VERIFIER_SCHEMA);
  });

  // Pre-condition: DRAFTER_SCHEMA is the module-private document-phase schema passed for
  // the v1 draft step.
  // Call: reportSchema('document', 'sdd-drafter').
  // Observable result: the identical DRAFTER_SCHEMA object.
  // Expected-value source: design.md Component 4, "document sdd-drafter -> DRAFTER_SCHEMA".
  it('returns the identical DRAFTER_SCHEMA for (document, sdd-drafter)', () => {
    expect(reportSchema('document', 'sdd-drafter')).toBe(DRAFTER_SCHEMA);
  });

  // Pre-condition: BATCH_SCHEMA is the module-private close-out-phase schema passed for the
  // close-out implementer batch and fix steps.
  // Call: reportSchema('closeout', 'sdd-implementer').
  // Observable result: the identical BATCH_SCHEMA object.
  // Expected-value source: design.md Component 4, "closeout sdd-implementer -> BATCH_SCHEMA".
  it('returns the identical BATCH_SCHEMA for (closeout, sdd-implementer)', () => {
    expect(reportSchema('closeout', 'sdd-implementer')).toBe(BATCH_SCHEMA);
  });

  // Pre-condition: none of the five pairs name this role.
  // Call: reportSchema('implementation', 'sdd-nonexistent-role').
  // Observable result: undefined.
  // Expected-value source: design.md Component 4, "Other pairs return undefined."
  it('returns undefined for an unknown role', () => {
    expect(reportSchema('implementation' as EvalPhase, 'sdd-nonexistent-role')).toBeUndefined();
  });

  // Pre-condition: 'sdd-drafter' is a known role, but only under the document phase, not closeout.
  // Call: reportSchema('closeout', 'sdd-drafter').
  // Observable result: undefined.
  // Expected-value source: design.md Component 4, "Other pairs return undefined."
  it('returns undefined for a known role under the wrong phase', () => {
    expect(reportSchema('closeout' as EvalPhase, 'sdd-drafter')).toBeUndefined();
  });
});
