import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import displayService, { Display } from '../../services/displays';
import { PushContentDialog } from '../../components/PushContentDialog';
import './DisplayList.css';

// Interface for PushContentDialog display format
interface PushContentDisplay {
  id: string;
  name: string;
  status: 'active' | 'offline' | 'online';
  ipAddress: string;
  lastSeen: string;
  currentContent: string;
  addedOn: string;
}

interface DisplayListProps {
  displays: Display[];
  onSelectDisplay: (display: Display) => void;
  onDeleteDisplay: (displayId: string) => void;
  isAdmin: boolean;
}

export const DisplayList: React.FC<DisplayListProps> = ({
  displays,
  onSelectDisplay,
  onDeleteDisplay,
  isAdmin,
}) => {
  const [selectedDisplay, setSelectedDisplay] = useState<Display | null>(null);
  const [isPushDialogOpen, setIsPushDialogOpen] = useState(false);

  const handlePushContent = (display: Display) => {
    setSelectedDisplay(display);
    setIsPushDialogOpen(true);
  };

  const handleUnpair = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to unpair "${name}"?`)) {
      return;
    }

    try {
      await displayService.unpairDisplay(id);
      onDeleteDisplay(id);
      toast.success('Display unpaired successfully');
    } catch (err: any) {
      console.error('Error unpairing display:', err);
      toast.error(err.response?.data?.message || 'Failed to unpair display');
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'maintenance':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="display-list">
      <h2>Displays</h2>
      <div className="display-list-content">
        {displays.length === 0 ? (
          <div className="no-displays">
            <p>No displays found. Add one to get started.</p>
          </div>
        ) : (
          displays.map(display => (
            <div
              key={display.id}
              className="display-item"
            >
              <div
                className="display-item-content"
                onClick={() => onSelectDisplay(display)}
              >
                <div className="display-item-header">
                  <h3>{display.name}</h3>
                  {display.description && (
                    <p className="display-description">{display.description}</p>
                  )}
                </div>
                <div className="display-item-details">
                  <span className={`display-status ${getStatusBadgeClass(display.status)}`}>
                    {display.status}
                  </span>
                  <div className="display-actions">
                    <button
                      className="push-button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePushContent(display);
                      }}
                    >
                      Push Content
                    </button>
                    {isAdmin && (
                      <button
                        className="delete-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteDisplay(display.id);
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      {selectedDisplay && (
        <PushContentDialog
          display={selectedDisplay}
          isOpen={isPushDialogOpen}
          onClose={() => setIsPushDialogOpen(false)}
        />
      )}
    </div>
  );
};

export default DisplayList; 