import { ApiError } from '@/lib/error-handler';
import { ApiClient } from '../client';

describe('ApiClient auth error handling', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'vizora_csrf_token=test-csrf',
    });
    global.fetch = jest.fn();
  });

  it('preserves authenticated state and throws ApiError for 403 responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ message: 'Forbidden resource' }),
    });

    const client = new ApiClient('/api/v1');
    client.setAuthenticated(true);

    await expect(client.request('/admin-only')).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 403,
      message: 'Forbidden resource',
      userMessage: 'You do not have permission to access this resource.',
    });
    expect(client.isAuthenticated).toBe(true);
  });

  it('clears authenticated state for 401 responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      json: async () => ({ message: 'Session expired' }),
    });

    const client = new ApiClient('/api/v1');
    client.setAuthenticated(true);

    await expect(client.request('/dashboard-data')).rejects.toBeInstanceOf(ApiError);
    expect(client.isAuthenticated).toBe(false);
  });

  it('preserves authenticated state and throws ApiError for FormData 403 responses', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ message: 'Upload forbidden' }),
    });

    const client = new ApiClient('/api/v1');
    client.setAuthenticated(true);

    await expect(client.requestFormData('/content/upload', new FormData())).rejects.toMatchObject({
      name: 'ApiError',
      statusCode: 403,
      message: 'Upload forbidden',
      userMessage: 'You do not have permission to access this resource.',
    });
    expect(client.isAuthenticated).toBe(true);
  });
});
