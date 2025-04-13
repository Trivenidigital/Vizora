import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { displayService } from '../services/displayService';
import { toast } from 'react-hot-toast';

interface Display {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'warning';
  lastPing?: string;
  location?: string;
  model?: string;
  serialNumber?: string;
}

interface DisplayListProps {
  initialDisplays?: Display[];
  showActions?: boolean;
  onDisplayUnpair?: (id: string) => void;
  onDisplaySelect?: (display: Display) => void;
  filterOptions?: {
    status?: string;
    searchQuery?: string;
  };
}

const DisplayList: React.FC<DisplayListProps> = ({
  initialDisplays,
  showActions = true,
  onDisplayUnpair,
  onDisplaySelect,
  filterOptions = {}
}) => {
  const [displays, setDisplays] = useState<Display[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDisplays) {
      setDisplays(initialDisplays);
      setLoading(false);
      return;
    }

    const fetchDisplays = async () => {
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
          console.warn('Unexpected display format received in DisplayList:', response);
          fetchedDisplays = [];
        }
        
        setDisplays(fetchedDisplays);
        setError(null);
      } catch (err) {
        setError('Failed to load displays. Please try again.');
        console.error('Error fetching displays:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDisplays();
  }, [initialDisplays]);

  const handleUnpairDisplay = async (id: string) => {
    try {
      await displayService.unpairDisplay(id);
      setDisplays(displays.filter(display => display.id !== id));
      toast.success('Display unpaired successfully');
      if (onDisplayUnpair) {
        onDisplayUnpair(id);
      }
    } catch (err) {
      toast.error('Failed to unpair display');
      console.error('Error unpairing display:', err);
    }
  };

  const handleSelectDisplay = (display: Display) => {
    if (onDisplaySelect) {
      onDisplaySelect(display);
    }
  };

  const filteredDisplays = displays.filter(display => {
    const matchesStatus = !filterOptions.status || display.status === filterOptions.status;
    const matchesSearch = !filterOptions.searchQuery || 
      display.name.toLowerCase().includes((filterOptions.searchQuery || '').toLowerCase()) ||
      (display.location && display.location.toLowerCase().includes((filterOptions.searchQuery || '').toLowerCase()));
    
    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return <div className="loading">Loading displays...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="display-list">
      <h2>Displays</h2>
      <div className="display-list-content">
        {displays.length === 0 ? (
          <div className="no-displays">
            <p>No displays found. Add one to get started.</p>
            <Link to="/displays/add" className="add-display-btn">
              Add Display
            </Link>
          </div>
        ) : (
          <div className="display-grid">
            {filteredDisplays.map(display => (
              <div 
                key={display.id} 
                className={`display-card status-${display.status}`}
                onClick={() => handleSelectDisplay(display)}
              >
                <div className="display-header">
                  <h3>{display.name}</h3>
                  <span className={`status-indicator ${display.status}`}>
                    {display.status}
                  </span>
                </div>
                
                {display.location && (
                  <div className="display-location">
                    <span>Location: {display.location}</span>
                  </div>
                )}
                
                {display.lastPing && (
                  <div className="display-last-ping">
                    <span>Last ping: {new Date(display.lastPing).toLocaleString()}</span>
                  </div>
                )}
                
                {showActions && (
                  <div className="display-actions">
                    <Link to={`/displays/${display.id}`} className="view-display-btn">
                      View
                    </Link>
                    <Link to={`/displays/${display.id}/edit`} className="edit-display-btn">
                      Edit
                    </Link>
                    <button
                      className="unpair-display-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnpairDisplay(display.id);
                      }}
                    >
                      Unpair
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DisplayList; 