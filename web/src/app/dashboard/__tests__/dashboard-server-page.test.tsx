import { render } from '@testing-library/react';
import DashboardPage from '../page';
import DashboardClient from '../page-client';
import { ServerFetchError, serverFetch } from '@/lib/server-api';

jest.mock('@/lib/server-api', () => {
  class MockServerFetchError extends Error {
    constructor(
      public statusCode: number,
      message: string,
      public body: unknown,
    ) {
      super(message);
      this.name = 'ServerFetchError';
    }
  }

  return {
    ServerFetchError: MockServerFetchError,
    serverFetch: jest.fn(),
  };
});

jest.mock('../page-client', () => jest.fn(() => <div data-testid="dashboard-client" />));

const mockedServerFetch = serverFetch as jest.MockedFunction<typeof serverFetch>;
const mockedDashboardClient = DashboardClient as jest.Mock;

describe('DashboardPage server data', () => {
  beforeEach(() => {
    mockedServerFetch.mockReset();
    mockedDashboardClient.mockClear();
  });

  it('passes analytics summary, bounded activity samples, and health/storage to the client', async () => {
    mockedServerFetch.mockImplementation(async (path) => {
      switch (path) {
        case '/analytics/summary':
          return {
            totalDevices: 10,
            onlineDevices: 8,
            totalContent: 250,
            processingContent: 7,
            totalPlaylists: 42,
            activePlaylists: 31,
          } as never;
        case '/content?limit=3':
          return {
            data: [{ id: 'content-1' }],
            meta: { page: 1, limit: 3, total: 250, totalPages: 84 },
          } as never;
        case '/playlists?limit=3':
          return {
            data: [{ id: 'playlist-1' }],
            meta: { page: 1, limit: 3, total: 42, totalPages: 14 },
          } as never;
        case '/organizations/storage':
          return {
            usedBytes: 1024,
            quotaBytes: 2048,
            availableBytes: 1024,
            usagePercent: 50,
          } as never;
        case '/health/ready':
          return { status: 'ok', timestamp: '2026-05-31T00:00:00.000Z' } as never;
        default:
          throw new Error(`Unexpected serverFetch path: ${path}`);
      }
    });

    render(await DashboardPage());

    expect(mockedDashboardClient).toHaveBeenCalledTimes(1);
    expect(mockedDashboardClient.mock.calls[0][0]).toEqual(expect.objectContaining({
      initialContent: [{ id: 'content-1' }],
      initialPlaylists: [{ id: 'playlist-1' }],
      initialStats: {
        devices: { total: 10, online: 8 },
        content: { total: 250, processing: 7 },
        playlists: { total: 42, active: 31 },
      },
      initialContentSampleReady: true,
      initialPlaylistsSampleReady: true,
      initialStorageInfo: {
        usedBytes: 1024,
        quotaBytes: 2048,
        availableBytes: 1024,
        usagePercent: 50,
      },
      initialSystemHealth: { status: 'ok', timestamp: '2026-05-31T00:00:00.000Z' },
    }));
  });

  it('does not mark paginated server data incomplete when only bounded samples are fetched', async () => {
    mockedServerFetch.mockImplementation(async (path) => {
      switch (path) {
        case '/analytics/summary':
          return {
            totalDevices: 0,
            onlineDevices: 0,
            totalContent: 2,
            processingContent: 0,
            totalPlaylists: 2,
            activePlaylists: 1,
          } as never;
        case '/content?limit=3':
          return {
            data: [{ id: 'content-1' }],
            meta: { page: 1, limit: 3, total: 2, totalPages: 1 },
          } as never;
        case '/playlists?limit=3':
          return {
            data: [{ id: 'playlist-1' }],
            meta: { page: 1, limit: 3, total: 2, totalPages: 1 },
          } as never;
        case '/organizations/storage':
          return null as never;
        case '/health/ready':
          return { status: 'ok' } as never;
        default:
          throw new Error(`Unexpected serverFetch path: ${path}`);
      }
    });

    render(await DashboardPage());

    expect(mockedDashboardClient.mock.calls[0][0]).toEqual(expect.objectContaining({
      initialStats: {
        devices: { total: 0, online: 0 },
        content: { total: 2, processing: 0 },
        playlists: { total: 2, active: 1 },
      },
      initialContentSampleReady: true,
      initialPlaylistsSampleReady: true,
    }));
  });

  it('preserves unhealthy readiness from a server-side 503 response', async () => {
    mockedServerFetch.mockImplementation(async (path) => {
      switch (path) {
        case '/analytics/summary':
          return null as never;
        case '/content?limit=3':
        case '/playlists?limit=3':
          return { data: [], meta: { page: 1, limit: 3, total: 0, totalPages: 1 } } as never;
        case '/organizations/storage':
          return null as never;
        case '/health/ready':
          throw new ServerFetchError(503, 'Service unavailable', {
            status: 'unhealthy',
            checks: { database: { status: 'down' } },
          });
        default:
          throw new Error(`Unexpected serverFetch path: ${path}`);
      }
    });

    render(await DashboardPage());

    expect(mockedDashboardClient.mock.calls[0][0]).toEqual(expect.objectContaining({
      initialSystemHealth: {
        status: 'unhealthy',
        checks: { database: { status: 'down' } },
      },
    }));
  });
});
