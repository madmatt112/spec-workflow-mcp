import React, { useState } from 'react';
import { Button, ui } from '../ui/ui';
import { ageTone, compactAge, isStalled, launchPress, mergeRead, runControls, runDot, runTone, setupLine, waitSummary } from './board';
import { pauseNote, pauseNoteClass } from './pause';
import { OpErrorView } from './harness';
import type { SetupView } from '../harness/types';
import type { ControllerRun, ControllerWait, StagedAction } from './types';
import type { Stage } from './stage';

// Design C10 "Home and tiles" (tasks 11-15). `Tile`, `WaitTile`, `ActionTile`,
// `StageLine`, `RunTile` and `NextTile` with their press controls.

const CTRL_KIND_LABELS: Record<ControllerWait['kind'], string> = {
  'gate-a': 'Gate A', 'gate-b': 'Gate B', 'retro-plan': 'Retro plan',
  merge: 'Merge', escalation: 'Escalation', error: 'Error', question: 'Question',
};

const STAGED_KIND_LABELS: Record<StagedAction['kind'], string> = {
  merge: 'Merge', deploy: 'Deploy', launch: 'Launch', answer: 'Answer',
  deferral: 'Deferral', decomposition: 'Decomposition', backlog: 'Backlog',
};

function KindBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-(--surface-inset) px-2 py-0.5 text-xs font-medium text-(--text-secondary)">
      {label}
    </span>
  );
}

/** The tile frame (design C10): `ui.tile(tone)` keeps `--surface-panel` as the
 *  fill and colours only the border and age by tone. */
export function Tile({
  tone,
  testId,
  children,
}: {
  tone: 'neutral' | 'warning' | 'danger';
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`${ui.tile(tone)} min-w-0 space-y-2`} data-tone={tone} data-testid={testId}>
      {children}
    </div>
  );
}

/** For a `merge` wait, the PR line from `mergeRead`, else "PR not read yet" (R4 AC 3). */
function MergeLine({ wait, runs }: { wait: ControllerWait; runs: ControllerRun[] }) {
  if (wait.kind !== 'merge') return null;
  const read = mergeRead(wait, runs);
  if (!read) {
    return <p className="text-sm text-(--text-muted)">{'PR not read yet'}</p>;
  }
  return (
    <p className="text-sm text-(--text-secondary)">
      {`PR #${read.number} · ${read.ci} · ${read.verdict}`}
    </p>
  );
}

/** A controller wait as a tile (design C10, R4): kind, project tag, spec,
 *  summary, age in the display size, Answer, and the merge PR line. */
export function WaitTile({
  wait,
  runs,
  projectName,
  now,
  onAnswer,
}: {
  wait: ControllerWait;
  runs: ControllerRun[];
  projectName: string;
  now: number;
  onAnswer: () => void;
}) {
  const age = now - Date.parse(wait.created);
  const tone = ageTone(age);
  return (
    <Tile tone={tone} testId={`wait-tile-${wait.id}`}>
      <div className="flex items-center gap-2">
        <KindBadge label={CTRL_KIND_LABELS[wait.kind] ?? wait.kind} />
        <span className="shrink-0 text-xs text-(--text-muted)">{projectName}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-(--text-primary)">{wait.spec}</span>
      </div>
      <p className="whitespace-normal break-words text-sm text-(--text-primary)">{waitSummary(wait)}</p>
      <MergeLine wait={wait} runs={runs} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-display tabular-nums text-(--text-primary)">
          {'Age '}{compactAge(age)}{' ago'}
        </span>
        <Button variant="secondary" onClick={onAnswer} data-testid={`wait-answer-${wait.id}`}>
          {'Answer'}
        </Button>
      </div>
    </Tile>
  );
}

/** Dot colour classes (design C10); red from tokens.css:92. */
const RUN_DOT_CLASS: Record<'green' | 'amber' | 'grey' | 'red', string> = {
  green: 'bg-(--tone-success-fg)',
  amber: 'bg-(--tone-warning-fg)',
  grey: 'bg-(--tone-neutral-fg)',
  red: 'bg-(--tone-danger-fg)',
};

