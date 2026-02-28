import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Prioritri, PrioritriCreate } from '../types';

export function usePrioritris() {
  return useQuery<Prioritri[]>({
    queryKey: ['prioritris'],
    queryFn: () => api.get('/api/prioritris'),
  });
}

export function useCreatePrioritri() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PrioritriCreate) => api.post('/api/prioritris', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prioritris'] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
    },
  });
}

export function useUpdatePrioritri() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PrioritriCreate> }) =>
      api.put(`/api/prioritris/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prioritris'] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
    },
  });
}

export function useDeletePrioritri() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/prioritris/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prioritris'] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
    },
  });
}
