import { act, renderHook } from '@testing-library/react';
import { usePairing } from '../usePairing';

jest.mock('../../lib/device-identifier', () => ({
  getDeviceIdentifier: jest.fn(() => 'browser-display-1'),
  getDeviceMetadata: jest.fn(() => ({ userAgent: 'jest' })),
}));

describe('usePairing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    localStorage.clear();
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            code: 'ABC123',
            expiresInSeconds: 300,
          },
        }),
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { status: 'pending' } }),
      }) as jest.Mock;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('polls pairing status slowly enough to stay under the endpoint throttle', async () => {
    const { result } = renderHook(() => usePairing());

    await act(async () => {
      await result.current.requestPairingCode();
    });

    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      jest.advanceTimersByTime(6000);
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith('/api/v1/devices/pairing/status/ABC123');
  });

  it('backs off instead of hammering after a 429 status response', async () => {
    (fetch as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { code: 'ABC123', expiresInSeconds: 300 } }),
      })
      .mockResolvedValueOnce({ ok: false, status: 429 })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: { status: 'pending' } }) });

    const { result } = renderHook(() => usePairing());

    await act(async () => {
      await result.current.requestPairingCode();
    });

    await act(async () => {
      jest.advanceTimersByTime(8000);
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(8000);
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(2);

    await act(async () => {
      jest.advanceTimersByTime(8000);
      await Promise.resolve();
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
