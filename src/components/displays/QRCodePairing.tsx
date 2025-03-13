import { useState, useEffect } from 'react';
import QRCodeGenerator from './QRCodeGenerator';
import pairingService from '../../services/pairingService';
import { X } from 'lucide-react';

interface QRCodePairingProps {
  onClose: () => void;
  onPaired?: (deviceInfo: any) => void;
}

const QRCodePairing: React.FC<QRCodePairingProps> = ({ onClose, onPaired }) => {
  const [pairingCode, setPairingCode] = useState<string>('');
  const [pairingStatus, setPairingStatus] = useState<'generating' | 'ready' | 'paired' | 'expired' | 'error'>('generating');
  const [error, setError] = useState<string | null>(null);
  const [expiryTime, setExpiryTime] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Create pairing session on component mount
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const createSession = async () => {
      try {
        setPairingStatus('generating');
        setError(null);
        
        // Create a new pairing session
        const session = await pairingService.createPairingSession();
        setPairingCode(session.code);
        setExpiryTime(new Date(session.expiresAt));
        setPairingStatus('ready');
        
        // Subscribe to pairing updates
        unsubscribe = pairingService.subscribeToPairing(session.code, (updatedSession) => {
          if (updatedSession.status === 'paired') {
            setPairingStatus('paired');
            onPaired?.(updatedSession.deviceInfo);
          } else if (updatedSession.status === 'expired') {
            setPairingStatus('expired');
          }
        });
      } catch (err) {
        console.error('Error creating pairing session:', err);
        setPairingStatus('error');
        setError('Failed to create pairing session. Please try again.');
      }
    };

    createSession();

    // Cleanup subscription on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [onPaired]);

  // Update countdown timer
  useEffect(() => {
    if (!expiryTime || pairingStatus === 'paired' || pairingStatus === 'expired') {
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const expiry = new Date(expiryTime);
      const diffMs = expiry.getTime() - now.getTime();
      
      if (diffMs <= 0) {
        setPairingStatus('expired');
        setTimeLeft('Expired');
        clearInterval(interval);
        return;
      }
      
      // Format remaining time as MM:SS
      const diffSec = Math.floor(diffMs / 1000);
      const minutes = Math.floor(diffSec / 60);
      const seconds = diffSec % 60;
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiryTime, pairingStatus]);

  const handleRetry = () => {
    // Reset state and create a new session
    setPairingCode('');
    setPairingStatus('generating');
    setError(null);
    setExpiryTime(null);
    setTimeLeft('');
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">Pair New Display</h2>
        <button 
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X size={20} />
        </button>
      </div>
      
      <div className="flex flex-col items-center">
        {pairingStatus === 'generating' && (
          <div className="flex flex-col items-center justify-center h-64 w-full">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            <p className="mt-4 text-gray-600">Generating pairing code...</p>
          </div>
        )}
        
        {pairingStatus === 'ready' && (
          <>
            <div className="mb-4 text-center">
              <p className="text-gray-600 mb-2">Scan this QR code with your display device</p>
              <p className="text-sm text-gray-500">Expires in {timeLeft}</p>
            </div>
            
            <div className="mb-6">
              <QRCodeGenerator pairingCode={pairingCode} size={240} />
            </div>
            
            <div className="text-center">
              <p className="text-lg font-medium mb-1">Manual Code</p>
              <p className="text-2xl font-bold tracking-wider text-primary-600">{pairingCode}</p>
              <p className="text-sm text-gray-500 mt-1">Enter this code on your display device</p>
            </div>
          </>
        )}
        
        {pairingStatus === 'paired' && (
          <div className="text-center py-8">
            <div className="bg-green-100 text-green-800 rounded-full p-4 inline-block mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">Successfully Paired!</h3>
            <p className="text-gray-600">Your display has been successfully paired and is now ready to use.</p>
            <button
              onClick={onClose}
              className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Done
            </button>
          </div>
        )}
        
        {pairingStatus === 'expired' && (
          <div className="text-center py-8">
            <div className="bg-yellow-100 text-yellow-800 rounded-full p-4 inline-block mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">Code Expired</h3>
            <p className="text-gray-600">The pairing code has expired. Please generate a new code.</p>
            <button
              onClick={handleRetry}
              className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
        
        {pairingStatus === 'error' && (
          <div className="text-center py-8">
            <div className="bg-red-100 text-red-800 rounded-full p-4 inline-block mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">Error</h3>
            <p className="text-red-600">{error || 'Failed to generate QR code. Please try again.'}</p>
            <button
              onClick={handleRetry}
              className="mt-6 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRCodePairing;
