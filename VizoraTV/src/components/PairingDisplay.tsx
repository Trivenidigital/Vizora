import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { websocketService } from '../services/websocketService';
import styles from './PairingDisplay.module.css';
import { ConnectionStatus } from '../types';

interface PairingDisplayProps {
  connectionStatus: ConnectionStatus;
  displayId: string | null;
  pairingCode: string | null;
}

const PairingDisplay: React.FC<PairingDisplayProps> = ({ 
  connectionStatus, 
  displayId, 
  pairingCode 
}) => {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Log props for debugging
  useEffect(() => {
    console.log('PairingDisplay: Props updated', { connectionStatus, displayId, pairingCode });
    
    // If we have both displayId and pairingCode, we're no longer loading
    if (displayId && pairingCode) {
      setIsLoading(false);
    }
  }, [connectionStatus, displayId, pairingCode]);

  // Handle connection status changes
  useEffect(() => {
    console.log('PairingDisplay: Connection status changed to', connectionStatus);
    
    if (connectionStatus === 'error') {
      setError('Failed to connect to the middleware server. Please check your network connection and try again.');
    } else {
      setError(null);
    }
  }, [connectionStatus]);

  // Debug function to manually trigger the paired event
  const handleDebugPair = () => {
    console.log('PairingDisplay: Debug button clicked, manually triggering paired event');
    if (displayId) {
      console.log('PairingDisplay: Using websocketService.debugTriggerPaired()');
      websocketService.debugTriggerPaired();
    } else {
      console.error('PairingDisplay: Cannot trigger pairing, no displayId available');
      setError('Cannot trigger pairing, no displayId available');
    }
  };

  const renderContent = () => {
    switch (connectionStatus) {
      case 'connecting':
        return (
          <div className={styles.status}>
            <div className={styles.spinner}></div>
            <p>Connecting to middleware server...</p>
          </div>
        );

      case 'connected':
        if (!displayId || !pairingCode) {
          return (
            <div className={styles.status}>
              <div className={styles.spinner}></div>
              <p>Registering Display...</p>
            </div>
          );
        }

        return (
          <div className={styles.pairingInfo}>
            <div className={styles.qrCodeContainer}>
              <QRCodeSVG
                value={JSON.stringify({
                  displayId: displayId,
                  pairingCode: pairingCode
                })}
                size={300}
                level="H"
                includeMargin={true}
                bgColor="#ffffff"
                fgColor="#000000"
              />
            </div>
            <div className={styles.pairingDetails}>
              <h2>Pairing Code</h2>
              <p className={styles.pairingCode}>{pairingCode}</p>
              <p className={styles.instructions}>
                Scan this QR code or enter the pairing code
              </p>
              <div className={styles.statusIndicator}>
                <span className={`${styles.statusDot} ${styles.connected}`}></span>
                <span>Connected</span>
              </div>
              
              {/* Debug button */}
              <div className={styles.debugSection}>
                <button 
                  className={styles.debugButton}
                  onClick={handleDebugPair}
                >
                  Debug: Force Pair
                </button>
                <p className={styles.debugInfo}>Display ID: {displayId}</p>
              </div>
            </div>
          </div>
        );

      case 'disconnected':
        return (
          <div className={styles.error}>
            <p>Disconnected from server. Attempting to reconnect...</p>
            <div className={styles.spinner}></div>
          </div>
        );

      case 'error':
        return (
          <div className={styles.error}>
            <p>{error || 'Failed to connect to server. Please refresh the page to try again.'}</p>
            <div className={styles.spinner}></div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className={styles.container}>
      <h1>VizoraTV</h1>
      {renderContent()}
    </div>
  );
};

export default PairingDisplay; 