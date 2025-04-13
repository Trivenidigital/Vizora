import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import reactQueryMock from '../../mocks/reactQuery';

// Define interfaces
interface SyncState {
  displays: DisplayInfo[];
  masterDisplayId: string | null;
  syncEnabled: boolean;
  syncMode: 'mirroring' | 'tiling' | 'custom';
  syncStatus: 'connected' | 'connecting' | 'disconnected';
  lastSyncTime: string | null;
}

interface DisplayInfo {
  id: string;
  name: string;
  status: 'online' | 'offline';
  ipAddress: string;
  role: 'master' | 'slave' | 'standalone';
  position?: { x: number; y: number };
}

// Mock sync service
const syncService = {
  getDisplays: vi.fn(),
  setMasterDisplay: vi.fn(),
  enableSync: vi.fn(),
  disableSync: vi.fn(),
  setSyncMode: vi.fn(),
  updateDisplayPosition: vi.fn(),
  refreshSyncStatus: vi.fn()
};

vi.mock('../../services/syncService', () => ({
  default: syncService
}));

// Mock socket service for real-time updates
const socketService = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  emit: vi.fn()
};

vi.mock('../../services/socketService', () => ({
  default: socketService
}));

// Mock DisplaySync component
const DisplaySync = () => {
  const [syncState, setSyncState] = React.useState<SyncState>({
    displays: [],
    masterDisplayId: null,
    syncEnabled: false,
    syncMode: 'mirroring',
    syncStatus: 'disconnected',
    lastSyncTime: null
  });
  
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Load initial data
  React.useEffect(() => {
    const loadDisplays = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const displays = await syncService.getDisplays();
        
        setSyncState(prev => ({
          ...prev,
          displays,
          masterDisplayId: displays.find(d => d.role === 'master')?.id || null
        }));
      } catch (err) {
        setError('Failed to load displays');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    loadDisplays();
    
    // Setup socket for real-time updates
    socketService.connect();
    
    socketService.subscribe('display-status-change', (data) => {
      setSyncState(prev => ({
        ...prev,
        displays: prev.displays.map(d => 
          d.id === data.displayId ? { ...d, status: data.status } : d
        )
      }));
    });
    
    socketService.subscribe('sync-status-change', (data) => {
      setSyncState(prev => ({
        ...prev,
        syncStatus: data.status,
        lastSyncTime: data.timestamp
      }));
    });
    
    return () => {
      socketService.disconnect();
      socketService.unsubscribe('display-status-change');
      socketService.unsubscribe('sync-status-change');
    };
  }, []);

  const handleSetMaster = async (displayId: string) => {
    try {
      await syncService.setMasterDisplay(displayId);
      
      setSyncState(prev => ({
        ...prev,
        masterDisplayId: displayId,
        displays: prev.displays.map(d => ({
          ...d,
          role: d.id === displayId ? 'master' : 'slave'
        }))
      }));
    } catch (err) {
      setError('Failed to set master display');
      console.error(err);
    }
  };

  const handleToggleSync = async () => {
    try {
      if (syncState.syncEnabled) {
        await syncService.disableSync();
      } else {
        await syncService.enableSync();
      }
      
      setSyncState(prev => ({
        ...prev,
        syncEnabled: !prev.syncEnabled,
        syncStatus: !prev.syncEnabled ? 'connecting' : 'disconnected'
      }));
    } catch (err) {
      setError(`Failed to ${syncState.syncEnabled ? 'disable' : 'enable'} sync`);
      console.error(err);
    }
  };

  const handleChangeSyncMode = async (mode: 'mirroring' | 'tiling' | 'custom') => {
    try {
      await syncService.setSyncMode(mode);
      
      setSyncState(prev => ({
        ...prev,
        syncMode: mode
      }));
    } catch (err) {
      setError('Failed to change sync mode');
      console.error(err);
    }
  };

  const handleUpdatePosition = async (displayId: string, position: { x: number; y: number }) => {
    try {
      await syncService.updateDisplayPosition(displayId, position);
      
      setSyncState(prev => ({
        ...prev,
        displays: prev.displays.map(d => 
          d.id === displayId ? { ...d, position } : d
        )
      }));
    } catch (err) {
      setError('Failed to update display position');
      console.error(err);
    }
  };

  const handleRefreshSync = async () => {
    try {
      setLoading(true);
      const status = await syncService.refreshSyncStatus();
      
      setSyncState(prev => ({
        ...prev,
        syncStatus: status.connected ? 'connected' : 'disconnected',
        lastSyncTime: status.timestamp
      }));
    } catch (err) {
      setError('Failed to refresh sync status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div data-testid="loading">Loading displays...</div>;
  }

  return (
    <div data-testid="display-sync">
      <h1>Display Sync Manager</h1>
      
      {error && <div data-testid="error-message" className="error">{error}</div>}
      
      <div className="status-bar">
        <div data-testid="sync-status">
          Status: <span className={syncState.syncStatus}>{syncState.syncStatus}</span>
        </div>
        {syncState.lastSyncTime && (
          <div data-testid="last-sync">
            Last sync: {syncState.lastSyncTime}
          </div>
        )}
        <button 
          onClick={handleRefreshSync}
          data-testid="refresh-button"
        >
          Refresh
        </button>
      </div>
      
      <div className="controls">
        <button 
          onClick={handleToggleSync}
          data-testid="toggle-sync"
          disabled={!syncState.masterDisplayId}
        >
          {syncState.syncEnabled ? 'Disable Sync' : 'Enable Sync'}
        </button>
        
        <div className="sync-modes">
          <select
            value={syncState.syncMode}
            onChange={(e) => handleChangeSyncMode(e.target.value as any)}
            disabled={!syncState.syncEnabled}
            data-testid="sync-mode-select"
          >
            <option value="mirroring">Mirroring (Clone)</option>
            <option value="tiling">Tiling (Video Wall)</option>
            <option value="custom">Custom Layout</option>
          </select>
        </div>
      </div>
      
      <div className="displays-grid">
        <h2>Connected Displays</h2>
        
        {syncState.displays.length === 0 ? (
          <div data-testid="no-displays">No displays found</div>
        ) : (
          <ul data-testid="display-list">
            {syncState.displays.map(display => (
              <li 
                key={display.id} 
                data-testid={`display-${display.id}`}
                className={display.status === 'offline' ? 'offline' : ''}
              >
                <div className="display-info">
                  <h3>{display.name}</h3>
                  <div>IP: {display.ipAddress}</div>
                  <div>Status: {display.status}</div>
                  <div>Role: {display.role}</div>
                </div>
                
                <div className="display-actions">
                  <button
                    onClick={() => handleSetMaster(display.id)}
                    disabled={display.status === 'offline' || display.role === 'master'}
                    data-testid={`set-master-${display.id}`}
                  >
                    Set as Master
                  </button>
                  
                  {syncState.syncMode === 'custom' && display.role === 'slave' && (
                    <div className="position-controls">
                      <label>Position:</label>
                      <input 
                        type="number" 
                        placeholder="X"
                        value={display.position?.x || 0}
                        onChange={(e) => handleUpdatePosition(display.id, { 
                          x: Number(e.target.value), 
                          y: display.position?.y || 0 
                        })}
                        data-testid={`position-x-${display.id}`}
                      />
                      <input 
                        type="number" 
                        placeholder="Y"
                        value={display.position?.y || 0}
                        onChange={(e) => handleUpdatePosition(display.id, { 
                          x: display.position?.x || 0,
                          y: Number(e.target.value)
                        })}
                        data-testid={`position-y-${display.id}`}
                      />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

describe('DisplaySync Component', () => {
  const mockDisplays: DisplayInfo[] = [
    {
      id: 'display-1',
      name: 'Main Display',
      status: 'online',
      ipAddress: '192.168.1.101',
      role: 'master'
    },
    {
      id: 'display-2',
      name: 'Secondary Display',
      status: 'online',
      ipAddress: '192.168.1.102',
      role: 'slave',
      position: { x: 1920, y: 0 }
    },
    {
      id: 'display-3',
      name: 'Third Display',
      status: 'offline',
      ipAddress: '192.168.1.103',
      role: 'slave'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    reactQueryMock.resetReactQueryMocks();
    
    // Mock default responses
    syncService.getDisplays.mockResolvedValue(mockDisplays);
    syncService.setMasterDisplay.mockResolvedValue({ success: true });
    syncService.enableSync.mockResolvedValue({ success: true });
    syncService.disableSync.mockResolvedValue({ success: true });
    syncService.setSyncMode.mockResolvedValue({ success: true });
    syncService.updateDisplayPosition.mockResolvedValue({ success: true });
    syncService.refreshSyncStatus.mockResolvedValue({ 
      connected: true, 
      timestamp: '2023-05-15T10:30:00Z' 
    });
    
    // Mock socket handlers
    socketService.subscribe.mockImplementation((event, callback) => {
      // Store the callback for later use in tests
      if (event === 'display-status-change') {
        (socketService as any).displayStatusCallback = callback;
      } else if (event === 'sync-status-change') {
        (socketService as any).syncStatusCallback = callback;
      }
    });
  });

  it('renders the display list correctly', async () => {
    render(<DisplaySync />);
    
    // Initially shows loading
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    
    // Wait for displays to load
    await waitFor(() => {
      expect(screen.getByTestId('display-sync')).toBeInTheDocument();
    });
    
    // Check if all displays are rendered
    expect(screen.getByTestId('display-list')).toBeInTheDocument();
    expect(screen.getByTestId('display-display-1')).toBeInTheDocument();
    expect(screen.getByTestId('display-display-2')).toBeInTheDocument();
    expect(screen.getByTestId('display-display-3')).toBeInTheDocument();
    
    // Check display status and roles
    expect(screen.getByTestId('display-display-1')).toHaveTextContent('Role: master');
    expect(screen.getByTestId('display-display-2')).toHaveTextContent('Role: slave');
    expect(screen.getByTestId('display-display-3')).toHaveTextContent('Status: offline');
  });

  it('sets a new master display when button is clicked', async () => {
    render(<DisplaySync />);
    
    // Wait for displays to load
    await waitFor(() => {
      expect(screen.getByTestId('display-sync')).toBeInTheDocument();
    });
    
    // Initially display-1 is master
    expect(screen.getByTestId('display-display-1')).toHaveTextContent('Role: master');
    
    // Click set master button for display-2
    fireEvent.click(screen.getByTestId('set-master-display-2'));
    
    // Check if API was called
    expect(syncService.setMasterDisplay).toHaveBeenCalledWith('display-2');
    
    // Wait for UI update
    await waitFor(() => {
      expect(screen.getByTestId('display-display-2')).toHaveTextContent('Role: master');
      expect(screen.getByTestId('display-display-1')).toHaveTextContent('Role: slave');
    });
  });

  it('enables and disables sync when toggle button is clicked', async () => {
    render(<DisplaySync />);
    
    // Wait for displays to load
    await waitFor(() => {
      expect(screen.getByTestId('display-sync')).toBeInTheDocument();
    });
    
    // Check initial state (sync disabled)
    expect(screen.getByTestId('toggle-sync')).toHaveTextContent('Enable Sync');
    
    // Click to enable sync
    fireEvent.click(screen.getByTestId('toggle-sync'));
    
    // Check if enableSync was called
    expect(syncService.enableSync).toHaveBeenCalled();
    
    // Check updated UI
    await waitFor(() => {
      expect(screen.getByTestId('toggle-sync')).toHaveTextContent('Disable Sync');
      expect(screen.getByTestId('sync-status')).toHaveTextContent('connecting');
    });
    
    // Click to disable sync
    fireEvent.click(screen.getByTestId('toggle-sync'));
    
    // Check if disableSync was called
    expect(syncService.disableSync).toHaveBeenCalled();
    
    // Check updated UI
    await waitFor(() => {
      expect(screen.getByTestId('toggle-sync')).toHaveTextContent('Enable Sync');
      expect(screen.getByTestId('sync-status')).toHaveTextContent('disconnected');
    });
  });

  it('changes sync mode when dropdown is changed', async () => {
    render(<DisplaySync />);
    
    // Wait for displays to load
    await waitFor(() => {
      expect(screen.getByTestId('display-sync')).toBeInTheDocument();
    });
    
    // Enable sync first
    fireEvent.click(screen.getByTestId('toggle-sync'));
    
    await waitFor(() => {
      expect(screen.getByTestId('toggle-sync')).toHaveTextContent('Disable Sync');
    });
    
    // Change sync mode to tiling
    fireEvent.change(screen.getByTestId('sync-mode-select'), {
      target: { value: 'tiling' }
    });
    
    // Check if setSyncMode was called
    expect(syncService.setSyncMode).toHaveBeenCalledWith('tiling');
  });

  it('updates display position in custom mode', async () => {
    render(<DisplaySync />);
    
    // Wait for displays to load
    await waitFor(() => {
      expect(screen.getByTestId('display-sync')).toBeInTheDocument();
    });
    
    // Enable sync first
    fireEvent.click(screen.getByTestId('toggle-sync'));
    
    await waitFor(() => {
      expect(screen.getByTestId('toggle-sync')).toHaveTextContent('Disable Sync');
    });
    
    // Change sync mode to custom
    fireEvent.change(screen.getByTestId('sync-mode-select'), {
      target: { value: 'custom' }
    });
    
    // Position inputs should now be visible for slave displays
    await waitFor(() => {
      expect(screen.getByTestId('position-x-display-2')).toBeInTheDocument();
      expect(screen.getByTestId('position-y-display-2')).toBeInTheDocument();
    });
    
    // Update X position
    fireEvent.change(screen.getByTestId('position-x-display-2'), {
      target: { value: '3840' }
    });
    
    // Check if updatePosition API was called
    expect(syncService.updateDisplayPosition).toHaveBeenCalledWith(
      'display-2', 
      { x: 3840, y: 0 }
    );
  });

  it('handles real-time display status updates via socket', async () => {
    render(<DisplaySync />);
    
    // Wait for displays to load
    await waitFor(() => {
      expect(screen.getByTestId('display-sync')).toBeInTheDocument();
    });
    
    // Initially display-3 is offline
    expect(screen.getByTestId('display-display-3')).toHaveTextContent('Status: offline');
    
    // Simulate socket event for display status change
    const displayStatusCallback = (socketService as any).displayStatusCallback;
    displayStatusCallback({
      displayId: 'display-3',
      status: 'online'
    });
    
    // Check if UI was updated
    await waitFor(() => {
      expect(screen.getByTestId('display-display-3')).toHaveTextContent('Status: online');
    });
  });

  it('handles real-time sync status updates via socket', async () => {
    render(<DisplaySync />);
    
    // Wait for displays to load
    await waitFor(() => {
      expect(screen.getByTestId('display-sync')).toBeInTheDocument();
    });
    
    // Initially sync status is disconnected
    expect(screen.getByTestId('sync-status')).toHaveTextContent('disconnected');
    
    // Simulate socket event for sync status change
    const syncStatusCallback = (socketService as any).syncStatusCallback;
    syncStatusCallback({
      status: 'connected',
      timestamp: '2023-05-15T11:45:00Z'
    });
    
    // Check if UI was updated
    await waitFor(() => {
      expect(screen.getByTestId('sync-status')).toHaveTextContent('connected');
      expect(screen.getByTestId('last-sync')).toHaveTextContent('2023-05-15T11:45:00Z');
    });
  });

  it('refreshes sync status when refresh button is clicked', async () => {
    render(<DisplaySync />);
    
    // Wait for displays to load
    await waitFor(() => {
      expect(screen.getByTestId('display-sync')).toBeInTheDocument();
    });
    
    // Click refresh button
    fireEvent.click(screen.getByTestId('refresh-button'));
    
    // Check if refreshSyncStatus was called
    expect(syncService.refreshSyncStatus).toHaveBeenCalled();
    
    // Check updated UI
    await waitFor(() => {
      expect(screen.getByTestId('sync-status')).toHaveTextContent('connected');
      expect(screen.getByTestId('last-sync')).toHaveTextContent('2023-05-15T10:30:00Z');
    });
  });

  it('disables set master button for offline displays', async () => {
    render(<DisplaySync />);
    
    // Wait for displays to load
    await waitFor(() => {
      expect(screen.getByTestId('display-sync')).toBeInTheDocument();
    });
    
    // Check if set master button is disabled for offline display
    expect(screen.getByTestId('set-master-display-3')).toBeDisabled();
  });

  it('handles error when fetching displays fails', async () => {
    // Mock API error
    syncService.getDisplays.mockRejectedValue(new Error('Failed to fetch displays'));
    
    render(<DisplaySync />);
    
    // Check for error message
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to load displays');
    });
  });
}); 