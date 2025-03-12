import { useState, useEffect, useCallback, Fragment } from 'react';
import { X, Search, RefreshCw, Monitor, Wifi, Server } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import NetworkScanner from './NetworkScanner';

interface AddDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDisplay: (display: any) => void;
}

const mockDiscoveredDevices = [
  { id: 'dev-001', name: 'Samsung Smart Display', ip: '192.168.1.101', mac: '00:1A:2B:3C:4D:5E', type: 'Smart TV', model: 'Samsung Tizen 4.0', status: 'available' },
  { id: 'dev-002', name: 'LG WebOS Display', ip: '192.168.1.102', mac: '00:1A:2B:3C:4D:5F', type: 'Smart TV', model: 'LG WebOS 6.0', status: 'available' },
  { id: 'dev-003', name: 'Android Media Player', ip: '192.168.1.103', mac: '00:1A:2B:3C:4D:60', type: 'Media Player', model: 'Android 10.0', status: 'available' },
  { id: 'dev-004', name: 'Chrome Device', ip: '192.168.1.104', mac: '00:1A:2B:3C:4D:61', type: 'Chrome Device', model: 'ChromeOS 91', status: 'in-use' },
  { id: 'dev-005', name: 'Raspberry Pi', ip: '192.168.1.105', mac: '00:1A:2B:3C:4D:62', type: 'Single Board Computer', model: 'Raspberry Pi 4', status: 'available' },
];

