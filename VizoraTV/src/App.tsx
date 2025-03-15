import React, { useEffect, useState } from 'react';
import PairingDisplay from "./components/PairingDisplay";
import { ContentDisplay } from "./components/ContentDisplay";
import { websocketService } from "./services/websocketService";
import { DisplayStatus } from './types';
import styles from './App.module.css';

const App: React.FC = () => {
  const [isPaired, setIsPaired] = useState(false);
  const [displayId, setDisplayId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<DisplayStatus['status']>('offline');

  useEffect(() => {
    const updateStatus = async () => {
      try {
        await websocketService.updateStatus({
          status: connectionStatus,
          lastSeen: new Date()
        });
      } catch (error) {
        console.error('Failed to update status:', error);
      }
    };

    updateStatus();
  }, [connectionStatus]);

  useEffect(() => {
    const handlePaired = (id: string) => {
      setDisplayId(id);
      setIsPaired(true);
    };

    websocketService.onMessage((message) => {
      if (message.type === 'pair-success') {
        handlePaired(message.payload);
      }
    });

    return () => {
      websocketService.disconnect();
    };
  }, []);

  return (
    <div className={styles.app}>
      {!isPaired ? (
        <PairingDisplay />
      ) : (
        <ContentDisplay displayId={displayId!} />
      )}
    </div>
  );
};

export default App; 