import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '../theme/ThemeProvider';
import { WebSocketProvider } from '../ws/WebSocketProvider';
import { ProjectProvider } from '../projects/ProjectProvider';
import { ShellProvider } from '../shell/ShellProvider';
import { NotificationProvider } from '../notifications/NotificationProvider';
import { I18nErrorBoundary } from '../../components/I18nErrorBoundary';
import { Sidebar } from '../shell/Sidebar';
import { UsagePage } from '../shell/UsagePage';
import { DeferralsPage } from '../shell/DeferralsPage';
import { NowPage } from '../shell/NowPage';
import { RunsStub, RunDetailStub, SpecsStub } from '../shell/stubs';

function Shell() {
  return (
    <div className="min-h-screen bg-[var(--surface-base)] text-[var(--text-primary)] lg:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 px-4 py-4 sm:px-6">
        <Routes>
          <Route path="/" element={<NowPage />} />
          <Route path="/runs" element={<RunsStub />} />
          <Route path="/runs/:projectId" element={<RunDetailStub />} />
          <Route path="/specs" element={<SpecsStub />} />
          <Route path="/usage" element={<UsagePage />} />
          <Route path="/deferrals" element={<DeferralsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <I18nErrorBoundary>
      <ThemeProvider>
        <ProjectProvider>
          <WebSocketProvider>
            <ShellProvider>
              <NotificationProvider>
                <Shell />
              </NotificationProvider>
            </ShellProvider>
          </WebSocketProvider>
        </ProjectProvider>
      </ThemeProvider>
    </I18nErrorBoundary>
  );
}
