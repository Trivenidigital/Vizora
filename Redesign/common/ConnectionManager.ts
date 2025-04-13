// Import the actual ConnectionManager implementation 
import { getConnectionManager } from './src/hooks/useConnectionStatus';

/**
 * Get the socket ID if connected
 * This is a standalone utility function for easier imports
 */
export function getSocketId(): string | undefined {
  // Get the ConnectionManager instance
  const connectionManager = getConnectionManager();
  
  // If available, use its getSocketId method
  if (connectionManager && typeof connectionManager.getSocketId === 'function') {
    const socketId = connectionManager.getSocketId();
    return socketId || undefined;
  }
  
  // Fallback for testing/development
  return undefined;
}

// Re-export getSocketId from the common utils
export { getSocketId } from './src/utils/socketUtils'; 