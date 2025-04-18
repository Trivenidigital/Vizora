import { useSyncExternalStore } from 'react';
import { 
  getConnectionManager, 
  ConnectionState, 
  ConnectionDiagnostics 
} from '../services/ConnectionManager'; 

/**
 * Hook to get the reactive ConnectionState from the ConnectionManager.
 *
 * @returns The current ConnectionState enum value.
 */
export function useConnectionState(): ConnectionState {
  const manager = getConnectionManager(); 
  const state = useSyncExternalStore(
    manager.subscribe.bind(manager), // Subscribe function
    manager.getConnectionStateSnapshot.bind(manager), // Get snapshot function
    manager.getConnectionStateSnapshot.bind(manager)  // Get server snapshot function (can be same as client)
  );
  return state as ConnectionState;
}

/**
 * Hook to get the reactive detailed ConnectionDiagnostics from the ConnectionManager.
 * Useful for debugging connection issues.
 * 
 * @returns The current ConnectionDiagnostics object, or null if ConnectionManager isn't initialized properly.
 */
export function useConnectionStatusDebug(): ConnectionDiagnostics | null {
    const manager = getConnectionManager();
    const diagnostics = useSyncExternalStore(
      manager.subscribe.bind(manager), // Re-use the same subscribe, notifies on any state change
      manager.getDiagnostics.bind(manager), // Get the full diagnostics object
      manager.getDiagnostics.bind(manager) // Server snapshot
    );
    return diagnostics as ConnectionDiagnostics | null;
} 