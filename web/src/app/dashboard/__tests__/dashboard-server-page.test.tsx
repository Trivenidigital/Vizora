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

  it('passes complete pagination flags and initial health/storage to the client', async () => {
    mockedServerFetch.mockImplementation(async (path) => {
      switch (path) {
        case '/content?limit=100':
          return {
            data: [{ id: 'content-1' }],
            meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
          } as never;
        case '/playlists?limit=100':
          return {
            data: [{ id: 'playlist-1' }],
            meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
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
      initialContentComplete: true,
      initialPlaylistsComplete: true,
      initialStorageInfo: {
        usedBytes: 1024,
        quotaBytes: 2048,
        availableBytes: 1024,
        usagePercent: 50,
      },
      initialSystemHealth: { status: 'ok', timestamp: '2026-05-31T00:00:00.000Z' },
    }));
  });

  it('marks paginated server data incomplete when more pages remain', async () => {
    mockedServerFetch.mockImplementation(async (path) => {
      switch (path) {
        case '/content?limit=100':
          return {
            data: [{ id: 'content-1' }],
            meta: { page: 1, limit: 100, total: 2, totalPages: 2 },
          } as never;
        case '/playlists?limit=100':
          return {
            data: [{ id: 'playlist-1' }],
            meta: { page: 1, limit: 100, total: 2, totalPages: 2 },
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
      initialContentComplete: false,
      initialPlaylistsComplete: false,
    }));
  });

  it('preserves unhealthy readiness from a server-side 503 response', async () => {
    mockedServerFetch.mockImplementation(async (path) => {
      switch (path) {
        case '/content?limit=100':
        case '/playlists?limit=100':
          return { data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 1 } } as never;
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
