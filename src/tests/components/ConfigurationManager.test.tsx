import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfigurationManager from '../../components/ConfigurationManager';
import configService from '../../services/configService';
import storageService from '../../services/storageService';
import systemService from '../../services/systemService';

// Mock services
vi.mock('../../services/configService');
vi.mock('../../services/storageService');
vi.mock('../../services/systemService');

describe.skip('ConfigurationManager Component', () => {
  const mockConfig = {
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
    (configService.getConfiguration as jest.Mock).mockResolvedValue(mockConfig);
    (storageService.getItem as jest.Mock).mockReturnValue(null);
    (configService.updateConfiguration as jest.Mock).mockResolvedValue(undefined);
    (configService.resetConfiguration as jest.Mock).mockResolvedValue(mockConfig);
    (configService.exportConfiguration as jest.Mock).mockResolvedValue(undefined);
    (configService.importConfiguration as jest.Mock).mockResolvedValue(undefined);
  });

  it('displays loading state initially', () => {
    render(<ConfigurationManager />);
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('displays error state when config fails to load', async () => {
    (configService.getConfiguration as jest.Mock).mockRejectedValueOnce(new Error('Failed to load'));
    render(<ConfigurationManager />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('error')).toBeInTheDocument();
    });
  });

  it('displays configuration form after loading', async () => {
    render(<ConfigurationManager />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
      expect(screen.getByTestId('config-manager')).toBeInTheDocument();
      expect(screen.getByTestId('input-displayName')).toHaveValue('Test Display');
    });
  });

  it('updates configuration values and shows success message', async () => {
    const user = userEvent.setup();
    render(<ConfigurationManager />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    const displayNameInput = screen.getByTestId('input-displayName');
    await user.clear(displayNameInput);
    await user.type(displayNameInput, 'New Display Name');

    const form = screen.getByRole('form');
    await user.click(screen.getByTestId('save-button'));

    await waitFor(() => {
      expect(configService.updateConfiguration).toHaveBeenCalledWith(expect.objectContaining({
        displayName: 'New Display Name'
      }));
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
      expect(screen.getByTestId('success-message')).toHaveTextContent('Configuration saved successfully');
    });
  });

  it('handles save errors correctly', async () => {
    const user = userEvent.setup();
    (configService.updateConfiguration as jest.Mock).mockRejectedValueOnce(new Error('Failed to save'));

    render(<ConfigurationManager />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    await user.click(screen.getByTestId('save-button'));

    await waitFor(() => {
      expect(screen.getByTestId('error-message')).toBeInTheDocument();
      expect(screen.getByTestId('error-message')).toHaveTextContent('Failed to save configuration');
    });
  });

  it('handles reset to defaults correctly', async () => {
    const user = userEvent.setup();
    const defaultConfig = { ...mockConfig, displayName: 'Default Display' };
    (configService.resetConfiguration as jest.Mock).mockResolvedValue(defaultConfig);

    render(<ConfigurationManager />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    await user.click(screen.getByTestId('reset-button'));

    await waitFor(() => {
      expect(configService.resetConfiguration).toHaveBeenCalled();
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
      expect(screen.getByTestId('input-displayName')).toHaveValue('Default Display');
    });
  });

  it('handles import/export correctly', async () => {
    const user = userEvent.setup();
    render(<ConfigurationManager />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    // Test export
    await user.click(screen.getByTestId('export-button'));
    expect(configService.exportConfiguration).toHaveBeenCalledWith(mockConfig);

    // Test import
    const file = new File(['{}'], 'config.json', { type: 'application/json' });
    const input = screen.getByTestId('import-input');
    await user.upload(input, file);

    await waitFor(() => {
      expect(configService.importConfiguration).toHaveBeenCalled();
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });
  });

  it('handles select changes correctly', async () => {
    const user = userEvent.setup();
    render(<ConfigurationManager />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    const orientationSelect = screen.getByTestId('select-orientation');
    await user.selectOptions(orientationSelect, 'portrait');

    await user.click(screen.getByTestId('save-button'));

    await waitFor(() => {
      expect(configService.updateConfiguration).toHaveBeenCalledWith(expect.objectContaining({
        orientation: 'portrait'
      }));
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });
  });

  it('handles range input changes correctly', async () => {
    const user = userEvent.setup();
    render(<ConfigurationManager />);
    
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    const brightnessInput = screen.getByTestId('range-brightness');
    await user.type(brightnessInput, '90');

    await user.click(screen.getByTestId('save-button'));

    await waitFor(() => {
      expect(configService.updateConfiguration).toHaveBeenCalledWith(expect.objectContaining({
        brightness: 90
      }));
      expect(screen.getByTestId('success-message')).toBeInTheDocument();
    });
  });
}); 