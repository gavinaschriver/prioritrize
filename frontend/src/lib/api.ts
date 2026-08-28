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
      // Scoring buckets by local day, so writes that move a past day's score need
      // to know the zone. Sent on every request rather than threaded through each
      // mutation as a query param.
      'X-Timezone': getUserTimezone(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    // FastAPI validation errors return detail as an array of objects
    let message = 'API error';
    if (typeof err.detail === 'string') {
      message = err.detail;
    } else if (Array.isArray(err.detail)) {
      message = err.detail.map((e: any) => e.msg || JSON.stringify(e)).join('; ');
    }
    throw new Error(message);
  }
  return res.json();
}

export const api = {
  get: (path: string) => authFetch(path),
  post: (path: string, body: unknown) =>
    authFetch(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    authFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (path: string, body: unknown) =>
    authFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => authFetch(path, { method: 'DELETE' }),
};

export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function getTodayStr(): string {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}
