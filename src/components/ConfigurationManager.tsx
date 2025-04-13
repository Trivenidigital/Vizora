import React, { useState, useEffect, useMemo } from 'react';
import configService from '../services/configService';
import storageService from '../services/storageService';
import systemService from '../services/systemService';

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

const ConfigurationManager: React.FC = () => {
  const [config, setConfig] = useState<DisplayConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  const handleInputChange = (name: string, value: string | number | boolean) => {
    if (!config) return;

    let finalValue: string | number | boolean = value;
    
    // Handle numeric inputs
    if (name === 'brightness' || name === 'volume' || name === 'refreshRate' || name === 'cacheLimit') {
      const numValue = typeof value === 'string' ? parseInt(value, 10) : value;
      if (isNaN(numValue)) {
        return; // Don't update if not a valid number
      }
      finalValue = numValue;
    }

    setConfig(prev => ({
      ...prev!,
      [name]: finalValue
    }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!config) return;
    
    const { name, value } = e.target;
    let finalValue: string | number = value;

    // Handle numeric selects
    if (name === 'refreshRate') {
      finalValue = parseInt(value, 10);
    }

    setConfig(prev => ({
      ...prev!,
      [name]: finalValue
    }));
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const configData = event.target?.result as string;
        handleImport(configData);
      } catch (err) {
        setError('Failed to parse configuration file');
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  // Detect if config has been modified
  const isModified = useMemo(() => {
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
      
      {error && <div data-testid="error-message" className="text-red-600">{error}</div>}
      {saveSuccess && <div data-testid="success-message" className="text-green-600">Configuration saved successfully</div>}
      
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <div>
          <label htmlFor="displayName">Display Name:</label>
          <input
            id="displayName"
            type="text"
            value={config.displayName}
            onChange={(e) => handleInputChange('displayName', e.target.value)}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            data-testid="select-orientation"
          >
            <option value="landscape">Landscape</option>
            <option value="portrait">Portrait</option>
          </select>
        </div>

        <div>
          <label htmlFor="brightness">Brightness:</label>
          <input
            id="brightness"
            type="range"
            min="0"
            max="100"
            value={config.brightness}
            onChange={(e) => handleInputChange('brightness', parseInt(e.target.value, 10))}
            className="block w-full"
            data-testid="range-brightness"
          />
          <span data-testid="brightness-value">{config.brightness}%</span>
        </div>

        <div>
          <label htmlFor="volume">Volume:</label>
          <input
            id="volume"
            type="range"
            min="0"
            max="100"
            value={config.volume}
            onChange={(e) => handleInputChange('volume', parseInt(e.target.value, 10))}
            className="block w-full"
            data-testid="range-volume"
          />
          <span data-testid="volume-value">{config.volume}%</span>
        </div>

        <div>
          <label htmlFor="refreshRate">Refresh Rate:</label>
          <select
            id="refreshRate"
            name="refreshRate"
            value={config.refreshRate}
            onChange={handleSelectChange}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            data-testid="select-refreshRate"
          >
            <option value="30">30 Hz</option>
            <option value="60">60 Hz</option>
            <option value="120">120 Hz</option>
            <option value="144">144 Hz</option>
          </select>
        </div>

        <div>
          <label htmlFor="autostart">Auto-start:</label>
          <input
            type="checkbox"
            id="autostart"
            name="autostart"
            checked={config.autostart}
            onChange={(e) => handleInputChange('autostart', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
            id="cacheLimit"
            type="number"
            min="0"
            value={config.cacheLimit}
            onChange={(e) => handleInputChange('cacheLimit', parseInt(e.target.value, 10))}
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            data-testid="select-offlineMode"
          >
            <option value="disabled">Disabled</option>
            <option value="basic">Basic (Show last content)</option>
            <option value="advanced">Advanced (Full offline schedule)</option>
          </select>
        </div>

        <div className="mt-4 flex space-x-4">
          <button
            type="submit"
            disabled={isSaving || !isModified}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
            data-testid="save-button"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            data-testid="reset-button"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            data-testid="export-button"
          >
            Export
          </button>

          <label className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 cursor-pointer">
            Import
            <input
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
              data-testid="import-input"
            />
          </label>
        </div>
      </form>
    </div>
  );
};

export default ConfigurationManager; 