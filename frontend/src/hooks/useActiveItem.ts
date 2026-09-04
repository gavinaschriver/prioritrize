import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ActiveItem, ActiveEntityType } from '../types';

/** The one thing in progress right now, or null when the bullpen is empty. */
export function useActiveItem() {
  return useQuery<ActiveItem | null>({
    queryKey: ['activeItem'],
    queryFn: () => api.get('/api/active-item'),
  });
}

export function useSetActiveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { entity_type: ActiveEntityType; entity_id: string }): Promise<ActiveItem> =>
      api.put('/api/active-item', data),
    // Seeded from the response so the item jumps to the bullpen immediately
    // rather than after a round trip.
    onSuccess: data => {
      queryClient.setQueryData<ActiveItem | null>(['activeItem'], data);
    },
  });
}

export function useClearActiveItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/api/active-item'),
    onSuccess: () => {
      queryClient.setQueryData<ActiveItem | null>(['activeItem'], null);
    },
  });
}
