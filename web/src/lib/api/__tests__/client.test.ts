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

describe('ApiClient auto-refresh on 401 (PR-17b)', () => {
  const okEnvelope = (data: unknown) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({ success: true, data }),
  });
  const unauthorized = (message = 'Session expired') => ({
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    json: async () => ({ message }),
  });

  beforeEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'vizora_csrf_token=test-csrf',
    });
    global.fetch = jest.fn();
  });

  it('on a 401, redeems the refresh cookie ONCE and replays the original request', async () => {
    const calls: string[] = [];
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      calls.push(url);
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(okEnvelope({ expiresIn: 1800 }));
      }
      if (url.endsWith('/widgets')) {
        const hits = calls.filter((u) => u.endsWith('/widgets')).length;
        return Promise.resolve(hits === 1 ? unauthorized() : okEnvelope({ ok: 1 }));
      }
      return Promise.resolve(okEnvelope({}));
    });

    const client = new ApiClient('/api/v1');
    const result = await client.request('/widgets');

    expect(result).toEqual({ ok: 1 });
    expect(calls.filter((u) => u.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(calls.filter((u) => u.endsWith('/widgets'))).toHaveLength(2); // original + replay
    expect(client.isAuthenticated).toBe(true);
  });

  it('coalesces concurrent 401s into a SINGLE /auth/refresh (single-flight mutex)', async () => {
    const calls: string[] = [];
    let refreshCount = 0;
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      calls.push(url);
      if (url.endsWith('/auth/refresh')) {
        refreshCount += 1;
        // Delay so all three initial 401s are in-flight before this resolves —
        // if the mutex is missing, each would spawn its own refresh.
        return new Promise((resolve) => setTimeout(() => resolve(okEnvelope({ expiresIn: 1800 })), 10));
      }
      const isReplay = calls.filter((u) => u === url).length > 1;
      return Promise.resolve(isReplay ? okEnvelope({ url }) : unauthorized());
    });

    const client = new ApiClient('/api/v1');
    const [a, b, c] = await Promise.all([
      client.request('/a'),
      client.request('/b'),
      client.request('/c'),
    ]);

    expect(refreshCount).toBe(1);
    expect(calls.filter((u) => u.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(a).toEqual({ url: '/api/v1/a' });
    expect(b).toEqual({ url: '/api/v1/b' });
    expect(c).toEqual({ url: '/api/v1/c' });
  });

  it('when the refresh also fails, clears auth and redirects a protected route to login', async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { pathname: '/dashboard', href: '' },
    });

    // Everything (including /auth/refresh) returns 401 → refresh cannot recover.
    (global.fetch as jest.Mock).mockResolvedValue(unauthorized());

    const client = new ApiClient('/api/v1');
    client.setAuthenticated(true);

    await expect(client.request('/widgets')).rejects.toBeInstanceOf(ApiError);
    expect(client.isAuthenticated).toBe(false);
    expect(window.location.href).toBe('/login?redirect=%2Fdashboard');

    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('does NOT auto-refresh a failed login (bad credentials surface unchanged, no loop)', async () => {
    const calls: string[] = [];
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      calls.push(url);
      return Promise.resolve(unauthorized('Invalid credentials'));
    });

    const client = new ApiClient('/api/v1');
    await expect(
      client.request('/auth/login', { method: 'POST', body: '{}' }),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid credentials' });

    expect(calls.filter((u) => u.endsWith('/auth/refresh'))).toHaveLength(0);
    expect(calls.filter((u) => u.endsWith('/auth/login'))).toHaveLength(1);
  });

  it('does NOT recurse when /auth/refresh itself returns 401', async () => {
    const calls: string[] = [];
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      calls.push(url);
      return Promise.resolve(unauthorized('Refresh token reuse detected'));
    });

    const client = new ApiClient('/api/v1');
    await expect(client.request('/auth/refresh', { method: 'POST' })).rejects.toBeInstanceOf(ApiError);

    expect(calls.filter((u) => u.endsWith('/auth/refresh'))).toHaveLength(1);
  });
});
