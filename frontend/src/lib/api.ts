import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL;

async function authFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'API error');
  }
  return res.json();
}

export const api = {
  get: (path: string) => authFetch(path),
  post: (path: string, body: unknown) =>
    authFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    authFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => authFetch(path, { method: 'DELETE' }),
};

export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getTodayStr(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}
