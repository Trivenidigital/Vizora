'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { PaginatedResponse, Content, Display, Playlist, Schedule } from '@/lib/types';

export function useContent(params?: {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
}) {
  return useQuery<PaginatedResponse<Content>>({
    queryKey: ['content', params],
    queryFn: () => apiClient.getContent(params),
  });
}

export function useDisplays(params?: { page?: number; limit?: number }) {
  return useQuery<PaginatedResponse<Display>>({
    queryKey: ['displays', params],
    queryFn: () => apiClient.getDisplays(params),
  });
}

export function usePlaylists(params?: { page?: number; limit?: number }) {
  return useQuery<PaginatedResponse<Playlist>>({
    queryKey: ['playlists', params],
    queryFn: () => apiClient.getPlaylists(params),
  });
}

export function useSchedules(params?: { page?: number; limit?: number }) {
  return useQuery<PaginatedResponse<Schedule>>({
    queryKey: ['schedules', params],
    queryFn: () => apiClient.getSchedules(params),
  });
}
