import { NotFoundException } from '@nestjs/common';
import { DisplaysService } from './displays.service';

describe('DisplaysService - Bulk Operations', () => {
  let service: DisplaysService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      display: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      playlist: {
        findFirst: jest.fn(),
      },
      displayGroup: {
        findFirst: jest.fn(),
      },
      displayGroupMember: {
        createMany: jest.fn(),
      },
      displayTag: {
        findMany: jest.fn(),
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      content: {
        findFirst: jest.fn(),
      },
    };

    // Service has 4 constructor dependencies: db, jwtService, httpService, circuitBreaker
    const mockJwtService = { sign: jest.fn() } as any;
    const mockHttpService = { post: jest.fn() } as any;
    const mockCircuitBreaker = { executeWithFallback: jest.fn() } as any;

    service = new DisplaysService(mockDb, mockJwtService, mockHttpService, mockCircuitBreaker);
  });

  describe('bulkDelete', () => {
    it('should delete displays by ids within organization', async () => {
      mockDb.display.deleteMany.mockResolvedValue({ count: 3 });

      const result = await service.bulkDelete('org-1', ['d1', 'd2', 'd3']);

      expect(result).toEqual({ deleted: 3 });
      expect(mockDb.display.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['d1', 'd2', 'd3'] }, organizationId: 'org-1' },
      });
    });

    it('should return 0 when no matching displays', async () => {
      mockDb.display.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.bulkDelete('org-1', ['nonexistent']);

      expect(result).toEqual({ deleted: 0 });
    });
  });

  describe('bulkAssignPlaylist', () => {
    it('should assign playlist to multiple displays and notify realtime', async () => {
      mockDb.playlist.findFirst.mockResolvedValue({ id: 'p1', organizationId: 'org-1', items: [] });
      mockDb.display.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkAssignPlaylist('org-1', ['d1', 'd2'], 'p1');

      expect(result).toEqual({ updated: 2 });
      expect(mockDb.display.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['d1', 'd2'] }, organizationId: 'org-1' },
        data: { currentPlaylistId: 'p1' },
      });
    });

    it('should throw when playlist not found in org', async () => {
      mockDb.playlist.findFirst.mockResolvedValue(null);

      await expect(
        service.bulkAssignPlaylist('org-1', ['d1'], 'bad-playlist')
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkAssignGroup', () => {
    it('should add displays to group', async () => {
      mockDb.displayGroup.findFirst.mockResolvedValue({ id: 'g1', organizationId: 'org-1' });
      mockDb.displayGroupMember.createMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkAssignGroup('org-1', ['d1', 'd2'], 'g1');

      expect(result).toEqual({ added: 2 });
      expect(mockDb.displayGroupMember.createMany).toHaveBeenCalledWith({
        data: [
          { displayId: 'd1', displayGroupId: 'g1' },
          { displayId: 'd2', displayGroupId: 'g1' },
        ],
        skipDuplicates: true,
      });
    });

    it('should throw when group not found in org', async () => {
      mockDb.displayGroup.findFirst.mockResolvedValue(null);

      await expect(
        service.bulkAssignGroup('org-1', ['d1'], 'bad-group')
      ).rejects.toThrow(NotFoundException);
    });
  });
});
