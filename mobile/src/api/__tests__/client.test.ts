import { api, ApiError } from '../client';
import { useAuthStore } from '../../stores/auth';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock the auth store so we can control the token returned by getState()
jest.mock('../../stores/auth', () => ({
  useAuthStore: {
    getState: jest.fn(() => ({ token: null })),
  },
}));

// We need access to the mock for type-safe usage
const mockGetState = useAuthStore.getState as jest.Mock;

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---------------------------------------------------------------------------
// XHR mock helpers
// ---------------------------------------------------------------------------
type XHRInstance = {
  open: jest.Mock;
  send: jest.Mock;
  setRequestHeader: jest.Mock;
  upload: { onprogress: ((event: Partial<ProgressEvent>) => void) | null };
  onload: (() => void) | null;
  onerror: (() => void) | null;
  status: number;
  responseText: string;
};

let lastXhr: XHRInstance;

function createMockXHR(): XHRInstance {
  const xhr: XHRInstance = {
    open: jest.fn(),
    send: jest.fn(),
    setRequestHeader: jest.fn(),
    upload: { onprogress: null },
    onload: null,
    onerror: null,
    status: 0,
    responseText: '',
  };
  lastXhr = xhr;
  return xhr;
}

// Replace global XMLHttpRequest with our mock
(global as unknown as Record<string, unknown>).XMLHttpRequest = jest.fn(
  () => createMockXHR(),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: jest.fn().mockResolvedValue(data),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState.mockReturnValue({ token: null });
  });

  // -----------------------------------------------------------------------
  // request() — envelope unwrapping
  // -----------------------------------------------------------------------
  describe('request — envelope unwrapping', () => {
    it('unwraps { success, data } envelope and returns data', async () => {
      const payload = { id: '1', name: 'Display A' };
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ success: true, data: payload }),
      );

      const result = await api.getDisplays();

      expect(result).toEqual(payload);
    });

    it('passes through non-envelope JSON as-is', async () => {
      const payload = { custom: 'value', other: 42 };
      mockFetch.mockResolvedValueOnce(jsonResponse(payload));

      const result = await api.getDisplays();

      expect(result).toEqual(payload);
    });

    it('passes through envelope with success but missing data as-is', async () => {
      const payload = { success: true, message: 'ok' };
      mockFetch.mockResolvedValueOnce(jsonResponse(payload));

      const result = await api.getDisplays();

      // No 'data' key, so it should not unwrap
      expect(result).toEqual(payload);
    });
  });

  // -----------------------------------------------------------------------
  // request() — Bearer token injection
  // -----------------------------------------------------------------------
  describe('request — Bearer token', () => {
    it('includes Authorization header when token is present', async () => {
      mockGetState.mockReturnValue({ token: 'my-jwt-token' });
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await api.getDisplays();

      const [, fetchOptions] = mockFetch.mock.calls[0];
      expect(fetchOptions.headers).toMatchObject({
        Authorization: 'Bearer my-jwt-token',
      });
    });

    it('omits Authorization header when token is null', async () => {
      mockGetState.mockReturnValue({ token: null });
      mockFetch.mockResolvedValueOnce(jsonResponse([]));

      await api.getDisplays();

      const [, fetchOptions] = mockFetch.mock.calls[0];
      expect(fetchOptions.headers).not.toHaveProperty('Authorization');
    });
  });

  // -----------------------------------------------------------------------
  // request() — ApiError on non-OK response
  // -----------------------------------------------------------------------
  describe('request — error handling', () => {
    it('throws ApiError with status and message from error body', async () => {
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ message: 'Unauthorized' }, 401),
      );

      await expect(api.getDisplays()).rejects.toThrow(ApiError);
      await expect(
        api.getDisplays().catch((e: ApiError) => {
          expect(e.status).toBe(401);
          expect(e.message).toBe('Unauthorized');
          throw e;
        }),
      ).rejects.toThrow();
    });

    it('falls back to "Request failed" when error body has no message', async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse({}, 500));

      try {
        await api.getDisplays();
        // Should not reach here
        expect(true).toBe(false);
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(500);
        expect((err as ApiError).message).toBe('Request failed');
      }
    });

    it('falls back to statusText when error body JSON parsing fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: jest.fn().mockRejectedValue(new Error('invalid json')),
      } as unknown as Response);

      try {
        await api.getDisplays();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).status).toBe(502);
        expect((err as ApiError).message).toBe('Bad Gateway');
      }
    });
  });

  // -----------------------------------------------------------------------
  // login
  // -----------------------------------------------------------------------
  describe('login', () => {
    it('calls POST /api/v1/auth/login with email and password', async () => {
      const loginResponse = {
        access_token: 'tok-123',
        user: {
          id: 'u1',
          email: 'a@b.com',
          firstName: 'A',
          lastName: 'B',
          role: 'admin',
          organizationId: 'org-1',
        },
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(loginResponse));

      const result = await api.login('a@b.com', 'secret');

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/v1/auth/login');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual({
        email: 'a@b.com',
        password: 'secret',
      });
      expect(result).toEqual(loginResponse);
    });
  });

  // -----------------------------------------------------------------------
  // register
  // -----------------------------------------------------------------------
  describe('register', () => {
    it('calls POST /api/v1/auth/register with RegisterData body', async () => {
      const registerData = {
        email: 'new@user.com',
        password: 'pass123',
        firstName: 'New',
        lastName: 'User',
        organizationName: 'TestOrg',
      };
      const registerResponse = {
        token: 'new-token',
        user: {
          id: 'u2',
          email: 'new@user.com',
          firstName: 'New',
          lastName: 'User',
          role: 'admin',
          organizationId: 'org-2',
        },
      };
      mockFetch.mockResolvedValueOnce(jsonResponse(registerResponse));

      const result = await api.register(registerData);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe('http://localhost:3000/api/v1/auth/register');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual(registerData);
      expect(result).toEqual(registerResponse);
    });
  });

  // -----------------------------------------------------------------------
  // uploadFile
  // -----------------------------------------------------------------------
  describe('uploadFile', () => {
    it('uses XMLHttpRequest to POST to /api/v1/content/upload', async () => {
      mockGetState.mockReturnValue({ token: 'upload-token' });
      const onProgress = jest.fn();

      const uploadPromise = api.uploadFile(
        'file:///photo.jpg',
        'photo.jpg',
        'image/jpeg',
        onProgress,
      );

      // Verify XHR was configured correctly
      expect(lastXhr.open).toHaveBeenCalledWith(
        'POST',
        'http://localhost:3000/api/v1/content/upload',
      );
      expect(lastXhr.setRequestHeader).toHaveBeenCalledWith(
        'Authorization',
        'Bearer upload-token',
      );

      // Simulate progress
      lastXhr.upload.onprogress!({ lengthComputable: true, loaded: 50, total: 100 });
      expect(onProgress).toHaveBeenCalledWith(50);

      lastXhr.upload.onprogress!({ lengthComputable: true, loaded: 100, total: 100 });
      expect(onProgress).toHaveBeenCalledWith(100);

      // Simulate successful response
      lastXhr.status = 200;
      lastXhr.responseText = JSON.stringify({
        success: true,
        data: { id: 'c1', name: 'photo.jpg', type: 'image' },
      });
      lastXhr.onload!();

      const result = await uploadPromise;
      expect(result).toEqual({ id: 'c1', name: 'photo.jpg', type: 'image' });
    });

    it('does not set Authorization header when no token', async () => {
      mockGetState.mockReturnValue({ token: null });

      const uploadPromise = api.uploadFile(
        'file:///photo.jpg',
        'photo.jpg',
        'image/jpeg',
      );

      expect(lastXhr.setRequestHeader).not.toHaveBeenCalled();

      // Complete the upload to avoid hanging promise
      lastXhr.status = 200;
      lastXhr.responseText = JSON.stringify({ id: 'c1', name: 'photo.jpg' });
      lastXhr.onload!();

      await uploadPromise;
    });

    it('calls onProgress with percentage on upload progress', async () => {
      mockGetState.mockReturnValue({ token: null });
      const onProgress = jest.fn();

      const uploadPromise = api.uploadFile(
        'file:///video.mp4',
        'video.mp4',
        'video/mp4',
        onProgress,
      );

      // Simulate progress events
      lastXhr.upload.onprogress!({ lengthComputable: true, loaded: 25, total: 100 });
      expect(onProgress).toHaveBeenCalledWith(25);

      lastXhr.upload.onprogress!({ lengthComputable: true, loaded: 75, total: 100 });
      expect(onProgress).toHaveBeenCalledWith(75);

      // Non-computable progress should be ignored
      lastXhr.upload.onprogress!({ lengthComputable: false, loaded: 0, total: 0 });
      expect(onProgress).toHaveBeenCalledTimes(2);

      // Complete
      lastXhr.status = 200;
      lastXhr.responseText = JSON.stringify({ id: 'c2' });
      lastXhr.onload!();
      await uploadPromise;
    });

    it('unwraps envelope from upload response', async () => {
      mockGetState.mockReturnValue({ token: null });

      const uploadPromise = api.uploadFile(
        'file:///img.png',
        'img.png',
        'image/png',
      );

      lastXhr.status = 201;
      lastXhr.responseText = JSON.stringify({
        success: true,
        data: { id: 'c3', name: 'img.png', type: 'image' },
      });
      lastXhr.onload!();

      const result = await uploadPromise;
      expect(result).toEqual({ id: 'c3', name: 'img.png', type: 'image' });
    });

    it('passes through non-envelope upload response', async () => {
      mockGetState.mockReturnValue({ token: null });

      const uploadPromise = api.uploadFile(
        'file:///img.png',
        'img.png',
        'image/png',
      );

      lastXhr.status = 200;
      lastXhr.responseText = JSON.stringify({ id: 'c4', name: 'img.png' });
      lastXhr.onload!();

      const result = await uploadPromise;
      expect(result).toEqual({ id: 'c4', name: 'img.png' });
    });

    it('rejects with ApiError on non-2xx response', async () => {
      mockGetState.mockReturnValue({ token: null });

      const uploadPromise = api.uploadFile(
        'file:///bad.jpg',
        'bad.jpg',
        'image/jpeg',
      );

      lastXhr.status = 413;
      lastXhr.responseText = JSON.stringify({ message: 'File too large' });
      lastXhr.onload!();

      await expect(uploadPromise).rejects.toThrow(ApiError);
      await expect(uploadPromise).rejects.toMatchObject({
        status: 413,
        message: 'File too large',
      });
    });

    it('rejects with ApiError on invalid server response', async () => {
      mockGetState.mockReturnValue({ token: null });

      const uploadPromise = api.uploadFile(
        'file:///bad.jpg',
        'bad.jpg',
        'image/jpeg',
      );

      lastXhr.status = 200;
      lastXhr.responseText = 'not json';
      lastXhr.onload!();

      await expect(uploadPromise).rejects.toThrow(ApiError);
      await expect(uploadPromise).rejects.toMatchObject({
        status: 200,
        message: 'Invalid server response',
      });
    });

    it('rejects with ApiError on network error', async () => {
      mockGetState.mockReturnValue({ token: null });

      const uploadPromise = api.uploadFile(
        'file:///fail.jpg',
        'fail.jpg',
        'image/jpeg',
      );

      lastXhr.onerror!();

      await expect(uploadPromise).rejects.toThrow(ApiError);
      await expect(uploadPromise).rejects.toMatchObject({
        status: 0,
        message: 'Network error during upload',
      });
    });
  });
});

// ---------------------------------------------------------------------------
// buildQuery (exported indirectly via getContent)
// ---------------------------------------------------------------------------
describe('buildQuery (via api.getContent)', () => {
  const mockGetState2 = useAuthStore.getState as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetState2.mockReturnValue({ token: null });
  });

  it('filters out null and undefined values from params', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    await api.getContent({ type: 'image', page: undefined, limit: null as unknown as undefined });

    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain('type=image');
    expect(url).not.toContain('page');
    expect(url).not.toContain('limit');
  });

  it('converts values to strings in query params', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    await api.getContent({ page: 2, limit: 10 });

    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
  });

  it('sends no query string when params are omitted', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse([]));

    await api.getContent();

    const url: string = mockFetch.mock.calls[0][0];
    expect(url).toBe('http://localhost:3000/api/v1/content');
  });
});

// ---------------------------------------------------------------------------
// ApiError
// ---------------------------------------------------------------------------
describe('ApiError', () => {
  it('has correct name, status, and message', () => {
    const err = new ApiError(404, 'Not Found');
    expect(err.name).toBe('ApiError');
    expect(err.status).toBe(404);
    expect(err.message).toBe('Not Found');
    expect(err).toBeInstanceOf(Error);
  });
});
