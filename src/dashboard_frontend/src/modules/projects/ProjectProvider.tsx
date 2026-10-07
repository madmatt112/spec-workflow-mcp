import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export interface ProjectInstance {
  pid: number;
  registeredAt: string;
}

export interface Project {
  projectId: string;
  projectName: string;
  projectPath: string;
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

function readDisabled(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [disabledIds, setDisabledIds] = useState<string[]>(() => readDisabled());

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
    (projectId: string) => !disabledIds.includes(projectId),
    [disabledIds]
  );

  const toggle = useCallback((projectId: string) => {
    setDisabledIds((prev) => {
      const next = prev.includes(projectId)
        ? prev.filter((id) => id !== projectId)
        : [...prev, projectId];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error('Failed to save project filter:', error);
      }
      return next;
    });
  }, []);

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
