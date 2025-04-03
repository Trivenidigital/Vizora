import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import SchedulePage from '../../src/pages/schedules/SchedulePage';
import * as scheduleService from '../../src/services/scheduleService';
import toast from 'react-hot-toast';

// Mock services
vi.mock('../../src/services/scheduleService');
vi.mock('react-hot-toast');

const mockSchedules = [
  {
    _id: 'sched-001',
    name: 'Business Hours',
    displayId: 'disp-001',
    contentId: 'content-001',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    startTime: '09:00',
    endTime: '17:00',
    daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    repeat: 'weekly',
    priority: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    _id: 'sched-002',
    name: 'Weekend Special',
    displayId: 'disp-002',
    contentId: 'content-002',
    startDate: '2024-01-01',
    endDate: '2024-12-31',
    startTime: '10:00',
    endTime: '18:00',
    daysOfWeek: ['saturday', 'sunday'],
    repeat: 'weekly',
    priority: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

describe('Schedule Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (scheduleService.getSchedules as any).mockResolvedValue(mockSchedules);
  });

  it('loads and displays schedule list', async () => {
    render(<SchedulePage />);

    // Wait for schedules to load
    await waitFor(() => {
      expect(screen.getByText('Business Hours')).toBeInTheDocument();
      expect(screen.getByText('Weekend Special')).toBeInTheDocument();
    });

    // Verify schedule details are shown
    expect(screen.getByText('09:00 - 17:00')).toBeInTheDocument();
    expect(screen.getByText('10:00 - 18:00')).toBeInTheDocument();
  });

  it('allows filtering schedules by display', async () => {
    render(<SchedulePage />);

    await waitFor(() => {
      expect(screen.getByText('Business Hours')).toBeInTheDocument();
    });

    // Select display filter
    const displaySelect = screen.getByLabelText(/display/i);
    fireEvent.change(displaySelect, { target: { value: 'disp-001' } });
    
    await waitFor(() => {
      expect(screen.getByText('Business Hours')).toBeInTheDocument();
      expect(screen.queryByText('Weekend Special')).not.toBeInTheDocument();
    });
  });

  it('allows creating a new schedule', async () => {
    const mockNewSchedule = {
      name: 'Evening Hours',
      displayId: 'disp-001',
      contentId: 'content-003',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      startTime: '18:00',
      endTime: '22:00',
      daysOfWeek: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      repeat: 'weekly',
      priority: 3,
    };
    (scheduleService.createSchedule as any).mockResolvedValue({ ...mockNewSchedule, _id: 'sched-003' });
    
    render(<SchedulePage />);

    // Click add schedule button
    const addButton = screen.getByRole('button', { name: /add schedule/i });
    fireEvent.click(addButton);

    // Fill in schedule details
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Evening Hours' } });
    fireEvent.change(screen.getByLabelText(/display/i), { target: { value: 'disp-001' } });
    fireEvent.change(screen.getByLabelText(/content/i), { target: { value: 'content-003' } });
    fireEvent.change(screen.getByLabelText(/start date/i), { target: { value: '2024-01-01' } });
    fireEvent.change(screen.getByLabelText(/end date/i), { target: { value: '2024-12-31' } });
    fireEvent.change(screen.getByLabelText(/start time/i), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText(/end time/i), { target: { value: '22:00' } });
    
    // Select days of week
    const mondayCheckbox = screen.getByLabelText(/monday/i);
    const tuesdayCheckbox = screen.getByLabelText(/tuesday/i);
    const wednesdayCheckbox = screen.getByLabelText(/wednesday/i);
    const thursdayCheckbox = screen.getByLabelText(/thursday/i);
    const fridayCheckbox = screen.getByLabelText(/friday/i);
    
    fireEvent.click(mondayCheckbox);
    fireEvent.click(tuesdayCheckbox);
    fireEvent.click(wednesdayCheckbox);
    fireEvent.click(thursdayCheckbox);
    fireEvent.click(fridayCheckbox);

    // Select repeat option
    fireEvent.change(screen.getByLabelText(/repeat/i), { target: { value: 'weekly' } });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(scheduleService.createSchedule).toHaveBeenCalledWith(mockNewSchedule);
      expect(toast.success).toHaveBeenCalledWith('Schedule created successfully');
    });
  });

  it('handles schedule deletion', async () => {
    (scheduleService.deleteSchedule as any).mockResolvedValue(undefined);
    
    render(<SchedulePage />);

    await waitFor(() => {
      expect(screen.getByText('Business Hours')).toBeInTheDocument();
    });

    // Click delete button for first schedule
    const deleteButton = screen.getAllByRole('button', { name: /delete/i })[0];
    fireEvent.click(deleteButton);

    // Confirm deletion
    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(scheduleService.deleteSchedule).toHaveBeenCalledWith('sched-001');
      expect(toast.success).toHaveBeenCalledWith('Schedule deleted successfully');
    });
  });

  it('handles schedule updates', async () => {
    const mockUpdate = {
      name: 'Updated Business Hours',
      endTime: '18:00',
    };
    (scheduleService.updateSchedule as any).mockResolvedValue({
      ...mockSchedules[0],
      ...mockUpdate,
    });
    
    render(<SchedulePage />);

    await waitFor(() => {
      expect(screen.getByText('Business Hours')).toBeInTheDocument();
    });

    // Click edit button for first schedule
    const editButton = screen.getAllByRole('button', { name: /edit/i })[0];
    fireEvent.click(editButton);

    // Update schedule details
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Updated Business Hours' } });
    fireEvent.change(screen.getByLabelText(/end time/i), { target: { value: '18:00' } });

    // Submit form
    const submitButton = screen.getByRole('button', { name: /update/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(scheduleService.updateSchedule).toHaveBeenCalledWith('sched-001', mockUpdate);
      expect(toast.success).toHaveBeenCalledWith('Schedule updated successfully');
    });
  });

  it('handles errors gracefully', async () => {
    const error = new Error('API Error');
    (scheduleService.getSchedules as any).mockRejectedValue(error);
    
    render(<SchedulePage />);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Failed to load schedules');
    });
  });
}); 