import { renderHook, act } from '@testing-library/react';
import {
  useRealtimeConnectionStatus,
  connectionReducer,
  REALTIME_RECONNECT_TIMEOUT_MS,
  INITIAL_CONNECTION_STATE,
} from '../useRealtimeConnectionStatus';

describe('connectionReducer', () => {
  it('true -> connected, false -> offline', () => {
    const on = connectionReducer(INITIAL_CONNECTION_STATE, { type: 'signal', connected: true });
    expect(on).toEqual({ status: 'connected', stable: 'connected' });
    const off = connectionReducer(on, { type: 'signal', connected: false });
    expect(off).toEqual({ status: 'offline', stable: 'offline' });
  });

  it('null is reconnecting and keeps the last confirmed state', () => {
    const on = connectionReducer(INITIAL_CONNECTION_STATE, { type: 'signal', connected: true });
    expect(connectionReducer(on, { type: 'signal', connected: null })).toEqual({
      status: 'reconnecting',
      stable: 'connected',
    });
  });

  it('timeout only decays a state that is still reconnecting', () => {
    const on = connectionReducer(INITIAL_CONNECTION_STATE, { type: 'signal', connected: true });
    expect(connectionReducer(on, { type: 'timeout' })).toBe(on);
    const blip = connectionReducer(on, { type: 'signal', connected: null });
    expect(connectionReducer(blip, { type: 'timeout' })).toEqual({
      status: 'offline',
      stable: 'offline',
    });
  });
});

describe('useRealtimeConnectionStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts offline until the socket confirms a connection', () => {
    const { result } = renderHook(() => useRealtimeConnectionStatus());
    expect(result.current.status).toBe('offline');
    expect(result.current.stableStatus).toBe('offline');
  });

  it('connected -> null stays non-offline before the timeout', () => {
    const { result } = renderHook(() => useRealtimeConnectionStatus());
    act(() => result.current.onConnectionChange(true));
    act(() => result.current.onConnectionChange(null));

    expect(result.current.status).toBe('reconnecting');
    expect(result.current.stableStatus).toBe('connected');

    act(() => {
      jest.advanceTimersByTime(REALTIME_RECONNECT_TIMEOUT_MS - 1);
    });
    expect(result.current.status).toBe('reconnecting');
    expect(result.current.stableStatus).toBe('connected');
  });

  it('null -> offline only once the reconnect timeout elapses', () => {
    const { result } = renderHook(() => useRealtimeConnectionStatus());
    act(() => result.current.onConnectionChange(true));
    act(() => result.current.onConnectionChange(null));

    act(() => {
      jest.advanceTimersByTime(REALTIME_RECONNECT_TIMEOUT_MS);
    });
    expect(result.current.status).toBe('offline');
    expect(result.current.stableStatus).toBe('offline');
  });

  it('an explicit false is offline immediately', () => {
    const { result } = renderHook(() => useRealtimeConnectionStatus());
    act(() => result.current.onConnectionChange(true));
    act(() => result.current.onConnectionChange(false));
    expect(result.current.status).toBe('offline');
    expect(result.current.stableStatus).toBe('offline');
  });

  it('reconnecting -> true is connected and cancels the pending decay', () => {
    const { result } = renderHook(() => useRealtimeConnectionStatus());
    act(() => result.current.onConnectionChange(true));
    act(() => result.current.onConnectionChange(null));
    act(() => result.current.onConnectionChange(true));
    expect(result.current.status).toBe('connected');

    act(() => {
      jest.advanceTimersByTime(REALTIME_RECONNECT_TIMEOUT_MS * 2);
    });
    expect(result.current.status).toBe('connected');
  });

  it('honours a custom timeout', () => {
    const { result } = renderHook(() => useRealtimeConnectionStatus({ reconnectTimeoutMs: 1000 }));
    act(() => result.current.onConnectionChange(true));
    act(() => result.current.onConnectionChange(null));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.status).toBe('offline');
  });

  it('returns a callback whose identity is stable across renders', () => {
    const { result, rerender } = renderHook(() => useRealtimeConnectionStatus());
    const first = result.current.onConnectionChange;
    act(() => first(true));
    rerender();
    expect(result.current.onConnectionChange).toBe(first);
  });

  it('clears a pending decay on unmount', () => {
    const { result, unmount } = renderHook(() => useRealtimeConnectionStatus());
    act(() => result.current.onConnectionChange(null));
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
