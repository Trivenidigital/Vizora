import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { createSuccessQueryResponse } from '../helpers/queryMockHelpers';
import reactQueryMock from '../../mocks/reactQuery';

// Define interfaces
interface DisplayConfig {
  id: string;
  displayName: string;
  resolution: string;
  orientation: 'landscape' | 'portrait';
  refreshRate: number;
  brightness: number;
  volume: number;
  autostart: boolean;
  logLevel: 'info' | 'warn' | 'error' | 'debug';
  cacheLimit: number; // in MB
  offlineMode: 'disabled' | 'basic' | 'advanced';
}

// Mock configuration service
const configService = {
  getConfiguration: vi.fn(),
  updateConfiguration: vi.fn(),
  resetConfiguration: vi.fn(),
  exportConfiguration: vi.fn(),
  importConfiguration: vi.fn()
};

vi.mock('../../services/configService', () => ({
  default: configService
}));

// Mock storage service
const storageService = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
};

vi.mock('../../services/storageService', () => ({
  default: storageService
}));

// Mock system service
const systemService = {
  getDisplayInfo: vi.fn(),
  rebootDevice: vi.fn(),
  updateSoftware: vi.fn()
};

vi.mock('../../services/systemService', () => ({
  default: systemService
}));

// Mock ConfigurationManager component
const ConfigurationManager = () => {
  const [config, setConfig] = React.useState<DisplayConfig | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveSuccess, setSaveSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const data = await configService.getConfiguration();
        setConfig(data);
      } catch (err) {
        setError('Failed to load configuration');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, []);

  const handleSave = async () => {
    if (!config) return;
    
    try {
      setIsSaving(true);
      setError(null);
      setSaveSuccess(false);
      
      await configService.updateConfiguration(config);
      
      // Save to local storage as backup
      storageService.setItem('lastConfig', JSON.stringify(config));
      
      setSaveSuccess(true);
    } catch (err) {
      setError('Failed to save configuration');
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const defaultConfig = await configService.resetConfiguration();
      setConfig(defaultConfig);
      
      setSaveSuccess(true);
    } catch (err) {
      setError('Failed to reset configuration');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    if (!config) return;
    
    try {
      await configService.exportConfiguration(config);
    } catch (err) {
      setError('Failed to export configuration');
      console.error(err);
    }
  };

  const handleImport = async (configData: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const importedConfig = JSON.parse(configData);
      await configService.importConfiguration(importedConfig);
      
      // Reload config
      const updatedConfig = await configService.getConfiguration();
      setConfig(updatedConfig);
      
      setSaveSuccess(true);
    } catch (err) {
      setError('Failed to import configuration');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!config) return;
    
    const { name, value, type, checked } = e.target;
    setConfig({
      ...config,
      [name]: type === 'checkbox' ? checked : 
              type === 'number' ? Number(value) : value
    });
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!config) return;
    
    const { name, value } = e.target;
    setConfig({
      ...config,
      [name]: value
    });
  };

  // Detect if config has been modified
  const isModified = React.useMemo(() => {
    if (!config) return false;
    
    const savedConfig = storageService.getItem('lastConfig');
    if (!savedConfig) return true;
    
    try {
      const parsedSavedConfig = JSON.parse(savedConfig);
      return JSON.stringify(parsedSavedConfig) !== JSON.stringify(config);
    } catch (e) {
      return true;
    }
  }, [config]);

  if (isLoading) {
    return <div data-testid="loading">Loading configuration...</div>;
  }

  if (!config) {
    return <div data-testid="error">Failed to load configuration</div>;
  }

  return (
    <div data-testid="config-manager">
      <h1>Display Configuration</h1>
      
      {error && <div data-testid="error-message" className="error">{error}</div>}
      {saveSuccess && <div data-testid="success-message" className="success">Configuration saved successfully</div>}
      
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div>
          <label htmlFor="displayName">Display Name:</label>
          <input
            type="text"
            id="displayName"
            name="displayName"
            value={config.displayName}
            onChange={handleInputChange}
            data-testid="input-displayName"
          />
        </div>
        
        <div>
          <label htmlFor="resolution">Resolution:</label>
          <select
            id="resolution"
            name="resolution"
            value={config.resolution}
            onChange={handleSelectChange}
            data-testid="select-resolution"
          >
            <option value="1920x1080">1920x1080 (Full HD)</option>
            <option value="3840x2160">3840x2160 (4K UHD)</option>
            <option value="1280x720">1280x720 (HD)</option>
            <option value="auto">Auto-detect</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="orientation">Orientation:</label>
          <select
            id="orientation"
            name="orientation"
            value={config.orientation}
            onChange={handleSelectChange}
            data-testid="select-orientation"
          >
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="brightness">Brightness:</label>
          <input
            type="range"
            id="brightness"
            name="brightness"
            min="0"
            max="100"
            value={config.brightness}
            onChange={handleInputChange}
            data-testid="range-brightness"
          />
          <span data-testid="brightness-value">{config.brightness}%</span>
        </div>
        
        <div>
          <label htmlFor="volume">Volume:</label>
          <input
            type="range"
            id="volume"
            name="volume"
            min="0"
            max="100"
            value={config.volume}
            onChange={handleInputChange}
            data-testid="range-volume"
          />
          <span data-testid="volume-value">{config.volume}%</span>
        </div>
        
        <div>
          <label htmlFor="autostart">Auto-start:</label>
          <input
            type="checkbox"
            id="autostart"
            name="autostart"
            checked={config.autostart}
            onChange={handleInputChange}
            data-testid="checkbox-autostart"
          />
        </div>
        
        <div>
          <label htmlFor="logLevel">Log Level:</label>
          <select
            id="logLevel"
            name="logLevel"
            value={config.logLevel}
            onChange={handleSelectChange}
            data-testid="select-logLevel"
          >
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
        </div>
        
        <div>
          <label htmlFor="cacheLimit">Cache Limit (MB):</label>
          <input
            type="number"
            id="cacheLimit"
            name="cacheLimit"
            min="100"
            max="10000"
            value={config.cacheLimit}
            onChange={handleInputChange}
            data-testid="input-cacheLimit"
          />
        </div>
        
        <div>
          <label htmlFor="offlineMode">Offline Mode:</label>
          <select
            id="offlineMode"
            name="offlineMode"
            value={config.offlineMode}
            onChange={handleSelectChange}
            data-testid="select-offlineMode"
          >
            <option value="disabled">Disabled</option>
            <option value="basic">Basic (Show last content)</option>
            <option value="advanced">Advanced (Full offline schedule)</option>
          </select>
        </div>
        
        <div className="button-group">
          <button 
            type="submit" 
            disabled={isSaving || !isModified}
            data-testid="button-save"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
          
          <button 
            type="button" 
            onClick={handleReset}
            data-testid="button-reset"
          >
            Reset to Defaults
          </button>
          
          <button 
            type="button" 
            onClick={handleExport}
            data-testid="button-export"
          >
            Export Configuration
          </button>
          
          <button 
            type="button"
            onClick={() => {
              const input = prompt('Paste configuration JSON:');
              if (input) handleImport(input);
            }}
            data-testid="button-import"
          >
            Import Configuration
          </button>
        </div>
      </form>
    </div>
  );
};

