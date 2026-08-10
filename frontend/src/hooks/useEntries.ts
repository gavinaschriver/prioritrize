import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getUserTimezone } from '../lib/api';

export function useCreateEntry() {
  const queryClient = useQueryClient();
  const tz = getUserTimezone();

  return useMutation({
    mutationFn: (data: { prioritry_id: string; comment?: string | null; target_date?: string }) =>
      api.post(`/api/entries?tz=${encodeURIComponent(tz)}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useUpdateEntryComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ entryId, comment }: { entryId: string; comment: string | null }) =>
      api.patch(`/api/entries/${entryId}`, { comment }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
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
