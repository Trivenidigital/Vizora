import { useEffect, useState, useCallback, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

interface UseSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
  auth?: {
    token?: string;
    organizationId?: string;
  };
}

// Track URLs where reconnection has been exhausted, with time-based expiry for automatic recovery
const reconnectExhaustedFor = new Map<string, number>();

const RECONNECT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

function isReconnectExhausted(url: string): boolean {
  const exhaustedAt = reconnectExhaustedFor.get(url);
  if (!exhaustedAt) return false;
  if (Date.now() - exhaustedAt > RECONNECT_COOLDOWN_MS) {
    reconnectExhaustedFor.delete(url);
    return false;
  }
  return true;
}

function markReconnectExhausted(url: string): void {
  reconnectExhaustedFor.set(url, Date.now());
}

interface UseSocketReturn {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  lastMessage: any;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (data: any) => void) => () => void;
  once: (event: string, callback: (data: any) => void) => void;
  joinRoom: (room: string) => void;
  leaveRoom: (room: string) => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const {
    url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002',
    autoConnect = true,
    reconnection = true,
    reconnectionDelay = 1000,
    reconnectionDelayMax = 5000,
    reconnectionAttempts = 5,
    auth,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoggedErrorRef = useRef(false);

  useEffect(() => {
    if (!autoConnect) return;

    // If reconnection was previously exhausted for this URL (within cooldown), don't create a new socket
    if (isReconnectExhausted(url)) {
      return;
    }

    hasLoggedErrorRef.current = false;

    // Create socket connection with auth
    const socket = io(url, {
      reconnection,
      reconnectionDelay,
      reconnectionDelayMax,
      reconnectionAttempts,
      transports: ['websocket', 'polling'],
      auth: auth || {},
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      // Clear exhaustion on successful connect
      reconnectExhaustedFor.delete(url);
      console.log('[Socket] Connected:', socket.id);

      // Join organization room if organizationId is provided
      if (auth?.organizationId) {
        socket.emit('join:organization', { organizationId: auth.organizationId });
      }
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      setConnectionError(error.message);
      // Only log the first connect_error per socket instance
      if (!hasLoggedErrorRef.current) {
        hasLoggedErrorRef.current = true;
        console.warn('[Socket] Connection error (retrying):', error.message);
      }
    });

    socket.on('error', (error) => {
      console.error('[Socket] Error:', error);
    });

    // Generic message handler for testing
    socket.on('message', (data) => {
      setLastMessage(data);
    });

    // Handle organization room join confirmation
    socket.on('joined:organization', (data) => {
      console.log('[Socket] Joined organization room:', data.organizationId);
    });

    // Handle reconnection exhaustion - log once and stop retrying (auto-recovers after cooldown)
    socket.io.on('reconnect_failed', () => {
      markReconnectExhausted(url);
      console.warn('[Socket] Reconnection exhausted for', url, '— will retry after cooldown');
    });

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socket.close();
      socketRef.current = null;
    };
  // Dependencies are intentionally primitives to avoid reconnect loops from object identity changes
  }, [url, autoConnect, reconnection, reconnectionDelay, reconnectionDelayMax, reconnectionAttempts, auth?.token, auth?.organizationId]);

  // Emit event
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit(event, data);
    }
  }, [isConnected]);

  // Listen to event
  const on = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);

      // Return unsubscribe function
      return () => {
        if (socketRef.current) {
          socketRef.current.off(event, callback);
        }
      };
    }
    return () => {};
  }, []);

  // Listen to event once
  const once = useCallback((event: string, callback: (data: any) => void) => {
    if (socketRef.current) {
      socketRef.current.once(event, callback);
    }
  }, []);

  // Join a room (e.g., organization room)
  const joinRoom = useCallback((room: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('join:room', { room });
    }
  }, [isConnected]);

  // Leave a room
  const leaveRoom = useCallback((room: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('leave:room', { room });
    }
  }, [isConnected]);

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    lastMessage,
    emit,
    on,
    once,
    joinRoom,
    leaveRoom,
  };
}
