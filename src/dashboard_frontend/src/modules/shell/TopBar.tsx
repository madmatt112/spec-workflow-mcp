import React from 'react';
import { NavLink } from 'react-router-dom';
import { ui } from '../ui/ui';
import { DeployControl } from './DeployControl';
import { OpenAdvisor } from './OpenAdvisor';
import { Gear } from './Gear';

interface NavItem {
  to: string;
  testId: string;
  label: string;
  end?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', testId: 'nav-home', label: 'Home', end: true },
  { to: '/specs', testId: 'nav-specs', label: 'Specs' },
  { to: '/usage', testId: 'nav-usage', label: 'Usage' },
  { to: '/deferrals', testId: 'nav-deferrals', label: 'Deferrals' },
];

/**
 * The header (design C7, Requirement 1): Home, Specs, Usage, Deferrals,
 * Deploy, Open advisor and the gear, in that order, with no link counts.
 */
export function TopBar() {
  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-(--border-default) bg-(--surface-panel) px-4 py-2">
      <nav className="flex flex-wrap items-center gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.testId}
            to={item.to}
            end={item.end}
            data-testid={item.testId}
            className={({ isActive }) => ui.navRow(isActive)}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="min-w-0 max-w-full">
        <DeployControl />
      </div>
      <OpenAdvisor />
      <div className="ml-auto">
        <Gear />
      </div>
    </header>
  );
}
