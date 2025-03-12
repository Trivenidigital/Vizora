import { useState, useEffect } from 'react';
import { X, Search, RefreshCw, Monitor, Wifi, Server } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';

interface AddDisplayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddDisplay: (display: any) => void;
}

// Mock discovered devices
const mockDiscoveredDevices = [
  {
    id: 'dev-001',
    name: 'Samsung Smart Display',
    ip: '192.168.1.101',
    mac: '00:1A:2B:3C:4D:5E',
    type: 'Smart TV',
    model: 'Samsung Tizen 4.0',
    status: 'available'
  },
  {
    id: 'dev-002',
    name: 'LG WebOS Display',
    ip: '192.168.1.102',
    mac: '00:1A:2B:3C:4D:5F',
    type: 'Smart TV',
    model: 'LG WebOS 6.0',
    status: 'available'
  },
  {
    id: 'dev-003',
    name: 'Android Media Player',
    ip: '192.168.1.103',
    mac: '00:1A:2B:3C:4D:60',
    type: 'Media Player',
    model: 'Android 10.0',
    status: 'available'
  },
  {
    id: 'dev-004',
    name: 'Chrome Device',
    ip: '192.168.1.104',
    mac: '00:1A:2B:3C:4D:61',
    type: 'Chrome Device',
    model: 'ChromeOS 91',
    status: 'in-use'
  },
  {
    id: 'dev-005',
    name: 'Raspberry Pi',
    ip: '192.168.1.105',
    mac: '00:1A:2B:3C:4D:62',
    type: 'Single Board Computer',
    model: 'Raspberry Pi 4',
    status: 'available'
  }
];

