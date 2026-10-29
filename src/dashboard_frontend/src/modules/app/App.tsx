import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '../theme/ThemeProvider';
import { AuthProvider } from '../auth/AuthProvider';
import { WebSocketProvider } from '../ws/WebSocketProvider';
import { ProjectProvider } from '../projects/ProjectProvider';
import { ShellProvider } from '../shell/ShellProvider';
import { Sidebar } from '../shell/Sidebar';
import { ConnectionBanner } from './ConnectionBanner';
import { UsagePage } from '../shell/UsagePage';
import { DeferralsPage } from '../shell/DeferralsPage';
import { NowPage } from '../shell/NowPage';
import { RunsPage } from '../shell/RunsPage';
import { RunPage } from '../shell/RunPage';
import { SpecsPage } from '../shell/SpecsPage';

function Shell() {
  return (
    <div className="min-h-screen bg-[var(--surface-base)] text-[var(--text-primary)] lg:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-4 sm:px-6">
        <div className="mx-auto w-full max-w-(--content-max)">
          <ConnectionBanner />
          <Routes>
            <Route path="/" element={<NowPage />} />
            <Route path="/runs" element={<RunsPage />} />
            <Route path="/runs/:projectId" element={<RunPage />} />
            <Route path="/specs" element={<SpecsPage />} />
            <Route path="/usage" element={<UsagePage />} />
            <Route path="/deferrals" element={<DeferralsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProjectProvider>
          <WebSocketProvider>
            <ShellProvider>
              <Shell />
            </ShellProvider>
          </WebSocketProvider>
        </ProjectProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
