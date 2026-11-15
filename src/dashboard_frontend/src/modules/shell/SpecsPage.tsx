import React, { useMemo } from 'react';
import { useProjects } from '../projects/ProjectProvider';
import { storeGroups, storeOf } from '../projects/stores';
import { useShell } from './ShellProvider';
import { Pill, type Tone } from '../ui/ui';
import type { SpecBlock, SpecWord } from './types';

const WORD_TONE: Record<SpecWord, Tone> = {
  live: 'accent',
  closed: 'success',
  deferred: 'neutral',
  next: 'neutral',
  stopped: 'neutral',
  'not started': 'neutral',
};

/**
 * The read-only Specs page (design C8, D17; Requirement 1). One block per
 * enabled spec store, titled with the representative's project name, with
 * one plain line per decomposition heading carrying its number, state word,
 * spec name and fact. No chips, search, pager, document versions, phase
 * table or detail panel; a line links nowhere (D17). A `shell-specs` push
 * replaces the blocks through ShellProvider, so the page refreshes with no
 * reload (Requirement 1 AC 8).
 */
export function SpecsPage() {
  const { projects, enabled } = useProjects();
  const { specBlocks } = useShell();

  const groups = useMemo(() => storeGroups(projects, enabled), [projects, enabled]);
  const enabledGroups = useMemo(() => groups.filter((g) => g.enabled), [groups]);

  const blockByStore = useMemo(() => {
    const map = new Map<string, SpecBlock>();
    for (const b of specBlocks) map.set(storeOf(projects, b.projectId), b);
    return map;
  }, [specBlocks, projects]);

  return (
    <div data-testid="page-list">
      {enabledGroups.map((g) => {
        const block = blockByStore.get(g.store);
        const projectId = g.representative.projectId;
        return (
          <section key={g.store} className="mb-4" data-testid={`specs-block-${projectId}`}>
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              {g.representative.projectName}
            </h2>
            {!block || block.lines.length === 0 ? (
              <p className="text-sm text-[var(--text-muted)]" data-testid={`specs-no-decomposition-${projectId}`}>
                {'No decomposition'}
              </p>
            ) : (
              <div>
                {block.lines.map((line) => (
                  <div
                    key={line.spec}
                    className="flex items-center gap-3 overflow-hidden px-2 py-1 text-sm"
                    data-testid={`spec-line-${projectId}-${line.spec}`}
                  >
                    <span className="shrink-0 text-xs tabular-nums text-[var(--text-muted)]">{line.number}</span>
                    <Pill
                      tone={WORD_TONE[line.word]}
                      className="shrink-0"
                      data-testid={`spec-word-${projectId}-${line.spec}`}
                    >
                      {line.word}
                    </Pill>
                    <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">{line.spec}</span>
                    {line.fact && (
                      <span className="hidden shrink-0 truncate text-xs text-[var(--text-secondary)] sm:inline">
                        {line.fact}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
