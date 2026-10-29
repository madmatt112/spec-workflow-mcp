import React, { useEffect, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { useProjects } from '../projects/ProjectProvider';
import { useShell } from './ShellProvider';
import { Button, ui } from '../ui/ui';

/**
 * The settings gear at the foot of the sidebar: theme toggle, density, and the
 * version read from the first registered project's info route. With no project
 * there is no version.
 */
export function Gear() {
  const { theme, toggleTheme } = useTheme();
  const { density, setDensity } = useShell();
  const { projects } = useProjects();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState<string>('');
  const notifySupported = typeof Notification !== 'undefined';
  const [notifyPermission, setNotifyPermission] = useState<string>(
    notifySupported ? Notification.permission : 'unsupported'
  );

  const requestNotify = () => {
    if (!notifySupported) return;
    Notification.requestPermission().then((p) => setNotifyPermission(p)).catch(() => { /* ignore */ });
  };

  const firstProjectId = projects[0]?.projectId ?? null;

  useEffect(() => {
    if (!firstProjectId) {
      setVersion('');
      return;
    }
    let cancelled = false;
    fetch(`/api/projects/${firstProjectId}/info`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.version) setVersion(String(data.version));
      })
      .catch(() => { /* leave version empty */ });
    return () => { cancelled = true; };
  }, [firstProjectId]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="gear-toggle"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-(--text-secondary) hover:bg-(--surface-hover)"
        title="Settings"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Settings</span>
      </button>

      {open && (
        <div
          className={`absolute bottom-full left-0 mb-2 w-64 ${ui.popover}`}
          data-testid="gear-panel"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-(--text-secondary)">Theme</span>
              <Button variant="secondary" size="sm" onClick={toggleTheme}>
                {theme === 'dark' ? 'Dark' : 'Light'}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-(--text-secondary)">Density</span>
              <div className="flex gap-3 text-sm text-(--text-secondary)">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="shell-density"
                    checked={density === 'comfortable'}
                    onChange={() => setDensity('comfortable')}
                    data-testid="density-comfortable"
                  />
                  Comfortable
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="shell-density"
                    checked={density === 'compact'}
                    onChange={() => setDensity('compact')}
                    data-testid="density-compact"
                  />
                  Compact
                </label>
              </div>
            </div>

            {notifySupported && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-(--text-secondary)">Notifications</span>
                {notifyPermission === 'granted' ? (
                  <span className="text-xs text-(--text-muted)" data-testid="notify-state">On</span>
                ) : notifyPermission === 'denied' ? (
                  <span className="text-xs text-(--text-muted)" data-testid="notify-state">Blocked</span>
                ) : (
                  <button
                    onClick={requestNotify}
                    data-testid="notify-enable"
                    className="rounded-md bg-(--surface-inset) px-3 py-1.5 text-sm text-(--text-secondary) hover:bg-(--surface-hover)"
                  >
                    Enable
                  </button>
                )}
              </div>
            )}

            {version && (
              <div className="border-t border-(--border-default) pt-2 text-center">
                <span
                  data-testid="gear-version"
                  className="text-xs text-(--text-muted)"
                >
                  Spec-Workflow-MCP v{version}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
