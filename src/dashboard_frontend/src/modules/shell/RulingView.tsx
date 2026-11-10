import React, { useEffect, useState } from 'react';
import { Button, ui } from '../ui/ui';
import { compactAge, mergeRead } from './board';
import {
  rulingLayout, initialValues, canSubmit, answerPayload, securityLines, offersAbandon,
} from './ruling';
import type { ControllerRun, ControllerWait, ControllerWaitQuestion, DiffFile, WaitDiff, WaitTaskRow } from './types';
import type { Stage } from './stage';

// Design C8 "Ruling view (frontend)" (R1, R3, R5, R6; task 11). Replaces
// the deleted controller-wait answer sheet.

const CTRL_KIND_LABELS: Record<ControllerWait['kind'], string> = {
  'gate-a': 'Gate A', 'gate-b': 'Gate B', 'retro-plan': 'Retro plan',
  merge: 'Merge', escalation: 'Escalation', error: 'Error', question: 'Question',
};

type DiffFetchState = WaitDiff | { state: 'fetch-failed'; status: number };

function KindBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-(--surface-inset) px-2 py-0.5 text-xs font-medium text-(--text-secondary)">
      {label}
    </span>
  );
}

function DetailText({ heading, body }: { heading: string; body?: string | null }) {
  if (!body || !body.trim()) return null;
  return (
    <div>
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{heading}</h4>
      <p className="whitespace-pre-wrap text-sm text-(--text-primary)">{body}</p>
    </div>
  );
}

