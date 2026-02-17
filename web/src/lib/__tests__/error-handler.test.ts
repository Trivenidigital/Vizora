import { ApiError, isApiError, getUserFriendlyMessage, handleResponse, logError } from '../error-handler';

// Mock the sentry module
jest.mock('../sentry', () => ({
  captureException: jest.fn(),
}));

describe('ApiError', () => {
  it('creates an error with statusCode and message', () => {
    const error = new ApiError(404, 'Not Found');
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Not Found');
    expect(error.name).toBe('ApiError');
    expect(error).toBeInstanceOf(Error);
  });

  it('defaults userMessage to message if not provided', () => {
    const error = new ApiError(500, 'Internal error');
    expect(error.userMessage).toBe('Internal error');
  });

  it('sets a custom userMessage when provided', () => {
    const error = new ApiError(500, 'DB connection failed', 'Something went wrong');
    expect(error.message).toBe('DB connection failed');
    expect(error.userMessage).toBe('Something went wrong');
  });
});

describe('isApiError', () => {
  it('returns true for ApiError instances', () => {
    const error = new ApiError(400, 'Bad Request');
    expect(isApiError(error)).toBe(true);
  });

  it('returns false for plain Error', () => {
    expect(isApiError(new Error('plain'))).toBe(false);
  });

  it('returns false for non-Error objects', () => {
    expect(isApiError({ statusCode: 400, message: 'Bad' })).toBe(false);
  });

  it('returns false for null and undefined', () => {
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
  });

  it('returns false for strings', () => {
    expect(isApiError('error')).toBe(false);
  });
});

describe('getUserFriendlyMessage', () => {
  it('returns userMessage for ApiError', () => {
    const error = new ApiError(500, 'Internal', 'Server error occurred');
    expect(getUserFriendlyMessage(error)).toBe('Server error occurred');
  });

  it('returns network error message for TypeError', () => {
    expect(getUserFriendlyMessage(new TypeError('Failed to fetch'))).toBe(
      'A network error occurred. Please check your connection.'
    );
  });

  it('returns timeout message for request timeout errors', () => {
    expect(getUserFriendlyMessage(new Error('Request timeout'))).toBe(
      'The request took too long. Please try again.'
    );
  });

  it('hides SQL-related error messages', () => {
    expect(getUserFriendlyMessage(new Error('SQL syntax error at line 1'))).toBe(
      'A server error occurred. Please try again later.'
    );
  });

  it('hides database-related error messages', () => {
    expect(getUserFriendlyMessage(new Error('database connection refused'))).toBe(
      'A server error occurred. Please try again later.'
    );
  });

  it('returns raw message for generic Error without sensitive content', () => {
    expect(getUserFriendlyMessage(new Error('Something broke'))).toBe('Something broke');
  });

  it('returns default message for non-Error values', () => {
    expect(getUserFriendlyMessage('string error')).toBe(
      'An unexpected error occurred. Please try again.'
    );
    expect(getUserFriendlyMessage(42)).toBe(
      'An unexpected error occurred. Please try again.'
    );
    expect(getUserFriendlyMessage(null)).toBe(
      'An unexpected error occurred. Please try again.'
    );
  });
});

describe('logError', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    jest.restoreAllMocks();
  });

  it('logs full error in development', () => {
    process.env.NODE_ENV = 'development';
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('dev error');

    logError(error, 'TestContext');

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('TestContext'),
      error
    );
  });

  it('logs error message only in production', () => {
    process.env.NODE_ENV = 'production';
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('prod error');

    logError(error);

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining('Error'),
      'prod error'
    );
  });

  it('reports to sentry in production', () => {
    process.env.NODE_ENV = 'production';
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { captureException } = require('../sentry');
    const error = new Error('sentry error');

    logError(error, 'SentryCtx');

    expect(captureException).toHaveBeenCalledWith(error, expect.objectContaining({
      context: 'SentryCtx',
    }));
  });
});

