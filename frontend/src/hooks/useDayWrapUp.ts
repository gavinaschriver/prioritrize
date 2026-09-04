import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getUserTimezone } from '../lib/api';
import type { DayWrapUp } from '../types';

/** Whether a given day has been declared "done logging".
 *
 *  Server-backed rather than localStorage: the point is that dismissing it on
 *  the phone also dismisses it on the laptop and the local dev app. */
export function useDayWrapUp(date: string) {
  return useQuery<DayWrapUp>({
    queryKey: ['dayWrapUp', date],
    queryFn: () => api.get(`/api/days/${date}/wrap-up`),
    enabled: !!date,
  });
}

export function useSetDayWrapUp() {
  const queryClient = useQueryClient();
  const tz = getUserTimezone();
  return useMutation({
    mutationFn: ({ date, wrapped }: { date: string; wrapped: boolean }): Promise<DayWrapUp> => {
      const path = `/api/days/${date}/wrap-up?tz=${encodeURIComponent(tz)}`;
      return wrapped ? api.post(path, {}) : api.delete(path);
    },
    // Seed the cache from the response so the banner goes immediately, rather
    // than flashing back while a refetch lands.
    onSuccess: (data, variables) => {
      queryClient.setQueryData<DayWrapUp>(['dayWrapUp', variables.date], data);
      queryClient.invalidateQueries({ queryKey: ['dayWrapUp'] });
    },
  });
}
