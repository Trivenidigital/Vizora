import { useState } from 'react';
import { 
  Monitor, 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Zap, 
  AlertTriangle, 
  Clock, 
  RefreshCw,
  Power,
  Edit,
  Trash2,
  Download
} from 'lucide-react';
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import AddDisplayModal from '../components/displays/AddDisplayModal';

interface Display {
  id: number;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'scheduled';
  lastSeen: string;
  resolution: string;
  currentContent: string;
  type: string;
  groups: string[];
}

const initialDisplays: Display[] = [
  { id: 1, name: 'Lobby Display', location: 'Main Entrance', status: 'online', lastSeen: 'Just now', resolution: '1920x1080', currentContent: 'Welcome Slideshow', type: 'Samsung Smart TV', groups: ['Lobby', 'Public Areas'] },
];

const Displays = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [displays, setDisplays] = useState<Display[]>(initialDisplays);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const filteredDisplays = displays.filter(display => 
    (display.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    display.location.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (selectedStatus === 'all' || display.status === selectedStatus)
  );

  const handleAddDisplay = (newDisplay: Display) => {
    setDisplays(prevDisplays => [...prevDisplays, { ...newDisplay, id: prevDisplays.length + 1 }]);
    setIsAddModalOpen(false);
  };

  return (
    <div>
      <button className="btn btn-primary flex items-center mt-4 sm:mt-0" onClick={() => setIsAddModalOpen(true)}>
        <Plus className="h-4 w-4 mr-2" /> Add Display
      </button>

      <AddDisplayModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} onAddDisplay={handleAddDisplay} />
    </div>
  );
};

export default Displays;
