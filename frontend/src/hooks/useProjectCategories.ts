import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ProjectCategory } from '../types';

/** Categories are broad and long-lived, so they change far less often than the
 *  projects under them — worth a stale window since several views read them. */
export function useProjectCategories() {
  return useQuery<ProjectCategory[]>({
    queryKey: ['projectCategories'],
    queryFn: () => api.get('/api/project-categories'),
    staleTime: 5 * 60_000,
  });
}

export function useCreateProjectCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string }): Promise<ProjectCategory> =>
      api.post('/api/project-categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectCategories'] });
    },
  });
}

export function useRenameProjectCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }): Promise<ProjectCategory> =>
      api.put(`/api/project-categories/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectCategories'] });
    },
  });
}

export function useDeleteProjectCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/project-categories/${id}`),
    // Deleting only unfiles the projects (FK is ON DELETE SET NULL), so the
    // project lists need refetching too or they'd keep showing the dead label.
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projectCategories'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project'] });
    },
  });
}
