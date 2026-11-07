import React, { useEffect, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';
import { useProjects } from '../projects/ProjectProvider';
import { Button, ui } from '../ui/ui';

/**
 * The settings gear in the top bar: theme toggle, a switch per project, the
 * notification setting, and the version read from the first registered
 * project's info route. With no project there is no version (D13).
 */
export function Gear() {
  const { theme, toggleTheme } = useTheme();
  const { projects, enabled, toggle } = useProjects();
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

  const sortedProjects = [...projects].sort((a, b) => a.projectName.localeCompare(b.projectName));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid="gear-toggle"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-(--text-secondary) hover:bg-(--surface-hover)"
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
          className={`absolute right-0 top-full mt-2 w-64 ${ui.popover}`}
          data-testid="gear-panel"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-(--text-secondary)">Theme</span>
              <Button variant="secondary" size="sm" onClick={toggleTheme}>
                {theme === 'dark' ? 'Dark' : 'Light'}
              </Button>
            </div>

            {sortedProjects.length > 0 && (
              <div className="space-y-1.5 border-t border-(--border-default) pt-2">
                {sortedProjects.map((p) => (
                  <label
                    key={p.projectId}
                    className="flex items-center justify-between gap-2 text-sm text-(--text-secondary)"
                  >
                    <span className="min-w-0 truncate">{p.projectName}</span>
                    <input
                      type="checkbox"
                      role="switch"
                      checked={enabled(p.projectId)}
                      onChange={() => toggle(p.projectId)}
                      data-testid={`project-toggle-${p.projectId}`}
                    />
                  </label>
                ))}
              </div>
            )}

            {notifySupported && (
              <div className="flex items-center justify-between border-t border-(--border-default) pt-2">
                <span className="text-sm text-(--text-secondary)">Notifications</span>
                {notifyPermission === 'granted' ? (
                  <span className="text-xs text-(--text-muted)" data-testid="notify-state">On</span>
                ) : notifyPermission === 'denied' ? (
                  <span className="text-xs text-(--text-muted)" data-testid="notify-state">Blocked</span>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={requestNotify}
                    data-testid="notify-enable"
                  >
                    Enable
                  </Button>
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
