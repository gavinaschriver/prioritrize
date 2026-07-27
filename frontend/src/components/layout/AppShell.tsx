import { Link, useLocation } from 'react-router-dom';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { data: google } = useGoogleCalendar();

  // A dead notification pipeline is the worst outcome here, so surface it in
  // the shell rather than only on the Settings page nobody visits.
  const needsReauth = google?.connected && google.status === 'needs_reauth';

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3">
        {/* Wraps rather than overflowing: six items plus the brand do not fit
            on one line at phone width, and this is an installable app. */}
        <div className="max-w-2xl mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Link to="/" className="text-lg font-bold text-blue-700 shrink-0 whitespace-nowrap">
            PRIORI-TRIZE
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
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
            {/* Replaces the Sign Out button, which moved into the page — the
                nav is a single non-wrapping row and was already tight. */}
            <Link
              to="/settings"
              title="Settings"
              aria-label="Settings"
              className={`text-sm relative ${location.pathname === '/settings' ? 'text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              ⚙
              {needsReauth && (
                <span className="absolute -top-0.5 -right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </Link>
          </div>
        </div>
      </nav>

      {needsReauth && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2">
          <div className="max-w-2xl mx-auto text-sm text-red-700">
            Google Calendar lost access, so no reminders are being sent.{' '}
            <Link to="/settings" className="underline font-medium">
              Reconnect
            </Link>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
