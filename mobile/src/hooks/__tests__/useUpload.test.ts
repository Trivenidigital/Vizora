import { renderHook, act } from '@testing-library/react-native';
import { useUpload } from '../useUpload';
import { api } from '../../api/client';
import { useContentStore } from '../../stores/content';
import type { Content } from '../../types';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../../api/client', () => ({
  api: {
    uploadFile: jest.fn(),
  },
}));

jest.mock('../../stores/content', () => ({
  useContentStore: {
    getState: jest.fn(() => ({
      addItem: jest.fn(),
    })),
  },
}));

const mockUploadFile = api.uploadFile as jest.Mock;
const mockGetState = useContentStore.getState as jest.Mock;

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockContent: Content = {
  id: 'content-1',
  name: 'photo.jpg',
  type: 'image',
  url: 'https://cdn.example.com/photo.jpg',
  thumbnailUrl: null,
  mimeType: 'image/jpeg',
  fileSize: 12345,
  duration: null,
  status: 'ready',
  organizationId: 'org-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useUpload', () => {
  let mockAddItem: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAddItem = jest.fn();
    mockGetState.mockReturnValue({ addItem: mockAddItem });
  });

  describe('initial state', () => {
    it('should start with status idle', () => {
      const { result } = renderHook(() => useUpload());

      expect(result.current.state).toEqual({ status: 'idle' });
    });
  });

  describe('upload — success flow', () => {
    it('transitions to uploading, then success', async () => {
      mockUploadFile.mockResolvedValueOnce(mockContent);

      const { result } = renderHook(() => useUpload());

      let uploadResult: Content | undefined;

      await act(async () => {
        uploadResult = await result.current.upload(
          'file:///photo.jpg',
          'photo.jpg',
          'image/jpeg',
        );
      });

      // Final state should be success with the content
      expect(result.current.state).toEqual({
        status: 'success',
        content: mockContent,
      });

      // Should return the content
      expect(uploadResult).toEqual(mockContent);
    });

    it('passes onProgress callback to api.uploadFile', async () => {
      mockUploadFile.mockResolvedValueOnce(mockContent);

      const { result } = renderHook(() => useUpload());

      await act(async () => {
        await result.current.upload('file:///photo.jpg', 'photo.jpg', 'image/jpeg');
      });

      // Verify uploadFile was called with correct args
      expect(mockUploadFile).toHaveBeenCalledWith(
        'file:///photo.jpg',
        'photo.jpg',
        'image/jpeg',
        expect.any(Function),
      );
    });

    it('adds uploaded content to the content store', async () => {
      mockUploadFile.mockResolvedValueOnce(mockContent);

      const { result } = renderHook(() => useUpload());

      await act(async () => {
        await result.current.upload('file:///photo.jpg', 'photo.jpg', 'image/jpeg');
      });

      expect(mockAddItem).toHaveBeenCalledWith(mockContent);
    });

    it('transitions through uploading with progress 0 initially', async () => {
      // Use a deferred promise so we can observe intermediate state
      let resolveUpload!: (value: Content) => void;
      mockUploadFile.mockReturnValueOnce(
        new Promise<Content>((resolve) => {
          resolveUpload = resolve;
        }),
      );

      const { result } = renderHook(() => useUpload());

      // Start upload (don't await yet)
      let uploadPromise: Promise<Content | undefined>;
      act(() => {
        uploadPromise = result.current.upload(
          'file:///photo.jpg',
          'photo.jpg',
          'image/jpeg',
        );
      });

      // The state should be 'uploading' with progress 0
      expect(result.current.state).toEqual({
        status: 'uploading',
        progress: 0,
      });

      // Now resolve
      await act(async () => {
        resolveUpload(mockContent);
        await uploadPromise!;
      });

      expect(result.current.state).toEqual({
        status: 'success',
        content: mockContent,
      });
    });
  });

  describe('upload — error flow', () => {
    it('transitions to error state on failure', async () => {
      mockUploadFile.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useUpload());

      await act(async () => {
        await result.current
          .upload('file:///bad.jpg', 'bad.jpg', 'image/jpeg')
          .catch(() => {
            // Expected — the hook re-throws
          });
      });

      expect(result.current.state).toEqual({
        status: 'error',
        message: 'Network error',
      });
    });

    it('uses "Upload failed" message for non-Error exceptions', async () => {
      mockUploadFile.mockRejectedValueOnce('string error');

      const { result } = renderHook(() => useUpload());

      await act(async () => {
        await result.current
          .upload('file:///bad.jpg', 'bad.jpg', 'image/jpeg')
          .catch(() => {
            // Expected
          });
      });

      expect(result.current.state).toEqual({
        status: 'error',
        message: 'Upload failed',
      });
    });

    it('re-throws the error to the caller', async () => {
      const uploadError = new Error('Upload rejected');
      mockUploadFile.mockRejectedValueOnce(uploadError);

      const { result } = renderHook(() => useUpload());

      await expect(
        act(async () => {
          await result.current.upload('file:///bad.jpg', 'bad.jpg', 'image/jpeg');
        }),
      ).rejects.toThrow('Upload rejected');
    });

    it('does not add to content store on failure', async () => {
      mockUploadFile.mockRejectedValueOnce(new Error('fail'));

      const { result } = renderHook(() => useUpload());

      await act(async () => {
        await result.current
          .upload('file:///bad.jpg', 'bad.jpg', 'image/jpeg')
          .catch(() => {});
      });

      expect(mockAddItem).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('returns to idle state after success', async () => {
      mockUploadFile.mockResolvedValueOnce(mockContent);

      const { result } = renderHook(() => useUpload());

      await act(async () => {
        await result.current.upload('file:///photo.jpg', 'photo.jpg', 'image/jpeg');
      });

      expect(result.current.state.status).toBe('success');

      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toEqual({ status: 'idle' });
    });

    it('returns to idle state after error', async () => {
      mockUploadFile.mockRejectedValueOnce(new Error('fail'));

      const { result } = renderHook(() => useUpload());

      await act(async () => {
        await result.current
          .upload('file:///bad.jpg', 'bad.jpg', 'image/jpeg')
          .catch(() => {});
      });

      expect(result.current.state.status).toBe('error');

      act(() => {
        result.current.reset();
      });

      expect(result.current.state).toEqual({ status: 'idle' });
    });
  });
});
