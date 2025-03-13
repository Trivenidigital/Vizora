import { useState } from 'react';
import { X } from 'lucide-react';
import QRCodePairing from './QRCodePairing';

interface AddDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDisplay: (display: any) => void;
}

const AddDisplayModal: React.FC<AddDisplayModalProps> = ({ isOpen, onClose, onAddDisplay }) => {
  if (!isOpen) return null;

  const handleManualAdd = (displayData: any) => {
    onAddDisplay({
      id: `manual-${Date.now()}`,
      ...displayData,
      status: 'active',
      lastSeen: new Date().toISOString()
    });
    onClose();
  };

  const handlePairingComplete = (deviceData: any) => {
    onAddDisplay({
      id: deviceData.id || `paired-${Date.now()}`,
      name: deviceData.name || 'Paired Display',
      type: deviceData.type || 'Smart TV',
      location: deviceData.location || '',
      status: 'online',
      lastSeen: new Date().toISOString()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-secondary-900">
            Add New Display
          </h2>
          <button 
            onClick={onClose}
            className="text-secondary-500 hover:text-secondary-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <QRCodePairing 
            onManualAdd={handleManualAdd} 
            onPairingComplete={handlePairingComplete}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
};

export default AddDisplayModal;
