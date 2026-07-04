import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProvisioningTemplatesService } from './provisioning-templates.service';
import { DatabaseService } from '../database/database.service';

describe('ProvisioningTemplatesService', () => {
  let service: ProvisioningTemplatesService;
  let db: any;

  const orgId = 'org-123';

  beforeEach(() => {
    db = {
      provisioningTemplate: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      playlist: { findFirst: jest.fn() },
    };
    service = new ProvisioningTemplatesService(db as unknown as DatabaseService);
  });

  afterEach(() => jest.clearAllMocks());

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  describe('create', () => {
    it('happy path — creates with default orientation/timezone when omitted', async () => {
      db.provisioningTemplate.create.mockResolvedValue({ id: 'tpl-1' });

      await service.create(orgId, { name: 'Lobby TVs' });

      expect(db.provisioningTemplate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: orgId,
          name: 'Lobby TVs',
          defaultOrientation: 'landscape',
          defaultTimezone: 'UTC',
          isDefault: false,
        }),
      });
    });

    it('rejects defaultPlaylistId from another org (cross-tenant guard)', async () => {
      db.playlist.findFirst.mockResolvedValue(null); // playlist not in caller's org

      await expect(
        service.create(orgId, { name: 'X', defaultPlaylistId: 'playlist-foreign' }),
      ).rejects.toThrow(ForbiddenException);
      expect(db.provisioningTemplate.create).not.toHaveBeenCalled();
    });

    it('accepts defaultPlaylistId when it belongs to the caller org', async () => {
      db.playlist.findFirst.mockResolvedValue({ id: 'pl-1', organizationId: orgId });
      db.provisioningTemplate.create.mockResolvedValue({ id: 'tpl-1' });

      await service.create(orgId, { name: 'X', defaultPlaylistId: 'pl-1' });

      expect(db.provisioningTemplate.create).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // findOne — cross-org guard
  // ---------------------------------------------------------------------------
  describe('findOne', () => {
    it('returns template when it belongs to the caller org', async () => {
      db.provisioningTemplate.findFirst.mockResolvedValue({ id: 'tpl-1', organizationId: orgId });
      await expect(service.findOne(orgId, 'tpl-1')).resolves.toEqual(
        expect.objectContaining({ id: 'tpl-1' }),
      );
    });

    it('throws NotFound when template belongs to another org', async () => {
      db.provisioningTemplate.findFirst.mockResolvedValue(null);
      await expect(service.findOne(orgId, 'tpl-foreign')).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // update + remove — cross-org guards
  // ---------------------------------------------------------------------------
  describe('update', () => {
    it('throws NotFound on cross-org PATCH (findOne guard)', async () => {
      db.provisioningTemplate.findFirst.mockResolvedValue(null);
      await expect(service.update(orgId, 'tpl-x', { name: 'new' })).rejects.toThrow(NotFoundException);
      expect(db.provisioningTemplate.updateMany).not.toHaveBeenCalled();
      expect(db.provisioningTemplate.update).not.toHaveBeenCalled();
    });

    it('throws NotFound when the org-scoped updateMany affects zero rows (cross-tenant write backstop)', async () => {
      db.provisioningTemplate.findFirst.mockResolvedValue({ id: 'tpl-1', organizationId: orgId }); // findOne passes
      db.provisioningTemplate.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.update(orgId, 'tpl-1', { name: 'new' })).rejects.toThrow(NotFoundException);
    });

    it('rejects PATCH with cross-org defaultPlaylistId', async () => {
      db.provisioningTemplate.findFirst.mockResolvedValue({ id: 'tpl-1', organizationId: orgId });
      db.playlist.findFirst.mockResolvedValue(null);

      await expect(
        service.update(orgId, 'tpl-1', { defaultPlaylistId: 'playlist-foreign' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows PATCH defaultPlaylistId to null (clear the default playlist)', async () => {
      // findFirst backs both the findOne guard and the post-updateMany re-fetch.
      db.provisioningTemplate.findFirst.mockResolvedValue({ id: 'tpl-1', organizationId: orgId, defaultPlaylistId: null });

      await service.update(orgId, 'tpl-1', { defaultPlaylistId: null as unknown as string });

      // No cross-org check is run when clearing (defaultPlaylistId is null, not undefined)
      expect(db.playlist.findFirst).not.toHaveBeenCalled();
      expect(db.provisioningTemplate.updateMany).toHaveBeenCalledWith({
        where: { id: 'tpl-1', organizationId: orgId },
        data: { defaultPlaylistId: null },
      });
    });
  });

  describe('remove', () => {
    it('throws NotFound on cross-org DELETE (deleteMany affects zero rows)', async () => {
      db.provisioningTemplate.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.remove(orgId, 'tpl-x')).rejects.toThrow(NotFoundException);
      expect(db.provisioningTemplate.deleteMany).toHaveBeenCalledWith({ where: { id: 'tpl-x', organizationId: orgId } });
      expect(db.provisioningTemplate.delete).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // resolveForPairing — apply-at-pairing helper
  // ---------------------------------------------------------------------------
  describe('resolveForPairing', () => {
    it('returns { orientation, timezone, currentPlaylistId } when template has all set', async () => {
      db.provisioningTemplate.findFirst.mockResolvedValue({
        id: 'tpl-1',
        organizationId: orgId,
        defaultOrientation: 'portrait',
        defaultTimezone: 'America/Los_Angeles',
        defaultPlaylistId: 'pl-1',
      });

      const result = await service.resolveForPairing(orgId, 'tpl-1');

      expect(result).toEqual({
        orientation: 'portrait',
        timezone: 'America/Los_Angeles',
        currentPlaylistId: 'pl-1',
      });
    });

    it('omits currentPlaylistId when template defaultPlaylistId is null (playlist was deleted)', async () => {
      db.provisioningTemplate.findFirst.mockResolvedValue({
        id: 'tpl-1',
        organizationId: orgId,
        defaultOrientation: 'landscape',
        defaultTimezone: 'UTC',
        defaultPlaylistId: null,
      });

      const result = await service.resolveForPairing(orgId, 'tpl-1');

      expect(result).toEqual({ orientation: 'landscape', timezone: 'UTC' });
      expect(result).not.toHaveProperty('currentPlaylistId');
    });

    it('throws NotFound for cross-org template (template belongs to another org)', async () => {
      db.provisioningTemplate.findFirst.mockResolvedValue(null);
      await expect(service.resolveForPairing(orgId, 'tpl-foreign')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
