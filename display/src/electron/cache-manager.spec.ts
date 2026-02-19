jest.mock('electron', () => ({
  app: {
    getPath: jest.fn().mockReturnValue('/tmp/test-vizora'),
  },
}), { virtual: true });

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  statSync: jest.fn(),
  unlinkSync: jest.fn(),
  createWriteStream: jest.fn(),
}));

jest.mock('https', () => ({
  get: jest.fn(),
}));

jest.mock('http', () => ({
  get: jest.fn(),
}));

import { CacheManager } from './cache-manager';
import * as fs from 'fs';
import * as http from 'http';

describe('CacheManager', () => {
  let cacheManager: CacheManager;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    // Default: cache dir does not exist, no manifest
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    (fs.readFileSync as jest.Mock).mockReturnValue('{"entries":{},"version":1}');
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});
    (fs.mkdirSync as jest.Mock).mockImplementation(() => {});
    (fs.unlinkSync as jest.Mock).mockImplementation(() => {});
    (fs.statSync as jest.Mock).mockReturnValue({ size: 0 });

    cacheManager = new CacheManager(100);
  });

  describe('constructor', () => {
    it('should create cache directory if it does not exist', () => {
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('content-cache'),
        { recursive: true },
      );
    });

    it('should load manifest from disk if it exists', () => {
      (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
        return p.includes('manifest.json');
      });
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify({
          entries: { 'c-1': { contentId: 'c-1', filePath: '/tmp/c-1.jpg', size: 1024, mimeType: 'image/jpeg', lastAccessed: 1000, downloadedAt: 900 } },
          version: 1,
        }),
      );

      const cm = new CacheManager(100);
      const stats = cm.getCacheStats();
      expect(stats.itemCount).toBe(1);
    });

    it('should handle corrupt manifest gracefully', () => {
      (fs.existsSync as jest.Mock).mockImplementation((p: string) => {
        return p.includes('manifest.json');
      });
      (fs.readFileSync as jest.Mock).mockReturnValue('NOT VALID JSON');

      const cm = new CacheManager(100);
      const stats = cm.getCacheStats();
      expect(stats.itemCount).toBe(0);
    });
  });

  describe('getCachedPath', () => {
    it('should return null for uncached content', () => {
      const result = cacheManager.getCachedPath('nonexistent');
      expect(result).toBeNull();
    });

    it('should return file path for cached content', () => {
      // Set up manifest with an entry
      (cacheManager as any).manifest = {
        entries: {
          'c-1': {
            contentId: 'c-1',
            filePath: '/tmp/test-vizora/content-cache/c-1.jpg',
            size: 1024,
            mimeType: 'image/jpeg',
            lastAccessed: 1000,
            downloadedAt: 900,
          },
        },
        version: 1,
      };
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = cacheManager.getCachedPath('c-1');
      expect(result).toBe('/tmp/test-vizora/content-cache/c-1.jpg');
    });

    it('should remove entry and return null if file no longer exists', () => {
      (cacheManager as any).manifest = {
        entries: {
          'c-1': {
            contentId: 'c-1',
            filePath: '/tmp/deleted.jpg',
            size: 1024,
            mimeType: 'image/jpeg',
            lastAccessed: 1000,
            downloadedAt: 900,
          },
        },
        version: 1,
      };
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = cacheManager.getCachedPath('c-1');

      expect(result).toBeNull();
      expect((cacheManager as any).manifest.entries['c-1']).toBeUndefined();
    });

    it('should update lastAccessed timestamp', () => {
      const entry = {
        contentId: 'c-1',
        filePath: '/tmp/c-1.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        lastAccessed: 1000,
        downloadedAt: 900,
      };
      (cacheManager as any).manifest = { entries: { 'c-1': entry }, version: 1 };
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      cacheManager.getCachedPath('c-1');

      expect(entry.lastAccessed).toBeGreaterThan(1000);
    });
  });

  describe('downloadContent', () => {
    it('should return cached path if content already exists', async () => {
      (cacheManager as any).manifest = {
        entries: {
          'c-1': {
            contentId: 'c-1',
            filePath: '/tmp/c-1.jpg',
            size: 1024,
            mimeType: 'image/jpeg',
            lastAccessed: 1000,
            downloadedAt: 900,
          },
        },
        version: 1,
      };
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      const result = await cacheManager.downloadContent('c-1', 'http://example.com/img.jpg', 'image/jpeg');

      expect(result).toBe('/tmp/c-1.jpg');
      expect(http.get).not.toHaveBeenCalled();
    });

    it('should download and cache new content', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.statSync as jest.Mock).mockReturnValue({ size: 2048 });

      const mockWriteStream = {
        on: jest.fn(),
        close: jest.fn(),
      };
      (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

      const mockResponse = {
        statusCode: 200,
        pipe: jest.fn(),
        headers: {},
      };

      (http.get as jest.Mock).mockImplementation((_url: string, cb: Function) => {
        cb(mockResponse);
        // Trigger finish
        const finishCb = mockWriteStream.on.mock.calls.find((c: any[]) => c[0] === 'finish');
        if (finishCb) {
          finishCb[1]();
        }
        return { on: jest.fn().mockReturnThis() };
      });

      const result = await cacheManager.downloadContent('c-new', 'http://localhost:3000/file.jpg', 'image/jpeg');

      expect(result).toContain('c-new');
      expect(fs.createWriteStream).toHaveBeenCalled();
    });

    it('should fall back to URL on download failure', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const mockWriteStream = {
        on: jest.fn(),
        close: jest.fn(),
      };
      (fs.createWriteStream as jest.Mock).mockReturnValue(mockWriteStream);

      (http.get as jest.Mock).mockImplementation((_url: string, _cb: Function) => {
        const errorHandler = { on: jest.fn() };
        errorHandler.on.mockImplementation((event: string, cb: Function) => {
          if (event === 'error') {
            cb(new Error('Network error'));
          }
          return errorHandler;
        });
        return errorHandler;
      });

      const result = await cacheManager.downloadContent('c-fail', 'http://example.com/file.mp4', 'video/mp4');

      expect(result).toBe('http://example.com/file.mp4');
    });
  });

  describe('clearCache', () => {
    it('should delete all cached files and reset manifest', () => {
      (cacheManager as any).manifest = {
        entries: {
          'c-1': { contentId: 'c-1', filePath: '/tmp/c-1.jpg', size: 1024 },
          'c-2': { contentId: 'c-2', filePath: '/tmp/c-2.mp4', size: 2048 },
        },
        version: 1,
      };
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      cacheManager.clearCache();

      expect(fs.unlinkSync).toHaveBeenCalledTimes(2);
      expect((cacheManager as any).manifest.entries).toEqual({});
    });

    it('should handle deletion errors gracefully', () => {
      (cacheManager as any).manifest = {
        entries: {
          'c-1': { contentId: 'c-1', filePath: '/tmp/c-1.jpg', size: 1024 },
        },
        version: 1,
      };
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.unlinkSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      // Should not throw
      expect(() => cacheManager.clearCache()).not.toThrow();
    });
  });

  describe('getCacheStats', () => {
    it('should return correct cache statistics', () => {
      (cacheManager as any).manifest = {
        entries: {
          'c-1': { contentId: 'c-1', size: 1024 * 1024 }, // 1MB
          'c-2': { contentId: 'c-2', size: 2 * 1024 * 1024 }, // 2MB
        },
        version: 1,
      };

      const stats = cacheManager.getCacheStats();

      expect(stats.itemCount).toBe(2);
      expect(stats.totalSizeMB).toBeCloseTo(3, 0);
      expect(stats.maxSizeMB).toBe(100);
    });

    it('should return zero stats for empty cache', () => {
      const stats = cacheManager.getCacheStats();

      expect(stats.itemCount).toBe(0);
      expect(stats.totalSizeMB).toBe(0);
    });
  });

  describe('removeItem', () => {
    it('should delete a specific cached item', () => {
      (cacheManager as any).manifest = {
        entries: {
          'c-1': { contentId: 'c-1', filePath: '/tmp/c-1.jpg', size: 1024 },
          'c-2': { contentId: 'c-2', filePath: '/tmp/c-2.jpg', size: 2048 },
        },
        version: 1,
      };
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      cacheManager.removeItem('c-1');

      expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/c-1.jpg');
      expect((cacheManager as any).manifest.entries['c-1']).toBeUndefined();
      expect((cacheManager as any).manifest.entries['c-2']).toBeDefined();
    });

    it('should do nothing for nonexistent items', () => {
      cacheManager.removeItem('nonexistent');
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });

  describe('enforceMaxCacheSize', () => {
    it('should evict least recently used items when over limit', async () => {
      (cacheManager as any).manifest = {
        entries: {
          'old': { contentId: 'old', filePath: '/tmp/old.jpg', size: 60 * 1024 * 1024, mimeType: 'image/jpeg', lastAccessed: 1000, downloadedAt: 900 },
          'new': { contentId: 'new', filePath: '/tmp/new.jpg', size: 60 * 1024 * 1024, mimeType: 'image/jpeg', lastAccessed: 9000, downloadedAt: 8000 },
        },
        version: 1,
      };
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      await cacheManager.enforceMaxCacheSize();

      // old item should have been evicted (least recently accessed)
      expect(fs.unlinkSync).toHaveBeenCalledWith('/tmp/old.jpg');
      expect((cacheManager as any).manifest.entries['old']).toBeUndefined();
      // new item should remain
      expect((cacheManager as any).manifest.entries['new']).toBeDefined();
    });

    it('should not evict anything when under limit', async () => {
      (cacheManager as any).manifest = {
        entries: {
          'c-1': { contentId: 'c-1', filePath: '/tmp/c-1.jpg', size: 1024, lastAccessed: 1000 },
        },
        version: 1,
      };

      await cacheManager.enforceMaxCacheSize();

      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });
  });
});
