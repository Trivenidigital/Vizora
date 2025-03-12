import { useState, useEffect } from 'react';
import { QrCode, Smartphone, ArrowRight, RefreshCw, CheckCircle, Clock } from 'lucide-react';
import QRCodeGenerator from './QRCodeGenerator';
import pairingService from '../../services/pairingService';

interface PairingSession {
  id: string;
  code: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'paired' | 'expired';
  deviceInfo?: any;
}

interface QRCodePairingProps {
  onManualAdd: (displayData: any) => void;
  onPairingComplete?: (deviceData: any) => void;
}

const QRCodePairing: React.FC<QRCodePairingProps> = ({ onManualAdd, onPairingComplete }) => {
  const [displayName, setDisplayName] = useState('');
  const [displayType, setDisplayType] = useState('');
  const [displayLocation, setDisplayLocation] = useState('');
  const [step, setStep] = useState<'qr' | 'manual'>('qr');
  
  // QR code pairing state
  const [pairingSession, setPairingSession] = useState<PairingSession | null>(null);
  const [pairingStatus, setPairingStatus] = useState<'generating' | 'ready' | 'pairing' | 'paired' | 'expired' | 'error'>('generating');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Initialize pairing session
  useEffect(() => {
    if (step === 'qr') {
      createNewPairingSession();
    }
    
    return () => {
      // Clean up subscription when component unmounts
      if (pairingSession) {
        // No need to unsubscribe as the function will be returned by subscribeToPairing
      }
    };
  }, [step]);

  // Timer for expiration countdown
  useEffect(() => {
    if (!pairingSession || pairingStatus !== 'ready') return;
    
    const interval = setInterval(() => {
      const now = new Date();
      const expiresAt = new Date(pairingSession.expiresAt);
      const remainingMs = expiresAt.getTime() - now.getTime();
      
      if (remainingMs <= 0) {
        setPairingStatus('expired');
        clearInterval(interval);
      } else {
        setTimeRemaining(Math.floor(remainingMs / 1000));
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [pairingSession, pairingStatus]);

  const createNewPairingSession = async () => {
    try {
      setPairingStatus('generating');
      setErrorMessage(null);
      
      // Create new pairing session
      const session = await pairingService.createPairingSession();
      setPairingSession(session);
      
      // Calculate initial time remaining
      const now = new Date();
      const expiresAt = new Date(session.expiresAt);
      setTimeRemaining(Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      
      // Subscribe to updates for this session
      pairingService.subscribeToPairing(session.code, handlePairingUpdate);
      
      setPairingStatus('ready');
    } catch (error) {
      console.error('Failed to create pairing session:', error);
      setPairingStatus('error');
      setErrorMessage('Failed to generate QR code. Please try again.');
    }
  };

  const handlePairingUpdate = (updatedSession: PairingSession) => {
    setPairingSession(updatedSession);
    
    if (updatedSession.status === 'paired' && updatedSession.deviceInfo) {
      setPairingStatus('paired');
      
      // Notify parent component if callback provided
      if (onPairingComplete) {
        onPairingComplete({
          name: updatedSession.deviceInfo.name || 'New Display',
          type: updatedSession.deviceInfo.type || 'Unknown',
          id: updatedSession.deviceInfo.id,
          status: 'online',
          location: '',
          ip: '0.0.0.0' // Placeholder for paired displays
        });
      }
    } else if (updatedSession.status === 'expired') {
      setPairingStatus('expired');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onManualAdd({
      name: displayName,
      type: displayType,
      location: displayLocation,
      ip: '0.0.0.0', // Placeholder for manually added displays
      status: 'pending'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setStep('qr')}
          className={`flex-1 py-2 px-4 rounded-md text-center ${
            step === 'qr'
              ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
              : 'bg-white text-secondary-700 border border-secondary-300'
          }`}
        >
          QR Code
        </button>
        <button
          onClick={() => setStep('manual')}
          className={`flex-1 py-2 px-4 rounded-md text-center ${
            step === 'manual'
              ? 'bg-primary-100 text-primary-700 border-2 border-primary-300'
              : 'bg-white text-secondary-700 border border-secondary-300'
          }`}
        >
          Manual Entry
        </button>
      </div>

      {step === 'qr' && (
        <div className="text-center">
          {pairingStatus === 'generating' && (
            <div className="bg-secondary-100 p-6 rounded-lg inline-block mb-4 flex items-center justify-center">
              <div className="animate-spin h-12 w-12 text-primary-600">
                <RefreshCw size={48} />
              </div>
            </div>
          )}
          
          {pairingStatus === 'ready' && pairingSession && (
            <>
              <div className="bg-secondary-100 p-6 rounded-lg inline-block mb-4 relative">
                <QRCodeGenerator pairingCode={pairingSession.code} size={200} />
                <div className="absolute bottom-2 right-2 bg-white bg-opacity-80 px-2 py-1 rounded-md text-xs flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                </div>
              </div>
              
              <div className="text-sm text-secondary-600 mb-4">
                Pairing Code: <span className="font-mono font-medium">{pairingSession.code}</span>
              </div>
            </>
          )}
          
          {pairingStatus === 'paired' && (
            <div className="bg-green-100 p-6 rounded-lg inline-block mb-4 text-green-700">
              <CheckCircle className="h-16 w-16 mx-auto mb-2" />
              <p className="font-medium">Device Successfully Paired!</p>
              {pairingSession?.deviceInfo?.name && (
                <p className="text-sm mt-2">Device: {pairingSession.deviceInfo.name}</p>
              )}
            </div>
          )}
          
          {pairingStatus === 'expired' && (
            <div className="bg-yellow-100 p-6 rounded-lg inline-block mb-4 text-yellow-700">
              <Clock className="h-16 w-16 mx-auto mb-2" />
              <p className="font-medium">QR Code Expired</p>
              <button 
                onClick={createNewPairingSession}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                Generate New Code
              </button>
            </div>
          )}
          
          {pairingStatus === 'error' && (
            <div className="bg-red-100 p-6 rounded-lg inline-block mb-4 text-red-700">
              <p className="font-medium">Error</p>
              <p className="text-sm mt-2">{errorMessage || 'Something went wrong'}</p>
              <button 
                onClick={createNewPairingSession}
                className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
              >
                Try Again
              </button>
            </div>
          )}
          
          {(pairingStatus === 'ready' || pairingStatus === 'paired') && (
            <>
              <h3 className="text-lg font-medium text-secondary-900 mb-2">Scan with your display device</h3>
              <p className="text-secondary-600 mb-6">
                Open the Vizora app on your display device and scan this QR code to connect it to your account.
              </p>
              
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-left">
                <h4 className="flex items-center text-sm font-medium text-blue-800 mb-2">
                  <Smartphone className="h-4 w-4 mr-2" />
                  Don't have the Vizora app?
                </h4>
                <p className="text-sm text-blue-700 mb-3">
                  Download our app for your display device:
                </p>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li className="flex items-center">
                    <ArrowRight className="h-3 w-3 mr-2" />
                    <a href="#" className="underline">Android TV / Google TV</a>
                  </li>
                  <li className="flex items-center">
                    <ArrowRight className="h-3 w-3 mr-2" />
                    <a href="#" className="underline">Amazon Fire TV</a>
                  </li>
                  <li className="flex items-center">
                    <ArrowRight className="h-3 w-3 mr-2" />
                    <a href="#" className="underline">Samsung Tizen OS</a>
                  </li>
                  <li className="flex items-center">
                    <ArrowRight className="h-3 w-3 mr-2" />
                    <a href="#" className="underline">LG webOS</a>
                  </li>
                </ul>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'manual' && (
        <div>
          <p className="text-secondary-600 mb-4">
            Enter the details of your display device manually:
          </p>
          
          <form onSubmit={handleManualSubmit}>
            <div className="space-y-4">
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-secondary-700 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  id="displayName"
                  className="w-full border border-secondary-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Lobby Display"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
              
              <div>
                <label htmlFor="displayType" className="block text-sm font-medium text-secondary-700 mb-1">
                  Display Type
                </label>
                <select
                  id="displayType"
                  className="w-full border border-secondary-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  value={displayType}
                  onChange={(e) => setDisplayType(e.target.value)}
                  required
                >
                  <option value="">Select a type</option>
                  <option value="Smart TV">Smart TV</option>
                  <option value="Android TV">Android TV</option>
                  <option value="Fire TV">Fire TV</option>
                  <option value="Apple TV">Apple TV</option>
                  <option value="Roku">Roku</option>
                  <option value="Media Player">Media Player</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="displayLocation" className="block text-sm font-medium text-secondary-700 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  id="displayLocation"
                  className="w-full border border-secondary-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
                  placeholder="Main Entrance"
                  value={displayLocation}
                  onChange={(e) => setDisplayLocation(e.target.value)}
                />
              </div>
              
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Add Display
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default QRCodePairing;
