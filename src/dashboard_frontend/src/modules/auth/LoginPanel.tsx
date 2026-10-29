import React, { useState } from 'react';

// The login box the shell shows on a 401 (controller-design.md §17). One
// password field and a Sign in button; it posts the secret to /api/login and,
// on success, reloads so every fetch retries and the WebSocket reconnects with
// the session cookie. A wrong secret is reported in place.
export function LoginPanel() {
  const [secret, setSecret] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!secret || busy) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret }),
      });
      if (res.status === 204) {
        window.location.reload();
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-6 shadow-(--shadow-overlay)"
      >
        <h2 className="mb-1 text-base font-semibold text-[var(--text-primary)]">Sign in</h2>
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          Enter the dashboard's shared secret to continue.
        </p>
        <input
          type="password"
          autoFocus
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Shared secret"
          aria-label="Shared secret"
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--surface-inset)] px-3 py-1.5 text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--border-focus)]"
        />
        {error && (
          <p className="mt-2 text-sm text-[var(--status-error)]">That secret was not accepted.</p>
        )}
        <button
          type="submit"
          disabled={busy || !secret}
          className="mt-4 w-full rounded-md bg-[var(--interactive-primary)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--interactive-primary-hover)] disabled:opacity-50"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
