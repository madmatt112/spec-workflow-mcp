import React, { useEffect, useMemo, useState } from 'react';
import { useProjects } from '../projects/ProjectProvider';
import { useShell } from './ShellProvider';
import { needsYou } from './board';
import { WaitTile } from './tiles';
import { AnswerSheet } from './AnswerSheet';
import type { ControllerWait, StagedAction } from './types';

/** Narrows a `needsYou` entry to a controller wait; `ActionTile` arrives in task 12. */
function isControllerWait(item: ControllerWait | StagedAction): item is ControllerWait {
  return 'project' in item;
}

function Band({
  testId,
  title,
  emptyText,
  children,
}: {
  testId: string;
  title: string;
  emptyText: string;
  children: React.ReactNode[];
}) {
  return (
    <section data-testid={testId} className="space-y-3">
      <h2 className="text-sm font-semibold text-(--text-secondary)">{title}</h2>
      {children.length === 0 ? (
        <p className="text-sm text-(--text-muted)">{emptyText}</p>
      ) : (
        <div className="grid gap-(--tile-gap) lg:grid-cols-2">{children}</div>
      )}
    </section>
  );
}

/**
 * Home (design C10; Requirements 3, 4, 11.3, 11.4). Replaces the Now page:
 * three fixed, uncollapsible bands (Needs you, Running, Next) of large
 * tiles, with the controller-wait answer sheet replacing the board at full
 * width while a wait is open (D31).
 */
export function HomePage() {
  const { enabled, loading, projects } = useProjects();
  const { controllerWaits, controllerRuns, controllerActions } = useShell();
  const [tick, setTick] = useState(Date.now());
  const [openWaitId, setOpenWaitId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const projectName = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.projectId, p.projectName]));
    return (id: string) => byId.get(id) ?? id;
  }, [projects]);

  // No tile while the project list is loading, so a project the fixture
  // would otherwise filter out does not flash on first load (design C8).
  const needsYouWaits = useMemo(
    () => (loading ? [] : needsYou(controllerWaits, controllerActions, enabled).filter(isControllerWait)),
    [loading, controllerWaits, controllerActions, enabled],
  );

  // Re-derived on each render: gone, answered or filtered, and the board returns.
  const openWait = useMemo(
    () => (openWaitId ? needsYouWaits.find((w) => w.id === openWaitId) ?? null : null),
    [openWaitId, needsYouWaits],
  );

  if (openWait) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          className="text-sm font-medium text-(--text-secondary) underline-offset-2 hover:text-(--text-primary) hover:underline"
          onClick={() => setOpenWaitId(null)}
        >
          {'Back to board'}
        </button>
        <AnswerSheet
          wait={openWait}
          projectName={projectName(openWait.project)}
          onDone={() => setOpenWaitId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-(--band-gap)">
      <Band testId="band-needs-you" title="Needs you" emptyText="Nothing waiting on you.">
        {needsYouWaits.map((wait) => (
          <WaitTile
            key={wait.id}
            wait={wait}
            runs={controllerRuns}
            projectName={projectName(wait.project)}
            now={tick}
            onAnswer={() => setOpenWaitId(wait.id)}
          />
        ))}
      </Band>
      <Band testId="band-running" title="Running" emptyText="No live runs.">{[]}</Band>
      <Band testId="band-next" title="Next" emptyText="Nothing launchable.">{[]}</Band>
    </div>
  );
}
