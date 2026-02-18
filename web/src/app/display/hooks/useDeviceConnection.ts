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

interface UseDeviceConnectionOptions {
  credentials: DeviceCredentials;
  onPlaylistUpdate: (playlist: Playlist) => void;
  onCommand: (command: DeviceCommand) => void;
  onConfig: (config: DeviceConfig) => void;
  onContentPush?: (content: PushContent, duration: number) => void;
  onUnauthorized: () => void;
  currentContentId: string | null;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3002';

export function useDeviceConnection({
  credentials,
  onPlaylistUpdate,
  onCommand,
  onConfig,
  onContentPush,
  onUnauthorized,
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

    socket.emit('heartbeat', data, (response: { commands?: DeviceCommand[] }) => {
      if (response?.commands) {
        response.commands.forEach((cmd) => onCommand(cmd));
      }
    });
  }, [onCommand]);

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
      auth: { token: credentials.deviceToken },
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

      if (err.message.includes('unauthorized') || err.message.includes('invalid token')) {
        onUnauthorized();
      }
    });

    socket.on('config', (config: DeviceConfig) => {
      onConfig(config);
    });

    socket.on('playlist:update', (data: { playlist: Playlist }) => {
      onPlaylistUpdate(data.playlist);
    });

    socket.on('command', (command: DeviceCommand) => {
      if (command.type === 'push_content' && command.payload && onContentPush) {
        const content = command.payload.content as unknown as PushContent;
        const duration = (command.payload.duration as number) || 30;
        onContentPush(content, duration);
      } else {
        onCommand(command);
      }
    });

    socket.on('error', (err: { message: string }) => {
      console.error('[Vizora Display] Socket error:', err.message);
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
