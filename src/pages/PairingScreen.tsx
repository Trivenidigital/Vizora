import React, { useEffect, useState } from 'react';
import { useDisplay } from '../contexts/DisplayContext';
import { QRCode } from '../components/QRCode';
import '../styles/QRCodeScreen.css';

const PairingScreen: React.FC = () => {
  const { 
    displayId, 
    pairingCode, 
    isPaired, 
    isLoading, 
    error, 
    resetError,
    requestPairingCode 
  } = useDisplay();
  
  const [qrValue, setQrValue] = useState<string>('');
  const [timeElapsed, setTimeElapsed] = useState<number>(0);
  
  // Create the QR code value when displayId and pairingCode are available
  useEffect(() => {
    if (displayId && pairingCode) {
      // URL that controller should visit to pair with this display
      const webUrl = import.meta.env.VITE_WEB_URL || 'http://localhost:5173';
      const pairingUrl = `${webUrl}/pair?deviceId=${displayId}&code=${pairingCode}`;
      
      setQrValue(pairingUrl);
      console.log('📱 QR code URL:', pairingUrl);
    }
  }, [displayId, pairingCode]);
  
  // Refresh pairing code if necessary
  useEffect(() => {
    if (!pairingCode && !isLoading && !isPaired) {
      const getPairingCode = async () => {
        try {
          await requestPairingCode();
        } catch (err) {
          console.error('Failed to get pairing code:', err);
        }
      };
      
      getPairingCode();
    }
  }, [pairingCode, isLoading, isPaired, requestPairingCode]);
  
  // Set up timer to track how long the QR code has been displayed
  useEffect(() => {
    if (pairingCode && !isPaired) {
      setTimeElapsed(0);
      const timer = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [pairingCode, isPaired]);
  
  // Handle a pairing code refresh request
  const handleRefresh = () => {
    requestPairingCode().catch(err => {
      console.error('Failed to refresh pairing code:', err);
    });
  };
  
  // Loading state
  if (isLoading) {
    return (
      <div className="qr-screen loading">
        <div className="spinner"></div>
        <h2>Preparing Pairing Code...</h2>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="qr-screen error">
        <div className="error-icon">!</div>
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={resetError} className="retry-button">
          Try Again
        </button>
      </div>
    );
  }
  
  // No pairing code state
  if (!pairingCode) {
    return (
      <div className="qr-screen loading">
        <div className="spinner"></div>
        <h2>Waiting for Pairing Code...</h2>
      </div>
    );
  }

  return (
    <div className="qr-screen">
      <div className="qr-container">
        <h1>Scan to Connect</h1>
        <p className="subtitle">Scan this QR code from the Vizora Web app to control this display</p>
        
        <div className="qr-code-wrapper">
          {qrValue && <QRCode value={qrValue} size={280} level="H" />}
        </div>
        
        <div className="pairing-info">
          <p className="pairing-code">
            <span className="label">Pairing Code:</span>
            <span className="code">{pairingCode}</span>
          </p>
          <p className="device-id">
            <span className="label">Device ID:</span>
            <span className="id">{displayId}</span>
          </p>
        </div>
        
        <div className="timer">
          <p>Code valid for: {Math.floor((300 - timeElapsed) / 60)}:{String((300 - timeElapsed) % 60).padStart(2, '0')}</p>
          <button onClick={handleRefresh} className="refresh-button">
            Refresh Code
          </button>
        </div>
      </div>
      
      <div className="qr-footer">
        <p className="help-text">
          Need help? Visit <a href="https://docs.vizora.io/pairing" target="_blank" rel="noopener noreferrer">docs.vizora.io/pairing</a>
        </p>
      </div>
    </div>
  );
};

export default PairingScreen; 