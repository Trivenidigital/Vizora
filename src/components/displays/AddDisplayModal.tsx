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

        <div className="fixed inset-0 overflow-y-auto flex items-center justify-center p-4">
          <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
            <Dialog.Panel className="w-full max-w-3xl bg-white rounded-2xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium text-secondary-900">Add New Display</h3>
                <button className="text-secondary-400 hover:text-secondary-500" onClick={onClose}>
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="border-b border-secondary-200 mb-4">
                <button className={`mr-8 py-4 text-sm font-medium ${activeTab === 'scan' ? 'border-b-2 border-primary-500 text-primary-600' : 'text-secondary-500'}`} onClick={() => setActiveTab('scan')}>Scan Network</button>
                <button className={`py-4 text-sm font-medium ${activeTab === 'manual' ? 'border-b-2 border-primary-500 text-primary-600' : 'text-secondary-500'}`} onClick={() => setActiveTab('manual')}>Manual Entry</button>
              </div>

              {activeTab === 'scan' ? (
                <div>
                  <button className="btn btn-secondary flex items-center" onClick={scanNetwork} disabled={isScanning}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                    {isScanning ? 'Scanning...' : 'Scan Again'}
                  </button>
                </div>
              ) : (
                <div>
                  <input type="text" name="name" placeholder="Display Name" className="input mt-2" value={manualForm.name} onChange={handleManualFormChange} />
                  <input type="text" name="ip" placeholder="IP Address" className="input mt-2" value={manualForm.ip} onChange={handleManualFormChange} />
                </div>
              )}

              <div className="mt-6 flex justify-end space-x-3">
                <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={!selectedDevice && !manualForm.name}>Add Display</button>
              </div>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
};

export default AddDisplayModal;
