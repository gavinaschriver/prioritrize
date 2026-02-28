import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getUserTimezone } from '../lib/api';

export function useCreateEntry() {
  const queryClient = useQueryClient();
  const tz = getUserTimezone();

  return useMutation({
    mutationFn: (data: { prioritri_id: string; comment?: string | null; target_date?: string }) =>
      api.post(`/api/entries?tz=${encodeURIComponent(tz)}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  const tz = getUserTimezone();

  return useMutation({
    mutationFn: (entryId: string) =>
      api.delete(`/api/entries/${entryId}?tz=${encodeURIComponent(tz)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}