/** "Second opinion" on an open wait (design C7, C12): disabled while running. */
function SecondOpinionButton({ wait }: { wait: ControllerWait }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const running = wait.opinionStatus?.state === 'running';
  const failureReason = wait.opinionStatus?.state === 'failed' ? wait.opinionStatus.reason : undefined;

  async function press() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/controller/waits/${wait.id}/second-opinion`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string; reason?: string }));
        throw new Error(body?.reason ?? body?.error ?? `second opinion failed (${res.status})`);
      }
    } catch (e: any) {
      setError(e?.message ?? 'second opinion failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" onClick={press} disabled={running || pending} data-testid="second-opinion">
        {'Second opinion'}
      </Button>
      {(failureReason || error) && (
        <span className="min-w-0 text-xs text-(--tone-danger-fg)">{failureReason ?? error}</span>
      )}
    </div>
  );
}

/** Split a raw proposal block into its bold title and the prose that follows. */
function splitProposal(block: string): { title: string; body: string } {
  const m = block.match(/\*\*([\s\S]*?)\*\*/);
  if (!m) return { title: block.replace(/^-\s*/, '').trim(), body: '' };
  const title = m[1].replace(/\s+/g, ' ').trim();
  const body = block.slice((m.index ?? 0) + m[0].length).replace(/\s+/g, ' ').trim();
  return { title, body };
}

/** The question id a non-gate decision records under. */
function decisionKey(wait: ControllerWait): string {
  return wait.questions[0]?.id ?? wait.kind;
}

function RulingHeader({
  wait, run, projectName, now,
}: { wait: ControllerWait; run: ControllerRun | undefined; projectName: string; now: number }) {
  const age = now - Date.parse(wait.created);
  const taskId = wait.questions[0]?.task;
  return (
    <div className="mb-3 space-y-1" data-testid="ruling-header">
      <div className="flex items-center gap-2">
        <KindBadge label={CTRL_KIND_LABELS[wait.kind] ?? wait.kind} />
        <span className="text-xs text-(--text-muted)">{projectName}</span>
        <span className="text-xs text-(--text-muted)">{wait.spec}</span>
      </div>
      <p className="break-words text-sm text-(--text-secondary)">{`wait ${wait.id}`}</p>
      <p className="break-words text-sm text-(--text-secondary)">
        {run
          ? `run ${run.id} · ${[run.phase, run.stepKind].filter(Boolean).join(' · ')}`
          : `run ${wait.run} · run record gone`}
      </p>
      {taskId && <p className="text-sm text-(--text-secondary)">{`task ${taskId}`}</p>}
      <span className="text-display tabular-nums text-(--text-primary)" data-testid="ruling-age">
        {`Age ${compactAge(age)} ago`}
      </span>
    </div>
  );
}

function QuestionFields({
  wait, picks, texts, setPick, setText, showText = true,
}: {
  wait: ControllerWait;
  picks: Record<string, string>;
  texts: Record<string, string>;
  setPick: (id: string, value: string) => void;
  setText: (id: string, value: string) => void;
  showText?: boolean;
}) {
  return (
    <div className="space-y-4">
      {wait.questions.map((q: ControllerWaitQuestion) => {
        const hasOptions = !!q.options && q.options.length > 0;
        return (
          <div key={q.id}>
            {showText && (
              <p className="mb-1 whitespace-normal break-words text-sm font-medium text-(--text-primary)">{q.text}</p>
            )}
            {hasOptions && (
              <div className="space-y-1">
                {q.options!.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-(--text-secondary)">
                    <input
                      type="radio"
                      name={q.id}
                      checked={picks[q.id] === opt}
                      onChange={() => setPick(q.id, opt)}
                      data-testid={`answer-opt-${q.id}`}
                    />
                    {opt}
                    {q.recommended === opt && <span className="text-xs text-(--text-muted)">{'(recommended)'}</span>}
                    {q.recommended === opt && q.reason && <span className="text-xs text-(--text-muted)">{q.reason}</span>}
                  </label>
                ))}
              </div>
            )}
            {(!hasOptions || q.free) && (
              <textarea
                value={texts[q.id] ?? ''}
                onChange={(e) => setText(q.id, e.target.value)}
                data-testid={`answer-text-${q.id}`}
                rows={2}
                className="w-full rounded-md border border-(--border-default) bg-(--surface-inset) px-3 py-1.5 text-sm text-(--text-primary)"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TaskRowView({ row }: { row: WaitTaskRow | null }) {
  return (
    <div
      data-testid="ruling-task-row"
      className="space-y-1 rounded-md border border-(--border-default) bg-(--surface-inset) p-3 text-sm"
    >
      {row === null ? null : row.state === 'not-found' ? (
        <p className="text-(--text-secondary)">{`task ${row.id} not found in tasks.md`}</p>
      ) : row.state === 'no-task' ? (
        <p className="text-(--text-secondary)">{'no task'}</p>
      ) : (
        <>
          <p className="font-medium text-(--text-primary)">{`${row.id}. ${row.title}`}</p>
          <p className="text-(--text-secondary)">{row.success ?? 'no Success clause'}</p>
          <p className="text-(--text-secondary)">{`TDD ${row.tdd ? 'yes' : 'no'}`}</p>
          <p className="text-(--text-secondary)">{row.risk ?? 'risk not scored yet'}</p>
          <ul className="list-disc space-y-0.5 pl-5 text-(--text-secondary)">
            {row.files.map((f) => <li key={f}>{f}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

function DetailView({ detail }: { detail?: string }) {
  return (
    <div data-testid="ruling-detail" className="whitespace-pre-wrap text-sm text-(--text-primary)">
      {detail && detail.trim() ? detail : 'no worker report or task review'}
    </div>
  );
}

function DiffLineView({ line }: { line: { kind: 'add' | 'del' | 'ctx'; text: string } }) {
  const cls = line.kind === 'add'
    ? 'text-(--tone-success-fg)'
    : line.kind === 'del'
      ? 'text-(--tone-danger-fg)'
      : 'text-(--text-secondary)';
  const prefix = line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' ';
  return <div className={`whitespace-pre text-xs ${cls}`}>{`${prefix}${line.text}`}</div>;
}

function DiffFileView({ file }: { file: DiffFile }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-(--text-primary)">{file.path}</p>
      {file.binary ? (
        <p className="text-sm text-(--text-muted)">{'binary'}</p>
      ) : (
        <>
          {file.hunks.map((hunk, i) => (
            <div key={i}>
              <p className="text-xs text-(--text-muted)">{hunk.header}</p>
              {hunk.lines.map((line, j) => <DiffLineView key={j} line={line} />)}
            </div>
          ))}
          {file.droppedLines > 0 && (
            <p className="text-xs text-(--text-muted)">{`${file.droppedLines} lines dropped`}</p>
          )}
        </>
      )}
    </div>
  );
}

function DiffView({ diff }: { diff: DiffFetchState | null }) {
  let content: React.ReactNode = null;
  if (diff === null) {
    content = null;
  } else if (diff.state === 'fetch-failed') {
    content = <p className="text-sm text-(--tone-danger-fg)">{`diff request failed (${diff.status})`}</p>;
  } else if (diff.state === 'worktree-gone') {
    content = <p className="text-sm text-(--text-secondary)">{'worktree gone'}</p>;
  } else if (diff.state === 'no-commits') {
    content = <p className="text-sm text-(--text-secondary)">{'no commits for this task'}</p>;
  } else if (diff.state === 'run-gone') {
    content = <p className="text-sm text-(--text-secondary)">{'run record gone'}</p>;
  } else if (diff.state === 'unreadable') {
    content = <p className="text-sm text-(--tone-danger-fg)">{`git could not read the diff: ${diff.error}`}</p>;
  } else {
    content = (
      <div className="space-y-3">
        {diff.commits.map((commit) => (
          <div key={commit.hash} className="space-y-2">
            <p className="text-sm font-medium text-(--text-primary)">{`${commit.hash} ${commit.subject}`}</p>
            {!commit.found ? (
              <p className="text-sm text-(--text-secondary)">{'not found in the worktree'}</p>
            ) : (
              commit.files.map((file) => <DiffFileView key={file.path} file={file} />)
            )}
          </div>
        ))}
        {diff.overflow.count > 0 && (
          <p className="text-sm text-(--text-muted)">
            {`${diff.overflow.count} more file(s): ${diff.overflow.paths.join(', ')}`}
          </p>
        )}
      </div>
    );
  }
  return <div data-testid="ruling-diff" className="space-y-2">{content}</div>;
}

function MergeBody({ wait, runs }: { wait: ControllerWait; runs: ControllerRun[] }) {
  const read = mergeRead(wait, runs);
  if (!read) return <p className="text-sm text-(--text-secondary)">{'PR not read yet'}</p>;
  return (
    <div className="space-y-1 text-sm text-(--text-secondary)">
      <p className="text-(--text-primary)">
        {read.url && read.url.startsWith('https')
          ? <a href={read.url} target="_blank" rel="noreferrer" className="underline">{`PR #${read.number}`}</a>
          : `PR #${read.number}`}
      </p>
      <p>{`CI ${read.ci}`}</p>
      {read.mergeable && <p>{`mergeable ${read.mergeable}`}</p>}
      <p>{`verdict ${read.verdict}`}</p>
      {read.reasons.map((r, i) => <p key={i}>{r}</p>)}
    </div>
  );
}

