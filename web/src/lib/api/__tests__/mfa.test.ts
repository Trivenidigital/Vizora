import { ApiClient } from '../client';
import '../mfa';

describe('mfa api methods', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: 'vizora_csrf_token=test-csrf',
    });
    global.fetch = jest.fn();
  });

  const okJson = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data }) });

  it('enroll sends the x-mfa-enrollment-token header when a token is provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      okJson({ otpauthUrl: 'otpauth://totp/x', qrDataUrl: 'data:image/png;base64,AA' }),
    );
    const client = new ApiClient('/api/v1');

    await client.mfaEnroll('enrollment-token-abc');

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/v1/auth/mfa/enroll');
    expect(init.method).toBe('POST');
    expect(init.headers['x-mfa-enrollment-token']).toBe('enrollment-token-abc');
  });

  it('enroll omits the enrollment header when no token (voluntary flow)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      okJson({ otpauthUrl: 'otpauth://totp/x', qrDataUrl: 'data:image/png;base64,AA' }),
    );
    const client = new ApiClient('/api/v1');

    await client.mfaEnroll();

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.headers?.['x-mfa-enrollment-token']).toBeUndefined();
  });

  it('mfaChallenge posts challengeToken + code and marks authenticated', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(
      okJson({ access_token: 'jwt', user: { id: 'u1' }, expiresIn: 1800 }),
    );
    const client = new ApiClient('/api/v1');

    const res = await client.mfaChallenge('ct-1', '123456');

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/v1/auth/mfa/challenge');
    expect(JSON.parse(init.body)).toEqual({ challengeToken: 'ct-1', code: '123456' });
    expect(client.isAuthenticated).toBe(true);
    expect(res).toEqual({ access_token: 'jwt', user: { id: 'u1' }, expiresIn: 1800 });
  });

  it('mfaEnable marks authenticated only when a session is returned (forced flow)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(okJson({ backupCodes: ['a', 'b'], access_token: 'jwt' }));
    const client = new ApiClient('/api/v1');

    await client.mfaEnable('123456', 'enr-token');
    expect(client.isAuthenticated).toBe(true);
  });

  it('setOrgMfaRequired PATCHes the org policy endpoint', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(okJson({ mfaRequired: true }));
    const client = new ApiClient('/api/v1');

    await expect(client.setOrgMfaRequired(true)).resolves.toEqual({ mfaRequired: true });
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('/api/v1/organizations/current/mfa-required');
    expect(init.method).toBe('PATCH');
  });
});
