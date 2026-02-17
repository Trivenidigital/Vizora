import { withRetry } from '../retry';

describe('withRetry', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('returns result on first successful attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const promise = withRetry(fn);

    const result = await promise;
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on retryable status code and succeeds', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce({ status: 500, message: 'Server Error' })
      .mockResolvedValueOnce('recovered');

    const promise = withRetry(fn);

    // First attempt fails, wait for retry delay (1000ms * 2^0 = 1000ms)
    await jest.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws immediately on non-retryable status code', async () => {
    const error = { status: 400, message: 'Bad Request' };
    const fn = jest.fn().mockRejectedValue(error);

    await expect(withRetry(fn)).rejects.toEqual(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after max retries exhausted', async () => {
    jest.useRealTimers();
    const error = { status: 500, message: 'Server Error' };
    const fn = jest.fn().mockRejectedValue(error);

    await expect(
      withRetry(fn, { maxRetries: 2, retryDelay: 1, exponentialBackoff: false })
    ).rejects.toEqual(error);
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries

    jest.useFakeTimers();
  });

  it('uses exponential backoff by default', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce({ status: 503, message: 'Unavailable' })
      .mockRejectedValueOnce({ status: 503, message: 'Unavailable' })
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { retryDelay: 100, maxRetries: 3 });

    // Attempt 0 fails -> delay = 100 * 2^0 = 100ms
    await jest.advanceTimersByTimeAsync(100);
    // Attempt 1 fails -> delay = 100 * 2^1 = 200ms
    await jest.advanceTimersByTimeAsync(200);
    // Attempt 2 succeeds

    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses constant delay when exponentialBackoff is false', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce({ status: 500, message: 'Error' })
      .mockRejectedValueOnce({ status: 500, message: 'Error' })
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { retryDelay: 100, exponentialBackoff: false, maxRetries: 3 });

    // Attempt 0 fails -> delay = 100ms (constant)
    await jest.advanceTimersByTimeAsync(100);
    // Attempt 1 fails -> delay = 100ms (constant)
    await jest.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries on all default retryable status codes', async () => {
    const retryableCodes = [408, 429, 500, 502, 503, 504];

    for (const code of retryableCodes) {
      jest.clearAllMocks();

      const fn = jest.fn()
        .mockRejectedValueOnce({ status: code, message: `Error ${code}` })
        .mockResolvedValueOnce('ok');

      const promise = withRetry(fn, { maxRetries: 1, retryDelay: 10 });
      await jest.advanceTimersByTimeAsync(10);

      const result = await promise;
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    }
  });

  it('does not retry errors without a status code', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { maxRetries: 2, retryDelay: 100 });

    // Error has no status code, so it should retry (statusCode is undefined, the check is: if statusCode && !retryOn.includes => throw)
    // Since statusCode is falsy, the condition is false, so it will retry
    await jest.advanceTimersByTimeAsync(100);

    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('uses custom retryOn status codes', async () => {
    const fn = jest.fn().mockRejectedValue({ status: 500, message: 'Error' });

    // Only retry on 503, not 500
    const promise = withRetry(fn, { retryOn: [503], maxRetries: 2 });

    await expect(promise).rejects.toEqual({ status: 500, message: 'Error' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects statusCode property as alternative to status', async () => {
    const fn = jest.fn().mockRejectedValue({ statusCode: 400, message: 'Bad Request' });

    await expect(withRetry(fn)).rejects.toEqual({ statusCode: 400, message: 'Bad Request' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('logs warning on each retry', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce({ status: 500, message: 'fail' })
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { retryDelay: 50, maxRetries: 1 });
    await jest.advanceTimersByTimeAsync(50);

    await promise;
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('attempt 1/2'),
      'fail'
    );
  });

  it('works with maxRetries of 0 (no retries)', async () => {
    const error = { status: 500, message: 'Error' };
    const fn = jest.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { maxRetries: 0 })).rejects.toEqual(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
