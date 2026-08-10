import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { TagSuggestion } from '../types';

/** Every tag the user has ever used, most-used first. Feeds autocomplete in
 *  TagCommentInput, so it's shared across every comment field on the page. */
export function useTags() {
  return useQuery<TagSuggestion[]>({
    queryKey: ['tags'],
    queryFn: () => api.get('/api/tags'),
    staleTime: 5 * 60_000,
  });
}
