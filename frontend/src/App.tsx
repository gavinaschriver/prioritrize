import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './pages/LoginPage';
import { DayTrackerPage } from './pages/DayTrackerPage';
import { ManagePrioritriesPage } from './pages/ManagePrioritriesPage';
import { ManageTodosPage } from './pages/ManageTodosPage';
import { ManageProjectsPage } from './pages/ManageProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';
import { UpdatePrompt } from './components/pwa/UpdatePrompt';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Outside BrowserRouter so the update prompt also shows on /login */}
      <UpdatePrompt />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DayTrackerPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/manage"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ManagePrioritriesPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/manage-todos"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ManageTodosPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/manage-projects"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ManageProjectsPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/projects/:id"
            element={
              <ProtectedRoute>
                <AppShell>
                  <ProjectDetailPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppShell>
                  <DashboardPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppShell>
                  <SettingsPage />
                </AppShell>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