describe('ConfigurationManager Component', () => {
  const mockConfig: DisplayConfig = {
    id: '1',
    displayName: 'Test Display',
    resolution: '1920x1080',
    orientation: 'landscape',
    refreshRate: 60,
    brightness: 80,
    volume: 50,
    autostart: true,
    logLevel: 'info',
    cacheLimit: 1000,
    offlineMode: 'basic'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    reactQueryMock.resetReactQueryMocks();
    
    // Mock default successful config fetch
    configService.getConfiguration.mockResolvedValue(mockConfig);
    
    // Mock successful update
    configService.updateConfiguration.mockResolvedValue({ success: true });
    
    // Mock reset to return default config
    configService.resetConfiguration.mockResolvedValue({ ...mockConfig, brightness: 70, volume: 60 });
    
    // Mock storage getItem to return null initially (no saved config)
    storageService.getItem.mockReturnValue(null);
  });

  it('renders the configuration form with correct initial values', async () => {
    render(<ConfigurationManager />);
    
    // Initially shows loading
    expect(screen.getByTestId('loading')).toBeInTheDocument();
    
    // Wait for config to load
    await waitFor(() => {
      expect(screen.getByTestId('config-manager')).toBeInTheDocument();
    });
    
    // Check if form fields have correct values
    expect(screen.getByTestId('input-displayName')).toHaveValue('Test Display');
    expect(screen.getByTestId('select-resolution')).toHaveValue('1920x1080');
    expect(screen.getByTestId('select-orientation')).toHaveValue('landscape');
    expect(screen.getByTestId('range-brightness')).toHaveValue('80');
    expect(screen.getByTestId('range-volume')).toHaveValue('50');
    expect(screen.getByTestId('checkbox-autostart')).toBeChecked();
    expect(screen.getByTestId('select-logLevel')).toHaveValue('info');
    expect(screen.getByTestId('input-cacheLimit')).toHaveValue(1000);
    expect(screen.getByTestId('select-offlineMode')).toHaveValue('basic');
  });

  it('saves configuration when save button is clicked', async () => {
    render(<ConfigurationManager />);
    
    // Wait for config to load
    await waitFor(() => {
      expect(screen.getByTestId('config-manager')).toBeInTheDocument();
    });
    
    // Change a value
    fireEvent.change(screen.getByTestId('input-displayName'), {
      target: { value: 'Updated Display Name' }
    });
    
    // Click save button
    fireEvent.click(screen.getByTestId('button-save'));
    
    // Check if updateConfiguration was called with updated config
    await waitFor(() => {
      expect(configService.updateConfiguration).toHaveBeenCalledWith({
        ...mockConfig,
        displayName: 'Updated Display Name'
      });
      expect(storageService.setItem).toHaveBeenCalled();
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });
  });

  it('resets configuration to default values', async () => {
    render(<ConfigurationManager />);
    
    // Wait for config to load
    await waitFor(() => {
      expect(screen.getByTestId('config-manager')).toBeInTheDocument();
    });
    
    // Click reset button
    fireEvent.click(screen.getByTestId('button-reset'));
    
    // Check if resetConfiguration was called
    await waitFor(() => {
      expect(configService.resetConfiguration).toHaveBeenCalled();
    });
    
    // Check if form was updated with default values
    expect(screen.getByTestId('range-brightness')).toHaveValue('70');
    expect(screen.getByTestId('range-volume')).toHaveValue('60');
  });

  it('exports configuration when export button is clicked', async () => {
    render(<ConfigurationManager />);
    
    // Wait for config to load
    await waitFor(() => {
      expect(screen.getByTestId('config-manager')).toBeInTheDocument();
    });
    
    // Click export button
    fireEvent.click(screen.getByTestId('button-export'));
    
    // Check if exportConfiguration was called with current config
    expect(configService.exportConfiguration).toHaveBeenCalledWith(mockConfig);
  });

  it('imports configuration when import button is clicked', async () => {
    // Mock window.prompt
    const mockPrompt = vi.spyOn(window, 'prompt');
    mockPrompt.mockImplementation(() => JSON.stringify({
      ...mockConfig,
      displayName: 'Imported Display',
      brightness: 60
    }));
    
    render(<ConfigurationManager />);
    
    // Wait for config to load
    await waitFor(() => {
      expect(screen.getByTestId('config-manager')).toBeInTheDocument();
    });
    
    // Click import button
    fireEvent.click(screen.getByTestId('button-import'));
    
    // Check if importConfiguration was called with imported config
    await waitFor(() => {
      expect(configService.importConfiguration).toHaveBeenCalledWith({
        ...mockConfig,
        displayName: 'Imported Display',
        brightness: 60
      });
      expect(configService.getConfiguration).toHaveBeenCalledTimes(2); // Initial + after import
    });
    
    // Restore mock
    mockPrompt.mockRestore();
  });

  it('handles errors during configuration loading', async () => {
    // Mock error during config loading
    configService.getConfiguration.mockRejectedValue(new Error('Failed to load'));
    
    render(<ConfigurationManager />);
    
    // Wait for error to show
    await waitFor(() => {
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
  });

  it('handles errors during configuration saving', async () => {
    // Mock error during config saving
    configService.updateConfiguration.mockRejectedValue(new Error('Failed to save'));
    
    render(<ConfigurationManager />);
    
    // Wait for config to load
    await waitFor(() => {
      expect(screen.getByTestId('config-manager')).toBeInTheDocument();
    });
    
    // Change a value and save
    fireEvent.change(screen.getByTestId('input-displayName'), {
      target: { value: 'Updated Display Name' }
    });
    
    fireEvent.click(screen.getByTestId('button-save'));
    
    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to save configuration');
    });
  });

  it('disables save button when no changes are made', async () => {
    // Mock localStorage to return stringified config (simulating no changes)
    storageService.getItem.mockReturnValue(JSON.stringify(mockConfig));
    
    render(<ConfigurationManager />);
    
    // Wait for config to load
    await waitFor(() => {
      expect(screen.getByTestId('config-manager')).toBeInTheDocument();
    });
    
    // Save button should be disabled
    expect(screen.getByTestId('button-save')).toBeDisabled();
    
    // Change a value
    fireEvent.change(screen.getByTestId('input-displayName'), {
      target: { value: 'Changed Name' }
    });
    
    // Save button should be enabled
    expect(screen.getByTestId('button-save')).not.toBeDisabled();
  });

  it('updates multiple configuration values correctly', async () => {
    render(<ConfigurationManager />);
    
    // Wait for config to load
    await waitFor(() => {
      expect(screen.getByTestId('config-manager')).toBeInTheDocument();
    });
    
    // Change multiple values
    fireEvent.change(screen.getByTestId('input-displayName'), {
      target: { value: 'Multi-Update Display' }
    });
    
    fireEvent.change(screen.getByTestId('select-resolution'), {
      target: { value: '3840x2160' }
    });
    
    fireEvent.change(screen.getByTestId('range-brightness'), {
      target: { value: 65 }
    });
    
    fireEvent.click(screen.getByTestId('checkbox-autostart')); // Toggle off
    
    // Save changes
    fireEvent.click(screen.getByTestId('button-save'));
    
    // Check if updateConfiguration was called with all updated values
    await waitFor(() => {
      expect(configService.updateConfiguration).toHaveBeenCalledWith({
        ...mockConfig,
        displayName: 'Multi-Update Display',
        resolution: '3840x2160',
        brightness: 65,
        autostart: false
      });
    });
  });
}); 