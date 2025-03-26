import React, { useState } from 'react';
import { QRCodePairing } from './QRCodePairing';
import { PairingSession } from '../services/pairingService';

export const NetworkDiscovery: React.FC = () => {
  const [pairedDevice, setPairedDevice] = useState<PairingSession | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const handlePairingComplete = (session: PairingSession) => {
    setPairedDevice(session);
    setError(null);
  };

  const handleError = (error: Error) => {
    setError(error);
    setPairedDevice(null);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Network Discovery</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error.message}
        </div>
      )}

      {pairedDevice ? (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <h2 className="font-bold">Successfully Paired!</h2>
          <p>Device: {pairedDevice.deviceName}</p>
          <p>IP: {pairedDevice.deviceIP}</p>
        </div>
      ) : (
        <QRCodePairing
          onPairingComplete={handlePairingComplete}
          onError={handleError}
        />
      )}
    </div>
  );
}; 