import React from 'react';
import { Button, ui } from '../ui/ui';
import { ageTone, compactAge, mergeRead, waitSummary } from './board';
import type { ControllerRun, ControllerWait, StagedAction } from './types';
import type { Stage } from './stage';

// Design C10 "Home and tiles" (tasks 11-12). The `Tile` frame, `WaitTile`,
// `ActionTile` and `StageLine` exist so far; `RunTile` and `NextTile` arrive
// in later tasks.

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

/** One-line target of a staged action; moved verbatim from NowPage.tsx:98-102. */
function actionTarget(action: StagedAction): string {
  const t = action.target as { project?: string; spec?: string; pr?: number; wait?: string };
  const parts = [t.project, t.spec, t.pr ? `#${t.pr}` : undefined, t.wait].filter(Boolean);
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
  onConfirm,
  onDismiss,
}: {
  action: StagedAction;
  now: number;
  stage: Stage | null;
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
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-(--text-primary)">{actionTarget(action)}</span>
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