const AddDisplayModal: React.FC<AddDisplayModalProps> = ({ isOpen, onClose, onAddDisplay }) => {
  const [activeTab, setActiveTab] = useState<'scan' | 'manual'>('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Manual entry form state
  const [manualForm, setManualForm] = useState({
    name: '',
    ip: '',
    type: 'Smart TV',
    location: '',
    notes: ''
  });

  // Filter devices based on search term
  const filteredDevices = discoveredDevices.filter(device => 
    device.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    device.ip.includes(searchTerm) ||
    device.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Simulate network scanning
  const scanNetwork = () => {
    setIsScanning(true);
    setDiscoveredDevices([]);
    
    // Simulate network scan delay
    setTimeout(() => {
      setDiscoveredDevices(mockDiscoveredDevices);
      setIsScanning(false);
    }, 2000);
  };

  // Handle manual form changes
  const handleManualFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setManualForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = () => {
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
        onClose();
      }
    } else if (activeTab === 'manual') {
      onAddDisplay({
        id: Date.now(),
        name: manualForm.name,
        location: manualForm.location,
        status: 'offline',
        lastSeen: 'Never',
        resolution: '1920x1080',
        currentContent: 'None',
        type: manualForm.type,
        groups: []
      });
      onClose();
    }
  };

  // Start scanning when modal opens
  useEffect(() => {
    if (isOpen && activeTab === 'scan') {
      scanNetwork();
    }
  }, [isOpen, activeTab]);

  // Reset form when modal closes
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
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex justify-between items-center mb-4">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-secondary-900"
                  >
                    Add New Display
                  </Dialog.Title>
                  <button
                    type="button"
                    className="text-secondary-400 hover:text-secondary-500"
                    onClick={onClose}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Tabs */}
                <div className="border-b border-secondary-200 mb-4">
                  <div className="flex -mb-px">
                    <button
                      className={`mr-8 py-4 text-sm font-medium ${
                        activeTab === 'scan'
                          ? 'border-b-2 border-primary-500 text-primary-600'
                          : 'text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                      }`}
                      onClick={() => setActiveTab('scan')}
                    >
                      Scan Network
                    </button>
                    <button
                      className={`py-4 text-sm font-medium ${
                        activeTab === 'manual'
                          ? 'border-b-2 border-primary-500 text-primary-600'
                          : 'text-secondary-500 hover:text-secondary-700 hover:border-secondary-300'
                      }`}
                      onClick={() => setActiveTab('manual')}
                    >
                      Manual Entry
                    </button>
                  </div>
                </div>

                {/* Scan Network Tab */}
                {activeTab === 'scan' && (
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div className="relative flex-1 max-w-md">
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
                      <button
                        className="btn btn-secondary flex items-center ml-4"
                        onClick={scanNetwork}
                        disabled={isScanning}
                      >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                        {isScanning ? 'Scanning...' : 'Scan Again'}
                      </button>
                    </div>

                    {isScanning ? (
                      <div className="py-12 flex flex-col items-center justify-center">
                        <RefreshCw className="h-8 w-8 text-primary-500 animate-spin mb-4" />
                        <p className="text-secondary-700 font-medium">Scanning network for displays...</p>
                        <p className="text-secondary-500 text-sm mt-2">This may take a few moments</p>
                      </div>
                    ) : (
                      <>
                        {filteredDevices.length > 0 ? (
                          <div className="mt-2 max-h-80 overflow-y-auto">
                            <ul className="divide-y divide-secondary-200">
                              {filteredDevices.map((device) => (
                                <li key={device.id} className="py-4">
                                  <div className="flex items-center">
                                    <input
                                      type="radio"
                                      id={device.id}
                                      name="device"
                                      className="h-4 w-4 text-primary-600 border-secondary-300 focus:ring-primary-500"
                                      checked={selectedDevice === device.id}
                                      onChange={() => setSelectedDevice(device.id)}
                                    />
                                    <label htmlFor={device.id} className="ml-3 flex-1 cursor-pointer">
                                      <div className="flex items-center">
                                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-md bg-primary-50 text-primary-600">
                                          <Monitor className="h-6 w-6" />
                                        </div>
                                        <div className="ml-4 flex-1">
                                          <div className="flex items-center justify-between">
                                            <div>
                                              <p className="text-sm font-medium text-secondary-900">{device.name}</p>
                                              <p className="text-sm text-secondary-500">{device.model}</p>
                                            </div>
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                              device.status === 'available' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                            }`}>
                                              {device.status === 'available' ? 'Available' : 'In Use'}
                                            </span>
                                          </div>
                                          <div className="mt-2 flex items-center text-xs text-secondary-500">
                                            <div className="flex items-center mr-4">
                                              <Server className="h-3 w-3 mr-1" />
                                              {device.ip}
                                            </div>
                                            <div className="flex items-center">
                                              <Wifi className="h-3 w-3 mr-1" />
                                              {device.mac}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </label>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="py-12 text-center">
                            <Monitor className="mx-auto h-12 w-12 text-secondary-400" />
                            <h3 className="mt-2 text-sm font-medium text-secondary-900">No displays found</h3>
                            <p className="mt-1 text-sm text-secondary-500">
                              Try scanning again or check your network connection.
                            </p>
                            <button
                              className="mt-4 btn btn-primary"
                              onClick={scanNetwork}
                            >
                              Scan Again
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Manual Entry Tab */}
                {activeTab === 'manual' && (
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-secondary-700">
                        Display Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        className="mt-1 input"
                        value={manualForm.name}
                        onChange={handleManualFormChange}
                        placeholder="Conference Room Display"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="ip" className="block text-sm font-medium text-secondary-700">
                        IP Address
                      </label>
                      <input
                        type="text"
                        id="ip"
                        name="ip"
                        className="mt-1 input"
                        value={manualForm.ip}
                        onChange={handleManualFormChange}
                        placeholder="192.168.1.100"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="type" className="block text-sm font-medium text-secondary-700">
                        Display Type
                      </label>
                      <select
                        id="type"
                        name="type"
                        className="mt-1 input"
                        value={manualForm.type}
                        onChange={handleManualFormChange}
                      >
                        <option value="Smart TV">Smart TV</option>
                        <option value="Media Player">Media Player</option>
                        <option value="Chrome Device">Chrome Device</option>
                        <option value="Single Board Computer">Single Board Computer</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="location" className="block text-sm font-medium text-secondary-700">
                        Location
                      </label>
                      <input
                        type="text"
                        id="location"
                        name="location"
                        className="mt-1 input"
                        value={manualForm.location}
                        onChange={handleManualFormChange}
                        placeholder="Main Lobby"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="notes" className="block text-sm font-medium text-secondary-700">
                        Notes
                      </label>
                      <textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        className="mt-1 input"
                        value={manualForm.notes}
                        onChange={handleManualFormChange}
                        placeholder="Additional information about this display"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSubmit}
                    disabled={(activeTab === 'scan' && !selectedDevice) || 
                             (activeTab === 'manual' && (!manualForm.name || !manualForm.ip))}
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
