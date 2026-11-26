// Live-update channel state for dashboard pages.
//
// `useRealtimeEvents` reports the socket through `onConnectionChange` with a
// THREE-valued signal:
//   true  - connected
//   false - disconnected while the browser has no network (genuinely offline)
//   null  - the socket dropped but the browser still has network (reconnecting)
//
// Six pages used to interpret that signal independently, and two of them
// (health, analytics) collapsed `null` into offline, so a two-second network
// blip flipped health into "Polling mode" for a socket that was already coming
// back. This hook is the single interpretation: `null` is never offline on its
// own. It is reconnecting, and only decays to offline if no `true` arrives
// within the reconnect timeout.

import { useCallback, useEffect, useReducer } from 'react';

export type RealtimeConnectionStatus = 'connected' | 'reconnecting' | 'offline';

/** The last state the socket actually confirmed (never `reconnecting`). */
export type StableConnectionStatus = Exclude<RealtimeConnectionStatus, 'reconnecting'>;

/** How long a reconnect may run before the page admits it is offline. */
export const REALTIME_RECONNECT_TIMEOUT_MS = 15_000;

export interface ConnectionState {
  status: RealtimeConnectionStatus;
  stable: StableConnectionStatus;
}

export type ConnectionEvent =
  | { type: 'signal'; connected: boolean | null }
  | { type: 'timeout' };

/**
 * Pages start offline: nothing has confirmed a connection yet.
 * `useRealtimeEvents` promotes an already-established socket to `true` on mount.
 */
export const INITIAL_CONNECTION_STATE: ConnectionState = { status: 'offline', stable: 'offline' };

export function connectionReducer(state: ConnectionState, event: ConnectionEvent): ConnectionState {
  if (event.type === 'timeout') {
    // A late timer must not undo a reconnect or an explicit offline.
    return state.status === 'reconnecting' ? { status: 'offline', stable: 'offline' } : state;
  }
  if (event.connected === true) return { status: 'connected', stable: 'connected' };
  if (event.connected === false) return { status: 'offline', stable: 'offline' };
  // null: reconnecting. Hold the last confirmed state; do not assert offline.
  return state.status === 'reconnecting' ? state : { status: 'reconnecting', stable: state.stable };
}

export interface UseRealtimeConnectionStatusOptions {
  reconnectTimeoutMs?: number;
}

export interface UseRealtimeConnectionStatusResult {
  /** Three-state view, for pages that present reconnecting distinctly. */
  status: RealtimeConnectionStatus;
  /**
   * Two-state view for pages that only show connected/offline: holds the last
   * confirmed state through a reconnect, and becomes offline once the reconnect
   * timeout elapses without recovery.
   */
  stableStatus: StableConnectionStatus;
  /**
   * Pass as `useRealtimeEvents({ onConnectionChange })`. Identity is stable, so
   * it does not re-run that hook's effects on every render. Calling it with
   * `true` is also how a page records that a live event just arrived.
   */
  onConnectionChange: (connected: boolean | null) => void;
}

export function useRealtimeConnectionStatus(
  options: UseRealtimeConnectionStatusOptions = {},
): UseRealtimeConnectionStatusResult {
  const { reconnectTimeoutMs = REALTIME_RECONNECT_TIMEOUT_MS } = options;
  const [state, dispatch] = useReducer(connectionReducer, INITIAL_CONNECTION_STATE);

  // The decay timer lives for exactly as long as the page is reconnecting: any
  // transition out of reconnecting (or unmount) clears it.
  useEffect(() => {
    if (state.status !== 'reconnecting') return undefined;
    const timer = setTimeout(() => dispatch({ type: 'timeout' }), reconnectTimeoutMs);
    return () => clearTimeout(timer);
  }, [state.status, reconnectTimeoutMs]);

  const onConnectionChange = useCallback((connected: boolean | null) => {
    dispatch({ type: 'signal', connected });
  }, []);

  return { status: state.status, stableStatus: state.stable, onConnectionChange };
}
