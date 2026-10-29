import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useProjects } from '../projects/ProjectProvider';
import { useShell } from './ShellProvider';
import { Gear } from './Gear';
import { ui } from '../ui/ui';
import { storeGroups, storeOf } from '../projects/stores';

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
      className={({ isActive }) => ui.navRow(isActive)}
    >
      <span>{item.label}</span>
      {typeof item.count === 'number' && (
        <span className="ml-2 rounded-full bg-(--surface-inset) px-2 py-0.5 text-xs text-(--text-muted)">
          {item.count}
        </span>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate }: { onNavigate: () => void }) {
  const { projects, enabled, toggle } = useProjects();
  const { now, specRows, deferralsByProject, connected } = useShell();

  const waitsCount = (now?.waits ?? []).filter((w) => enabled(w.projectId)).length;
  const liveCount = (now?.live ?? []).filter((r) => enabled(r.projectId)).length;

  // Specs/Deferrals key on the store (design C10/C11, Requirement 2): a
  // store counts once however many listed projects share it, and is
  // enabled when any one of them is.
  const groups = storeGroups(projects, enabled);
  const enabledStores = new Set(groups.filter((g) => g.enabled).map((g) => g.store));
  const specsCount = specRows.filter((r) => enabledStores.has(storeOf(projects, r.projectId))).length;
  const deferredCount = groups
    .filter((g) => g.enabled)
    .reduce((sum, g) => {
      const withPayload = g.projects.find((p) => deferralsByProject[p.projectId]);
      const deferrals = withPayload ? (deferralsByProject[withPayload.projectId]?.deferrals ?? []) : [];
      return sum + deferrals.filter((d) => d.status === 'deferred').length;
    }, 0);

  const items: NavItem[] = [
    { to: '/', testId: 'nav-now', label: 'Now', count: waitsCount, end: true },
    { to: '/runs', testId: 'nav-runs', label: 'Runs', count: liveCount },
    { to: '/specs', testId: 'nav-specs', label: 'Specs', count: specsCount },
    { to: '/usage', testId: 'nav-usage', label: 'Usage' },
    { to: '/deferrals', testId: 'nav-deferrals', label: 'Deferrals', count: deferredCount },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 py-3 text-sm font-semibold text-(--text-primary)">
        {'Spec Workflow'}
      </div>

      {!connected && (
        <div
          data-testid="disconnected-marker"
          className="mx-3 mb-2 rounded-md bg-(--tone-danger-bg) px-3 py-1.5 text-xs text-(--tone-danger-fg)"
        >
          {'Disconnected'}
        </div>
      )}

      <nav className="flex flex-col gap-0.5 px-2">
        {items.map((item) => (
          <NavRow key={item.testId} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-4 px-3">
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-(--text-muted)">
          {'Projects'}
        </div>
        <div className="flex flex-col gap-1">
          {projects.map((p) => (
            <label key={p.projectId} className="flex items-center gap-2 rounded-sm px-2 py-1 text-sm text-(--text-secondary)">
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

      <div className="mt-auto border-t border-(--border-default) p-2">
        <Gear />
      </div>
    </div>
  );
}

export function Sidebar() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-(--sidebar-w) lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-(--border-default) lg:bg-(--surface-panel)">
        <SidebarContent onNavigate={() => {}} />
      </aside>

      {/* Mobile top bar with the drawer toggle, below the lg breakpoint */}
      <div className="flex items-center gap-3 border-b border-(--border-default) bg-(--surface-panel) px-4 py-2 lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          data-testid="sidebar-drawer-toggle"
          className="rounded-md p-2 text-(--text-muted) hover:bg-(--surface-hover)"
          title={'Open menu'}
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-(--text-primary)">{'Spec Workflow'}</span>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setDrawerOpen(false)}>
          <div className={ui.scrim} />
          <div
            className={`absolute left-0 top-0 h-full w-(--sidebar-w) ${ui.drawer}`}
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
