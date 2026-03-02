import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginPage } from './pages/LoginPage';
import { DayTrackerPage } from './pages/DayTrackerPage';
import { ManagePrioritriesPage } from './pages/ManagePrioritriesPage';
import { ManageTodosPage } from './pages/ManageTodosPage';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AppShell } from './components/layout/AppShell';

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
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
