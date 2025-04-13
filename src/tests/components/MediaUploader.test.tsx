import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { createSuccessQueryResponse, createErrorQueryResponse } from '../helpers/queryMockHelpers';
import reactQueryMock from '../../mocks/reactQuery';
import userEvent from '@testing-library/user-event';
import MediaUploader from '@/components/MediaUploader';

// Mock upload service
const uploadService = {
  uploadFile: vi.fn(),
  getUploadStatus: vi.fn(),
  cancelUpload: vi.fn(),
  getSupportedFileTypes: vi.fn()
};

vi.mock('../../services/uploadService', () => ({
  default: uploadService
}));

// Mock media processing service
const mediaService = {
  processMedia: vi.fn(),
  generateThumbnail: vi.fn(),
  validateMedia: vi.fn()
};

vi.mock('../../services/mediaService', () => ({
  default: mediaService
}));

describe('MediaUploader Component', () => {
  const mockSupportedTypes = ['jpg', 'png', 'mp4'];

  it('renders the uploader with supported file types', () => {
    const mockSupportedTypes = ['image/*', 'video/*'];
    render(
      <MediaUploader
        accept={mockSupportedTypes.join(',')}
        maxSize={100 * 1024 * 1024}
      />
    );

    expect(screen.getByTestId('file-input')).toBeInTheDocument();
    expect(screen.getByText(/Supported file types:/)).toBeInTheDocument();
    expect(screen.getByText(/image\/\*, video\/\*/)).toBeInTheDocument();
    
    const sizeText = screen.getAllByText(/100|MB/).map(el => el.textContent);
    expect(sizeText.join(' ')).toContain('100');
    expect(sizeText.join(' ')).toContain('MB');
  });

  it('uploads a file successfully', async () => {
    const onUpload = vi.fn();
    const onCancel = vi.fn();
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    render(
      <MediaUploader
        supportedTypes={mockSupportedTypes}
        onUpload={onUpload}
        onCancel={onCancel}
      />
    );

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText(/Uploading/)).toBeInTheDocument();
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it('shows validation errors for invalid files', () => {
    const onUpload = vi.fn();
    const onCancel = vi.fn();
    const file = new File(['x'.repeat(101 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' });

    render(
      <MediaUploader
        supportedTypes={mockSupportedTypes}
        onUpload={onUpload}
        onCancel={onCancel}
      />
    );

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByText(/File size exceeds/)).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('shows warning for unsupported file types', async () => {
    const onUpload = vi.fn();
    render(
      <MediaUploader
        accept="image/*"
        maxSize={100 * 1024 * 1024}
        onUpload={onUpload}
      />
    );

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });

    expect(screen.getByTestId('error-message')).toHaveTextContent('Unsupported file type');
    expect(onUpload).not.toHaveBeenCalled();
  });

  it('handles upload errors', async () => {
    const error = new Error('Upload failed');
    const onUpload = vi.fn().mockRejectedValue(error);
    const onCancel = vi.fn();
    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

    render(
      <MediaUploader
        supportedTypes={mockSupportedTypes}
        onUpload={onUpload}
        onCancel={onCancel}
      />
    );

    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText(/Upload failed/)).toBeInTheDocument();
  });

  it('cancels an in-progress upload', async () => {
    const onUpload = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(
      <MediaUploader
        accept="image/*"
        maxSize={100 * 1024 * 1024}
        onUpload={onUpload}
      />
    );

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const input = screen.getByTestId('file-input');
    fireEvent.change(input, { target: { files: [file] } });

    // Wait for upload to start
    await waitFor(() => {
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });

    const cancelButton = screen.getByTestId('cancel-button');
    fireEvent.click(cancelButton);

    // Wait for upload to be cancelled
    await waitFor(() => {
      expect(screen.queryByText('Uploading...')).not.toBeInTheDocument();
      expect(screen.queryByTestId('cancel-button')).not.toBeInTheDocument();
    });
  });
}); 