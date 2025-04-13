import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContentDisplayActions } from '../ContentDisplayActions';

describe('ContentDisplayActions', () => {
  const mockDisplays = [
    { id: '1', name: 'Display 1', status: 'online' as const },
    { id: '2', name: 'Display 2', status: 'offline' as const },
  ];

  const mockOnPush = jest.fn();
  const mockOnSchedule = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders display selection interface', async () => {
    render(
      <ContentDisplayActions
        displays={mockDisplays}
        onPush={mockOnPush}
        onSchedule={mockOnSchedule}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Displays')).toBeInTheDocument();
      expect(screen.getByText('Display 1')).toBeInTheDocument();
      expect(screen.getByText('Display 2')).toBeInTheDocument();
    });
  });

  it('switches between push and schedule modes', async () => {
    render(
      <ContentDisplayActions
        displays={mockDisplays}
        onPush={mockOnPush}
        onSchedule={mockOnSchedule}
        onCancel={mockOnCancel}
      />
    );

    const scheduleButton = screen.getByText('Schedule');
    fireEvent.click(scheduleButton);

    await waitFor(() => {
      expect(screen.getByText('Schedule Content')).toBeInTheDocument();
      expect(screen.getByLabelText('Start Time')).toBeInTheDocument();
      expect(screen.getByLabelText('End Time')).toBeInTheDocument();
      expect(screen.getByLabelText('Timezone')).toBeInTheDocument();
    });
  });

  it('checks for schedule conflicts', async () => {
    render(
      <ContentDisplayActions
        displays={mockDisplays}
        onPush={mockOnPush}
        onSchedule={mockOnSchedule}
        onCancel={mockOnCancel}
      />
    );

    // Switch to schedule mode
    const scheduleButton = screen.getByText('Schedule');
    fireEvent.click(scheduleButton);

    // Fill in schedule details
    const startTimeInput = screen.getByLabelText('Start Time');
    const endTimeInput = screen.getByLabelText('End Time');
    const timezoneSelect = screen.getByLabelText('Timezone');

    fireEvent.change(startTimeInput, { target: { value: '2024-04-02T10:00' } });
    fireEvent.change(endTimeInput, { target: { value: '2024-04-02T11:00' } });
    fireEvent.change(timezoneSelect, { target: { value: 'America/New_York' } });

    // Select a display
    const display1Checkbox = screen.getByLabelText('Display 1');
    fireEvent.click(display1Checkbox);

    // Click schedule button
    const scheduleContentButton = screen.getByText('Schedule Content');
    fireEvent.click(scheduleContentButton);

    expect(mockOnSchedule).toHaveBeenCalledWith(
      ['1'],
      expect.objectContaining({
        startTime: '2024-04-02T10:00',
        endTime: '2024-04-02T11:00',
        timezone: 'America/New_York',
        repeat: 'none',
      })
    );
  });
}); 