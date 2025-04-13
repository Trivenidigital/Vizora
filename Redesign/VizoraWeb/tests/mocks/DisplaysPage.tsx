import React, { useState, useEffect } from 'react';
import { displayServiceMock } from './displayServiceMock';
import toast from 'react-hot-toast';

// Mock the display service
const displayService = displayServiceMock;

interface Display {
  id: string;
  name: string;
  status: string;
  lastSeen: string;
  location?: string;
  model?: string;
  ipAddress?: string;
  resolution?: string;
  orientation?: string;
}

const DisplaysPage: React.FC = () => {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [filteredDisplays, setFilteredDisplays] = useState<Display[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDisplay, setSelectedDisplay] = useState<Display | null>(null);
  const [showUnpairModal, setShowUnpairModal] = useState(false);
  const [showPairModal, setShowPairModal] = useState(false);
  const [pairingCode, setPairingCode] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    loadDisplays();
  }, []);

  useEffect(() => {
    filterDisplays();
  }, [displays, activeFilter, searchQuery]);

  const loadDisplays = async () => {
    try {
      setLoading(true);
      const response = await displayService.getDisplays();
      
      // Extract displays from the response
      let fetchedDisplays: Display[] = [];
      if (response && 'displays' in response && Array.isArray(response.displays)) {
        fetchedDisplays = response.displays;
      } else if (Array.isArray(response)) {
        fetchedDisplays = response;
      } else {
        console.warn('Unexpected display format received in mock DisplaysPage:', response);
        fetchedDisplays = [];
      }
      
      setDisplays(fetchedDisplays);
    } catch (error) {
      console.error('Error loading displays:', error);
      toast.error('Failed to load displays');
    } finally {
      setLoading(false);
    }
  };

  const filterDisplays = () => {
    let filtered = [...displays];
    
    // Apply status filter
    if (activeFilter) {
      filtered = filtered.filter(item => item?.status?.toLowerCase() === activeFilter.toLowerCase());
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) || 
        (item.location?.toLowerCase() || '').includes(query)
      );
    }
    
    setFilteredDisplays(filtered);
  };

  const handleFilterClick = (filter: string) => {
    setActiveFilter(activeFilter === filter ? null : filter);
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleUnpairClick = (display: Display) => {
    setSelectedDisplay(display);
    setShowUnpairModal(true);
  };

  const handleConfirmUnpair = async () => {
    if (!selectedDisplay) return;
    
    try {
      await displayService.unpairDisplay(selectedDisplay.id);
      setDisplays(displays.filter(item => item.id !== selectedDisplay.id));
      toast.success('Display unpaired successfully');
    } catch (error) {
      console.error('Error unpairing display:', error);
      toast.error('Failed to unpair display');
    } finally {
      setShowUnpairModal(false);
      setSelectedDisplay(null);
    }
  };

  const handleAddDisplayClick = () => {
    setShowPairModal(true);
  };

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pairingCode || !displayName) return;
    
    try {
      const newDisplay = await displayService.pairDisplay(pairingCode, displayName);
      setDisplays([...displays, newDisplay]);
      toast.success('Display paired successfully');
      setShowPairModal(false);
      setPairingCode('');
      setDisplayName('');
    } catch (error) {
      console.error('Error pairing display:', error);
      toast.error('Failed to pair display');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="displays-page">
      <h1>Display Management</h1>
      
      <div className="display-filters">
        <button 
          onClick={() => handleFilterClick('online')}
          className={activeFilter === 'online' ? 'active' : ''}
        >
          Online
        </button>
        <button 
          onClick={() => handleFilterClick('offline')}
          className={activeFilter === 'offline' ? 'active' : ''}
        >
          Offline
        </button>
        <button 
          onClick={() => handleFilterClick('warning')}
          className={activeFilter === 'warning' ? 'active' : ''}
        >
          Warning
        </button>
        <input 
          type="text" 
          placeholder="Search displays..." 
          value={searchQuery}
          onChange={handleSearch}
        />
        <button onClick={handleAddDisplayClick}>Add Display</button>
      </div>
      
      <div className="display-grid">
        {filteredDisplays.map(item => (
          <div key={item.id} className="display-card">
            <h3>{item.name}</h3>
            <p>Status: <span className={`status-${item?.status?.toLowerCase() || 'unknown'}`}>{item?.status || 'Unknown'}</span></p>
            {item.location && <p>Location: {item.location}</p>}
            {item.lastSeen && <p>Last seen: {new Date(item.lastSeen).toLocaleString()}</p>}
            <div className="display-actions">
              <button onClick={() => handleUnpairClick(item)}>Unpair</button>
            </div>
          </div>
        ))}
        
        {filteredDisplays.length === 0 && (
          <div className="no-displays">
            <p>No displays found.</p>
          </div>
        )}
      </div>
      
      {/* Unpair Confirmation Modal */}
      {showUnpairModal && selectedDisplay && (
        <div className="modal">
          <div className="modal-content">
            <h2>Confirm Unpair</h2>
            <p>Are you sure you want to unpair "{selectedDisplay.name}"?</p>
            <div className="modal-actions">
              <button onClick={handleConfirmUnpair}>Confirm</button>
              <button onClick={() => setShowUnpairModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Pair Display Modal */}
      {showPairModal && (
        <div className="modal">
          <div className="modal-content">
            <h2>Pair New Display</h2>
            <form onSubmit={handlePairSubmit}>
              <div className="form-group">
                <label htmlFor="pairingCode">Pairing Code:</label>
                <input
                  id="pairingCode"
                  type="text"
                  value={pairingCode}
                  onChange={(e) => setPairingCode(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="displayName">Display Name:</label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="submit">Pair</button>
                <button type="button" onClick={() => setShowPairModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisplaysPage; 