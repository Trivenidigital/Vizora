import React, { useState } from 'react';
import { getPairingService } from '../../services/pairingService';

interface AddDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDisplayAdded: (display: { displayId: string; name: string; status: 'Connected' | 'Disconnected' }) => void;
}

const AddDisplayModal: React.FC<AddDisplayModalProps> = ({ isOpen, onClose, onDisplayAdded }) => {
  const [pairingCode, setPairingCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [isPairing, setIsPairing] = useState(false);

  if (!isOpen) return null;

  const handlePairingSubmit = async () => {
    if (!pairingCode || pairingCode.length !== 6) {
      setError('Please enter a valid 6-digit pairing code');
      return;
    }

    setIsPairing(true);
    setError('');

    try {
      const pairingService = getPairingService();
      const response = await pairingService.pairWithDisplay(pairingCode);
      
      if (response.success && response.displayId) {
        onDisplayAdded({
          displayId: response.displayId,
          name: displayName || `Display ${response.displayId}`,
          status: 'Connected'
        });
        onClose();
      } else {
        setError(response.error || 'Failed to pair with display. Please try again.');
      }
    } catch (err) {
      setError('Failed to pair with display. Please try again.');
    } finally {
      setIsPairing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex justify-between items-center border-b p-4">
          <h2 className="text-xl font-semibold">Add New Display</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Display Name (Optional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3"
                placeholder="Enter a name for this display"
                disabled={isPairing}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter Pairing Code
              </label>
              <input
                type="text"
                maxLength={6}
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, ''))}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-3 text-center text-2xl tracking-widest"
                placeholder="000000"
                disabled={isPairing}
              />
              <p className="mt-2 text-sm text-gray-500">
                Enter the 6-digit code shown on your TV display
              </p>
            </div>

            {error && (
              <div className="text-red-600 text-sm mt-2">
                {error}
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-gray-50 px-4 py-3 flex justify-end rounded-b-lg">
          <button
            type="button"
            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 mr-2"
            onClick={onClose}
            disabled={isPairing}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={handlePairingSubmit}
            disabled={isPairing || pairingCode.length !== 6}
          >
            {isPairing ? 'Pairing...' : 'Pair Display'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddDisplayModal;
