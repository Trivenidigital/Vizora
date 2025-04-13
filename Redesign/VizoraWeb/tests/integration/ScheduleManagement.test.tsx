import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '../utils/test-utils';
import SchedulePage from '../mocks/SchedulePage';
import toast from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
  success: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(),
  dismiss: vi.fn(),
}));

describe('Schedule Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const displaySelect = screen.getByLabelText(/display:/i);
    fireEvent.change(displaySelect, { target: { value: 'disp-001' } });
    
    await waitFor(() => {
      expect(screen.getByText('Business Hours')).toBeInTheDocument();
      expect(screen.queryByText('Weekend Special')).not.toBeInTheDocument();
    });
  });

  it('allows creating a new schedule', async () => {
    render(<SchedulePage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Click add schedule button
    const addButton = screen.getByRole('button', { name: /add schedule/i });
    fireEvent.click(addButton);

    // Fill in schedule details in the modal
    const modal = screen.getByText('Create New Schedule').closest('.modal');
    expect(modal).toBeInTheDocument();

    // Fill form fields within modal
    const nameInput = within(modal!).getByLabelText(/name:/i);
    fireEvent.change(nameInput, { target: { value: 'Evening Hours' } });
    
    const displaySelect = within(modal!).getByLabelText(/display:/i);
    fireEvent.change(displaySelect, { target: { value: 'disp-001' } });
    
    const contentSelect = within(modal!).getByLabelText(/content:/i);
    fireEvent.change(contentSelect, { target: { value: 'content-003' } });
    
    const startDateInput = within(modal!).getByLabelText(/start date:/i);
    fireEvent.change(startDateInput, { target: { value: '2024-01-01' } });
    
    const endDateInput = within(modal!).getByLabelText(/end date:/i);
    fireEvent.change(endDateInput, { target: { value: '2024-12-31' } });
    
    const startTimeInput = within(modal!).getByLabelText(/start time:/i);
    fireEvent.change(startTimeInput, { target: { value: '18:00' } });
    
    const endTimeInput = within(modal!).getByLabelText(/end time:/i);
    fireEvent.change(endTimeInput, { target: { value: '22:00' } });
    
    // Select days of week
    const mondayCheckbox = within(modal!).getByLabelText(/monday/i);
    const tuesdayCheckbox = within(modal!).getByLabelText(/tuesday/i);
    const wednesdayCheckbox = within(modal!).getByLabelText(/wednesday/i);
    const thursdayCheckbox = within(modal!).getByLabelText(/thursday/i);
    const fridayCheckbox = within(modal!).getByLabelText(/friday/i);
    
    fireEvent.click(mondayCheckbox);
    fireEvent.click(tuesdayCheckbox);
    fireEvent.click(wednesdayCheckbox);
    fireEvent.click(thursdayCheckbox);
    fireEvent.click(fridayCheckbox);

    // Submit form
    const submitButton = within(modal!).getByRole('button', { name: /create/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Schedule created successfully');
    });
  });

  it('handles schedule deletion', async () => {
    render(<SchedulePage />);

    await waitFor(() => {
      expect(screen.getByText('Business Hours')).toBeInTheDocument();
    });

    // Find and click delete button for Business Hours schedule
    const scheduleCards = screen.getAllByRole('heading', { level: 3 });
    const businessHoursCard = scheduleCards[0].closest('.schedule-card');
    
    const deleteButton = within(businessHoursCard!).getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    // Confirm deletion in the modal
    const modal = screen.getByText('Confirm Deletion').closest('.modal');
    const confirmButton = within(modal!).getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Schedule deleted successfully');
    });
  });

  it('handles schedule updates', async () => {
    render(<SchedulePage />);

    await waitFor(() => {
      expect(screen.getByText('Business Hours')).toBeInTheDocument();
    });

    // Find and click edit button for Business Hours schedule
    const scheduleCards = screen.getAllByRole('heading', { level: 3 });
    const businessHoursCard = scheduleCards[0].closest('.schedule-card');
    
    const editButton = within(businessHoursCard!).getByRole('button', { name: /edit/i });
    fireEvent.click(editButton);

    // Update schedule details in the modal
    const modal = screen.getByText('Edit Schedule').closest('.modal');
    
    const nameInput = within(modal!).getByLabelText(/name:/i);
    fireEvent.change(nameInput, { target: { value: 'Updated Business Hours' } });
    
    const endTimeInput = within(modal!).getByLabelText(/end time:/i);
    fireEvent.change(endTimeInput, { target: { value: '18:00' } });

    // Submit form
    const submitButton = within(modal!).getByRole('button', { name: /update/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Schedule updated successfully');
    });
  });
}); 