const AddDisplayModal: React.FC<AddDisplayModalProps> = ({ isOpen, onClose, onAddDisplay }) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'manual'>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [manualForm, setManualForm] = useState({
    name: '',
    ip: '',
    type: 'Smart TV',
    location: '',
    notes: ''
  });

  // Filter discovered devices
  const filteredDevices = discoveredDevices.filter(device => 
    device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.ip.includes(searchTerm) ||
    device.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Simulate network scan
  const scanNetwork = useCallback(() => {
    setIsScanning(true);
    setDiscoveredDevices([]);
    
    setTimeout(() => {
      setDiscoveredDevices(mockDiscoveredDevices);
      setIsScanning(false);
    }, 2000);
  }, []);

  // Handle manual form input changes
  const handleManualFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setManualForm(prev => ({ ...prev, [name]: value }));
  }, []);

  // Handle adding display
  const handleSubmit = useCallback(() => {
    if (activeTab === 'scan' && selectedDevice) {
      const device = discoveredDevices.find(d => d.id === selectedDevice);
      if (device) {
        onAddDisplay({
          id: Date.now(),
          name: device.name,
          location: 'New Location',
          status: 'offline',
          lastSeen: 'Never',
          resolution: '1920x1080',
          currentContent: 'None',
          type: device.type,
          groups: []
        });
      }
    } else if (activeTab === 'manual' && manualForm.name && manualForm.ip) {
      onAddDisplay({
        id: Date.now(),
        ...manualForm,
        status: 'offline',
        lastSeen: 'Never',
        resolution: '1920x1080',
        currentContent: 'None',
        groups: []
      });
    }
    onClose();
  }, [activeTab, selectedDevice, discoveredDevices, manualForm, onAddDisplay, onClose]);

  // Start scanning when modal opens
  useEffect(() => {
    if (isOpen && activeTab === 'scan') {
      scanNetwork();
    }
  }, [isOpen, activeTab, scanNetwork]);

  // Reset form on modal close
  useEffect(() => {
    if (!isOpen) {
      setSelectedDevice(null);
      setSearchTerm('');
      setManualForm({
        name: '',
        ip: '',
        type: 'Smart TV',
        location: '',
        notes: ''
      });
    }
  }, [isOpen]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-center mb-4">
                  <Dialog.Title as="h3" className="text-lg font-medium text-secondary-900">
                    Add New Display
                  </Dialog.Title>
                  <button className="text-secondary-400 hover:text-secondary-500" onClick={onClose}>
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-secondary-200 mb-4">
                  <button 
                    className={`mr-8 py-4 text-sm font-medium ${activeTab === 'scan' ? 'border-b-2 border-primary-500 text-primary-600' : 'text-secondary-500'}`} 
                    onClick={() => setActiveTab('scan')}
                  >
                    Scan Network
                  </button>
                  <button 
                    className={`py-4 text-sm font-medium ${activeTab === 'manual' ? 'border-b-2 border-primary-500 text-primary-600' : 'text-secondary-500'}`} 
                    onClick={() => setActiveTab('manual')}
                  >
                    Manual Entry
                  </button>
                </div>

                {activeTab === 'scan' ? (
                  <div>
                    <div className="mb-4">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="h-5 w-5 text-secondary-400" />
                        </div>
                        <input 
                          type="text" 
                          className="input pl-10" 
                          placeholder="Search devices..." 
                          value={searchTerm} 
                          onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                      </div>
                    </div>

                    <button 
                      className="btn btn-secondary flex items-center mb-4" 
                      onClick={scanNetwork} 
                      disabled={isScanning}
                    >
                      <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                      {isScanning ? 'Scanning...' : 'Scan Again'}
                    </button>

                    {isScanning ? (
                      <div className="py-8 flex justify-center">
                        <div className="flex flex-col items-center">
                          <RefreshCw className="h-8 w-8 text-primary-500 animate-spin mb-4" />
                          <p className="text-secondary-900 font-medium">Scanning network for displays...</p>
                          <p className="text-secondary-500 text-sm">This may take a few moments</p>
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-md overflow-hidden">
                        <table className="min-w-full divide-y divide-secondary-200">
                          <thead className="bg-secondary-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                                Device
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                                IP Address
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                                Type
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-secondary-500 uppercase tracking-wider">
                                Status
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-secondary-200">
                            {filteredDevices.length > 0 ? (
                              filteredDevices.map((device) => (
                                <tr 
                                  key={device.id} 
                                  className={`${selectedDevice === device.id ? 'bg-primary-50' : 'hover:bg-secondary-50 cursor-pointer'}`}
                                  onClick={() => setSelectedDevice(device.id)}
                                >
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-primary-50 text-primary-600">
                                        <Monitor className="h-6 w-6" />
                                      </div>
                                      <div className="ml-4">
                                        <div className="text-sm font-medium text-secondary-900">{device.name}</div>
                                        <div className="text-sm text-secondary-500">{device.model}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">
                                    {device.ip}
                                    <div className="text-xs text-secondary-500">{device.mac}</div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap text-sm text-secondary-900">{device.type}</td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      device.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {device.status === 'available' ? 'Available' : 'In Use'}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-sm text-secondary-500">
                                  <div className="flex flex-col items-center">
                                    <Monitor className="h-12 w-12 text-secondary-400 mb-4" />
                                    <p className="text-secondary-900 font-medium mb-1">No devices found</p>
                                    <p className="text-secondary-500 max-w-sm">
                                      {searchTerm ? 'Try adjusting your search criteria.' : 'Try scanning again or add a display manually.'}
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-secondary-700">Display Name</label>
                      <input 
                        type="text" 
                        id="name"
                        name="name" 
                        className="input mt-1" 
                        value={manualForm.name} 
                        onChange={handleManualFormChange} 
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="ip" className="block text-sm font-medium text-secondary-700">IP Address</label>
                      <input 
                        type="text" 
                        id="ip"
                        name="ip" 
                        className="input mt-1" 
                        value={manualForm.ip} 
                        onChange={handleManualFormChange} 
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="type" className="block text-sm font-medium text-secondary-700">Display Type</label>
                      <select 
                        id="type"
                        name="type" 
                        className="input mt-1" 
                        value={manualForm.type} 
                        onChange={handleManualFormChange}
                      >
                        <option value="Smart TV">Smart TV</option>
                        <option value="Media Player">Media Player</option>
                        <option value="Chrome Device">Chrome Device</option><ez1Action type="file" filePath="src/components/displays/AddDisplayModal.tsx">                        <option value="Single Board Computer">Single Board Computer</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="location" className="block text-sm font-medium text-secondary-700">Location</label>
                      <input 
                        type="text" 
                        id="location"
                        name="location" 
                        className="input mt-1" 
                        value={manualForm.location} 
                        onChange={handleManualFormChange} 
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-secondary-700">Notes</label>
                      <textarea 
                        id="notes"
                        name="notes" 
                        rows={3}
                        className="input mt-1" 
                        value={manualForm.notes} 
                        onChange={handleManualFormChange} 
                      />
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end space-x-3">
                  <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleSubmit} 
                    disabled={(activeTab === 'scan' && !selectedDevice) || (activeTab === 'manual' && (!manualForm.name || !manualForm.ip))}
                  >
                    Add Display
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AddDisplayModal;
