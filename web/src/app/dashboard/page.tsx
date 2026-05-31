import type { Metadata } from 'next';
import { ServerFetchError, serverFetch } from '@/lib/server-api';
import { unwrapPaginatedData } from '@/lib/api/pagination';
import type { StorageInfo } from '@/lib/api/organizations';
import type { AnalyticsSummary } from '@/lib/types';
import DashboardClient from './page-client';

export const metadata: Metadata = {
  title: 'Dashboard',
};

const DASHBOARD_ACTIVITY_LIMIT = 3;

type DashboardHealthStatus = 'ok' | 'degraded' | 'unhealthy' | 'unknown';

interface DashboardSystemHealth {
  status: DashboardHealthStatus;
  timestamp?: string;
  message?: string;
  checks?: Record<string, { status?: string; message?: string }>;
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

function getDashboardStatsFromSummary(summary: AnalyticsSummary | null) {
  if (!summary) return null;

  return {
    devices: {
      total: summary.totalDevices ?? 0,
      online: summary.onlineDevices ?? 0,
    },
    content: {
      total: summary.totalContent ?? 0,
      processing: summary.processingContent ?? 0,
    },
    playlists: {
      total: summary.totalPlaylists ?? 0,
      active: summary.activePlaylists ?? 0,
    },
  };
}

export default async function DashboardPage() {
  let content: any[] = [];
  let playlists: any[] = [];
  let summary: AnalyticsSummary | null = null;
  let initialContentSampleReady = false;
  let initialPlaylistsSampleReady = false;
  let storageInfo: StorageInfo | null = null;
  let systemHealth: DashboardSystemHealth | null = null;

  try {
    const results = await Promise.allSettled([
      serverFetch<AnalyticsSummary>('/analytics/summary'),
      serverFetch<any>(`/content?limit=${DASHBOARD_ACTIVITY_LIMIT}`),
      serverFetch<any>(`/playlists?limit=${DASHBOARD_ACTIVITY_LIMIT}`),
      serverFetch<StorageInfo>('/organizations/storage'),
      serverFetch<DashboardSystemHealth>('/health/ready'),
    ]);

    if (results[0].status === 'fulfilled') {
      summary = results[0].value;
    }
    if (results[1].status === 'fulfilled') {
      content = unwrapPaginatedData(results[1].value);
      initialContentSampleReady = true;
    }
    if (results[2].status === 'fulfilled') {
      playlists = unwrapPaginatedData(results[2].value);
      initialPlaylistsSampleReady = true;
    }
    if (results[3].status === 'fulfilled') {
      storageInfo = results[3].value;
    }
    if (results[4].status === 'fulfilled') {
      systemHealth = results[4].value;
    } else {
      systemHealth = getUnhealthyReadinessFromError(results[4].reason);
    }
  } catch {
    // Client handles empty state gracefully
  }

  return (
    <DashboardClient
      initialContent={content}
      initialPlaylists={playlists}
      initialStats={getDashboardStatsFromSummary(summary)}
      initialContentSampleReady={initialContentSampleReady}
      initialPlaylistsSampleReady={initialPlaylistsSampleReady}
      initialStorageInfo={storageInfo}
      initialSystemHealth={systemHealth}
    />
  );
}
