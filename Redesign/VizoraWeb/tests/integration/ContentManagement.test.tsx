import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '../utils/test-utils';
import ContentPage from '../mocks/ContentPage';
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

describe('Content Management Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and displays content items', async () => {
    render(<ContentPage />);

    // Wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Welcome Message')).toBeInTheDocument();
      expect(screen.getByText('Company Intro Video')).toBeInTheDocument();
    });

    // Verify content types
    const contentCards = screen.getAllByRole('article');
    
    // Find and verify the text item
    const textItem = contentCards.find(card => within(card).queryByText('Welcome Message'));
    expect(within(textItem!).getByText('Text')).toBeInTheDocument();
    
    // Find and verify the video item
    const videoItem = contentCards.find(card => within(card).queryByText('Company Intro Video'));
    expect(within(videoItem!).getByText('Video')).toBeInTheDocument();
  });

  it('allows filtering content by type', async () => {
    render(<ContentPage />);

    await waitFor(() => {
      expect(screen.getByText('Welcome Message')).toBeInTheDocument();
    });

    // Click video filter
    const videoButton = screen.getByRole('button', { name: 'Videos' });
    fireEvent.click(videoButton);
    
    await waitFor(() => {
      expect(screen.getByText('Company Intro Video')).toBeInTheDocument();
      expect(screen.queryByText('Welcome Message')).not.toBeInTheDocument();
    });
  });

  it('allows searching content', async () => {
    render(<ContentPage />);

    await waitFor(() => {
      expect(screen.getByText('Welcome Message')).toBeInTheDocument();
    });

    // Enter search term
    const searchInput = screen.getByPlaceholderText('Search content...');
    fireEvent.change(searchInput, { target: { value: 'video' } });

    await waitFor(() => {
      expect(screen.getByText('Company Intro Video')).toBeInTheDocument();
      expect(screen.queryByText('Welcome Message')).not.toBeInTheDocument();
    });
  });

  it('handles content deletion', async () => {
    render(<ContentPage />);

    await waitFor(() => {
      expect(screen.getByText('Welcome Message')).toBeInTheDocument();
    });

    // Find and click the delete button for the Welcome Message content
    const contentCards = screen.getAllByRole('article');
    const welcomeCard = contentCards.find(card => within(card).queryByText('Welcome Message'));
    
    const deleteButton = within(welcomeCard!).getByRole('button', { name: 'Delete' });
    fireEvent.click(deleteButton);

    // Confirm deletion in the modal
    const modal = screen.getByText('Confirm Deletion').closest('.modal');
    const confirmButton = within(modal!).getByRole('button', { name: 'Confirm' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Content deleted successfully');
    });
  });

  it('allows creating new content', async () => {
    render(<ContentPage />);

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    // Click add content button
    const addButton = screen.getByRole('button', { name: 'Add Content' });
    fireEvent.click(addButton);

    // Fill form in modal
    const modal = screen.getByText('Add New Content').closest('.modal');
    
    // Fill form fields
    const titleInput = within(modal!).getByLabelText(/title:/i);
    fireEvent.change(titleInput, { target: { value: 'New Content' } });
    
    const typeSelect = within(modal!).getByLabelText(/type:/i);
    fireEvent.change(typeSelect, { target: { value: 'image' } });
    
    const contentTextarea = within(modal!).getByLabelText(/content:/i);
    fireEvent.change(contentTextarea, { target: { value: 'https://example.com/image.jpg' } });
    
    const tagsInput = within(modal!).getByLabelText(/tags/i);
    fireEvent.change(tagsInput, { target: { value: 'new, test, image' } });
    
    // Submit form
    const submitButton = within(modal!).getByRole('button', { name: 'Create' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Content created successfully');
    });
  });
}); 