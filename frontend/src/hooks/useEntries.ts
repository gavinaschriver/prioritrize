import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getUserTimezone } from '../lib/api';

export function useCreateEntry() {
  const queryClient = useQueryClient();
  const tz = getUserTimezone();

  return useMutation({
    mutationFn: (data: {
      prioritry_id: string;
      comment?: string | null;
      target_date?: string;
      quantity?: number;
    }) => api.post(`/api/entries?tz=${encodeURIComponent(tz)}`, data),
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

/** Adds one more timeblock to an entry already logged. */
export function useIncrementEntry() {
  const queryClient = useQueryClient();
  const tz = getUserTimezone();

  return useMutation({
    mutationFn: (entryId: string) =>
      api.post(`/api/entries/${entryId}/increment?tz=${encodeURIComponent(tz)}`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

/** Drops one timeblock; the server deletes the entry when the last one goes. */
export function useDecrementEntry() {
  const queryClient = useQueryClient();
  const tz = getUserTimezone();

  return useMutation({
    mutationFn: (entryId: string) =>
      api.post(`/api/entries/${entryId}/decrement?tz=${encodeURIComponent(tz)}`, {}),
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
