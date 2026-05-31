'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type {
  DeviceCredentials,
  Playlist,
  DeviceCommand,
  DeviceConfig,
  HeartbeatData,
  PushContent,
} from '../lib/types';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
type SocketAck = (response?: { ok: boolean; error?: string }) => void;

interface UseDeviceConnectionOptions {
  credentials: DeviceCredentials;
  onPlaylistUpdate: (playlist: Playlist) => void;
  onCommand: (command: DeviceCommand) => void;
  onConfig: (config: DeviceConfig) => void;
  onContentPush?: (content: PushContent, duration: number) => void;
  onUnauthorized: () => void;
  onTokenRefresh?: (deviceToken: string) => void;
  currentContentId: string | null;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002';
const CREDENTIALS_KEY = 'vizora_display_credentials';
const TERMINAL_DEVICE_AUTH_ERRORS = [
  'unauthorized',
  'invalid token',
  'device_token_stale',
  'device_not_found',
];

function isTerminalDeviceAuthError(message: unknown): boolean {
  if (typeof message !== 'string') {
    return false;
  }

  const normalized = message.toLowerCase();
  return TERMINAL_DEVICE_AUTH_ERRORS.some((term) => normalized.includes(term));
}

export function useDeviceConnection({
  credentials,
  onPlaylistUpdate,
  onCommand,
  onConfig,
  onContentPush,
  onUnauthorized,
  onTokenRefresh,
  currentContentId,
}: UseDeviceConnectionOptions) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const socketRef = useRef<Socket | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());
  const currentContentRef = useRef(currentContentId);

  // Keep ref in sync
  currentContentRef.current = currentContentId;

  const sendHeartbeat = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    const uptimeSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
    let memoryUsage = 50;
    const perfMemory = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
    if (perfMemory?.jsHeapSizeLimit) {
      memoryUsage = Math.round((perfMemory.usedJSHeapSize / perfMemory.jsHeapSizeLimit) * 100 * 100) / 100;
    }

    const data: HeartbeatData = {
      timestamp: new Date().toISOString(),
      metrics: {
        cpuUsage: 0,
        memoryUsage,
        uptime: uptimeSeconds,
      },
      currentContent: currentContentRef.current,
      status: 'online',
    };

    socket.emit('heartbeat', data, () => {});
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatRef.current) return;
    sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 15000);
  }, [sendHeartbeat]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const emitImpression = useCallback((data: {
    contentId: string;
    playlistId?: string;
    duration?: number;
    completionPercentage?: number;
    timestamp: number;
  }) => {
    socketRef.current?.emit('content:impression', data);
  }, []);

  const emitContentError = useCallback((data: {
    contentId: string;
    errorType: string;
    errorMessage: string;
    timestamp: number;
  }) => {
    socketRef.current?.emit('content:error', data);
  }, []);

  // Connect/disconnect based on credentials
  useEffect(() => {
    if (!credentials?.deviceToken) return;

    setStatus('connecting');

    const socket = io(SOCKET_URL, {
      auth: {
        token: credentials.deviceToken,
        capabilities: {
          deliveryAck: true,
        },
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      startHeartbeat();
    });

    socket.on('disconnect', () => {
      setStatus('disconnected');
      stopHeartbeat();
    });

    socket.on('connect_error', (err) => {
      console.error('[Vizora Display] Connection error:', err.message);
      setStatus('error');
      stopHeartbeat();

      if (isTerminalDeviceAuthError(err.message)) {
        onUnauthorized();
      }
    });

    socket.on('config', (config: DeviceConfig) => {
      onConfig(config);
    });

    socket.on('token:refresh', (data: { token?: string }) => {
      if (!data?.token || typeof window === 'undefined') return;

      let parsed: Record<string, unknown> = {};
      try {
        const stored = localStorage.getItem(CREDENTIALS_KEY);
        parsed = stored ? JSON.parse(stored) : {};
      } catch (err) {
        console.error('[Vizora Display] Failed to parse stored display credentials:', err);
      }

      try {
        localStorage.setItem(
          CREDENTIALS_KEY,
          JSON.stringify({
            ...parsed,
            deviceToken: data.token,
          }),
        );
      } catch (err) {
        console.error('[Vizora Display] Failed to persist refreshed device token:', err);
      }

      socket.auth = {
        ...(socket.auth || {}),
        token: data.token,
        capabilities: {
          ...((socket.auth as any)?.capabilities || {}),
          deliveryAck: true,
        },
      };
      onTokenRefresh?.(data.token);
    });

    socket.on('playlist:update', (data: { playlist: Playlist }, ack?: SocketAck) => {
      try {
        onPlaylistUpdate(data.playlist);
        ack?.({ ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to apply playlist';
        console.error('[Vizora Display] Failed to apply playlist update:', message);
        ack?.({ ok: false, error: message });
      }
    });

    socket.on('command', (command: DeviceCommand, ack?: SocketAck) => {
      try {
        if (command.type === 'push_content' && command.payload && onContentPush) {
          const content = command.payload.content as unknown as PushContent;
          const duration = (command.payload.duration as number) || 5;
          onContentPush(content, duration);
        } else {
          onCommand(command);
        }
        ack?.({ ok: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to apply command';
        console.error('[Vizora Display] Failed to apply command:', message);
        ack?.({ ok: false, error: message });
      }
    });

    socket.on('error', (err: { message: string }) => {
      console.error('[Vizora Display] Socket error:', err.message);
      if (isTerminalDeviceAuthError(err.message)) {
        socket.disconnect();
        onUnauthorized();
      }
    });

    return () => {
      stopHeartbeat();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [credentials?.deviceToken]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    emitImpression,
    emitContentError,
  };
}
