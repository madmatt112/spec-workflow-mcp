import { useEffect } from 'react';
import { useProjects } from '../projects/ProjectProvider';
import { useShell } from './ShellProvider';
import { tabTitle } from './board';

const BASE_TITLE = document.title;

/**
 * Null-rendering: sets `document.title` from the open, enabled wait count
 * (design C10, D18). Recomputed on every waits change and every 30 s so the
 * age in the title keeps advancing.
 */
export function TabTitle() {
  const { enabled } = useProjects();
  const { controllerWaits } = useShell();

  useEffect(() => {
    const update = () => {
      document.title = tabTitle(controllerWaits, enabled, Date.now(), BASE_TITLE);
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, [controllerWaits, enabled]);

  return null;
}
