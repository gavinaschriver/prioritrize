import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

interface DailyNotesData {
  content: string;
  date: string;
  updated_at: string;
}

export function useDailyNotes(date: string) {
  return useQuery<DailyNotesData>({
    queryKey: ['dailyNotes', date],
    queryFn: () => api.get(`/api/daily-notes?date=${date}`),
    staleTime: 60_000,
  });
}

export function useUpdateDailyNotes(date: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.put(`/api/daily-notes?date=${date}`, { content }),
    onSuccess: (data) => {
      queryClient.setQueryData(['dailyNotes', date], data);
    },
  });
}
