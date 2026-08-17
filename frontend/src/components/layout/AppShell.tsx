import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/', label: 'Tracker' },
  { to: '/manage', label: 'Dailies' },
  { to: '/manage-todos', label: 'Todos' },
  { to: '/manage-projects', label: 'Projects' },
  { to: '/dashboard', label: 'Dashboard' },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // Tapping a link should close the drawer behind it.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const isActive = (to: string) =>
    to === '/manage-projects'
      ? location.pathname === to || location.pathname.startsWith('/projects/')
      : location.pathname === to;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <Link to="/" className="text-lg font-bold text-blue-700 whitespace-nowrap">
            PRIORI-TRIZE
          </Link>

          {/* Full row only where it fits — below sm it overflows the viewport. */}
          <div className="hidden sm:flex items-center gap-4">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`text-sm ${isActive(item.to) ? 'text-blue-600 font-medium' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign Out
            </button>
          </div>

          <button
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
            aria-expanded={menuOpen}
            className="sm:hidden shrink-0 w-9 h-9 flex flex-col items-center justify-center gap-1 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <span className="block w-4 h-0.5 bg-gray-600 rounded"></span>
            <span className="block w-4 h-0.5 bg-gray-600 rounded"></span>
            <span className="block w-4 h-0.5 bg-gray-600 rounded"></span>
          </button>
        </div>

        {menuOpen && (
          <div className="sm:hidden max-w-3xl mx-auto mt-3 pt-3 border-t border-gray-100 flex flex-col">
            {NAV_ITEMS.map(item => (
              <Link
                key={item.to}
                to={item.to}
                className={`py-2 text-sm ${isActive(item.to) ? 'text-blue-600 font-medium' : 'text-gray-600'}`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={signOut}
              className="py-2 text-sm text-gray-500 text-left"
            >
              Sign Out
            </button>
          </div>
        )}
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
