import { useState } from 'react';
import { X, Tv, QrCode, Wifi } from 'lucide-react';
import NetworkScanner from './NetworkScanner';
import ServerNetworkScanner from './ServerNetworkScanner';
import QRCodePairing from './QRCodePairing';
import { Device } from '../../types/device';

interface AddDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDisplay: (display: any) => void;
}

const AddDisplayModal: React.FC<AddDisplayModalProps> = ({ isOpen, onClose, onAddDisplay }) => {
  const [step, setStep] = useState<'method' | 'scan' | 'qr' | 'server-scan'>('method');
  const [discoveredDevices, setDiscoveredDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  if (!isOpen) return null;

  const handleDevicesFound = (devices: Device[]) => {
    setDiscoveredDevices(devices);
  };

  const handleScanComplete = () => {
    // Additional logic after scan completes if needed
  };

  const handleSelectDevice = (device: Device) => {
    setSelectedDevice(device);
  };

  const handleAddSelectedDevice = () => {
    if (selectedDevice) {
      onAddDisplay({
        id: selectedDevice.id || `device-${Date.now()}`,
        name: selectedDevice.name || 'New Display',
        type: selectedDevice.type || 'Unknown',
        ip: selectedDevice.ip,
        status: 'active',
        lastSeen: new Date().toISOString()
      });
      onClose();
    }
  };

  const handleManualAdd = (displayData: any) => {
    onAddDisplay({
      id: `manual-${Date.now()}`,
      ...displayData,
      status: 'active',
      lastSeen: new Date().toISOString()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold text-secondary-900">
            {step === 'method' && 'Add New Display'}
            {step === 'scan' && 'Scan for Displays'}
            {step === 'server-scan' && 'Server Network Scan'}
            {step === 'qr' && 'QR Code Pairing'}
          </h2>
          <button 
            onClick={onClose}
            className="text-secondary-500 hover:text-secondary-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          {step === 'method' && (
            <div className="space-y-4">
              <p className="text-secondary-600">
                Choose how you'd like to add a new display to your network:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setStep('server-scan')}
                  className="flex flex-col items-center p-6 border-2 border-primary-200 rounded-lg hover:bg-primary-50 hover:border-primary-500 transition-colors"
                >
                  <Wifi className="h-12 w-12 text-primary-500 mb-4" />
                  <h3 className="font-medium text-secondary-900 mb-1">Server Network Scan</h3>
                  <p className="text-sm text-secondary-500 text-center">
                    Scan your network using our server to find compatible displays
                  </p>
                </button>
                
                <button
                  onClick={() => setStep('scan')}
                  className="flex flex-col items-center p-6 border-2 border-primary-200 rounded-lg hover:bg-primary-50 hover:border-primary-500 transition-colors"
                >
                  <Tv className="h-12 w-12 text-primary-500 mb-4" />
                  <h3 className="font-medium text-secondary-900 mb-1">Browser Network Scan</h3>
                  <p className="text-sm text-secondary-500 text-center">
                    Scan your network using your browser to find compatible displays
                  </p>
                </button>
                
                <button
                  onClick={() => setStep('qr')}
                  className="flex flex-col items-center p-6 border-2 border-primary-200 rounded-lg hover:bg-primary-50 hover:border-primary-500 transition-colors md:col-span-2"
                >
                  <QrCode className="h-12 w-12 text-primary-500 mb-4" />
                  <h3 className="font-medium text-secondary-900 mb-1">QR Code Pairing</h3>
                  <p className="text-sm text-secondary-500 text-center">
                    Generate a QR code to pair with your display device
                  </p>
                </button>
              </div>
            </div>
          )}
          
          {step === 'scan' && (
            <div className="space-y-4">
              <NetworkScanner 
                onDevicesFound={handleDevicesFound}
                onScanComplete={handleScanComplete}
              />
              
              {discoveredDevices.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium text-secondary-900 mb-2">Discovered Devices</h3>
                  <div className="border rounded-md overflow-hidden">
                    <table className="min-w-full divide-y divide-secondary-200">
                      <thead className="bg-secondary-50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Name</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Type</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">IP Address</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-secondary-200">
                        {discoveredDevices.map((device) => (
                          <tr 
                            key={device.id || device.ip} 
                            className={`hover:bg-secondary-50 ${selectedDevice?.id === device.id ? 'bg-primary-50' : ''}`}
                            onClick={() => handleSelectDevice(device)}
                          >
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-900">{device.name || 'Unknown Device'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-500">{device.type || 'Unknown'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-500">{device.ip}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectDevice(device);
                                }}
                                className="text-primary-600 hover:text-primary-900"
                              >
                                Select
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between mt-4">
                <button
                  onClick={() => setStep('method')}
                  className="px-4 py-2 border border-secondary-300 text-secondary-700 rounded-md hover:bg-secondary-50"
                >
                  Back
                </button>
                <button
                  onClick={handleAddSelectedDevice}
                  disabled={!selectedDevice}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Selected Display
                </button>
              </div>
            </div>
          )}
          
          {step === 'server-scan' && (
            <div className="space-y-4">
              <ServerNetworkScanner 
                onDevicesFound={handleDevicesFound}
                onScanComplete={handleScanComplete}
              />
              
              {discoveredDevices.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-medium text-secondary-900 mb-2">Discovered Devices</h3>
                  <div className="border rounded-md overflow-hidden">
                    <table className="min-w-full divide-y divide-secondary-200">
                      <thead className="bg-secondary-50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Name</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Type</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">IP Address</th>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-secondary-200">
                        {discoveredDevices.map((device) => (
                          <tr 
                            key={device.id || device.ip} 
                            className={`hover:bg-secondary-50 ${selectedDevice?.id === device.id ? 'bg-primary-50' : ''}`}
                            onClick={() => handleSelectDevice(device)}
                          >
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-900">{device.name || 'Unknown Device'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-500">{device.type || 'Unknown'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-secondary-500">{device.ip}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectDevice(device);
                                }}
                                className="text-primary-600 hover:text-primary-900"
                              >
                                Select
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              
              <div className="flex justify-between mt-4">
                <button
                  onClick={() => setStep('method')}
                  className="px-4 py-2 border border-secondary-300 text-secondary-700 rounded-md hover:bg-secondary-50"
                >
                  Back
                </button>
                <button
                  onClick={handleAddSelectedDevice}
                  disabled={!selectedDevice}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Selected Display
                </button>
              </div>
            </div>
          )}
          
          {step === 'qr' && (
            <div className="space-y-4">
              <QRCodePairing onManualAdd={handleManualAdd} />
              
              <div className="flex justify-start mt-4">
                <button
                  onClick={() => setStep('method')}
                  className="px-4 py-2 border border-secondary-300 text-secondary-700 rounded-md hover:bg-secondary-50"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddDisplayModal;
