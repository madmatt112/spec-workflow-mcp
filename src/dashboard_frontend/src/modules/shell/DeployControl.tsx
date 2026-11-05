import React, { useState } from 'react';
import { useShell } from './ShellProvider';
import { DEPLOY_STAGES, canCancel, deployHoldCount, isDeployOpen } from './deploy';
import { Button, Pill } from '../ui/ui';
import type { ControllerDeploy } from './types';

/**
 * Press, watch and cancel a deploy from the Now page (design C9 "Dashboard
 * control"; Requirement 6). No props: reads only `useShell()` (AC10), so a
 * future top-bar placement can move it unchanged.
 */
export function DeployControl() {
  const { controllerDeploy, controllerRuns } = useShell();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stage = controllerDeploy?.stage;
  const open = stage !== undefined && isDeployOpen(stage);

  async function press() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/controller/deploy', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(body?.error ?? `deploy failed (${res.status})`);
      }
      setConfirming(false);
    } catch (e: any) {
      setError(e?.message ?? 'deploy failed');
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/controller/deploy/cancel', { method: 'POST' });
      if (!res.ok) throw new Error(`cancel failed (${res.status})`);
    } catch (e: any) {
      setError(e?.message ?? 'cancel failed');
    } finally {
      setBusy(false);
    }
  }

  const holdCount = deployHoldCount(controllerRuns);
  const confirmText =
    `This holds ${holdCount} run${holdCount === 1 ? '' : 's'} and restarts the service, ` +
    'ending the advisor session opened from the dashboard';

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {confirming ? (
        <Button variant="primary" size="sm" onClick={press} disabled={busy} data-testid="deploy-confirm">
          {busy ? 'Deploying…' : confirmText}
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setConfirming(true)}
          disabled={open}
          data-testid="deploy-button"
        >
          {'Deploy'}
        </Button>
      )}

      {open && <span className="text-xs text-[var(--text-muted)]">{`Deploying: ${stage}`}</span>}

      {controllerDeploy && <DeployStrip deploy={controllerDeploy} busy={busy} onCancel={cancel} />}

      {error && (
        <span className="text-xs text-(--tone-danger-fg)" data-testid="deploy-error">
          {error}
        </span>
      )}
    </div>
  );
}

function DeployStrip({ deploy, busy, onCancel }: {
  deploy: ControllerDeploy;
  busy: boolean;
  onCancel: () => void;
}) {
  const { stage } = deploy;
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="deploy-strip">
      <ol className="flex items-center gap-1">
        {DEPLOY_STAGES.map((s) => (
          <li key={s} data-testid={`deploy-stage-${s}`} aria-current={s === stage ? 'step' : undefined}>
            {s === stage ? (
              <Pill tone="accent">{s}</Pill>
            ) : (
              <span className="text-xs text-[var(--text-muted)]">{s}</span>
            )}
          </li>
        ))}
      </ol>

      {canCancel(stage) && (
        <Button variant="secondary" size="sm" onClick={onCancel} disabled={busy} data-testid="deploy-cancel">
          {'Cancel and resume now'}
        </Button>
      )}

      {stage === 'restart' && (
        <span className="text-xs text-[var(--text-muted)]">
          {'Restarting ends the advisor session opened from the dashboard.'}
        </span>
      )}

      {stage === 'failed' && deploy.error && (
        <span className="text-xs text-(--tone-danger-fg)">{deploy.error}</span>
      )}

      {stage === 'done' && deploy.commit && (
        <span className="text-xs text-[var(--text-muted)]">{deploy.commit}</span>
      )}
    </div>
  );
}
