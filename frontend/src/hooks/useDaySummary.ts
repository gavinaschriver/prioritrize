import { useQuery } from '@tanstack/react-query';
import { api, getUserTimezone } from '../lib/api';
import type { DaySummary } from '../types';

export function useDaySummary(date: string) {
  const tz = getUserTimezone();
  return useQuery<DaySummary>({
    queryKey: ['daySummary', date, tz],
    queryFn: () => api.get(`/api/days/summary?date=${date}&tz=${encodeURIComponent(tz)}`),
  });
}
