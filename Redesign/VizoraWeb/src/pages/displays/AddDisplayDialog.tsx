import { useState } from 'react';

interface AddDisplayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (pairingCode: string) => Promise<boolean>;
}

const AddDisplayDialog = ({ isOpen, onClose, onAdd }: AddDisplayDialogProps) => {
  const [pairingCode, setPairingCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  if (!isOpen) return null;
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pairingCode) {
      setError('Please enter a pairing code');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      const success = await onAdd(pairingCode);
      
      if (success) {
        setPairingCode('');
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg overflow-hidden shadow-xl max-w-md w-full">
        <div className="px-6 py-4">
          <div className="text-lg font-medium text-gray-900">
            Add Display
          </div>
          
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              Enter the pairing code shown on the display device to connect it to your account.
            </p>
            
            <form onSubmit={handleSubmit} className="mt-4">
              <div>
                <label htmlFor="pairingCode" className="block text-sm font-medium text-gray-700">
                  Pairing Code
                </label>
                <input 
                  type="text"
                  id="pairingCode"
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  disabled={isLoading}
                />
                {error && (
                  <p className="mt-2 text-sm text-red-600">
                    {error}
                  </p>
                )}
              </div>
              
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="mr-3 inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  disabled={isLoading}
                >
                  {isLoading ? 'Adding...' : 'Add Display'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddDisplayDialog; 