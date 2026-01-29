import { useEffect, useState, useCallback, useRef } from 'react';
import io, { Socket } from 'socket.io-client';

interface UseSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnection?: boolean;
  reconnectionDelay?: number;
  reconnectionDelayMax?: number;
  reconnectionAttempts?: number;
}

export function useSocket(options: UseSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3000',
    autoConnect = true,
    reconnection = true,
    reconnectionDelay = 1000,
    reconnectionDelayMax = 5000,
    reconnectionAttempts = 5,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<any>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!autoConnect) return;

    // Create socket connection
    const socket = io(url, {
      reconnection,
      reconnectionDelay,
      reconnectionDelayMax,
      reconnectionAttempts,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      setIsConnected(true);
      console.log('Socket.io connected:', socket.id);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('Socket.io disconnected');
    });

    socket.on('error', (error) => {
      console.error('Socket.io error:', error);
    });

    // Generic message handler for testing
    socket.on('message', (data) => {
      setLastMessage(data);
    });

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [url, autoConnect, reconnection, reconnectionDelay, reconnectionDelayMax, reconnectionAttempts]);

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

  return {
    socket: socketRef.current,
    isConnected,
    lastMessage,
    emit,
    on,
    once,
  };
}
