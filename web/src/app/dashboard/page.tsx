import type { Metadata } from 'next';
import { ServerFetchError, serverFetch } from '@/lib/server-api';
import { unwrapPaginatedData } from '@/lib/api/pagination';
import type { StorageInfo } from '@/lib/api/organizations';
import DashboardClient from './page-client';

export const metadata: Metadata = {
  title: 'Dashboard',
};

const DASHBOARD_PAGE_LIMIT = 100;

type PaginationMeta = {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
};

type DashboardHealthStatus = 'ok' | 'degraded' | 'unhealthy' | 'unknown';

interface DashboardSystemHealth {
  status: DashboardHealthStatus;
  timestamp?: string;
  message?: string;
  checks?: Record<string, { status?: string; message?: string }>;
}

function getPaginationMeta(response: unknown): PaginationMeta | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const body = response as { meta?: unknown };
  if (!body.meta || typeof body.meta !== 'object') {
    return null;
  }

  return body.meta as PaginationMeta;
}

function isPageComplete(items: unknown[], meta: PaginationMeta | null): boolean {
  if (!meta) {
    return items.length < DASHBOARD_PAGE_LIMIT;
  }

  if (typeof meta.page === 'number' && typeof meta.totalPages === 'number') {
    return meta.page >= meta.totalPages;
  }

  if (typeof meta.total === 'number') {
    return items.length >= meta.total;
  }

  const limit = typeof meta.limit === 'number' ? meta.limit : DASHBOARD_PAGE_LIMIT;
  return items.length < limit;
}

function getUnhealthyReadinessFromError(reason: unknown): DashboardSystemHealth | null {
  if (!(reason instanceof ServerFetchError) || reason.statusCode !== 503) {
    return null;
  }

  if (reason.body && typeof reason.body === 'object') {
    const body = reason.body as { status?: unknown; message?: unknown };
    if (body.status === 'unhealthy') {
      return body as DashboardSystemHealth;
    }
  }

  return {
    status: 'unhealthy',
    message: 'Core service needs attention',
  };
}

export default async function DashboardPage() {
  let content: any[] = [];
  let playlists: any[] = [];
  let initialContentComplete = false;
  let initialPlaylistsComplete = false;
  let storageInfo: StorageInfo | null = null;
  let systemHealth: DashboardSystemHealth | null = null;

  try {
    const results = await Promise.allSettled([
      serverFetch<any>(`/content?limit=${DASHBOARD_PAGE_LIMIT}`),
      serverFetch<any>(`/playlists?limit=${DASHBOARD_PAGE_LIMIT}`),
      serverFetch<StorageInfo>('/organizations/storage'),
      serverFetch<DashboardSystemHealth>('/health/ready'),
    ]);

    if (results[0].status === 'fulfilled') {
      content = unwrapPaginatedData(results[0].value);
      initialContentComplete = isPageComplete(content, getPaginationMeta(results[0].value));
    }
    if (results[1].status === 'fulfilled') {
      playlists = unwrapPaginatedData(results[1].value);
      initialPlaylistsComplete = isPageComplete(playlists, getPaginationMeta(results[1].value));
    }
    if (results[2].status === 'fulfilled') {
      storageInfo = results[2].value;
    }
    if (results[3].status === 'fulfilled') {
      systemHealth = results[3].value;
    } else {
      systemHealth = getUnhealthyReadinessFromError(results[3].reason);
    }
  } catch {
    // Client handles empty state gracefully
  }

  return (
    <DashboardClient
      initialContent={content}
      initialPlaylists={playlists}
      initialContentComplete={initialContentComplete}
      initialPlaylistsComplete={initialPlaylistsComplete}
      initialStorageInfo={storageInfo}
      initialSystemHealth={systemHealth}
    />
  );
}
