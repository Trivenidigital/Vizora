import { Test, TestingModule } from '@nestjs/testing';
import { PlaylistService } from './playlist.service';
import { RedisService } from './redis.service';
import { DatabaseService } from '../database/database.service';

describe('PlaylistService', () => {
  let service: PlaylistService;

  const mockRedisService = {
    getCachedPlaylist: jest.fn().mockResolvedValue(null),
    cachePlaylist: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const mockDatabaseService = {
    display: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    playlist: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  };

  beforeEach(async () => {
    // Reset all mocks (clears implementations, return values, and call history)
    mockRedisService.getCachedPlaylist.mockReset().mockResolvedValue(null);
    mockRedisService.cachePlaylist.mockReset().mockResolvedValue(undefined);
    mockRedisService.get.mockReset().mockResolvedValue(null);
    mockRedisService.set.mockReset().mockResolvedValue(undefined);
    mockRedisService.delete.mockReset().mockResolvedValue(undefined);
    mockDatabaseService.display.findUnique.mockReset().mockResolvedValue(null);
    mockDatabaseService.playlist.findFirst.mockReset().mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaylistService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<PlaylistService>(PlaylistService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDevicePlaylist', () => {
    it('should return cached playlist when available', async () => {
      const cachedPlaylist = { id: 'p-1', name: 'Cached', items: [] };
      mockRedisService.getCachedPlaylist.mockResolvedValueOnce(cachedPlaylist);

      const result = await service.getDevicePlaylist('device-1');

      expect(result).toEqual(cachedPlaylist);
      expect(mockDatabaseService.display.findUnique).not.toHaveBeenCalled();
    });

    it('should bypass cache when forceRefresh is true', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValueOnce(null);

      await service.getDevicePlaylist('device-1', true);

      expect(mockRedisService.getCachedPlaylist).not.toHaveBeenCalled();
      expect(mockDatabaseService.display.findUnique).toHaveBeenCalled();
    });

    it('should return device assigned playlist from database', async () => {
      const dbDisplay = {
        organizationId: 'org-1',
        currentPlaylist: {
          id: 'p-1',
          name: 'DB Playlist',
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-02'),
          items: [
            {
              id: 'item-1',
              contentId: 'c-1',
              order: 1,
              duration: 15,
              content: {
                id: 'c-1',
                name: 'Image 1',
                type: 'image',
                url: 'https://cdn.example.com/img.jpg',
                thumbnail: 'thumb.jpg',
                metadata: {},
              },
            },
          ],
        },
      };
      mockDatabaseService.display.findUnique.mockResolvedValueOnce(dbDisplay);

      const result = await service.getDevicePlaylist('device-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('p-1');
      expect(result!.name).toBe('DB Playlist');
      expect(result!.items).toHaveLength(1);
      expect(result!.items[0].duration).toBe(15);
      expect(mockRedisService.cachePlaylist).toHaveBeenCalled();
    });

    it('should default item duration to 10 when not set', async () => {
      const dbDisplay = {
        organizationId: 'org-1',
        currentPlaylist: {
          id: 'p-1',
          name: 'Test',
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [
            {
              id: 'item-1',
              contentId: 'c-1',
              order: 1,
              duration: null,
              content: null,
            },
          ],
        },
      };
      mockDatabaseService.display.findUnique.mockResolvedValueOnce(dbDisplay);

      const result = await service.getDevicePlaylist('device-1');

      expect(result!.items[0].duration).toBe(10);
    });

    it('should fallback to organization default playlist', async () => {
      // Device exists but has no assigned playlist
      mockDatabaseService.display.findUnique.mockResolvedValueOnce({
        organizationId: 'org-1',
        currentPlaylist: null,
      });

      const orgPlaylist = {
        id: 'org-p-1',
        name: 'Org Default',
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
      };
      mockDatabaseService.playlist.findFirst.mockResolvedValueOnce(orgPlaylist);

      const result = await service.getDevicePlaylist('device-1');

      expect(result).toBeDefined();
      expect(result!.id).toBe('org-p-1');
      expect(result!.name).toBe('Org Default');
      expect(mockDatabaseService.playlist.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-1' },
        }),
      );
    });

    it('should return null when no playlist found anywhere', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValueOnce({
        organizationId: 'org-1',
        currentPlaylist: null,
      });
      mockDatabaseService.playlist.findFirst.mockResolvedValueOnce(null);

      const result = await service.getDevicePlaylist('device-1');

      expect(result).toBeNull();
    });

    it('should return null when device not found', async () => {
      mockDatabaseService.display.findUnique.mockResolvedValueOnce(null);

      const result = await service.getDevicePlaylist('device-1');

      expect(result).toBeNull();
    });

    it('should return null on database error', async () => {
      mockDatabaseService.display.findUnique.mockRejectedValueOnce(
        new Error('Database connection lost'),
      );

      const result = await service.getDevicePlaylist('device-1');

      expect(result).toBeNull();
    });

    it('should handle non-Error exceptions gracefully', async () => {
      mockDatabaseService.display.findUnique.mockRejectedValueOnce('string error');

      const result = await service.getDevicePlaylist('device-1');

      expect(result).toBeNull();
    });

    it('should handle content being null in playlist items', async () => {
      const dbDisplay = {
        organizationId: 'org-1',
        currentPlaylist: {
          id: 'p-1',
          name: 'Test',
          createdAt: new Date(),
          updatedAt: new Date(),
          items: [
            {
              id: 'item-1',
              contentId: 'c-1',
              order: 0,
              duration: 10,
              content: null,
            },
          ],
        },
      };
      mockDatabaseService.display.findUnique.mockResolvedValueOnce(dbDisplay);

      const result = await service.getDevicePlaylist('device-1');

      expect(result!.items[0].content).toBeUndefined();
    });
  });

  describe('updateDevicePlaylist', () => {
    it('should cache the playlist', async () => {
      const playlist = { id: 'p-1', name: 'Test', items: [] } as any;

      await service.updateDevicePlaylist('device-1', playlist);

      expect(mockRedisService.cachePlaylist).toHaveBeenCalledWith('device-1', playlist);
    });

    it('should throw on Redis error', async () => {
      mockRedisService.cachePlaylist.mockRejectedValueOnce(new Error('Redis down'));

      await expect(
        service.updateDevicePlaylist('device-1', {} as any),
      ).rejects.toThrow('Redis down');
    });
  });

  describe('getInstantPublish', () => {
    it('should return null when no instant publish exists', async () => {
      mockRedisService.get.mockResolvedValueOnce(null);

      const result = await service.getInstantPublish('device-1');

      expect(result).toBeNull();
    });

    it('should return instant publish data when present', async () => {
      const instantPublish = {
        playlistId: 'p-1',
        deviceId: 'device-1',
        publishedAt: new Date().toISOString(),
      };
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(instantPublish));

      const result = await service.getInstantPublish('device-1');

      expect(result).toEqual(instantPublish);
    });

    it('should return null and clean up when instant publish has expired', async () => {
      const instantPublish = {
        playlistId: 'p-1',
        deviceId: 'device-1',
        expiresAt: new Date(Date.now() - 60000).toISOString(), // expired
        publishedAt: new Date().toISOString(),
      };
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(instantPublish));

      const result = await service.getInstantPublish('device-1');

      expect(result).toBeNull();
      expect(mockRedisService.delete).toHaveBeenCalledWith('instant:device-1');
    });

    it('should return instant publish when not expired', async () => {
      const instantPublish = {
        playlistId: 'p-1',
        deviceId: 'device-1',
        expiresAt: new Date(Date.now() + 60000).toISOString(), // future
        publishedAt: new Date().toISOString(),
      };
      mockRedisService.get.mockResolvedValueOnce(JSON.stringify(instantPublish));

      const result = await service.getInstantPublish('device-1');

      expect(result).toEqual(instantPublish);
    });

    it('should return null on error', async () => {
      mockRedisService.get.mockRejectedValueOnce(new Error('Redis error'));

      const result = await service.getInstantPublish('device-1');

      expect(result).toBeNull();
    });
  });

  describe('setInstantPublish', () => {
    it('should store instant publish with custom TTL when expiresAt provided', async () => {
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

      await service.setInstantPublish('device-1', 'p-1', expiresAt);

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'instant:device-1',
        expect.any(String),
        expect.any(Number),
      );

      const storedData = JSON.parse(mockRedisService.set.mock.calls[0][1]);
      expect(storedData.playlistId).toBe('p-1');
      expect(storedData.deviceId).toBe('device-1');
    });

    it('should store instant publish with 1-hour default TTL when no expiresAt', async () => {
      await service.setInstantPublish('device-1', 'p-1');

      expect(mockRedisService.set).toHaveBeenCalledWith(
        'instant:device-1',
        expect.any(String),
        3600,
      );
    });

    it('should throw on Redis error', async () => {
      mockRedisService.set.mockRejectedValueOnce(new Error('Redis down'));

      await expect(
        service.setInstantPublish('device-1', 'p-1'),
      ).rejects.toThrow('Redis down');
    });
  });

  describe('clearInstantPublish', () => {
    it('should delete the instant publish key', async () => {
      await service.clearInstantPublish('device-1');

      expect(mockRedisService.delete).toHaveBeenCalledWith('instant:device-1');
    });

    it('should throw on Redis error', async () => {
      mockRedisService.delete.mockRejectedValueOnce(new Error('Redis down'));

      await expect(
        service.clearInstantPublish('device-1'),
      ).rejects.toThrow('Redis down');
    });
  });
});
