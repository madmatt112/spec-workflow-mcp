import React, { useEffect, useMemo, useState } from 'react';
import { useProjects } from '../projects/ProjectProvider';
import { useShell } from './ShellProvider';
import { needsYou, running } from './board';
import { ActionTile, RunTile, WaitTile } from './tiles';
import { AnswerSheet } from './AnswerSheet';
import { useStages } from './useStages';
import type { ControllerWait, StagedAction } from './types';
import type { Stage } from './stage';

/** Narrows a `needsYou` entry to a controller wait; `ActionTile` renders the other half. */
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
  const stages = useStages();

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
  const needsYouItems = useMemo(
    () => (loading ? [] : needsYou(controllerWaits, controllerActions, enabled)),
    [loading, controllerWaits, controllerActions, enabled],
  );
  const needsYouWaits = useMemo(() => needsYouItems.filter(isControllerWait), [needsYouItems]);
  const runningTiles = useMemo(
    () => (loading ? [] : running(controllerRuns, enabled, tick)),
    [loading, controllerRuns, enabled, tick],
  );
  const needsYouActionIds = useMemo(
    () => new Set(needsYouItems.filter((item): item is StagedAction => !isControllerWait(item)).map((a) => a.id)),
    [needsYouItems],
  );

  // A pressed action's tile stays rendered from its last snapshot until the
  // stage clears, even once the real action has left `needsYou` (design
  // C11's retained tile; `useStages`'s `retained` is task 10's export).
  const actionTiles: Array<{ action: StagedAction; stage: Stage | null }> = [];
  for (const action of controllerActions) {
    const isLive = needsYouActionIds.has(action.id);
    if (!isLive && !stages.stages.has(action.id)) continue;
    const stage = stages.retained(action.id, {
      actionState: action.state,
      actionDetail: action.outcome?.detail.join('; '),
    });
    if (isLive || stage !== null) actionTiles.push({ action, stage });
  }

  const boardTiles = [
    ...needsYouWaits.map((wait) => ({
      created: wait.created,
      node: (
        <WaitTile
          key={wait.id}
          wait={wait}
          runs={controllerRuns}
          projectName={projectName(wait.project)}
          now={tick}
          onAnswer={() => setOpenWaitId(wait.id)}
        />
      ),
    })),
    ...actionTiles.map(({ action, stage }) => ({
      created: action.created,
      node: (
        <ActionTile
          key={action.id}
          action={action}
          now={tick}
          stage={stage}
          onConfirm={() => stages.press(action.id, 'confirm', `/api/controller/actions/${action.id}/confirm`, 'POST')}
          onDismiss={() => stages.press(action.id, 'dismiss', `/api/controller/actions/${action.id}/dismiss`, 'POST')}
        />
      ),
    })),
  ].sort((a, b) => Date.parse(a.created) - Date.parse(b.created));

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
        {boardTiles.map((tile) => tile.node)}
      </Band>
      <Band testId="band-running" title="Running" emptyText="No live runs.">
        {runningTiles.map((run) => (
          <RunTile
            key={run.id}
            run={run}
            waits={controllerWaits}
            projectName={projectName(run.project)}
            now={tick}
            stage={stages.retained(run.id, { run, waits: controllerWaits })}
            onPause={() => stages.press(run.id, 'pause', `/api/controller/runs/${run.id}/pause`, 'POST')}
            onResume={() => stages.press(run.id, 'resume', `/api/controller/runs/${run.id}/resume`, 'POST')}
            onStop={() => stages.press(run.id, 'stop', `/api/controller/runs/${run.id}/cancel`, 'POST')}
            onDiscard={() => stages.press(run.id, 'discard', `/api/controller/runs/${run.id}/discard`, 'POST')}
            onRedrive={() => stages.press(run.id, 'redrive', `/api/controller/runs/${run.id}/redrive`, 'POST')}
          />
        ))}
      </Band>
      <Band testId="band-next" title="Next" emptyText="Nothing launchable.">{[]}</Band>
    </div>
  );
}
