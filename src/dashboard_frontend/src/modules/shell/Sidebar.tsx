import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useProjects } from '../projects/ProjectProvider';
import { useShell } from './ShellProvider';
import { Gear } from './Gear';

interface NavItem {
  to: string;
  testId: string;
  label: string;
  count?: number;
  end?: boolean;
}

function NavRow({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      data-testid={item.testId}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
          isActive
            ? 'bg-[var(--surface-hover)] text-[var(--text-primary)] font-medium'
            : 'text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'
        }`
      }
    >
      <span>{item.label}</span>
      {typeof item.count === 'number' && (
        <span className="ml-2 rounded-full bg-[var(--surface-inset)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
          {item.count}
        </span>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation();
  const { projects, enabled, toggle } = useProjects();
  const { now, specRows, deferralsByProject, connected } = useShell();

  const waitsCount = (now?.waits ?? []).filter((w) => enabled(w.projectId)).length;
  const liveCount = (now?.live ?? []).filter((r) => enabled(r.projectId)).length;
  const specsCount = specRows.filter((r) => enabled(r.projectId)).length;
  const deferredCount = projects
    .filter((p) => enabled(p.projectId))
    .reduce((sum, p) => sum + (deferralsByProject[p.projectId]?.deferrals ?? []).filter((d) => d.status === 'deferred').length, 0);

  const items: NavItem[] = [
    { to: '/', testId: 'nav-now', label: t('shell.nav.now', 'Now'), count: waitsCount, end: true },
    { to: '/runs', testId: 'nav-runs', label: t('shell.nav.runs', 'Runs'), count: liveCount },
    { to: '/specs', testId: 'nav-specs', label: t('shell.nav.specs', 'Specs'), count: specsCount },
    { to: '/usage', testId: 'nav-usage', label: t('shell.nav.usage', 'Usage') },
    { to: '/deferrals', testId: 'nav-deferrals', label: t('shell.nav.deferrals', 'Deferrals'), count: deferredCount },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-3 text-sm font-semibold text-[var(--text-primary)]">
        {t('shell.title', 'Spec Workflow')}
      </div>

      {!connected && (
        <div
          data-testid="disconnected-marker"
          className="mx-3 mb-2 rounded-md bg-[var(--status-error)]/10 px-3 py-1.5 text-xs text-[var(--status-error)]"
        >
          {t('shell.disconnected', 'Disconnected')}
        </div>
      )}

      <nav className="flex flex-col gap-0.5 px-2">
        {items.map((item) => (
          <NavRow key={item.testId} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-4 px-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          {t('shell.projects', 'Projects')}
        </div>
        <div className="flex flex-col gap-1">
          {projects.map((p) => (
            <label key={p.projectId} className="flex items-center gap-2 rounded px-2 py-1 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                role="switch"
                checked={enabled(p.projectId)}
                onChange={() => toggle(p.projectId)}
                data-testid={`project-toggle-${p.projectId}`}
              />
              <span className="truncate">{p.projectName}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-[var(--border-default)] p-2">
        <Gear />
      </div>
    </div>
  );
}

export function Sidebar() {
  const { t } = useTranslation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-[var(--border-default)] lg:bg-[var(--surface-panel)]">
        <SidebarContent onNavigate={() => {}} />
      </aside>

      {/* Mobile top bar with the drawer toggle, below the lg breakpoint */}
      <div className="flex items-center gap-3 border-b border-[var(--border-default)] bg-[var(--surface-panel)] px-4 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          data-testid="sidebar-drawer-toggle"
          className="rounded-md p-2 text-[var(--text-muted)] hover:bg-[var(--surface-hover)]"
          title={t('shell.openMenu', 'Open menu')}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-[var(--text-primary)]">{t('shell.title', 'Spec Workflow')}</span>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute left-0 top-0 h-full w-64 bg-[var(--surface-panel)] shadow-[var(--shadow-overlay)]"
            onClick={(e) => e.stopPropagation()}
            data-testid="sidebar-drawer"
          >
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
