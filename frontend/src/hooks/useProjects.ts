import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Project, ProjectDetail, ProjectTask } from '../types';

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => api.get('/api/projects'),
  });
}

export function useProject(id: string) {
  return useQuery<ProjectDetail>({
    queryKey: ['project', id],
    queryFn: () => api.get(`/api/projects/${id}`),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; point_value?: number | null; due_date?: string | null; overview?: string }) =>
      api.post('/api/projects', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; point_value?: number | null; due_date?: string | null; overview?: string } }) =>
      api.put(`/api/projects/${id}`, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useCompleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/projects/${id}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useUncompleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/projects/${id}/uncomplete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useReorderProjects() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post('/api/projects/reorder', { ids }),
    // Applied optimistically so the row stays where it was dropped instead of
    // snapping back to the old order until the refetch lands.
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: ['projects'] });
      const previous = queryClient.getQueryData<Project[]>(['projects']);
      if (previous) {
        const byId = new Map(previous.map(p => [p.id, p]));
        queryClient.setQueryData<Project[]>(
          ['projects'],
          ids.map(id => byId.get(id)).filter((p): p is Project => !!p),
        );
      }
      return { previous };
    },
    onError: (_err, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(['projects'], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
}

export function useAddProjectUpdate(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { body: string }) =>
      api.post(`/api/projects/${projectId}/updates`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });
}

export function useEditProjectUpdate(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ updateId, body }: { updateId: string; body: string }) =>
      api.put(`/api/projects/${projectId}/updates/${updateId}`, { body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });
}

export function useDeleteProjectUpdate(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updateId: string) =>
      api.delete(`/api/projects/${projectId}/updates/${updateId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    },
  });
}

// --- Task hooks ---

export function useCreateProjectTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; point_value?: number; due_date?: string | null; description?: string | null; comment?: string | null }): Promise<ProjectTask> =>
      api.post(`/api/projects/${projectId}/tasks`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useUpdateProjectTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: { name?: string; point_value?: number; due_date?: string | null; description?: string | null; comment?: string | null } }): Promise<ProjectTask> =>
      api.put(`/api/projects/${projectId}/tasks/${taskId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useCompleteProjectTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string): Promise<ProjectTask> =>
      api.post(`/api/projects/${projectId}/tasks/${taskId}/complete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useUncompleteProjectTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string): Promise<ProjectTask> =>
      api.post(`/api/projects/${projectId}/tasks/${taskId}/uncomplete`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useDeleteProjectTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      api.delete(`/api/projects/${projectId}/tasks/${taskId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}

export function useConvertTaskToTodo(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) =>
      api.post(`/api/projects/${projectId}/tasks/${taskId}/convert-to-todo`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['daySummary'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
    },
  });
}
