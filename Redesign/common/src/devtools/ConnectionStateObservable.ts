/**
 * ConnectionStateObservable
 * 
 * Provides reactive observables for connection diagnostics that can be
 * subscribed to by dev tools and debugging components.
 */

import { BehaviorSubject } from "rxjs";
import { ConnectionState } from "../services/ConnectionManager";

/**
 * Event types for connection diagnostics
 */
export enum ConnectionDiagnosticEventType {
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED",
  RECONNECTING = "RECONNECTING",
  ERROR = "ERROR",
  TRANSPORT_UPGRADED = "TRANSPORT_UPGRADED",
  SOCKET_ID_CHANGED = "SOCKET_ID_CHANGED",
  CIRCUIT_BREAKER_TRIPPED = "CIRCUIT_BREAKER_TRIPPED",
  CIRCUIT_BREAKER_RESET = "CIRCUIT_BREAKER_RESET"
}

/**
 * Structure of a diagnostic event
 */
export type DiagnosticEvent = {
  type: ConnectionDiagnosticEventType;
  payload?: any;
  timestamp: number;
  socketId?: string | null;
  connectionState?: ConnectionState;
};

/**
 * Stream of connection diagnostic events
 */
export const connectionDiagnostics$ = new BehaviorSubject<DiagnosticEvent>({
  type: ConnectionDiagnosticEventType.DISCONNECTED,
  timestamp: Date.now(),
  connectionState: ConnectionState.DISCONNECTED
});

/**
 * History of connection diagnostic events with a maximum size
 */
export const connectionDiagnosticsHistory$ = new BehaviorSubject<DiagnosticEvent[]>([]);
const MAX_HISTORY_SIZE = 100;

// Subscribe to new events and update history
connectionDiagnostics$.subscribe(event => {
  const currentHistory = connectionDiagnosticsHistory$.value;
  const newHistory = [...currentHistory, event].slice(-MAX_HISTORY_SIZE);
  connectionDiagnosticsHistory$.next(newHistory);
});

/**
 * Helper to emit a diagnostic event
 */
export function emitDiagnosticEvent(event: DiagnosticEvent): void {
  // Ensure timestamp is set
  if (!event.timestamp) {
    event.timestamp = Date.now();
  }
  connectionDiagnostics$.next(event);
}

/**
 * Clear diagnostic history
 */
export function clearDiagnosticHistory(): void {
  connectionDiagnosticsHistory$.next([]);
}

/**
 * Get current socket transport type
 */
export function getCurrentTransport(socket: any): string {
  try {
    // @ts-ignore - accessing internal property
    return socket?.io?.engine?.transport?.name || 'unknown';
  } catch (e) {
    return 'unknown';
  }
} 