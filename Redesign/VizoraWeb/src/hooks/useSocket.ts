import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';
import { useConnectionState } from '@vizora/common';

export const useSocket = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    // Get the base URL from the current origin
    const serverUrl = window.location.origin;

    // ⚠️ IMPORTANT: Always use root namespace with Socket.IO
    // Do not append paths like '/display' or '/controller' to the URL
    // instead use event names to separate concerns
    console.log(`Creating socket connection to ${serverUrl}`);
    
    // Create socket connection using the root namespace only
    const newSocket = io(serverUrl, {
      auth: {
        token: user.token
      },
      path: '/socket.io', // default path
      transports: ['websocket', 'polling'] // try WebSocket first, fall back to polling
    });

    // Set up event listeners
    newSocket.on('connect', () => {
      console.log('Socket connected with ID:', newSocket.id);
      console.log('Using transport:', newSocket.io.engine.transport.name);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (newSocket) {
        console.log('Closing socket connection');
        newSocket.close();
      }
    };
  }, [user]);

  return { socket };
}; 