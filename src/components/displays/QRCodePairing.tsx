import { useState } from 'react';
import { QrCode, Smartphone, ArrowRight } from 'lucide-react';

interface QRCodePairingProps {
  onManualAdd: (displayData: any) => void;
}

const QRCodePairing: React.FC<QRCodePairingProps> = ({ onManualAdd }) => {
  const [displayName, setDisplayName] = useState('');
  const [displayType, setDisplayType] = useState('');
  const [displayLocation, setDisplayLocation] = useState('');
  const [step, setStep] = useState<'qr' | 'manual'>('qr');

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
          <div className="bg-secondary-100 p-6 rounded-lg inline-block mb-4">
            <QrCode className="h-48 w-48 text-secondary-800 mx-auto" />
          </div>
          
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
