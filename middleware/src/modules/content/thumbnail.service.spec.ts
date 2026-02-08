import { promises as fs } from 'fs';

// Mock sharp module - the service uses `import sharp from 'sharp'` (default import)
const mockToFile = jest.fn().mockResolvedValue(undefined);
const mockResize = jest.fn().mockReturnValue({ toFile: mockToFile });

jest.mock('sharp', () => {
  const mockSharpFn = jest.fn().mockImplementation(() => ({
    resize: mockResize,
    toFile: mockToFile,
  }));
  // For `import sharp from 'sharp'` (default import via __esModule)
  return {
    __esModule: true,
    default: mockSharpFn,
  };
});

// Mock fs
jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
  },
}));

// Now import the service
import { ThumbnailService } from './thumbnail.service';
import sharp from 'sharp';

// Mock fetch
global.fetch = jest.fn();

describe('ThumbnailService', () => {
  let service: ThumbnailService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations
    mockResize.mockReturnValue({ toFile: mockToFile });
    mockToFile.mockResolvedValue(undefined);

    service = new ThumbnailService();
  });

  describe('constructor', () => {
    it('should create service instance', () => {
      expect(service).toBeDefined();
    });

    it('should ensure thumbnail directory exists', () => {
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('thumbnails'),
        { recursive: true },
      );
    });
  });

  describe('generateThumbnail', () => {
    const contentId = 'content-123';
    const imageBuffer = Buffer.from('fake-image-data');
    const mimeType = 'image/jpeg';

    it('should generate thumbnail successfully', async () => {
      const result = await service.generateThumbnail(contentId, imageBuffer, mimeType);

      expect(result).toBe(`/static/thumbnails/${contentId}.jpg`);
      expect(sharp).toHaveBeenCalledWith(imageBuffer);
    });

    it('should resize with correct options', async () => {
      await service.generateThumbnail(contentId, imageBuffer, mimeType);

      expect(mockResize).toHaveBeenCalledWith(300, 300, {
        fit: 'inside',
        withoutEnlargement: true,
      });
    });

    it('should use correct extension for jpeg', async () => {
      const result = await service.generateThumbnail(contentId, imageBuffer, 'image/jpeg');

      expect(result).toContain('.jpg');
    });

    it('should use correct extension for png', async () => {
      const result = await service.generateThumbnail(contentId, imageBuffer, 'image/png');

      expect(result).toContain('.png');
    });

    it('should use correct extension for gif', async () => {
      const result = await service.generateThumbnail(contentId, imageBuffer, 'image/gif');

      expect(result).toContain('.gif');
    });

    it('should use correct extension for webp', async () => {
      const result = await service.generateThumbnail(contentId, imageBuffer, 'image/webp');

      expect(result).toContain('.webp');
    });

    it('should default to jpg for unknown mime type', async () => {
      const result = await service.generateThumbnail(contentId, imageBuffer, 'image/unknown');

      expect(result).toContain('.jpg');
    });

    it('should throw error when image exceeds size limit', async () => {
      const largeBuffer = Buffer.alloc(51 * 1024 * 1024); // 51MB

      await expect(
        service.generateThumbnail(contentId, largeBuffer, mimeType),
      ).rejects.toThrow('Image exceeds maximum size for thumbnail generation');
    });

    it('should throw error when sharp fails', async () => {
      mockToFile.mockRejectedValueOnce(new Error('Sharp error'));

      await expect(
        service.generateThumbnail(contentId, imageBuffer, mimeType),
      ).rejects.toThrow('Sharp error');
    });
  });

  describe('generateThumbnailFromUrl', () => {
    const contentId = 'content-456';
    const imageUrl = 'https://example.com/image.jpg';

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
        headers: {
          get: jest.fn().mockReturnValue('image/jpeg'),
        },
      });
    });

    it('should fetch image from URL and generate thumbnail', async () => {
      const result = await service.generateThumbnailFromUrl(contentId, imageUrl);

      expect(global.fetch).toHaveBeenCalledWith(imageUrl);
      expect(result).toBe(`/static/thumbnails/${contentId}.jpg`);
    });

    it('should use content-type from response headers', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
        headers: {
          get: jest.fn().mockReturnValue('image/png'),
        },
      });

      const result = await service.generateThumbnailFromUrl(contentId, imageUrl);

      expect(result).toContain('.png');
    });

    it('should default to jpeg when content-type is null', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(100)),
        headers: {
          get: jest.fn().mockReturnValue(null),
        },
      });

      const result = await service.generateThumbnailFromUrl(contentId, imageUrl);

      expect(result).toContain('.jpg');
    });

    it('should throw error when fetch fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(
        service.generateThumbnailFromUrl(contentId, imageUrl),
      ).rejects.toThrow('Network error');
    });
  });

  describe('deleteThumbnail', () => {
    it('should delete thumbnail file', async () => {
      await service.deleteThumbnail('/static/thumbnails/content-123.jpg');

      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('content-123.jpg'));
    });

    it('should not throw when thumbnail URL is empty', async () => {
      await expect(service.deleteThumbnail('')).resolves.toBeUndefined();
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should not throw when thumbnail URL is null', async () => {
      await expect(service.deleteThumbnail(null as any)).resolves.toBeUndefined();
      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should not delete when URL does not contain thumbnails path', async () => {
      await service.deleteThumbnail('/static/images/image.jpg');

      expect(fs.unlink).not.toHaveBeenCalled();
    });

    it('should not throw when unlink fails', async () => {
      (fs.unlink as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(
        service.deleteThumbnail('/static/thumbnails/missing.jpg'),
      ).resolves.toBeUndefined();
    });
  });
});
