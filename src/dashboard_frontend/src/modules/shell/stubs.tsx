import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from './PageLayout';

/**
 * Bridge stub page. Task 12 replaces it with the real list-plus-panel Specs page
 * built on PageLayout and the shell primitives; until then this keeps the route
 * mounted so the shell renders end to end.
 */
function Stub({ page, title }: { page: string; title: string }) {
  const { t } = useTranslation();
  return (
    <PageLayout
      list={
        <div data-testid={`stub-${page}`} className="rounded-lg border border-dashed border-[var(--border-default)] p-6">
          <h1 className="text-base font-semibold text-[var(--text-primary)]">{title}</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {t('shell.stub', 'This page arrives in a later task.')}
          </p>
        </div>
      }
    />
  );
}

export function SpecsStub() {
  const { t } = useTranslation();
  return <Stub page="specs" title={t('shell.nav.specs', 'Specs')} />;
}
