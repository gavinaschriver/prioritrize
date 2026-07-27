import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getUserTimezone } from '../lib/api';
import type { GoogleCalendarConnection, GoogleCalendarSettings, GoogleSyncResult } from '../types';

export function useGoogleCalendar() {
  return useQuery<GoogleCalendarConnection>({
    queryKey: ['googleCalendar'],
    queryFn: () => api.get('/api/integrations/google'),
  });
}

export function useStartGoogleConnect() {
  return useMutation({
    mutationFn: (redirectPath: string = '/settings') =>
      api.post('/api/integrations/google/connect', {
        timezone: getUserTimezone(),
        redirect_path: redirectPath,
      }),
    onSuccess: (data: { authorization_url: string }) => {
      // A full navigation, not fetch/iframe — Google blocks both.
      window.location.href = data.authorization_url;
    },
  });
}

export function useSyncGoogleNow() {
  const queryClient = useQueryClient();
  return useMutation<GoogleSyncResult>({
    mutationFn: () => api.post('/api/integrations/google/sync', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['googleCalendar'] });
    },
  });
}

export function useUpdateGoogleSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: GoogleCalendarSettings) => api.put('/api/integrations/google/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['googleCalendar'] });
    },
  });
}

export function useDisconnectGoogle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete('/api/integrations/google'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['googleCalendar'] });
    },
  });
}
