import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface ScratchPadData {
  content: string;
  updated_at: string;
}

export function useScratchPad() {
  return useQuery<ScratchPadData>({
    queryKey: ['scratchPad'],
    queryFn: () => api.get('/api/scratch-pad'),
    staleTime: 60_000,
  });
}

export function useUpdateScratchPad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.put('/api/scratch-pad', { content }),
    onSuccess: (data) => {
      queryClient.setQueryData(['scratchPad'], data);
    },
  });
}