function RunDot({ color }: { color: 'green' | 'amber' | 'grey' | 'red' }) {
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${RUN_DOT_CLASS[color]}`} />;
}

/** A controller run as a tile (design C9, C10, C11, D21-D23, D36-D38; R6, R7,
 *  R9, R12 AC 3): spec, project tag, step kind, task, step age, the pause
 *  note, a heartbeat line and dot while a step is in flight, or red
 *  "Stalled" and Re-drive in its place. A `merging` run adds its PR, CI,
 *  verdict and "next check in N"; a `queued` run shows "queued". Pause,
 *  Resume, Stop, Discard and Re-drive go through the caller's stage hook
 *  (`onPause`/`onResume`/`onStop`/`onDiscard`/`onRedrive`); which controls
 *  show comes from `runControls`. Discard's first press only arms local
 *  state (`secondary`); the armed press (`danger`) carries "This deletes the
 *  worktree and branch and closes the PR" and is the only one that calls the
 *  route (D36).
 *  A stopped run with `discardAllowed: false` shows the quiet line "branch
 *  in use by a live run" instead of any control. */
export function RunTile({
  run,
  waits,
  projectName,
  now,
  stage,
  onPause,
  onResume,
  onStop,
  onDiscard,
  onRedrive,
}: {
  run: ControllerRun;
  waits: ControllerWait[];
  projectName: string;
  now: number;
  stage: Stage | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDiscard: () => void;
  onRedrive: () => void;
}) {
  const tone = runTone(run, waits, now);
  const stalled = isStalled(run, waits);
  const note = pauseNote(run, now);
  const heartbeatBase = run.lastActivity ?? run.stepStarted;
  const prRead = run.prReads?.find((read) => read.kind === 'run') ?? null;
  const controls = runControls(run, waits);
  const busy = stage !== null && (stage.phase === 'pressed' || stage.phase === 'running');
  const [discardArmed, setDiscardArmed] = useState(false);
  const noControls = !controls.pause && !controls.resume && !controls.stop && !controls.discard && !controls.redrive;
  return (
    <Tile tone={tone} testId={`run-tile-${run.id}`}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-(--text-muted)">{projectName}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-(--text-primary)">{run.spec}</span>
        <span className="shrink-0 text-xs text-(--text-muted)" data-testid={`run-age-${run.id}`}>
          {`run ${compactAge(now - Date.parse(run.created))}`}
        </span>
      </div>
      {(run.phase || run.stepKind || run.task) && (
        <p className="text-sm text-(--text-primary)">
          {[run.phase, run.stepKind, run.task].filter(Boolean).join(' · ')}
        </p>
      )}
      {run.stepStarted && (
        <span className="text-display tabular-nums text-(--text-primary)">
          {compactAge(now - Date.parse(run.stepStarted))}
        </span>
      )}
      {note && <p className={`text-sm ${pauseNoteClass(note)}`}>{note.text}</p>}
      <div className="flex items-center gap-2">
        {stalled ? (
          <>
            <span className="text-sm font-medium text-(--tone-danger-fg)">{'Stalled'}</span>
            <Button variant="secondary" size="sm" disabled={busy} onClick={onRedrive} data-testid={`run-redrive-${run.id}`}>
              {'Re-drive'}
            </Button>
          </>
        ) : run.inFlight && heartbeatBase ? (
          <>
            <RunDot color={runDot(run, now)} />
            <span className="text-sm text-(--text-secondary)">
              {`last activity ${compactAge(now - Date.parse(heartbeatBase))} ago`}
            </span>
          </>
        ) : (
          <RunDot color={runDot(run, now)} />
        )}
      </div>
      {run.status === 'merging' && prRead && (
        <p className="text-sm text-(--text-secondary)">
          {`PR #${prRead.number} · ${prRead.ci} · ${prRead.verdict}`}
        </p>
      )}
      {run.status === 'merging' && run.resumeAt && (
        <p className="text-sm text-(--text-muted)">
          {`next check in ${compactAge(Date.parse(run.resumeAt) - now)}`}
        </p>
      )}
      {run.status === 'queued' && <p className="text-sm text-(--text-primary)">{'queued'}</p>}
      {noControls && <p className="text-sm text-(--text-muted)">{'branch in use by a live run'}</p>}
      <StageLine stage={stage} />
      <div className="flex flex-wrap items-center gap-2">
        {controls.pause && (
          <Button variant="secondary" disabled={busy} onClick={onPause} data-testid={`run-pause-${run.id}`}>
            {'Pause'}
          </Button>
        )}
        {controls.resume && (
          <Button variant="secondary" disabled={busy} onClick={onResume} data-testid={`run-resume-${run.id}`}>
            {'Resume'}
          </Button>
        )}
        {controls.stop && (
          <Button variant="secondary" disabled={busy} onClick={onStop} data-testid={`run-stop-${run.id}`}>
            {'Stop'}
          </Button>
        )}
        {controls.discard && (
          discardArmed ? (
            <Button variant="danger" disabled={busy} onClick={onDiscard} data-testid={`run-discard-confirm-${run.id}`}>
              {'This deletes the worktree and branch and closes the PR'}
            </Button>
          ) : (
            <Button variant="secondary" disabled={busy} onClick={() => setDiscardArmed(true)} data-testid={`run-discard-${run.id}`}>
              {'Discard'}
            </Button>
          )
        )}
      </div>
    </Tile>
  );
}

/** A launchable project as a tile (design C9, C10, C2, D29, D30; R8, R9 AC 2;
 *  Requirement 2 AC 1-5, 9): spec, project tag, code root, the setup line
 *  task 9 exports, the guard's warning, and Launch through the caller's
 *  stage hook. A `warn` guard arms on the first press and only calls
 *  `onLaunch` on the second, keyed on the launchable spec so arming a stale
 *  tile does not carry over to a new spec (`launchPress`). A launch refusal
 *  keeps the stage's `opError` (`stage.ts`'s `responseStage`), which renders
 *  `OpErrorView` here, in addition to `StageLine`'s `failReason` text. No
 *  edit control. */
