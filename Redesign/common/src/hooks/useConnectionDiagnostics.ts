/**
 * useConnectionDiagnostics
 * 
 * A React hook that provides access to connection diagnostic events
 * for debugging and development tools.
 */

import { useEffect, useState } from "react";
import { 
  connectionDiagnostics$, 
  connectionDiagnosticsHistory$,
  DiagnosticEvent,
  clearDiagnosticHistory
} from "../devtools/ConnectionStateObservable";

/**
 * Hook to access live connection diagnostic events
 */
export const useConnectionDiagnostics = () => {
  const [event, setEvent] = useState<DiagnosticEvent>(connectionDiagnostics$.value);

  useEffect(() => {
    const subscription = connectionDiagnostics$.subscribe(setEvent);
    return () => subscription.unsubscribe();
  }, []);

  return event;
};

/**
 * Hook to access connection diagnostic history
 */
export const useConnectionDiagnosticsHistory = () => {
  const [history, setHistory] = useState<DiagnosticEvent[]>(connectionDiagnosticsHistory$.value);

  useEffect(() => {
    const subscription = connectionDiagnosticsHistory$.subscribe(setHistory);
    return () => subscription.unsubscribe();
  }, []);

  return {
    history,
    clearHistory: clearDiagnosticHistory
  };
};

/**
 * Hook to get simplified connection status with additional diagnostics
 */
export const useConnectionStatus = () => {
  const diagnostics = useConnectionDiagnostics();
  
  return {
    isConnected: diagnostics.connectionState === 'connected',
    isReconnecting: diagnostics.connectionState === 'reconnecting',
    socketId: diagnostics.socketId,
    lastEvent: diagnostics.type,
    lastEventTime: new Date(diagnostics.timestamp),
    payload: diagnostics.payload
  };
}; 