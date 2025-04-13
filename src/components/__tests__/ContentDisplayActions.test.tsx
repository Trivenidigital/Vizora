import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ContentDisplayActions from '../ContentDisplayActions';
import displayService from '../../services/displayService';
import { Display } from '../../types/display';

// Mock the display service
vi.mock('../../services/displayService', () => ({
  default: {
    getDisplays: vi.fn(),
    checkScheduleConflicts: vi.fn(),
    pushContentToDisplays: vi.fn(),
    scheduleContentForDisplays: vi.fn()
  }
}));

describe('ContentDisplayActions', () => {
  const mockDisplays: Display[] = [
    {
      id: 'display1',
      name: 'Display 1',
      description: 'Test display 1',
      location: 'Location 1',
      status: 'online',
      lastSeen: '2024-01-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      owner: 'user1'
    },
    {
      id: 'display2',
      name: 'Display 2',
      description: 'Test display 2',
      location: 'Location 2',
      status: 'offline',
      lastSeen: '2024-01-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      owner: 'user1'
    }
  ];

  const mockContentId = 'content1';
  const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (displayService.getDisplays as ReturnType<typeof vi.fn>).mockResolvedValue(mockDisplays);
  });

  it('renders display selection interface', async () => {
    render(
      <ContentDisplayActions
        contentId={mockContentId}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Select Displays')).toBeInTheDocument();
      expect(screen.getByText('Display 1')).toBeInTheDocument();
      expect(screen.getByText('Display 2')).toBeInTheDocument();
    });
  });

  it('handles display selection', async () => {
    render(
      <ContentDisplayActions
        contentId={mockContentId}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Display 1')).toBeInTheDocument();
    });

    const display1Checkbox = screen.getByLabelText('Display 1');
    await userEvent.click(display1Checkbox);

    expect(display1Checkbox).toBeChecked();
  });

  it('handles multiple display selection', async () => {
    render(
      <ContentDisplayActions
        contentId={mockContentId}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Display 1')).toBeInTheDocument();
      expect(screen.getByText('Display 2')).toBeInTheDocument();
    });

    const display1Checkbox = screen.getByLabelText('Display 1');
    const display2Checkbox = screen.getByLabelText('Display 2');

    await userEvent.click(display1Checkbox);
    await userEvent.click(display2Checkbox);

    expect(display1Checkbox).toBeChecked();
    expect(display2Checkbox).toBeChecked();
  });

  it('switches between push and schedule modes', async () => {
    render(
      <ContentDisplayActions
        contentId={mockContentId}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Display 1')).toBeInTheDocument();
    });

    // Select a display first
    const display1Checkbox = screen.getByLabelText('Display 1');
    await userEvent.click(display1Checkbox);

    // Switch to schedule mode
    const scheduleButton = screen.getByTestId('schedule-button');
    await userEvent.click(scheduleButton);

    expect(screen.getByText('Schedule Content')).toBeInTheDocument();
    expect(screen.getByLabelText('Start Time')).toBeInTheDocument();
    expect(screen.getByLabelText('End Time')).toBeInTheDocument();
    expect(screen.getByLabelText('Timezone')).toBeInTheDocument();
    expect(screen.getByLabelText('Repeat')).toBeInTheDocument();
  });

  it('checks for schedule conflicts', async () => {
    const mockConflicts = [
      {
        id: 'schedule1',
        displayId: 'display1',
        contentId: 'content1',
        startTime: '2024-01-01T10:00:00Z',
        endTime: '2024-01-01T11:00:00Z',
        repeat: 'none',
        timezone: 'UTC',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        owner: 'user1'
      }
    ];

    (displayService.checkScheduleConflicts as ReturnType<typeof vi.fn>).mockResolvedValue(mockConflicts);

    render(
      <ContentDisplayActions
        contentId={mockContentId}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Display 1')).toBeInTheDocument();
    });

    // Select a display and switch to schedule mode
    const display1Checkbox = screen.getByLabelText('Display 1');
    await userEvent.click(display1Checkbox);
    const scheduleButton = screen.getByTestId('schedule-button');
    await userEvent.click(scheduleButton);

    // Set schedule times
    const startTimeInput = screen.getByLabelText('Start Time');
    const endTimeInput = screen.getByLabelText('End Time');

    await userEvent.type(startTimeInput, '2024-01-01T10:00');
    await userEvent.type(endTimeInput, '2024-01-01T11:00');

    await waitFor(() => {
      expect(screen.getByText('Schedule Conflicts')).toBeInTheDocument();
    });
  });

  it('handles content push', async () => {
    (displayService.pushContentToDisplays as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(
      <ContentDisplayActions
        contentId={mockContentId}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Display 1')).toBeInTheDocument();
    });

    // Select a display
    const display1Checkbox = screen.getByLabelText('Display 1');
    await userEvent.click(display1Checkbox);

    // Push content
    const pushButton = screen.getByTestId('push-submit-button');
    await userEvent.click(pushButton);

    expect(displayService.pushContentToDisplays).toHaveBeenCalledWith(
      mockContentId,
      ['display1']
    );
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('handles content scheduling', async () => {
    (displayService.scheduleContentForDisplays as ReturnType<typeof vi.fn>).mockResolvedValue({});

    render(
      <ContentDisplayActions
        contentId={mockContentId}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Display 1')).toBeInTheDocument();
    });

    // Select a display and switch to schedule mode
    const display1Checkbox = screen.getByLabelText('Display 1');
    await userEvent.click(display1Checkbox);
    const scheduleButton = screen.getByTestId('schedule-button');
    await userEvent.click(scheduleButton);

    // Set schedule times
    const startTimeInput = screen.getByLabelText('Start Time');
    const endTimeInput = screen.getByLabelText('End Time');
    const repeatSelect = screen.getByLabelText('Repeat');
    const timezoneSelect = screen.getByLabelText('Timezone');

    await userEvent.type(startTimeInput, '2024-01-01T10:00');
    await userEvent.type(endTimeInput, '2024-01-01T11:00');
    await userEvent.selectOptions(repeatSelect, 'daily');
    await userEvent.selectOptions(timezoneSelect, 'UTC');

    // Schedule content
    await waitFor(() => {
      expect(screen.getByTestId('schedule-submit-button')).toBeInTheDocument();
    });
    const scheduleButton2 = screen.getByTestId('schedule-submit-button');
    await userEvent.click(scheduleButton2);

    expect(displayService.scheduleContentForDisplays).toHaveBeenCalledWith(
      mockContentId,
      ['display1'],
      expect.objectContaining({
        startTime: expect.any(String),
        endTime: expect.any(String),
        repeat: 'daily',
        timezone: 'UTC'
      })
    );
    expect(mockOnComplete).toHaveBeenCalled();
  });

  it('handles errors when pushing content', async () => {
    const errorMessage = 'Failed to push content';
    (displayService.pushContentToDisplays as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(errorMessage));

    render(
      <ContentDisplayActions
        contentId={mockContentId}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Display 1')).toBeInTheDocument();
    });

    // Select a display
    const display1Checkbox = screen.getByLabelText('Display 1');
    await userEvent.click(display1Checkbox);

    // Push content
    const pushButton = screen.getByTestId('push-submit-button');
    await userEvent.click(pushButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  it('handles errors when scheduling content', async () => {
    const errorMessage = 'Failed to schedule content';
    (displayService.scheduleContentForDisplays as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(errorMessage));

    render(
      <ContentDisplayActions
        contentId={mockContentId}
        onComplete={mockOnComplete}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Display 1')).toBeInTheDocument();
    });

    // Select a display and switch to schedule mode
    const display1Checkbox = screen.getByLabelText('Display 1');
    await userEvent.click(display1Checkbox);
    const scheduleButton = screen.getByTestId('schedule-button');
    await userEvent.click(scheduleButton);

    // Set schedule times
    const startTimeInput = screen.getByLabelText('Start Time');
    const endTimeInput = screen.getByLabelText('End Time');

    await userEvent.type(startTimeInput, '2024-01-01T10:00');
    await userEvent.type(endTimeInput, '2024-01-01T11:00');

    // Schedule content
    await waitFor(() => {
      expect(screen.getByTestId('schedule-submit-button')).toBeInTheDocument();
    });
    const scheduleButton2 = screen.getByTestId('schedule-submit-button');
    await userEvent.click(scheduleButton2);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
}); 