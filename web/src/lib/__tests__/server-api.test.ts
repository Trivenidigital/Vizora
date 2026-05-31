import { cookies } from 'next/headers';
import { serverFetch } from '../server-api';

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
}));

describe('serverFetch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
    (cookies as jest.Mock).mockResolvedValue({
      get: jest.fn((name: string) =>
        name === 'vizora_auth_token' ? { value: 'server-cookie-token' } : undefined,
      ),
    });
  });

  it('forwards the httpOnly auth cookie to middleware during SSR', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { ok: true } }),
    });

    await serverFetch('/admin/stats');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/admin/stats'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer server-cookie-token',
          Cookie: 'vizora_auth_token=server-cookie-token',
        }),
      }),
    );
  });

  it('unwraps middleware response envelopes for server components', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: { data: [{ id: 'org-1' }], total: 1 },
        meta: { requestId: 'req-1' },
      }),
    });

    await expect(serverFetch('/admin/organizations')).resolves.toEqual({
      data: [{ id: 'org-1' }],
      total: 1,
    });
  });

  it('includes backend error messages when SSR API calls fail', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ message: 'Admins only' }),
    });

    await expect(serverFetch('/admin/stats')).rejects.toThrow('Admins only');
  });
});
