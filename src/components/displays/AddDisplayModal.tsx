import React, { useState } from 'react';
import QRCodePairing from './QRCodePairing';
import NetworkScanner from './NetworkScanner';

interface AddDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddDisplayModal: React.FC<AddDisplayModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('qrcode');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl">
        <div className="flex justify-between items-center border-b p-4">
          <h2 className="text-xl font-semibold">Add New Display</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-4">
          <div className="flex border-b mb-4">
            <button
              className={`py-2 px-4 ${activeTab === 'qrcode' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
              onClick={() => setActiveTab('qrcode')}
            >
              QR Code Pairing
            </button>
            <button
              className={`py-2 px-4 ${activeTab === 'network' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
              onClick={() => setActiveTab('network')}
            >
              Network Discovery
            </button>
            <button
              className={`py-2 px-4 ${activeTab === 'manual' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}
              onClick={() => setActiveTab('manual')}
            >
              Manual Setup
            </button>
          </div>
          
          <div className="py-4">
            {activeTab === 'qrcode' && <QRCodePairing />}
            {activeTab === 'network' && <NetworkScanner />}
            {activeTab === 'manual' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Display Name</label>
                  <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">IP Address</label>
                  <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Device Type</label>
                  <select className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2">
                    <option>Android TV</option>
                    <option>Raspberry Pi</option>
                    <option>Chrome Device</option>
                    <option>Windows PC</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="bg-gray-50 px-4 py-3 flex justify-end rounded-b-lg">
          <button
            type="button"
            className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 mr-2"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700"
          >
            Add Display
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddDisplayModal;
