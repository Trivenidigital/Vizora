import { useContentStore } from '../content';
import { api } from '../../api/client';
import type { Content } from '../../types';

jest.mock('../../api/client', () => ({
  api: {
    getContent: jest.fn(),
    deleteContent: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const makeContent = (overrides: Partial<Content> = {}): Content => ({
  id: 'content-1',
  name: 'Welcome Banner',
  type: 'image',
  url: 'https://cdn.example.com/banner.png',
  thumbnailUrl: 'https://cdn.example.com/banner-thumb.png',
  mimeType: 'image/png',
  fileSize: 204800,
  duration: null,
  status: 'active',
  organizationId: 'org-1',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const initialState = {
  items: [],
  isLoading: false,
  error: null,
};

describe('useContentStore', () => {
  beforeEach(() => {
    useContentStore.setState(initialState);
    jest.clearAllMocks();
  });

  describe('fetchContent', () => {
    it('should fetch content without params and set items', async () => {
      const items = [makeContent(), makeContent({ id: 'content-2', name: 'Promo Video' })];
      mockedApi.getContent.mockResolvedValue(items);

      await useContentStore.getState().fetchContent();

      expect(mockedApi.getContent).toHaveBeenCalledWith(undefined);
      const state = useContentStore.getState();
      expect(state.items).toEqual(items);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should pass filter params to API', async () => {
      mockedApi.getContent.mockResolvedValue([]);

      await useContentStore.getState().fetchContent({ type: 'video', page: 1, limit: 10 });

      expect(mockedApi.getContent).toHaveBeenCalledWith({ type: 'video', page: 1, limit: 10 });
    });

    it('should set error on failure', async () => {
      mockedApi.getContent.mockRejectedValue(new Error('Server down'));

      await useContentStore.getState().fetchContent();

      const state = useContentStore.getState();
      expect(state.error).toBe('Server down');
      expect(state.isLoading).toBe(false);
      expect(state.items).toEqual([]);
    });

    it('should use fallback error message for non-Error throws', async () => {
      mockedApi.getContent.mockRejectedValue(42);

      await useContentStore.getState().fetchContent();

      expect(useContentStore.getState().error).toBe('Failed to load content');
    });

    it('should default to empty array if response is not an array', async () => {
      mockedApi.getContent.mockResolvedValue({ data: [] } as unknown as Content[]);

      await useContentStore.getState().fetchContent();

      expect(useContentStore.getState().items).toEqual([]);
    });

    it('should set isLoading=true while fetching', async () => {
      let capturedLoading = false;
      mockedApi.getContent.mockImplementation(async () => {
        capturedLoading = useContentStore.getState().isLoading;
        return [];
      });

      await useContentStore.getState().fetchContent();

      expect(capturedLoading).toBe(true);
      expect(useContentStore.getState().isLoading).toBe(false);
    });

    it('should clear previous error when starting a new fetch', async () => {
      useContentStore.setState({ error: 'old error' });
      mockedApi.getContent.mockResolvedValue([]);

      await useContentStore.getState().fetchContent();

      expect(useContentStore.getState().error).toBeNull();
    });
  });

  describe('deleteContent', () => {
    it('should call API and remove item from state', async () => {
      const item1 = makeContent({ id: 'content-1' });
      const item2 = makeContent({ id: 'content-2' });
      useContentStore.setState({ items: [item1, item2] });

      mockedApi.deleteContent.mockResolvedValue(undefined);

      await useContentStore.getState().deleteContent('content-1');

      expect(mockedApi.deleteContent).toHaveBeenCalledWith('content-1');
      const state = useContentStore.getState();
      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBe('content-2');
    });

    it('should propagate API errors', async () => {
      useContentStore.setState({ items: [makeContent()] });
      mockedApi.deleteContent.mockRejectedValue(new Error('Forbidden'));

      await expect(useContentStore.getState().deleteContent('content-1')).rejects.toThrow('Forbidden');

      // State should not change on error since the throw happens before set()
      expect(useContentStore.getState().items).toHaveLength(1);
    });
  });

  describe('addItem', () => {
    it('should prepend item to items array', () => {
      const existing = makeContent({ id: 'content-1' });
      useContentStore.setState({ items: [existing] });

      const newItem = makeContent({ id: 'content-new', name: 'New Upload' });
      useContentStore.getState().addItem(newItem);

      const state = useContentStore.getState();
      expect(state.items).toHaveLength(2);
      expect(state.items[0].id).toBe('content-new');
      expect(state.items[1].id).toBe('content-1');
    });

    it('should work on empty items array', () => {
      const newItem = makeContent({ id: 'content-new' });
      useContentStore.getState().addItem(newItem);

      expect(useContentStore.getState().items).toEqual([newItem]);
    });
  });
});
