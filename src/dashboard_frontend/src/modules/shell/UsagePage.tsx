import React from 'react';

/**
 * Usage: a single placeholder sentence (design C10). The usage views ship in a
 * later release; this page fetches nothing.
 */
export function UsagePage() {
  return (
    <p data-testid="usage-placeholder" className="text-sm text-[var(--text-secondary)]">
      {'The usage views arrive in a later release.'}
    </p>
  );
}
