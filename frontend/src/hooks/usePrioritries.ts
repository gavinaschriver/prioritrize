import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Prioritry, PrioritryCreate } from '../types';

export function usePrioritries() {
  return useQuery<Prioritry[]>({
    queryKey: ['prioritries'],
    queryFn: () => api.get('/api/prioritries'),
  });
}

export function useCreatePrioritry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PrioritryCreate) => api.post('/api/prioritries', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prioritries'] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
    },
  });
}

export function useUpdatePrioritry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PrioritryCreate> }) =>
      api.put(`/api/prioritries/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prioritries'] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
    },
  });
}

export function useDeletePrioritry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/prioritries/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prioritries'] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
    },
  });
}
