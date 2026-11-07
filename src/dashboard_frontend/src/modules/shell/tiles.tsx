import React from 'react';
import { Button, ui } from '../ui/ui';
import { ageTone, compactAge, mergeRead, waitSummary } from './board';
import type { ControllerRun, ControllerWait } from './types';

// Design C10 "Home and tiles" (task 11). Only the `Tile` frame and `WaitTile`
// exist so far; `ActionTile`, `RunTile`, `NextTile` and `StageLine` arrive in
// tasks 12-15.

const CTRL_KIND_LABELS: Record<ControllerWait['kind'], string> = {
  'gate-a': 'Gate A', 'gate-b': 'Gate B', 'retro-plan': 'Retro plan',
  merge: 'Merge', escalation: 'Escalation', error: 'Error', question: 'Question',
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
