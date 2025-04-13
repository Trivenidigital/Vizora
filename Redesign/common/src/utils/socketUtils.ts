import { getConnectionManager } from '../hooks/useConnectionStatus';

/**
 * Get the current socket ID if connected
 * @returns The socket ID or undefined if not connected
 */
export function getSocketId(): string | undefined {
  const connectionManager = getConnectionManager();
  if (connectionManager && typeof connectionManager.getSocketId === 'function') {
    const socketId = connectionManager.getSocketId();
    return socketId || undefined;
  }
  return undefined;
} 