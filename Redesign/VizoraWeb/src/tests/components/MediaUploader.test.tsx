import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../test/test-utils';
import { createSuccessQueryResponse, createErrorQueryResponse } from '../helpers/queryMockHelpers';
import reactQueryMock from '../../mocks/reactQuery';

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

// Create a mock component for testing
const MediaUploader = () => {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [isUploading, setIsUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const [uploadId, setUploadId] = React.useState<string | null>(null);
  const [supportedTypes, setSupportedTypes] = React.useState<string[]>([]);
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);

  // Load supported file types
  React.useEffect(() => {
    const loadSupportedTypes = async () => {
      try {
        const types = await uploadService.getSupportedFileTypes();
        setSupportedTypes(types);
      } catch (error) {
        console.error('Failed to load supported file types', error);
      }
    };
    
    loadSupportedTypes();
  }, []);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    setSelectedFile(file);
    setUploadError(null);
    
    // Validate file before upload
    try {
      const validationResult = await mediaService.validateMedia(file);
      
      if (!validationResult.valid) {
        setValidationErrors(validationResult.errors || []);
        return;
      } else {
        setValidationErrors([]);
      }
    } catch (error) {
      setUploadError('Validation failed');
      console.error('Validation error', error);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    try {
      setIsUploading(true);
      setUploadProgress(0);
      setUploadError(null);
      
      // Start upload and get upload ID
      const { id, uploadUrl } = await uploadService.uploadFile(selectedFile, {
        onProgress: (progress: number) => {
          setUploadProgress(progress);
        }
      });
      
      setUploadId(id);
      
      // Process media (like generating thumbnails, transcoding, etc.)
      await mediaService.processMedia(id);
      
      // Reset form after successful upload
      setSelectedFile(null);
      setUploadProgress(100);
      
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
    } catch (error) {
      setUploadError('Upload failed');
      console.error('Upload error', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = async () => {
    if (uploadId) {
      try {
        await uploadService.cancelUpload(uploadId);
        setIsUploading(false);
        setUploadProgress(0);
        setUploadId(null);
      } catch (error) {
        console.error('Cancel error', error);
      }
    }
  };

  const isFileTypeSupported = (file: File) => {
    const fileType = file.type;
    return supportedTypes.some(type => fileType.includes(type));
  };

  return (
    <div data-testid="media-uploader">
      <h2>Upload Media</h2>
      
      {uploadError && (
        <div className="error" data-testid="upload-error">{uploadError}</div>
      )}
      
      {validationErrors.length > 0 && (
        <div className="validation-errors" data-testid="validation-errors">
          <ul>
            {validationErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="upload-form">
        <div className="file-input-container">
          <input
            type="file"
            id="file-input"
            onChange={handleFileChange}
            accept={supportedTypes.map(type => `.${type}`).join(',')}
            disabled={isUploading}
            data-testid="file-input"
          />
          
          {selectedFile && (
            <div className="file-info" data-testid="file-info">
              <p>{selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)</p>
              {!isFileTypeSupported(selectedFile) && (
                <p className="warning" data-testid="file-type-warning">
                  Warning: File type may not be supported
                </p>
              )}
            </div>
          )}
        </div>
        
        <div className="upload-actions">
          <button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading || validationErrors.length > 0}
            data-testid="upload-button"
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </button>
          
          {isUploading && (
            <button
              onClick={handleCancel}
              data-testid="cancel-button"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      
      {isUploading && (
        <div className="progress-container" data-testid="progress-container">
          <div 
            className="progress-bar" 
            style={{ width: `${uploadProgress}%` }}
            data-testid="progress-bar"
          />
          <span className="progress-text" data-testid="progress-text">
            {uploadProgress}%
          </span>
        </div>
      )}
    </div>
  );
};

describe('MediaUploader Component', () => {
  const mockFile = new File(['test content'], 'test.mp4', { type: 'video/mp4' });
  const mockUploadId = 'upload-123';
  const mockUploadUrl = 'https://example.com/upload';

  beforeEach(() => {
    vi.clearAllMocks();
    reactQueryMock.resetReactQueryMocks();
    
    // Mock supported file types
    uploadService.getSupportedFileTypes.mockResolvedValue(['mp4', 'jpg', 'png']);
    
    // Mock successful validation
    mediaService.validateMedia.mockResolvedValue({ valid: true });
    
    // Mock successful upload
    uploadService.uploadFile.mockResolvedValue({
      id: mockUploadId,
      uploadUrl: mockUploadUrl
    });
    
    // Mock successful media processing
    mediaService.processMedia.mockResolvedValue({ success: true });
  });

  it('renders the upload form with file input', () => {
    render(<MediaUploader />);
    
    expect(screen.getByTestId('media-uploader')).toBeInTheDocument();
    expect(screen.getByTestId('file-input')).toBeInTheDocument();
    expect(screen.getByTestId('upload-button')).toBeInTheDocument();
    expect(screen.getByTestId('upload-button')).toBeDisabled();
  });

  it('handles file selection and validation', async () => {
    render(<MediaUploader />);
    
    // Wait for supported types to load
    await waitFor(() => {
      expect(uploadService.getSupportedFileTypes).toHaveBeenCalled();
    });
    
    // Simulate file selection
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    
    // Check if file info is displayed
    expect(screen.getByTestId('file-info')).toBeInTheDocument();
    expect(screen.getByTestId('file-info')).toHaveTextContent('test.mp4');
    
    // Check if validation was called
    expect(mediaService.validateMedia).toHaveBeenCalledWith(mockFile);
    
    // Check if upload button is enabled
    expect(screen.getByTestId('upload-button')).not.toBeDisabled();
  });

  it('handles file validation errors', async () => {
    // Mock validation failure
    mediaService.validateMedia.mockResolvedValue({
      valid: false,
      errors: ['File size exceeds limit']
    });
    
    render(<MediaUploader />);
    
    // Wait for supported types to load
    await waitFor(() => {
      expect(uploadService.getSupportedFileTypes).toHaveBeenCalled();
    });
    
    // Simulate file selection
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    
    // Check if validation errors are displayed
    expect(screen.getByTestId('validation-errors')).toBeInTheDocument();
    expect(screen.getByTestId('validation-errors')).toHaveTextContent('File size exceeds limit');
    
    // Check if upload button is disabled
    expect(screen.getByTestId('upload-button')).toBeDisabled();
  });

  it('handles successful file upload', async () => {
    render(<MediaUploader />);
    
    // Wait for supported types to load
    await waitFor(() => {
      expect(uploadService.getSupportedFileTypes).toHaveBeenCalled();
    });
    
    // Simulate file selection
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    
    // Click upload button
    fireEvent.click(screen.getByTestId('upload-button'));
    
    // Check if upload was started
    expect(uploadService.uploadFile).toHaveBeenCalledWith(mockFile, expect.any(Object));
    
    // Check if progress bar is shown
    expect(screen.getByTestId('progress-container')).toBeInTheDocument();
    
    // Simulate upload progress
    const progressCallback = uploadService.uploadFile.mock.calls[0][1].onProgress;
    progressCallback(50);
    
    // Check if progress is updated
    expect(screen.getByTestId('progress-text')).toHaveTextContent('50%');
    
    // Wait for upload to complete
    await waitFor(() => {
      expect(mediaService.processMedia).toHaveBeenCalledWith(mockUploadId);
    });
    
    // Check if form is reset
    expect(screen.queryByTestId('file-info')).not.toBeInTheDocument();
    expect(screen.getByTestId('upload-button')).toBeDisabled();
  });

  it('handles upload cancellation', async () => {
    render(<MediaUploader />);
    
    // Wait for supported types to load
    await waitFor(() => {
      expect(uploadService.getSupportedFileTypes).toHaveBeenCalled();
    });
    
    // Simulate file selection
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    
    // Click upload button
    fireEvent.click(screen.getByTestId('upload-button'));
    
    // Click cancel button
    fireEvent.click(screen.getByTestId('cancel-button'));
    
    // Check if cancel was called
    expect(uploadService.cancelUpload).toHaveBeenCalledWith(mockUploadId);
    
    // Check if form is reset
    expect(screen.queryByTestId('file-info')).not.toBeInTheDocument();
    expect(screen.getByTestId('upload-button')).toBeDisabled();
    expect(screen.queryByTestId('progress-container')).not.toBeInTheDocument();
  });

  it('handles upload errors', async () => {
    // Mock upload failure
    uploadService.uploadFile.mockRejectedValue(new Error('Upload failed'));
    
    render(<MediaUploader />);
    
    // Wait for supported types to load
    await waitFor(() => {
      expect(uploadService.getSupportedFileTypes).toHaveBeenCalled();
    });
    
    // Simulate file selection
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    
    // Click upload button
    fireEvent.click(screen.getByTestId('upload-button'));
    
    // Check if error message is displayed
    await waitFor(() => {
      expect(screen.getByTestId('upload-error')).toHaveTextContent('Upload failed');
    });
    
    // Check if form is reset
    expect(screen.queryByTestId('file-info')).not.toBeInTheDocument();
    expect(screen.getByTestId('upload-button')).toBeDisabled();
    expect(screen.queryByTestId('progress-container')).not.toBeInTheDocument();
  });

  it('shows warning for unsupported file types', async () => {
    // Mock supported file types to only include images
    uploadService.getSupportedFileTypes.mockResolvedValue(['jpg', 'png']);
    
    render(<MediaUploader />);
    
    // Wait for supported types to load
    await waitFor(() => {
      expect(uploadService.getSupportedFileTypes).toHaveBeenCalled();
    });
    
    // Simulate file selection with video file
    const fileInput = screen.getByTestId('file-input');
    fireEvent.change(fileInput, { target: { files: [mockFile] } });
    
    // Check if warning is displayed
    expect(screen.getByTestId('file-type-warning')).toBeInTheDocument();
    expect(screen.getByTestId('file-type-warning')).toHaveTextContent('Warning: File type may not be supported');
  });
}); 