export function NextTile({
  projectId,
  projectName,
  codeRoot,
  useProject,
  view,
  stage,
  onLaunch,
}: {
  projectId: string;
  projectName: string;
  codeRoot: string;
  useProject?: { name: string; codeRoot: string };
  view: SetupView;
  stage: Stage | null;
  onLaunch: () => void;
}) {
  const busy = stage !== null && (stage.phase === 'pressed' || stage.phase === 'running');
  const [armedSpec, setArmedSpec] = useState<string | null>(null);
  const guard = view.guard;
  const armed = guard?.state === 'warn' && armedSpec === view.launchable;
  const tone: 'neutral' | 'warning' | 'danger' = guard?.state === 'warn' ? 'warning' : 'neutral';
  const handleLaunch = () => {
    if (launchPress(view, armedSpec) === 'arm') {
      setArmedSpec(view.launchable);
      return;
    }
    onLaunch();
  };
  return (
    <Tile tone={tone} testId={`next-tile-${projectId}`}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-(--text-muted)">{projectName}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-(--text-primary)">{view.launchable}</span>
      </div>
      <p className="text-sm text-(--text-secondary)">{setupLine(view)}</p>
      <p className="text-sm text-(--text-muted)" data-testid={`next-code-root-${projectId}`}>{codeRoot}</p>
      {guard?.state === 'warn' && useProject && (
        <p className="text-sm text-(--tone-warning-fg)" data-testid={`next-guard-${projectId}`}>
          {`${guard.held} of ${guard.compared} spec files are under ${codeRoot}. Use ${useProject.name} (${useProject.codeRoot}).`}
        </p>
      )}
      {guard?.state === 'no-list' && (
        <p className="text-sm text-(--text-muted)" data-testid={`next-guard-${projectId}`}>
          {'No file list to compare'}
        </p>
      )}
      <StageLine stage={stage} />
      {stage?.phase === 'failed' && stage.opError && <OpErrorView error={stage.opError} />}
      <Button
        variant={armed ? 'danger' : 'secondary'}
        disabled={busy}
        onClick={handleLaunch}
        data-testid={`next-launch-${projectId}`}
      >
        {armed ? 'Launch anyway' : 'Launch'}
      </Button>
    </Tile>
  );
}

/** One-line target of a staged action; `t.project` renders through
 *  `projectName` (design C1) so a registered project shows its display
 *  name, not the raw id. */
function actionTarget(action: StagedAction, projectName: (id: string) => string): string {
  const t = action.target as { project?: string; spec?: string; pr?: number; wait?: string };
  const project = typeof t.project === 'string' ? projectName(t.project) : undefined;
  const parts = [project, t.spec, t.pr ? `#${t.pr}` : undefined, t.wait].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/** The pressed control's stage text (design C11): the phase name, plus the
 *  failure reason when the stage is `failed` (Requirement 9 AC 2). */
export function StageLine({ stage }: { stage: Stage | null }) {
  if (stage === null) return null;
  const text = stage.phase === 'failed' && stage.reason ? `${stage.phase} — ${stage.reason}` : stage.phase;
  return <p className="text-sm text-(--text-muted)">{text}</p>;
}

/** A staged advisor action as a tile (design C10, C11; R5, R9): kind, target,
 *  reason, age and, while `staged`, Confirm and Dismiss. A `pressed` or
 *  `running` stage disables both controls until it ends (D37); a tile kept
 *  rendering only because its stage has not cleared (the action itself has
 *  left `needsYou`) shows no controls, since it is never `staged` by then. */
export function ActionTile({
  action,
  now,
  stage,
  projectName,
  onConfirm,
  onDismiss,
}: {
  action: StagedAction;
  now: number;
  stage: Stage | null;
  projectName: (id: string) => string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  const age = now - Date.parse(action.created);
  const tone = ageTone(age);
  const busy = stage !== null && (stage.phase === 'pressed' || stage.phase === 'running');
  return (
    <Tile tone={tone} testId={`action-tile-${action.id}`}>
      <div className="flex items-center gap-2">
        <KindBadge label={STAGED_KIND_LABELS[action.kind] ?? action.kind} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-(--text-primary)">{actionTarget(action, projectName)}</span>
      </div>
      <p className="whitespace-normal break-words text-sm text-(--text-primary)">{action.reason}</p>
      <StageLine stage={stage} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-display tabular-nums text-(--text-primary)">
          {'Age '}{compactAge(age)}{' ago'}
        </span>
        {action.state === 'staged' && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onConfirm} disabled={busy} data-testid={`action-confirm-${action.id}`}>
              {'Confirm'}
            </Button>
            <Button variant="secondary" onClick={onDismiss} disabled={busy} data-testid={`action-dismiss-${action.id}`}>
              {'Dismiss'}
            </Button>
          </div>
        )}
      </div>
    </Tile>
  );
}