function AnswerStageLine({ stage }: { stage: Stage | null }) {
  if (stage === null) return null;
  const text = stage.phase === 'failed' && stage.reason ? `failed: ${stage.reason}` : stage.phase;
  return <p className="text-sm text-(--text-muted)" data-testid="answer-stage">{text}</p>;
}

export function RulingView({
  wait, runs, projectName, now, stage, onAnswer,
}: {
  wait: ControllerWait;
  runs: ControllerRun[];
  projectName: string;
  now: number;
  stage: Stage | null;
  onAnswer: (body: { answers: Record<string, string>; by: 'operator'; note?: string }) => void;
}) {
  const run = runs.find((r) => r.id === wait.run);
  const layout = rulingLayout(wait);

  const [picks, setPicks] = useState<Record<string, string>>(() => {
    const base = initialValues(wait);
    if (wait.kind === 'retro-plan') {
      (wait.proposals ?? []).forEach((_, i) => { base[`proposal:${i}`] = 'approve'; });
    }
    return base;
  });
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [taskRow, setTaskRow] = useState<WaitTaskRow | null>(null);
  const [diff, setDiff] = useState<DiffFetchState | null>(null);

  const setPick = (id: string, value: string) => setPicks((prev) => ({ ...prev, [id]: value }));
  const setText = (id: string, value: string) => setTexts((prev) => ({ ...prev, [id]: value }));

  useEffect(() => {
    if (layout !== 'task') return;
    let cancelled = false;
    fetch(`/api/controller/waits/${wait.id}/task`)
      .then((res) => (res.ok ? res.json() : null))
      .then((row) => { if (!cancelled) setTaskRow(row); })
      .catch(() => { if (!cancelled) setTaskRow(null); });
    fetch(`/api/controller/waits/${wait.id}/diff`)
      .then(async (res) => (res.ok ? res.json() : { state: 'fetch-failed' as const, status: res.status }))
      .then((d) => { if (!cancelled) setDiff(d); })
      .catch(() => { if (!cancelled) setDiff({ state: 'fetch-failed', status: 0 }); });
    return () => { cancelled = true; };
  }, [wait.id, layout]);

  const canAnswer = canSubmit(wait, picks, texts);
  const busy = stage !== null && (stage.phase === 'pressed' || stage.phase === 'running');

  function submit() {
    const payload = answerPayload(wait, picks, texts, notes);
    onAnswer({ ...payload, by: 'operator' });
  }
  function abandon() {
    onAnswer({ answers: { [decisionKey(wait)]: 'abandon' }, by: 'operator' });
  }
  function mergeDecision(value: 'merge' | 'hold') {
    onAnswer({ answers: { [decisionKey(wait)]: value }, by: 'operator' });
  }

  let bodyNode: React.ReactNode;
  if (layout === 'task') {
    bodyNode = (
      <>
        <QuestionFields wait={wait} picks={picks} texts={texts} setPick={setPick} setText={setText} />
        <TaskRowView row={taskRow} />
        <DetailView detail={wait.detail} />
        <DiffView diff={diff} />
      </>
    );
  } else if (layout === 'taskless') {
    bodyNode = (
      <>
        <QuestionFields wait={wait} picks={picks} texts={texts} setPick={setPick} setText={setText} />
        <p className="text-sm text-(--text-secondary)">
          {`no task: raised in the ${run ? (run.phase ?? 'unknown') : 'unknown'} phase`}
        </p>
      </>
    );
  } else if (layout === 'security') {
    const q = wait.questions.find((qq) => qq.id === 'security');
    const lines = securityLines(q?.text ?? '');
    bodyNode = (
      <>
        <div className="space-y-2">
          <p className="text-sm text-(--text-primary)">{lines.lead}</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-(--text-secondary)">
            {lines.findings.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
          <p className="text-sm text-(--text-primary)">{lines.tail}</p>
        </div>
        <QuestionFields wait={wait} picks={picks} texts={texts} setPick={setPick} setText={setText} showText={false} />
      </>
    );
  } else if (layout === 'gate') {
    const heading = wait.kind === 'gate-a' ? 'Recorded without asking' : 'The plan';
    bodyNode = (
      <>
        <QuestionFields wait={wait} picks={picks} texts={texts} setPick={setPick} setText={setText} />
        {wait.proposals && wait.proposals.length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{heading}</h4>
            <div className="space-y-1 text-sm text-(--text-secondary)">
              {wait.proposals.map((p, i) => <p key={i}>{p}</p>)}
            </div>
          </div>
        )}
      </>
    );
  } else if (layout === 'retro-plan') {
    bodyNode = (
      <>
        <QuestionFields wait={wait} picks={picks} texts={texts} setPick={setPick} setText={setText} />
        {wait.proposals && wait.proposals.length > 0 && (
          <div>
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--text-muted)">{'Proposals'}</h4>
            <div className="space-y-2">
              {wait.proposals.map((p, i) => {
                const { title, body } = splitProposal(p);
                const key = `proposal:${i}`;
                const checked = picks[key] !== 'drop';
                return (
                  <div key={i} className="flex items-start gap-2 text-sm text-(--text-secondary)">
                    <input
                      type="checkbox"
                      id={key}
                      checked={checked}
                      onChange={() => setPick(key, checked ? 'drop' : 'approve')}
                      data-testid={key}
                      aria-label={`Approve ${title}`}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <label htmlFor={key} className="cursor-pointer whitespace-normal break-words font-medium text-(--text-primary)">
                        {title}
                      </label>
                      {body && (
                        <details className="mt-0.5">
                          <summary className="cursor-pointer text-xs text-(--text-muted)">{'Details'}</summary>
                          <p className="mt-1 whitespace-normal break-words text-(--text-secondary)">{body}</p>
                        </details>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </>
    );
  } else if (layout === 'merge') {
    bodyNode = <MergeBody wait={wait} runs={runs} />;
  } else {
    bodyNode = <QuestionFields wait={wait} picks={picks} texts={texts} setPick={setPick} setText={setText} />;
  }

  return (
    <div className={`${ui.panel} p-4`} data-testid="now-answer-sheet">
      <RulingHeader wait={wait} run={run} projectName={projectName} now={now} />
      <div className="space-y-4 border-t border-(--border-default) pt-3">
        {bodyNode}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          data-testid="ruling-notes"
          rows={2}
          placeholder={'Notes'}
          className="w-full rounded-md border border-(--border-default) bg-(--surface-inset) px-3 py-1.5 text-sm text-(--text-primary)"
        />
        <SecondOpinionButton wait={wait} />
        {wait.opinion ? (
          <DetailText heading={'Opinion'} body={wait.opinion.summary} />
        ) : (
          <DetailText heading={'Advice'} body={wait.advice} />
        )}
        <div className="flex items-center gap-3">
          {wait.kind === 'merge' ? (
            <>
              <Button variant="primary" onClick={() => mergeDecision('merge')} disabled={busy} data-testid="answer-submit">
                {'Merge'}
              </Button>
              <Button variant="secondary" onClick={() => mergeDecision('hold')} disabled={busy} data-testid="answer-hold">
                {'Hold'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" onClick={submit} disabled={busy || !canAnswer} data-testid="answer-submit">
                {'Answer and continue the run'}
              </Button>
              {offersAbandon(wait) && (
                <Button variant="secondary" onClick={abandon} disabled={busy} data-testid="ruling-abandon">
                  {'Abandon the run'}
                </Button>
              )}
            </>
          )}
        </div>
        <AnswerStageLine stage={stage} />
      </div>
    </div>
  );
}
