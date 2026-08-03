import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getUserTimezone } from '../lib/api';
import type { SpendDay } from '../types';

export function useSpending(date: string) {
  const tz = getUserTimezone();

  return useQuery<SpendDay>({
    queryKey: ['spending', date],
    queryFn: () =>
      api.get(`/api/spending?date=${date}&tz=${encodeURIComponent(tz)}`),
  });
}

// Spending never affects the daily score or balance, so these only touch ['spending'].
export function useCreateSpend() {
  const queryClient = useQueryClient();
  const tz = getUserTimezone();

  return useMutation({
    mutationFn: (data: { amount: string; comment?: string | null; target_date?: string }) =>
      api.post(`/api/spending?tz=${encodeURIComponent(tz)}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spending'] });
    },
  });
}

export function useUpdateSpend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ spendId, data }: {
      spendId: string;
      data: { amount?: string; comment?: string | null };
    }) => api.patch(`/api/spending/${spendId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spending'] });
    },
  });
}

export function useDeleteSpend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (spendId: string) => api.delete(`/api/spending/${spendId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['spending'] });
    },
  });
}
