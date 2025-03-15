import React, { useEffect, useState } from 'react';
import { getPairingService } from '../services/pairingService';
import styles from './ContentDisplay.module.css';

interface ContentDisplayProps {
  displayId: string;
}

interface Content {
  id: string;
  type: 'image' | 'video' | 'text' | 'html';
  content: string;
  metadata?: {
    duration?: number;
    transition?: 'fade' | 'slide' | 'none';
  };
}

export const ContentDisplay: React.FC<ContentDisplayProps> = ({ displayId }) => {
  const [currentContent, setCurrentContent] = useState<Content | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const pairingService = getPairingService();

    // Listen for content updates
    pairingService.onContentUpdate((content: Content) => {
      setCurrentContent(content);
      setError(null);
    });

    // Listen for connection status
    pairingService.onConnectionStatus((status: boolean) => {
      setIsConnected(status);
      if (!status) {
        setError('Connection lost. Attempting to reconnect...');
      } else {
        setError(null);
      }
    });

    // Listen for errors
    pairingService.onError((err: Error) => {
      setError(err.message);
    });

    return () => {
      pairingService.disconnect();
    };
  }, [displayId]);

  const renderContent = () => {
    if (!currentContent) {
      return (
        <div className={styles.placeholder}>
          <h2>Waiting for content...</h2>
          <p>Display ID: {displayId}</p>
          {isConnected ? (
            <p className={styles.status}>Connected</p>
          ) : (
            <p className={styles.statusError}>Disconnected</p>
          )}
        </div>
      );
    }

    switch (currentContent.type) {
      case 'image':
        return (
          <img
            src={currentContent.content}
            alt="Display content"
            className={styles.image}
          />
        );
      case 'video':
        return (
          <video
            src={currentContent.content}
            autoPlay
            loop
            muted
            playsInline
            className={styles.video}
          />
        );
      case 'text':
        return (
          <div className={styles.text}>
            {currentContent.content}
          </div>
        );
      case 'html':
        return (
          <div
            className={styles.html}
            dangerouslySetInnerHTML={{ __html: currentContent.content }}
          />
        );
      default:
        return (
          <div className={styles.error}>
            Unsupported content type: {currentContent.type}
          </div>
        );
    }
  };

  return (
    <div className={styles.container}>
      {error ? (
        <div className={styles.error}>
          <p>{error}</p>
        </div>
      ) : (
        renderContent()
      )}
    </div>
  );
}; 