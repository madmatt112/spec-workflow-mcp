import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { isEnabled, toggled } from './enable';

export interface ProjectInstance {
  pid: number;
  registeredAt: string;
}

export interface Project {
  projectId: string;
  projectName: string;
  projectPath: string;
  workflowRootPath: string;
  instances: ProjectInstance[];
}

interface ProjectContextType {
  projects: Project[];
  /** Whether a project passes the sidebar filter. An id absent from storage is on. */
  enabled: (projectId: string) => boolean;
  /** Flip a project on or off; persisted under localStorage key `shell.projects`. */
  toggle: (projectId: string) => void;
  refreshProjects: () => Promise<void>;
  loading: boolean;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// The off (disabled) project ids; an id absent from this list is on.
const STORAGE_KEY = 'shell.projects';
// The explicit-on project ids; an id in this list is on even when also in STORAGE_KEY.
const ON_STORAGE_KEY = 'shell.projects.on';

function readIdList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabledIds, setDisabledIds] = useState<string[]>(() => readIdList(STORAGE_KEY));
  const [onIds, setOnIds] = useState<string[]>(() => readIdList(ON_STORAGE_KEY));

  // Fetch projects from API
  const fetchProjects = useCallback(async () => {
    try {
      const response = await fetch('/api/projects/list');
      if (response.ok) {
        const data = await response.json() as Project[];
        setProjects(data);
      }
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Poll for updates every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchProjects();
    }, 2500);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const enabled = useCallback(
    (projectId: string) => {
      const name = projects.find((p) => p.projectId === projectId)?.projectName ?? '';
      return isEnabled(projectId, name, disabledIds, onIds);
    },
    [projects, disabledIds, onIds]
  );

  const toggle = useCallback(
    (projectId: string) => {
      const name = projects.find((p) => p.projectId === projectId)?.projectName ?? '';
      const next = toggled(projectId, name, disabledIds, onIds);
      setDisabledIds(next.off);
      setOnIds(next.on);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next.off));
        localStorage.setItem(ON_STORAGE_KEY, JSON.stringify(next.on));
      } catch (error) {
        console.error('Failed to save project filter:', error);
      }
    },
    [projects, disabledIds, onIds]
  );

  const value = useMemo<ProjectContextType>(() => ({
    projects,
    enabled,
    toggle,
    refreshProjects: fetchProjects,
    loading
  }), [projects, enabled, toggle, fetchProjects, loading]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects(): ProjectContextType {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error('useProjects must be used within ProjectProvider');
  return ctx;
}