describe('handleResponse', () => {
  function createMockResponse(status: number, body?: any, ok?: boolean): Response {
    return {
      ok: ok ?? (status >= 200 && status < 300),
      status,
      json: jest.fn().mockResolvedValue(body ?? {}),
      headers: new Headers(),
      redirected: false,
      statusText: '',
      type: 'basic' as ResponseType,
      url: '',
      clone: jest.fn(),
      body: null,
      bodyUsed: false,
      arrayBuffer: jest.fn(),
      blob: jest.fn(),
      formData: jest.fn(),
      text: jest.fn(),
      bytes: jest.fn(),
    } as unknown as Response;
  }

  it('returns parsed JSON for successful response', async () => {
    const data = { id: 1, name: 'Test' };
    const response = createMockResponse(200, data);

    const result = await handleResponse(response);
    expect(result).toEqual(data);
  });

  it('throws ApiError for 400 Bad Request', async () => {
    const response = createMockResponse(400, { message: 'Validation failed' });

    try {
      await handleResponse(response);
      fail('Should have thrown');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.statusCode).toBe(400);
        expect(error.userMessage).toBe('Invalid request. Please check your input.');
      }
    }
  });

  it('throws ApiError for 401 Unauthorized', async () => {
    const response = createMockResponse(401, { message: 'Token expired' });

    try {
      await handleResponse(response);
      fail('Should have thrown');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.statusCode).toBe(401);
        expect(error.userMessage).toBe('Your session has expired. Please log in again.');
      }
    }
  });

  it('throws ApiError for 403 Forbidden', async () => {
    const response = createMockResponse(403, { message: 'Access denied' });

    try {
      await handleResponse(response);
      fail('Should have thrown');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.statusCode).toBe(403);
        expect(error.userMessage).toBe('You do not have permission to access this resource.');
      }
    }
  });

  it('throws ApiError for 404 Not Found', async () => {
    const response = createMockResponse(404, { message: 'Not found' });

    try {
      await handleResponse(response);
      fail('Should have thrown');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.statusCode).toBe(404);
        expect(error.userMessage).toBe('The requested resource was not found.');
      }
    }
  });

  it('throws ApiError for 409 Conflict with original message', async () => {
    const response = createMockResponse(409, { message: 'Email already exists' });

    try {
      await handleResponse(response);
      fail('Should have thrown');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.statusCode).toBe(409);
        expect(error.userMessage).toBe('Email already exists');
      }
    }
  });

  it('throws ApiError for 422 Unprocessable Entity', async () => {
    const response = createMockResponse(422, { message: 'Invalid data' });

    try {
      await handleResponse(response);
      fail('Should have thrown');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.statusCode).toBe(422);
        expect(error.userMessage).toBe('Please check your input and try again.');
      }
    }
  });

  it('throws ApiError for 429 Too Many Requests', async () => {
    const response = createMockResponse(429, { message: 'Rate limited' });

    try {
      await handleResponse(response);
      fail('Should have thrown');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.statusCode).toBe(429);
        expect(error.userMessage).toBe('Too many requests. Please wait a moment and try again.');
      }
    }
  });

  it('throws ApiError for 500 Internal Server Error', async () => {
    const response = createMockResponse(500, { message: 'Internal error' });

    try {
      await handleResponse(response);
      fail('Should have thrown');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.statusCode).toBe(500);
        expect(error.userMessage).toBe('A server error occurred. Please try again later.');
      }
    }
  });

  it('throws ApiError for 502 Bad Gateway', async () => {
    const response = createMockResponse(502, { message: 'Bad Gateway' });

    try {
      await handleResponse(response);
      fail('Should have thrown');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.statusCode).toBe(502);
        expect(error.userMessage).toBe('The service is temporarily unavailable. Please try again later.');
      }
    }
  });

  it('throws ApiError for 503 Service Unavailable', async () => {
    const response = createMockResponse(503, { message: 'Service Unavailable' });

    try {
      await handleResponse(response);
      fail('Should have thrown');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.statusCode).toBe(503);
        expect(error.userMessage).toBe('The service is temporarily unavailable. Please try again later.');
      }
    }
  });

  it('falls back to HTTP status message when response body is not JSON', async () => {
    const response = {
      ok: false,
      status: 500,
      json: jest.fn().mockRejectedValue(new Error('not json')),
      headers: new Headers(),
    } as unknown as Response;

    try {
      await handleResponse(response);
      fail('Should have thrown');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.statusCode).toBe(500);
        // errorMessage falls back to "Request failed" since json() threw,
        // but the switch maps 500 to a user-friendly message
        expect(error.userMessage).toBe('A server error occurred. Please try again later.');
      }
    }
  });

  it('uses errorData.message when available', async () => {
    const response = createMockResponse(418, { message: 'I am a teapot' });

    try {
      await handleResponse(response);
      fail('Should have thrown');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.statusCode).toBe(418);
        // 418 is not in the switch, so userMessage equals errorMessage
        expect(error.message).toBe('I am a teapot');
        expect(error.userMessage).toBe('I am a teapot');
      }
    }
  });

  it('falls back to HTTP status code string when no message in response body', async () => {
    const response = createMockResponse(418, {});

    try {
      await handleResponse(response);
      fail('Should have thrown');
    } catch (error) {
      expect(isApiError(error)).toBe(true);
      if (isApiError(error)) {
        expect(error.message).toBe('HTTP 418');
      }
    }
  });
});
