import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeviceSettingsForm } from '../DeviceSettingsForm';
import { useSocket } from '../../hooks/useSocket';
import { useAuth } from '../../hooks/useAuth';

// Mock the hooks
jest.mock('../../hooks/useSocket');
jest.mock('../../hooks/useAuth');

const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

const mockInitialSettings = {
  name: 'Test Display',
  location: 'Test Location',
  resolution: '1920x1080',
  playbackMode: 'scheduled',
  groupId: 'group1',
  settings: {
    brightness: 80,
    volume: 70,
    autoplay: true,
    contentFit: 'contain',
    rotation: 0,
  },
};

describe('DeviceSettingsForm', () => {
  beforeEach(() => {
    (useSocket as jest.Mock).mockReturnValue(mockSocket);
    (useAuth as jest.Mock).mockReturnValue({
      user: {
        role: 'admin',
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders with initial settings', () => {
    render(
      <DeviceSettingsForm
        displayId="test-display"
        initialSettings={mockInitialSettings}
      />
    );

    expect(screen.getByLabelText(/display name/i)).toHaveValue('Test Display');
    expect(screen.getByLabelText(/location/i)).toHaveValue('Test Location');
    expect(screen.getByLabelText(/resolution/i)).toHaveValue('1920x1080');
    expect(screen.getByLabelText(/playback mode/i)).toHaveValue('scheduled');
    expect(screen.getByLabelText(/brightness/i)).toHaveValue(80);
    expect(screen.getByLabelText(/volume/i)).toHaveValue(70);
    expect(screen.getByLabelText(/autoplay/i)).toBeChecked();
  });

  it('updates form values on real-time updates', async () => {
    render(
      <DeviceSettingsForm
        displayId="test-display"
        initialSettings={mockInitialSettings}
      />
    );

    // Simulate real-time update
    const updateCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'display:settings:update'
    )[1];
    updateCallback({
      displayId: 'test-display',
      settings: {
        ...mockInitialSettings,
        name: 'Updated Display',
        brightness: 90,
      },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/display name/i)).toHaveValue('Updated Display');
      expect(screen.getByLabelText(/brightness/i)).toHaveValue(90);
    });
  });

  it('validates form inputs', async () => {
    render(
      <DeviceSettingsForm
        displayId="test-display"
        initialSettings={mockInitialSettings}
      />
    );

    // Clear required field
    const nameInput = screen.getByLabelText(/display name/i);
    fireEvent.change(nameInput, { target: { value: '' } });
    fireEvent.blur(nameInput);

    // Submit form
    fireEvent.click(screen.getByText(/save changes/i));

    await waitFor(() => {
      expect(screen.getByText(/display name is required/i)).toBeInTheDocument();
    });
  });

  it('emits socket events on form submission', async () => {
    const onSave = jest.fn();
    render(
      <DeviceSettingsForm
        displayId="test-display"
        initialSettings={mockInitialSettings}
        onSave={onSave}
      />
    );

    // Update some values
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: 'New Display Name' },
    });

    // Submit form
    fireEvent.click(screen.getByText(/save changes/i));

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'display:settings:update',
        expect.objectContaining({
          displayId: 'test-display',
          settings: expect.objectContaining({
            name: 'New Display Name',
          }),
        })
      );
      expect(onSave).toHaveBeenCalled();
    });
  });

  it('shows health status and metrics', async () => {
    const mockHealth = {
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      metrics: {
        uptime: '24h',
        memory: '75%',
        cpu: '45%',
      },
      issues: [],
    };

    // Simulate health update
    const healthCallback = mockSocket.on.mock.calls.find(
      call => call[0] === 'display:health:update'
    )[1];
    healthCallback({
      displayId: 'test-display',
      health: mockHealth,
    });

    render(
      <DeviceSettingsForm
        displayId="test-display"
        initialSettings={mockInitialSettings}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/healthy/i)).toBeInTheDocument();
      expect(screen.getByText(/24h/i)).toBeInTheDocument();
      expect(screen.getByText(/75%/i)).toBeInTheDocument();
      expect(screen.getByText(/45%/i)).toBeInTheDocument();
    });
  });

  it('handles group assignment for admin users', async () => {
    render(
      <DeviceSettingsForm
        displayId="test-display"
        initialSettings={mockInitialSettings}
      />
    );

    const groupSelect = screen.getByLabelText(/group/i);
    fireEvent.change(groupSelect, { target: { value: 'group2' } });

    fireEvent.click(screen.getByText(/save changes/i));

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'display:settings:update',
        expect.objectContaining({
          displayId: 'test-display',
          settings: expect.objectContaining({
            groupId: 'group2',
          }),
        })
      );
    });
  });
}); 