import { Test, TestingModule } from '@nestjs/testing';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';

describe('PlaylistsController', () => {
  let controller: PlaylistsController;
  let mockPlaylistsService: jest.Mocked<PlaylistsService>;

  const organizationId = 'org-123';

  beforeEach(async () => {
    mockPlaylistsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      addItem: jest.fn(),
      removeItem: jest.fn(),
      duplicate: jest.fn(),
      remove: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PlaylistsController],
      providers: [{ provide: PlaylistsService, useValue: mockPlaylistsService }],
    }).compile();

    controller = module.get<PlaylistsController>(PlaylistsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    const createPlaylistDto = {
      name: 'Morning Playlist',
      description: 'Content for morning display',
    };

    it('should create a playlist', async () => {
      const expectedPlaylist = { id: 'playlist-123', ...createPlaylistDto };
      mockPlaylistsService.create.mockResolvedValue(expectedPlaylist as any);

      const result = await controller.create(organizationId, createPlaylistDto as any);

      expect(result).toEqual(expectedPlaylist);
      expect(mockPlaylistsService.create).toHaveBeenCalledWith(organizationId, createPlaylistDto);
    });
  });

  describe('findAll', () => {
    const pagination = { page: 1, limit: 10 };

    it('should return all playlists with pagination', async () => {
      const expectedResult = {
        data: [{ id: 'playlist-1' }, { id: 'playlist-2' }],
        total: 2,
      };
      mockPlaylistsService.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(organizationId, pagination as any);

      expect(result).toEqual(expectedResult);
      expect(mockPlaylistsService.findAll).toHaveBeenCalledWith(organizationId, pagination);
    });

    it('should handle empty results', async () => {
      const expectedResult = { data: [], total: 0 };
      mockPlaylistsService.findAll.mockResolvedValue(expectedResult as any);

      const result = await controller.findAll(organizationId, pagination as any);

      expect(result).toEqual(expectedResult);
    });
  });

  describe('findOne', () => {
    it('should return a playlist by id', async () => {
      const expectedPlaylist = {
        id: 'playlist-123',
        name: 'Test Playlist',
        items: [{ id: 'item-1', contentId: 'content-1' }],
      };
      mockPlaylistsService.findOne.mockResolvedValue(expectedPlaylist as any);

      const result = await controller.findOne(organizationId, 'playlist-123');

      expect(result).toEqual(expectedPlaylist);
      expect(mockPlaylistsService.findOne).toHaveBeenCalledWith(organizationId, 'playlist-123');
    });
  });

  describe('update', () => {
    it('should update a playlist', async () => {
      const updateDto = { name: 'Updated Playlist Name' };
      const expectedPlaylist = { id: 'playlist-123', ...updateDto };
      mockPlaylistsService.update.mockResolvedValue(expectedPlaylist as any);

      const result = await controller.update(organizationId, 'playlist-123', updateDto as any);

      expect(result).toEqual(expectedPlaylist);
      expect(mockPlaylistsService.update).toHaveBeenCalledWith(
        organizationId,
        'playlist-123',
        updateDto,
      );
    });
  });

  describe('addItem', () => {
    it('should add an item to a playlist', async () => {
      const expectedResult = {
        id: 'item-123',
        playlistId: 'playlist-123',
        contentId: 'content-456',
        duration: 10,
      };
      mockPlaylistsService.addItem.mockResolvedValue(expectedResult as any);

      const result = await controller.addItem(
        organizationId,
        'playlist-123',
        'content-456',
        10,
      );

      expect(result).toEqual(expectedResult);
      expect(mockPlaylistsService.addItem).toHaveBeenCalledWith(
        organizationId,
        'playlist-123',
        'content-456',
        10,
      );
    });

    it('should add item without duration', async () => {
      mockPlaylistsService.addItem.mockResolvedValue({ id: 'item-123' } as any);

      await controller.addItem(organizationId, 'playlist-123', 'content-456', undefined);

      expect(mockPlaylistsService.addItem).toHaveBeenCalledWith(
        organizationId,
        'playlist-123',
        'content-456',
        undefined,
      );
    });
  });

  describe('removeItem', () => {
    it('should remove an item from a playlist', async () => {
      mockPlaylistsService.removeItem.mockResolvedValue(undefined);

      await controller.removeItem(organizationId, 'playlist-123', 'item-456');

      expect(mockPlaylistsService.removeItem).toHaveBeenCalledWith(
        organizationId,
        'playlist-123',
        'item-456',
      );
    });
  });

  describe('duplicate', () => {
    it('should duplicate a playlist', async () => {
      const expectedPlaylist = {
        id: 'playlist-456',
        name: 'Morning Playlist (Copy)',
        description: 'Content for morning display',
        items: [{ id: 'item-1', contentId: 'content-1', order: 0 }],
      };
      mockPlaylistsService.duplicate.mockResolvedValue(expectedPlaylist as any);

      const result = await controller.duplicate(organizationId, 'playlist-123');

      expect(result).toEqual(expectedPlaylist);
      expect(mockPlaylistsService.duplicate).toHaveBeenCalledWith(organizationId, 'playlist-123');
    });
  });

  describe('remove', () => {
    it('should remove a playlist', async () => {
      mockPlaylistsService.remove.mockResolvedValue(undefined);

      await controller.remove(organizationId, 'playlist-123');

      expect(mockPlaylistsService.remove).toHaveBeenCalledWith(organizationId, 'playlist-123');
    });
  });
});
