import { useQuery } from '@tanstack/react-query';
import { api, getUserTimezone } from '../lib/api';
import type { DashboardData } from '../types';

export function useDashboard(start: string, end: string) {
  const tz = getUserTimezone();
  return useQuery<DashboardData>({
    queryKey: ['dashboard', start, end, tz],
    queryFn: () =>
      api.get(`/api/dashboard?start=${start}&end=${end}&tz=${encodeURIComponent(tz)}`),
    enabled: !!start && !!end,
  });
}
