import { useEffect, useRef, useCallback, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { config } from '../constants/config';
import { useAuthStore } from '../stores/auth';

type UseSocketReturn = {
  socket: Socket | null;
  isConnected: boolean;
  connectionError: string | null;
  on: (event: string, callback: (...args: unknown[]) => void) => () => void;
};

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const token = useAuthStore((s) => s.token);
  const organizationId = useAuthStore((s) => s.user?.organizationId);

  useEffect(() => {
    if (!token || !organizationId) return;

    const socket = io(config.realtimeUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts,
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
      // Join org room for device status events
      socket.emit('join:organization', { organizationId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      setConnectionError(err.message);
      setIsConnected(false);
      reconnectAttempts.current++;
    });

    // Manage socket based on app foreground/background state
    const handleAppState = (state: AppStateStatus) => {
      if (state === 'active' && !socket.connected) {
        reconnectAttempts.current = 0;
        socket.connect();
      } else if (state === 'background') {
        socket.disconnect();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppState);

    return () => {
      subscription.remove();
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [token, organizationId]);

  const on = useCallback(
    (event: string, callback: (...args: unknown[]) => void): (() => void) => {
      const socket = socketRef.current;
      if (!socket) return () => {};
      socket.on(event, callback);
      return () => {
        socket.off(event, callback);
      };
    },
    [],
  );

  return {
    socket: socketRef.current,
    isConnected,
    connectionError,
    on,
  };
}
