import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeProvider';
import { useProjects } from '../projects/ProjectProvider';
import { useShell } from './ShellProvider';
import { LanguageSelector } from '../../components/LanguageSelector';
import { VolumeControl } from '../notifications/VolumeControl';
import { ChangelogModal } from '../modals/ChangelogModal';

/**
 * The settings gear at the foot of the sidebar: theme toggle, language, density,
 * volume, and the version with a changelog link (design D13, Requirement 1 AC 4).
 * The version comes from the first registered project's info route; the changelog
 * link opens the modal with no project id. With no project there is no version.
 */
export function Gear() {
  const { t } = useTranslation();
  const { theme, toggleTheme } = useTheme();
  const { density, setDensity } = useShell();
  const { projects } = useProjects();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState<string>('');
  const [showChangelog, setShowChangelog] = useState(false);

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
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
        title={t('shell.gear.settings', 'Settings')}
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>{t('shell.gear.settings', 'Settings')}</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] p-3 shadow-[var(--shadow-overlay)]"
          data-testid="gear-panel"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">{t('shell.gear.theme', 'Theme')}</span>
              <button onClick={toggleTheme} className="rounded-md bg-[var(--surface-inset)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]">
                {theme === 'dark' ? t('theme.dark') : t('theme.light')}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">{t('language.select')}</span>
              <LanguageSelector className="w-32" />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">{t('shell.gear.density', 'Density')}</span>
              <div className="flex gap-3 text-sm text-[var(--text-secondary)]">
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="shell-density"
                    checked={density === 'comfortable'}
                    onChange={() => setDensity('comfortable')}
                    data-testid="density-comfortable"
                  />
                  {t('shell.gear.comfortable', 'Comfortable')}
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="shell-density"
                    checked={density === 'compact'}
                    onChange={() => setDensity('compact')}
                    data-testid="density-compact"
                  />
                  {t('shell.gear.compact', 'Compact')}
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-[var(--text-secondary)]">{t('shell.gear.volume', 'Volume')}</span>
              <VolumeControl />
            </div>

            {version && (
              <div className="border-t border-[var(--border-default)] pt-2 text-center">
                <button
                  onClick={() => setShowChangelog(true)}
                  data-testid="gear-version"
                  className="text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
                  title={t('changelog.viewChangelog', 'View changelog')}
                >
                  Spec-Workflow-MCP v{version}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ChangelogModal
        isOpen={showChangelog}
        onClose={() => setShowChangelog(false)}
        version={version}
      />
    </div>
  );
}
