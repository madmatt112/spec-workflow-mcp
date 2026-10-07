import React from 'react';
import { useTranslation } from 'react-i18next';
import { PageLayout } from './PageLayout';

/**
 * Bridge stub pages. Tasks 9 to 12 replace each with its real list-plus-panel
 * page built on PageLayout and the shell primitives; until then these keep the
 * five routes mounted so the shell renders end to end.
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

export function NowStub() {
  const { t } = useTranslation();
  return <Stub page="now" title={t('shell.nav.now', 'Now')} />;
}

export function RunsStub() {
  const { t } = useTranslation();
  return <Stub page="runs" title={t('shell.nav.runs', 'Runs')} />;
}

export function RunDetailStub() {
  const { t } = useTranslation();
  return <Stub page="run-detail" title={t('shell.nav.runs', 'Runs')} />;
}

export function SpecsStub() {
  const { t } = useTranslation();
  return <Stub page="specs" title={t('shell.nav.specs', 'Specs')} />;
}

export function DeferralsStub() {
  const { t } = useTranslation();
  return <Stub page="deferrals" title={t('shell.nav.deferrals', 'Deferrals')} />;
}
