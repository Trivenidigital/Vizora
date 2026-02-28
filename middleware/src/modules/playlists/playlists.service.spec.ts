import { NotFoundException } from '@nestjs/common';
import { PlaylistsService } from './playlists.service';
import { DatabaseService } from '../database/database.service';

describe('PlaylistsService', () => {
  let service: PlaylistsService;
  let mockDatabaseService: any;

  const mockPlaylist = {
    id: 'playlist-123',
    organizationId: 'org-123',
    name: 'Test Playlist',
    description: 'Test description',
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
  };

  const mockPlaylistItem = {
    id: 'item-123',
    playlistId: 'playlist-123',
    contentId: 'content-123',
    order: 0,
    duration: 10,
  };

  beforeEach(() => {
    mockDatabaseService = {
      playlist: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      playlistItem: {
        create: jest.fn(),
        findFirst: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((fn) => fn(mockDatabaseService)),
      content: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
      },
    };

    const mockEventEmitter = { emit: jest.fn() };
    service = new PlaylistsService(mockDatabaseService as DatabaseService, {} as any, mockEventEmitter as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'New Playlist',
      description: 'New description',
    };

    it('should create a playlist', async () => {
      mockDatabaseService.playlist.create.mockResolvedValue({
        ...mockPlaylist,
        ...createDto,
      });

      const result = await service.create('org-123', createDto);

      expect(result).toBeDefined();
      expect(mockDatabaseService.playlist.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-123',
            name: createDto.name,
          }),
        }),
      );
    });

    it('should create playlist with items', async () => {
      const dtoWithItems = {
        ...createDto,
        items: [{ contentId: 'content-123', order: 0 }],
      };

      // Mock content validation
      mockDatabaseService.content.findMany.mockResolvedValue([
        { id: 'content-123' },
      ]);

      mockDatabaseService.playlist.create.mockResolvedValue({
        ...mockPlaylist,
        items: [mockPlaylistItem],
      });

      const result = await service.create('org-123', dtoWithItems);

      expect(result.items).toHaveLength(1);
    });
  });

  describe('findAll', () => {
    it('should return paginated playlists', async () => {
      mockDatabaseService.playlist.findMany.mockResolvedValue([mockPlaylist]);
      mockDatabaseService.playlist.count.mockResolvedValue(1);

      const result = await service.findAll('org-123', { page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should enforce organization isolation', async () => {
      mockDatabaseService.playlist.findMany.mockResolvedValue([]);
      mockDatabaseService.playlist.count.mockResolvedValue(0);

      await service.findAll('org-123', { page: 1, limit: 10 });

      expect(mockDatabaseService.playlist.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: 'org-123' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return playlist by id', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValue(mockPlaylist);

      const result = await service.findOne('org-123', 'playlist-123');

      expect(result).toEqual({
        ...mockPlaylist,
        itemCount: 0,
        totalDuration: 0,
        totalSize: 0,
      });
    });

    it('should throw NotFoundException if playlist not found', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValue(null);

      await expect(service.findOne('org-123', 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Playlist' };

    it('should update playlist', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValue(mockPlaylist);
      mockDatabaseService.playlist.update.mockResolvedValue({
        ...mockPlaylist,
        ...updateDto,
      });

      const result = await service.update('org-123', 'playlist-123', updateDto);

      expect(result.name).toBe('Updated Playlist');
    });

    it('should replace items when updating with new items', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValue(mockPlaylist);
      mockDatabaseService.content.count.mockResolvedValue(1);
      mockDatabaseService.playlistItem.deleteMany.mockResolvedValue({ count: 1 });
      mockDatabaseService.playlist.update.mockResolvedValue({
        ...mockPlaylist,
        items: [mockPlaylistItem],
      });

      await service.update('org-123', 'playlist-123', {
        items: [{ contentId: 'content-456', order: 0 }],
      });

      expect(mockDatabaseService.playlistItem.deleteMany).toHaveBeenCalledWith({
        where: { playlistId: 'playlist-123' },
      });
    });
  });

  describe('addItem', () => {
    it('should add item to playlist', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValue(mockPlaylist);
      mockDatabaseService.content.findFirst.mockResolvedValue({ id: 'content-123' });
      mockDatabaseService.playlistItem.findFirst.mockResolvedValue({ order: 0 });
      mockDatabaseService.playlistItem.create.mockResolvedValue(mockPlaylistItem);

      const result = await service.addItem('org-123', 'playlist-123', 'content-123', 10);

      expect(result).toEqual(mockPlaylistItem);
    });

    it('should set correct order for new item', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValue(mockPlaylist);
      mockDatabaseService.content.findFirst.mockResolvedValue({ id: 'content-123' });
      mockDatabaseService.playlistItem.findFirst.mockResolvedValue({ order: 5 });
      mockDatabaseService.playlistItem.create.mockResolvedValue(mockPlaylistItem);

      await service.addItem('org-123', 'playlist-123', 'content-123');

      expect(mockDatabaseService.playlistItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            order: 6,
          }),
        }),
      );
    });
  });

  describe('removeItem', () => {
    it('should remove item from playlist', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValue(mockPlaylist);
      mockDatabaseService.playlistItem.deleteMany.mockResolvedValue({ count: 1 });

      const result = await service.removeItem('org-123', 'playlist-123', 'item-123');

      expect(result).toEqual({ id: 'item-123', playlistId: 'playlist-123' });
      expect(mockDatabaseService.playlistItem.deleteMany).toHaveBeenCalledWith({
        where: { id: 'item-123', playlistId: 'playlist-123' },
      });
    });
  });

  describe('duplicate', () => {
    it('should duplicate a playlist with items', async () => {
      const playlistWithItems = {
        ...mockPlaylist,
        name: 'Test Playlist',
        description: 'Test description',
        items: [
          { id: 'item-1', contentId: 'content-1', order: 0, duration: 10, content: null },
          { id: 'item-2', contentId: 'content-2', order: 1, duration: 20, content: null },
        ],
        itemCount: 2,
        totalDuration: 30,
        totalSize: 0,
      };

      const duplicatedPlaylist = {
        id: 'playlist-456',
        name: 'Test Playlist (Copy)',
        description: 'Test description',
        organizationId: 'org-123',
        items: [
          { id: 'item-3', contentId: 'content-1', order: 0, duration: 10 },
          { id: 'item-4', contentId: 'content-2', order: 1, duration: 20 },
        ],
      };

      mockDatabaseService.playlist.findFirst.mockResolvedValue(playlistWithItems);
      mockDatabaseService.playlist.create.mockResolvedValue(duplicatedPlaylist);

      const result = await service.duplicate('org-123', 'playlist-123');

      expect(result).toEqual(duplicatedPlaylist);
      expect(mockDatabaseService.playlist.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Test Playlist (Copy)',
            description: 'Test description',
            organizationId: 'org-123',
            items: {
              create: [
                { contentId: 'content-1', order: 0, duration: 10 },
                { contentId: 'content-2', order: 1, duration: 20 },
              ],
            },
          }),
        }),
      );
    });

    it('should throw NotFoundException if playlist not found', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValue(null);

      await expect(service.duplicate('org-123', 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('reorder', () => {
    it('should reorder playlist items', async () => {
      const playlistWithItems = {
        ...mockPlaylist,
        items: [
          { id: 'item-1', contentId: 'c-1', order: 0, duration: 10, content: null },
          { id: 'item-2', contentId: 'c-2', order: 1, duration: 20, content: null },
          { id: 'item-3', contentId: 'c-3', order: 2, duration: 15, content: null },
        ],
        itemCount: 3,
        totalDuration: 45,
        totalSize: 0,
      };

      // findOne for validation
      mockDatabaseService.playlist.findFirst
        .mockResolvedValueOnce(playlistWithItems)
        // findOne after reorder
        .mockResolvedValueOnce(playlistWithItems);

      // Transaction mock
      mockDatabaseService.$transaction.mockImplementation(async (fn) => {
        return fn(mockDatabaseService);
      });

      // playlistItem.update mocks (6 calls: 3 negative + 3 final)
      mockDatabaseService.playlistItem.update = jest.fn().mockResolvedValue({});

      const result = await service.reorder('org-123', 'playlist-123', ['item-3', 'item-1', 'item-2']);

      expect(mockDatabaseService.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException for invalid item IDs', async () => {
      const playlistWithItems = {
        ...mockPlaylist,
        items: [
          { id: 'item-1', contentId: 'c-1', order: 0, duration: 10, content: null },
        ],
        itemCount: 1,
        totalDuration: 10,
        totalSize: 0,
      };

      mockDatabaseService.playlist.findFirst.mockResolvedValue(playlistWithItems);

      await expect(
        service.reorder('org-123', 'playlist-123', ['item-1', 'invalid-id'])
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if not all items included', async () => {
      const playlistWithItems = {
        ...mockPlaylist,
        items: [
          { id: 'item-1', contentId: 'c-1', order: 0, duration: 10, content: null },
          { id: 'item-2', contentId: 'c-2', order: 1, duration: 20, content: null },
        ],
        itemCount: 2,
        totalDuration: 30,
        totalSize: 0,
      };

      mockDatabaseService.playlist.findFirst.mockResolvedValue(playlistWithItems);

      await expect(
        service.reorder('org-123', 'playlist-123', ['item-1'])
      ).rejects.toThrow(NotFoundException);
    });

    it('should use two-pass approach with negative orders then final orders', async () => {
      const playlistWithItems = {
        id: 'playlist-123',
        organizationId: 'org-123',
        name: 'Test Playlist',
        description: 'Test description',
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          { id: 'item-1', contentId: 'c-1', order: 0, duration: 10, content: null },
          { id: 'item-2', contentId: 'c-2', order: 1, duration: 20, content: null },
        ],
        itemCount: 2,
        totalDuration: 30,
        totalSize: 0,
      };

      mockDatabaseService.playlist.findFirst
        .mockResolvedValueOnce(playlistWithItems)
        .mockResolvedValueOnce(playlistWithItems);

      const updateCalls: Array<{ id: string; order: number }> = [];
      mockDatabaseService.$transaction.mockImplementation(async (fn) => {
        const txProxy = {
          ...mockDatabaseService,
          playlistItem: {
            ...mockDatabaseService.playlistItem,
            update: jest.fn().mockImplementation(({ where, data }) => {
              updateCalls.push({ id: where.id, order: data.order });
              return Promise.resolve({});
            }),
          },
        };
        return fn(txProxy);
      });

      await service.reorder('org-123', 'playlist-123', ['item-2', 'item-1']);

      // Should have 4 calls: 2 negative + 2 final
      expect(updateCalls).toHaveLength(4);
      // Pass 1: negative values
      expect(updateCalls[0]).toEqual({ id: 'item-2', order: -1 });
      expect(updateCalls[1]).toEqual({ id: 'item-1', order: -2 });
      // Pass 2: final values
      expect(updateCalls[2]).toEqual({ id: 'item-2', order: 0 });
      expect(updateCalls[3]).toEqual({ id: 'item-1', order: 1 });
    });

    it('should handle single item reorder', async () => {
      const playlistWithItems = {
        id: 'playlist-123',
        organizationId: 'org-123',
        name: 'Test Playlist',
        description: 'Test description',
        isDefault: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          { id: 'item-1', contentId: 'c-1', order: 0, duration: 10, content: null },
        ],
        itemCount: 1,
        totalDuration: 10,
        totalSize: 0,
      };

      mockDatabaseService.playlist.findFirst
        .mockResolvedValueOnce(playlistWithItems)
        .mockResolvedValueOnce(playlistWithItems);

      mockDatabaseService.$transaction.mockImplementation(async (fn) => {
        return fn(mockDatabaseService);
      });
      mockDatabaseService.playlistItem.update.mockResolvedValue({});

      const result = await service.reorder('org-123', 'playlist-123', ['item-1']);

      expect(mockDatabaseService.$transaction).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when playlist does not exist', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValue(null);

      await expect(
        service.reorder('org-123', 'nonexistent', ['item-1'])
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete playlist', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValue(mockPlaylist);
      mockDatabaseService.playlist.delete.mockResolvedValue(mockPlaylist);

      const result = await service.remove('org-123', 'playlist-123');

      expect(result).toEqual(mockPlaylist);
    });

    it('should throw NotFoundException if playlist not found', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValue(null);

      await expect(service.remove('org-123', 'invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
});
