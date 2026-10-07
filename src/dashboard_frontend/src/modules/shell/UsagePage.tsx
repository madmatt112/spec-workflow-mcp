import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Usage: a single placeholder sentence (design C10). The usage views ship in a
 * later release; this page fetches nothing.
 */
export function UsagePage() {
  const { t } = useTranslation();
  return (
    <p data-testid="usage-placeholder" className="text-sm text-[var(--text-secondary)]">
      {t('shell.usage.placeholder', 'The usage views arrive in a later release.')}
    </p>
  );
}
