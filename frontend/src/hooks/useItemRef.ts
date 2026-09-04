import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ItemRef } from '../types';

/** Resolve a "#1042" to whatever it names. Cached hard — a number never changes
 *  what it points at, short of a conversion, which carries the number along. */
export function useItemRef(number: number | null) {
  return useQuery<ItemRef>({
    queryKey: ['itemRef', number],
    queryFn: () => api.get(`/api/item-refs/${number}`),
    enabled: number !== null,
    retry: false,
    staleTime: 5 * 60_000,
  });
}
