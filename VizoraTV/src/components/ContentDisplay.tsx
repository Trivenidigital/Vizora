import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { websocketService } from '../services/websocketService';

const ContentDisplay: React.FC = () => {
  const [searchParams] = useSearchParams();
  const displayId = searchParams.get('displayId');
  const [status, setStatus] = useState<string>('Waiting for content...');
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  const [isConnected, setIsConnected] = useState<boolean>(false);

  useEffect(() => {
    if (!displayId) {
      setStatus('Error: No display ID provided');
      return;
    }

    // Set up connection status listener
    const handleStatusChange = (status: string) => {
      setIsConnected(status === 'connected' || status === 'paired');
      setLastUpdated(new Date().toISOString());
    };

    // Set up content update listener
    const handleMessage = (message: any) => {
      console.log('ContentDisplay: Received message:', message);
      
      if (message.type === 'content_update' || message.type === 'content_updated') {
        setStatus('Content updated!');
        setLastUpdated(new Date().toISOString());
        // Here you would handle the actual content display logic
      } else if (message.type === 'display_paired' || message.type === 'paired') {
        setStatus('Display paired successfully! Waiting for content...');
        setLastUpdated(new Date().toISOString());
      }
    };

    // Subscribe to events
    websocketService.onStatusChange(handleStatusChange);
    const unsubscribe = websocketService.subscribeToMessage(handleMessage);

    // Check initial connection status
    const socket = websocketService.getSocket();
    if (socket && socket.connected) {
      setIsConnected(true);
      setStatus('Connected and ready to receive content');
    }

    return () => {
      // Clean up listeners
      websocketService.offStatusChange(handleStatusChange);
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [displayId]);

  return (
    <div className="content-display">
      <div className="content-container">
        <div className="content-waiting">
          <h2>Display ID: {displayId}</h2>
          <div className={`connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          <p>This display is ready to receive content from a paired controller.</p>
          <div className="content-status">{status}</div>
          <div className="content-last-updated">
            Last Updated: {new Date(lastUpdated).toLocaleTimeString()}
          </div>
        </div>
        
        {/* TV-friendly animated waiting indicator */}
        <div className="tv-waiting-animation">
          <div className="pulse-circle"></div>
          <div className="pulse-circle delay-1"></div>
          <div className="pulse-circle delay-2"></div>
        </div>
        
        {/* This is where content would be rendered when received */}
        <div className="content-placeholder">
          {/* Content will appear here when pushed from the web app */}
        </div>
        
        <div className="tv-footer">
          <div className="tv-logo">VIZORA</div>
          <div className="tv-device-id">{displayId}</div>
        </div>
      </div>
    </div>
  );
};

export default ContentDisplay; 