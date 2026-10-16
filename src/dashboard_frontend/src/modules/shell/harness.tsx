import React from 'react';
import type { SetupView, SetupInput, Provider } from '../harness/types';

// The harness routes are called with fetch directly rather than the shared PUT
// helper, because that helper drops a non-ok body and these pages must show the
// 400, 409 or 500 body (design D8; Requirement 4 AC 12). A copy of
// src/dashboard_frontend/src/modules/pages/HarnessPage.tsx:10-29, which task 13
// deletes with that page.
export type HarnessResult = { ok: boolean; status: number; data: any };

export async function callHarness(url: string, method: 'PUT' | 'POST', body?: any): Promise<HarnessResult> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

export type OpError = { status: number; body: any };

/** True for a value a read-only field should render; absent fields are omitted. */
export function present(v: unknown): boolean {
  return v !== undefined && v !== null && v !== '';
}

/**
 * The launch setup input for a card (design D8; Requirement 4 AC 9, 10): the GET
 * setup view's defaults (the saved setup file went with step (d) of the
 * foundation rework); `spec` is always the launchable spec; gates stay the
 * default (the launch route forces `record`). An eligible role carries its
 * provider, every other role carries the model alone.
 */
export function buildLaunchInput(view: SetupView): SetupInput {
  const roles: Record<string, { model: string; provider?: Provider }> = {};
  for (const r of view.roles) {
    roles[r.agent] = r.providerEditable ? { model: r.defaultModel, provider: r.defaultProvider } : { model: r.defaultModel };
  }
  return {
    spec: view.launchable as string,
    supervisorModel: view.supervisor.model,
    worktree: view.worktree,
    gates: view.gates,
    roles,
  };
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (!present(value)) return null;
  return (
    <div className="min-w-0">
      <span className="text-xs text-[var(--text-muted)]">{label}: </span>
      <span className="break-words text-sm text-[var(--text-primary)]">{String(value)}</span>
    </div>
  );
}

/**
 * Renders a launch, save or stop refusal body (design Error Handling 5;
 * Requirement 4 AC 12): the 409 `reason`, the 400 `field` and `error`, or the 500
 * `step` and `detail`. Ported from HarnessPage.tsx:628-673.
 */
export function OpErrorView({ error }: { error: OpError }) {
  const body = error.body || {};
  if (body.error === 'run-live') {
    return (
      <div className="space-y-1 text-sm text-[var(--text-primary)]">
        <Field label={'A run is already live'} value={body.reason} />
        <Field label={'Run id'} value={body.runId} />
        <Field label={'PID'} value={body.pid} />
      </div>
    );
  }
  if (body.error === 'not-launchable') {
    return (
      <div className="space-y-1 text-sm text-[var(--text-primary)]">
        <Field label={'Not launchable'} value={body.reason} />
      </div>
    );
  }
  if (body.error === 'not-running') {
    return <div className="break-words text-sm text-[var(--text-primary)]">{'No run is running for this project.'}</div>;
  }
  if (present(body.step)) {
    return (
      <div className="space-y-1 text-sm text-[var(--text-primary)]">
        <Field label={'Step'} value={body.step} />
        <Field label={'Detail'} value={body.detail || body.error} />
      </div>
    );
  }
  if (present(body.field)) {
    return (
      <div className="space-y-1 text-sm text-[var(--text-primary)]">
        <Field label={'Field'} value={body.field} />
        <Field label={'Value'} value={body.value} />
        <div className="min-w-0 break-words">{body.error}</div>
      </div>
    );
  }
  return <div className="break-words text-sm text-[var(--text-primary)]">{body.error || 'The operation failed.'}</div>;
}
