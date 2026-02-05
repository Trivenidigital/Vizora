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

export function useSocket(options: UseSocketOptions = {}) {
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

  useEffect(() => {
    if (!autoConnect) return;

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
      console.log('[Socket] Connected:', socket.id);

      // Join organization room if organizationId is provided
      if (auth?.organizationId) {
        socket.emit('join:organization', { organizationId: auth.organizationId });
        console.log('[Socket] Requested to join org room:', auth.organizationId);
      }
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      console.log('[Socket] Disconnected:', reason);

      // Handle specific disconnect reasons
      if (reason === 'io server disconnect') {
        // Server disconnected us, try to reconnect manually
        console.log('[Socket] Server initiated disconnect, will attempt reconnect...');
      }
    });

    socket.on('connect_error', (error) => {
      setConnectionError(error.message);
      console.error('[Socket] Connection error:', error.message);
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

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      socket.close();
      socketRef.current = null;
    };
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
      console.log('[Socket] Joining room:', room);
    }
  }, [isConnected]);

  // Leave a room
  const leaveRoom = useCallback((room: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit('leave:room', { room });
      console.log('[Socket] Leaving room:', room);
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
