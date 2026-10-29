import React, { useState } from 'react';
import { Button, TextInput, ui } from '../ui/ui';

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
      className={`${ui.scrim} flex items-center justify-center p-4`}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
    >
      <form onSubmit={submit} className={ui.dialog}>
        <h2 className="mb-1 text-base font-semibold text-(--text-primary)">Sign in</h2>
        <p className="mb-4 text-sm text-(--text-muted)">
          Enter the dashboard's shared secret to continue.
        </p>
        <TextInput
          type="password"
          autoFocus
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Shared secret"
          aria-label="Shared secret"
        />
        {error && (
          <p className="mt-2 text-sm text-(--tone-danger-fg)">That secret was not accepted.</p>
        )}
        <Button type="submit" variant="primary" disabled={busy || !secret} className="mt-4 w-full">
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
