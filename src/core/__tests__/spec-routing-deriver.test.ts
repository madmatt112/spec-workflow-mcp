import { describe, it, expect } from 'vitest';
import { deriveRouting } from '../spec-routing-deriver.js';
import { SpecIndexEntry } from '../../types.js';

function entry(
  name: string,
  overallStatus: string,
  progress: Partial<SpecIndexEntry['taskProgress']> = {}
): SpecIndexEntry {
  return {
    name,
    currentPhase: 'implementation',
    overallStatus,
    taskProgress: { total: 0, completed: 0, inProgress: 0, pending: 0, unparsed: 0, ...progress },
    createdAt: '2020-01-01T00:00:00.000Z',
    deferred: false,
    inDecomposition: true,
  };
}

const done = (name: string) => entry(name, 'completed', { total: 2, completed: 2 });
const buckets = (b: Partial<Parameters<typeof deriveRouting>[0]>) =>
  deriveRouting({ active: [], deferred: [], other: [], ...b });

describe('deriveRouting', () => {
  it('reports no-specs for an empty project', () => {
    expect(buckets({})).toMatchObject({ state: 'no-specs', spec: null });
  });

  it('reports all-deferred rather than complete when every spec is deferred', () => {
    const d = deriveRouting({ active: [], deferred: [entry('parked', 'implementing')], other: [] });
    expect(d.state).toBe('all-deferred');
    expect(d.spec).toBeNull();
    expect(d.reason).toContain('Nothing is complete');
  });

  it('picks the first not-Complete spec in build order', () => {
    const d = buckets({ active: [done('one'), entry('two', 'implementing'), entry('three', 'tasks-needed')] });
    expect(d).toMatchObject({ state: 'active', spec: 'two' });
  });

  // The scoped-progress decision: `active` is a declared dependency sequence, so a
  // later spec being underway must not pull it ahead of an earlier unstarted one.
  it('does not let progress override declared build order', () => {
    const d = buckets({
      active: [entry('first', 'implementing', { total: 12 }), entry('seventh', 'implementing', { total: 20, completed: 5 })],
    });
    expect(d.spec).toBe('first');
  });

  // The original incident: every sequenced spec is Complete, and all live work sits in
  // the residual bucket where the router never looked.
  it('falls through to the residual bucket and picks the started spec', () => {
    const d = buckets({
      active: [done('a'), done('b')],
      other: [
        entry('export-import-account-data', 'implementing', { total: 14, pending: 14 }),
        entry('user-onboarding', 'implementing', { total: 38, completed: 20, pending: 18 }),
        entry('metrics-instrumentation', 'tasks-needed'),
      ],
    });
    expect(d).toMatchObject({ state: 'active', spec: 'user-onboarding' });
    expect(d.reason).toContain('20/38');
  });

  it('counts a spec as started when its first task is in progress', () => {
    const d = buckets({
      other: [entry('untouched', 'implementing', { total: 5, pending: 5 }), entry('begun', 'implementing', { total: 5, inProgress: 1, pending: 4 })],
    });
    expect(d).toMatchObject({ state: 'active', spec: 'begun' });
  });

  it('refuses to choose between two started residual specs', () => {
    const d = buckets({
      other: [
        entry('one', 'implementing', { total: 5, completed: 1, pending: 4 }),
        entry('two', 'implementing', { total: 9, completed: 3, pending: 6 }),
      ],
    });
    expect(d.state).toBe('ambiguous');
    expect(d.spec).toBeNull();
    expect(d.candidates).toEqual(['one (1/5)', 'two (3/9)']);
  });

  it('refuses to choose among residual specs when none are started', () => {
    const d = buckets({
      other: [entry('one', 'implementing', { total: 5, pending: 5 }), entry('two', 'tasks-needed')],
    });
    expect(d.state).toBe('ambiguous');
    expect(d.candidates).toEqual(['one (0/5)', 'two (no tasks yet)']);
  });

  // Specs are created lazily, so decomposition.md routinely names a spec with no
  // directory. Such a spec is invisible here, and calling this "roadmap complete"
  // is how the router silently stops with work outstanding.
  it('says all-on-disk-complete, not roadmap complete, when every spec is done', () => {
    const d = buckets({ active: [done('a'), done('b')] });
    expect(d.state).toBe('all-on-disk-complete');
    expect(d.reason).toContain('decomposition.md');
    expect(d.reason).not.toMatch(/roadmap complete/i);
  });

  it('warns when tasks.md has checkbox lines the parser dropped', () => {
    const d = buckets({ active: [entry('sloppy', 'completed', { total: 2, completed: 2, unparsed: 3 })] });
    expect(d.warnings).toHaveLength(1);
    expect(d.warnings[0]).toContain('sloppy');
    expect(d.warnings[0]).toContain('3 unfinished checkbox line(s)');
  });

  it('warns about deferred specs too, and orders warnings deterministically', () => {
    const parked = entry('zed', 'implementing', { total: 1, unparsed: 1 });
    const d = deriveRouting({
      active: [entry('active-one', 'implementing', { total: 1, pending: 1, unparsed: 2 })],
      deferred: [parked],
      other: [],
    });
    expect(d.warnings.map(w => w.split(':')[0])).toEqual(['active-one', 'zed']);
  });
});
