import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { contentService } from '../../services/contentService';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import reactQueryMock from '../../mocks/reactQuery';
import ContentForm from '../../components/ContentForm';

// Mock contentService and QueryClient
vi.mock('../../services/contentService', () => ({
  contentService: {
    createContent: vi.fn()
  }
}));

describe.skip('ContentForm Component', () => {
  const mockOnSubmit = vi.fn();
  const mockOnCancel = vi.fn();
  const mockInitialData = {
    title: 'Test Content',
    description: 'Test Description',
    type: 'image',
    url: 'http://example.com/test.jpg'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders form fields correctly', () => {
    render(<ContentForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/url/i)).toBeInTheDocument();
  });

  test('handles form submission correctly', async () => {
    render(<ContentForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'New Title' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'New Description' } });
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: 'video' } });
    fireEvent.change(screen.getByLabelText(/url/i), { target: { value: 'http://example.com/new.mp4' } });
    
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        title: 'New Title',
        description: 'New Description',
        type: 'video',
        url: 'http://example.com/new.mp4'
      });
    });
  });

  test('handles form cancellation correctly', () => {
    render(<ContentForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  test('displays error message when submission fails', async () => {
    const mockError = new Error('Failed to save content');
    mockOnSubmit.mockRejectedValueOnce(mockError);
    
    render(<ContentForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />);
    
    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'New Title' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));
    
    await waitFor(() => {
      expect(screen.getByText(mockError.message)).toBeInTheDocument();
    });
  });

  test('pre-fills form with initial data', () => {
    render(<ContentForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} initialData={mockInitialData} />);
    
    expect(screen.getByLabelText(/title/i)).toHaveValue(mockInitialData.title);
    expect(screen.getByLabelText(/description/i)).toHaveValue(mockInitialData.description);
    expect(screen.getByLabelText(/type/i)).toHaveValue(mockInitialData.type);
    expect(screen.getByLabelText(/url/i)).toHaveValue(mockInitialData.url);
  });
}); 