import React, { useEffect, useState } from 'react';
import { pairingService } from '../services/pairingService';

interface QRCodePairingProps {
  onPairingComplete: (session: PairingSession) => void;
  onError: (error: Error) => void;
}

export const QRCodePairing: React.FC<QRCodePairingProps> = ({ onPairingComplete, onError }) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'paired' | 'error'>('idle');
  const [manualIP, setManualIP] = useState('');

  useEffect(() => {
    startPairing();
    return () => {
      pairingService.disconnect();
    };
  }, []);

  const startPairing = async () => {
    try {
      setStatus('scanning');
      const { qrCode, pairingCode } = await pairingService.startPairing({
        useQRCode: true,
        manualIP: manualIP || undefined
      });
      setQrCode(qrCode || null);
      setPairingCode(pairingCode);
    } catch (error) {
      setStatus('error');
      onError(error instanceof Error ? error : new Error('Failed to start pairing'));
    }
  };

  const checkStatus = async () => {
    try {
      const session = await pairingService.checkPairingStatus();
      if (session.status === 'paired') {
        setStatus('paired');
        onPairingComplete(session);
      } else if (session.status === 'expired') {
        setStatus('error');
        onError(new Error('Pairing session expired'));
      }
    } catch (error) {
      setStatus('error');
      onError(error instanceof Error ? error : new Error('Failed to check pairing status'));
    }
  };

  useEffect(() => {
    if (status === 'scanning') {
      const interval = setInterval(checkStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [status]);

  return (
    <div className="flex flex-col items-center space-y-4 p-4">
      <h2 className="text-xl font-semibold">Pair Your TV</h2>
      
      {status === 'scanning' && (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              TV IP Address (Optional)
            </label>
            <input
              type="text"
              value={manualIP}
              onChange={(e) => setManualIP(e.target.value)}
              placeholder="Enter TV IP address"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {qrCode && (
            <div className="p-4 bg-white rounded-lg shadow">
              <img src={qrCode} alt="Pairing QR Code" className="w-64 h-64" />
              <p className="mt-2 text-sm text-gray-600">
                Scan this QR code with your TV's camera or enter the code manually
              </p>
            </div>
          )}

          {pairingCode && (
            <div className="mt-4">
              <p className="text-lg font-medium">Manual Entry Code:</p>
              <p className="text-2xl font-bold text-blue-600">{pairingCode}</p>
            </div>
          )}

          <div className="mt-4">
            <p className="text-sm text-gray-500">
              Make sure your TV and computer are on the same network
            </p>
          </div>
        </>
      )}

      {status === 'paired' && (
        <div className="text-green-600">
          <p className="text-lg font-medium">Successfully paired!</p>
        </div>
      )}

      {status === 'error' && (
        <div className="text-red-600">
          <p className="text-lg font-medium">Pairing failed</p>
          <button
            onClick={startPairing}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}; 