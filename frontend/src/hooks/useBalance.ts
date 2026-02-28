import { useQuery } from '@tanstack/react-query';
import { api, getUserTimezone } from '../lib/api';
import type { Balance } from '../types';

export function useBalance() {
  const tz = getUserTimezone();
  return useQuery<Balance>({
    queryKey: ['balance', tz],
    queryFn: () => api.get(`/api/days/balance?tz=${encodeURIComponent(tz)}`),
  });
}
