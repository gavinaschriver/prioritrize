import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-blue-700">
            PRIORI-TRIZE
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className={`text-sm ${location.pathname === '/' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Tracker
            </Link>
            <Link
              to="/manage"
              className={`text-sm ${location.pathname === '/manage' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Dailies
            </Link>
            <Link
              to="/manage-todos"
              className={`text-sm ${location.pathname === '/manage-todos' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Todos
            </Link>
            <Link
              to="/manage-projects"
              className={`text-sm ${location.pathname === '/manage-projects' || location.pathname.startsWith('/projects/') ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Projects
            </Link>
            <Link
              to="/dashboard"
              className={`text-sm ${location.pathname === '/dashboard' ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Dashboard
            </Link>
            <button
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>
      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
