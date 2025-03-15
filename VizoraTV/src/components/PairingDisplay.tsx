import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { websocketService } from '../services/websocketService';
import styles from './PairingDisplay.module.css';

const PairingDisplay: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [displayInfo, setDisplayInfo] = useState<{ displayId: string; pairingCode: string } | null>(null);

  useEffect(() => {
    // Set up connection status listener
    websocketService.onConnectionChange((status) => {
      console.log('Connection status changed:', status);
      setConnectionStatus(status);
    });

    // Set up registration listener
    websocketService.onRegistration((data) => {
      console.log('Registration data received:', data);
      setDisplayInfo(data);
    });

    // Cleanup
    return () => {
      console.log('PairingDisplay unmounting');
    };
  }, []);

  const renderContent = () => {
    switch (connectionStatus) {
      case 'connecting':
        return (
          <div className={styles.status}>
            <div className={styles.spinner}></div>
            <p>Connecting to server...</p>
          </div>
        );

      case 'connected':
        if (!displayInfo) {
          return (
            <div className={styles.status}>
              <div className={styles.spinner}></div>
              <p>Registering display...</p>
            </div>
          );
        }
        return (
          <div className={styles.pairingInfo}>
            <h2>Your Display ID</h2>
            <p className={styles.displayId}>{displayInfo.displayId}</p>
            <h2>Pairing Code</h2>
            <p className={styles.pairingCode}>{displayInfo.pairingCode}</p>
            <div className={styles.qrCode}>
              <QRCodeSVG
                value={JSON.stringify({
                  displayId: displayInfo.displayId,
                  pairingCode: displayInfo.pairingCode
                })}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>
            <p className={styles.instructions}>
              Scan this QR code or enter the pairing code manually in the Vizora web app
            </p>
          </div>
        );

      case 'disconnected':
        return (
          <div className={styles.error}>
            <p>Disconnected from server. Attempting to reconnect...</p>
          </div>
        );

      case 'error':
        return (
          <div className={styles.error}>
            <p>Failed to connect to server. Please refresh the page to try again.</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <h1>VizoraTV Display</h1>
      {renderContent()}
    </div>
  );
};

export default PairingDisplay; 