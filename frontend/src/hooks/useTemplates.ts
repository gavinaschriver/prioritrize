import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ItemTemplate } from '../types';

/** What the create form sends. Omit repeat_every_days for a manual template. */
export interface TemplateInput {
  name: string;
  point_value: number;
  description?: string | null;
  category_id?: string | null;
  kind?: 'todo' | 'task';
  project_id?: string | null;
  repeat_every_days?: number | null;
  starts_on?: string | null;
  ends_on?: string | null;
}

export function useTemplates(kind?: 'todo' | 'task', projectId?: string) {
  const params = new URLSearchParams();
  if (kind) params.set('kind', kind);
  if (projectId) params.set('project_id', projectId);
  const qs = params.toString();

  return useQuery<ItemTemplate[]>({
    queryKey: ['templates', kind ?? 'all', projectId ?? 'all'],
    queryFn: () => api.get(`/api/templates${qs ? `?${qs}` : ''}`),
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TemplateInput) => api.post('/api/templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      // A recurring template materializes its first occurrence on save, so this can
      // create real, scoreable work -- the queue and the day both need refetching.
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TemplateInput> & { paused?: boolean } }) =>
      api.put(`/api/templates/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      // Instances the template produced survive it (template_id is ON DELETE SET
      // NULL), but their provenance is gone, so anything showing it is now stale.
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
}

export function useInstantiateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dueDate, projectId }: { id: string; dueDate: string | null; projectId?: string | null }) =>
      api.post(`/api/templates/${id}/instantiate`, { due_date: dueDate }).then(created => ({ created, projectId })),
    onSuccess: ({ projectId }) => {
      // This one DOES make real, scoreable work, so it invalidates everything a
      // hand-typed todo would — same discipline as useCreateTodo.
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      if (projectId) {
        queryClient.invalidateQueries({ queryKey: ['project', projectId] });
        queryClient.invalidateQueries({ queryKey: ['projects'] });
      }
    },
  });
}

/** "every 3 days" / "weekly, from Sep 11" / "manual" — one phrasing, used by every
 *  list that shows a template. */
export function describeSchedule(t: ItemTemplate): string {
  if (t.repeat_every_days === null) return 'manual';
  const n = t.repeat_every_days;
  const every =
    n === 1 ? 'every day' :
    n === 7 ? 'every week' :
    n === 14 ? 'every 2 weeks' :
    `every ${n} days`;
  return t.paused ? `${every} (paused)` : every;
}
