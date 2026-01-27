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
      },
    };

    service = new PlaylistsService(mockDatabaseService as DatabaseService);
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

      expect(result).toEqual(mockPlaylist);
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
      mockDatabaseService.playlistItem.findFirst.mockResolvedValue({ order: 0 });
      mockDatabaseService.playlistItem.create.mockResolvedValue(mockPlaylistItem);

      const result = await service.addItem('org-123', 'playlist-123', 'content-123', 10);

      expect(result).toEqual(mockPlaylistItem);
    });

    it('should set correct order for new item', async () => {
      mockDatabaseService.playlist.findFirst.mockResolvedValue(mockPlaylist);
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
      mockDatabaseService.playlistItem.delete.mockResolvedValue(mockPlaylistItem);

      const result = await service.removeItem('org-123', 'playlist-123', 'item-123');

      expect(result).toEqual(mockPlaylistItem);
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
