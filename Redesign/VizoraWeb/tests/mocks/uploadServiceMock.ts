import { vi } from 'vitest';

// Create a mock upload service
export const uploadServiceMock = {
  uploadFile: vi.fn().mockImplementation((file: File, options: any = {}) => {
    // Return an upload ID for tracking
    const uploadId = 'upload-123';
    
    // Create a mock progress tracker
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 25;
      if (options.onProgress && progress <= 100) {
        options.onProgress({
          loaded: (progress / 100) * file.size,
          total: file.size,
          progress: progress / 100,
          percent: progress,
          bytes: (progress / 100) * file.size,
          rate: 1024 * 1024, // 1MB/s
          estimated: (100 - progress) / 25, // seconds remaining
          uploadId
        });
      }
      
      if (progress >= 100) {
        clearInterval(progressInterval);
        if (options.onComplete) {
          options.onComplete({
            id: uploadId,
            filename: file.name,
            originalName: file.name,
            size: file.size,
            mimeType: file.type,
            url: `https://example.com/uploads/${file.name}`,
            uploadId
          });
        }
      }
    }, 100);
    
    return {
      uploadId,
      cancel: () => {
        clearInterval(progressInterval);
        if (options.onCancel) {
          options.onCancel({ uploadId });
        }
      }
    };
  }),
  
  cancelUpload: vi.fn().mockImplementation((uploadId: string) => {
    return Promise.resolve({ success: true, message: 'Upload cancelled', uploadId });
  }),
  
  validateFile: vi.fn().mockImplementation((file: File, validationRules: any = {}) => {
    const errors = [];
    const maxSize = validationRules.maxSize || 10 * 1024 * 1024; // Default 10MB
    const allowedTypes = validationRules.allowedTypes || ['image/jpeg', 'image/png', 'video/mp4'];
    
    // Check file size
    if (file.size > maxSize) {
      errors.push('File size exceeds limit');
    }
    
    // Check file type
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      errors.push('File type not supported');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }),
  
  getUploadProgress: vi.fn().mockImplementation((uploadId: string) => {
    return Promise.resolve({
      uploadId,
      progress: 0.5,
      percent: 50,
      status: 'in-progress'
    });
  }),
  
  getUploadStatus: vi.fn().mockImplementation((uploadId: string) => {
    return Promise.resolve({
      uploadId,
      status: 'completed',
      file: {
        id: 'file-123',
        filename: 'test.jpg',
        originalName: 'test.jpg',
        size: 1024 * 1024, // 1MB
        mimeType: 'image/jpeg',
        url: `https://example.com/uploads/test.jpg`
      }
    });
  }),
  
  retryUpload: vi.fn().mockImplementation((uploadId: string) => {
    return Promise.resolve({
      success: true,
      message: 'Upload retry initiated',
      uploadId
    });
  })
};

// Function to reset all mocks in the service
export function resetUploadServiceMocks() {
  Object.values(uploadServiceMock).forEach(mock => {
    if (typeof mock === 'function' && mock.mockReset) {
      mock.mockReset();
    }
  });
  
  // Reset default implementations
  uploadServiceMock.uploadFile.mockImplementation((file: File, options: any = {}) => {
    const uploadId = 'upload-123';
    
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 25;
      if (options.onProgress && progress <= 100) {
        options.onProgress({
          loaded: (progress / 100) * file.size,
          total: file.size,
          progress: progress / 100,
          percent: progress,
          bytes: (progress / 100) * file.size,
          rate: 1024 * 1024,
          estimated: (100 - progress) / 25,
          uploadId
        });
      }
      
      if (progress >= 100) {
        clearInterval(progressInterval);
        if (options.onComplete) {
          options.onComplete({
            id: uploadId,
            filename: file.name,
            originalName: file.name,
            size: file.size,
            mimeType: file.type,
            url: `https://example.com/uploads/${file.name}`,
            uploadId
          });
        }
      }
    }, 100);
    
    return {
      uploadId,
      cancel: () => {
        clearInterval(progressInterval);
        if (options.onCancel) {
          options.onCancel({ uploadId });
        }
      }
    };
  });
  
  uploadServiceMock.cancelUpload.mockImplementation((uploadId: string) => {
    return Promise.resolve({ success: true, message: 'Upload cancelled', uploadId });
  });
  
  // Reset other implementations as needed
} 