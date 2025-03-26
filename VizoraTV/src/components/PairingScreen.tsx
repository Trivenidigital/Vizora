import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code';
import { ConnectionStatus } from '../types';

interface PairingScreenProps {
  displayId: string | null;
  pairingCode: string | null;
  status: string;
  connectionStatus: ConnectionStatus;
  qrData?: string;
  isRefreshing: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
  onReset: () => void;
  onRetry: () => void;
  onGenerateDiagnostics: () => string;
  diagnostics?: string;
}

const PairingScreen: React.FC<PairingScreenProps> = ({
  displayId,
  pairingCode,
  status,
  connectionStatus,
  qrData,
  isRefreshing,
  errorMessage,
  onRefresh,
  onReset,
  onRetry,
  onGenerateDiagnostics,
  diagnostics: propDiagnostics
}) => {
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [localPairingCode, setLocalPairingCode] = useState<string | null>(pairingCode);
  
  // Update local state when props change
  useEffect(() => {
    if (pairingCode && pairingCode !== localPairingCode) {
      setLocalPairingCode(pairingCode);
    }
  }, [pairingCode, localPairingCode]);
  
  // The actual code to display (prioritize props over local state)
  const displayPairingCode = pairingCode || localPairingCode;
  
  // Toggle debug information
  const toggleDebugInfo = () => {
    setShowDebugInfo(!showDebugInfo);
  };
  
  return (
    <div className="pairing-screen">
      <header className="pairing-header">
        <h1>VizoraTV</h1>
      </header>
      
      <div className="pairing-content">
        {displayPairingCode && (
          <div className="pairing-info">
            <div className="qr-code-container">
              <h2>Scan QR Code</h2>
              <QRCode 
                value={qrData || `vizora://pair?code=${displayPairingCode}&displayId=${displayId}`} 
                size={220}
                fgColor="#000000"
                bgColor="#FFFFFF"
              />
            </div>
            
            <div className="pairing-code">
              <h2>Pairing Code</h2>
              <span className="code">{displayPairingCode}</span>
              <p className="instruction">Enter in Vizora Web App</p>
            </div>
          </div>
        )}
      </div>
      
      <div className={`connection-status ${connectionStatus === 'connected' ? 'connected' : 'disconnected'}`}>
        {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
      </div>
      
      <button className="debug-toggle-button" onClick={toggleDebugInfo}>
        {showDebugInfo ? 'Hide' : 'Debug'}
      </button>
      
      {showDebugInfo && (
        <div className="debug-information">
          <h3>Debug</h3>
          <div className="debug-details">
            <div><strong>Status:</strong> {status}</div>
            <div><strong>Error:</strong> {errorMessage || 'None'}</div>
          </div>
        </div>
      )}
      
      <footer className="pairing-footer">
        <p>© Vizora {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
};

export default PairingScreen; 