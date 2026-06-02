import { NotFoundException, ConflictException } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { RedisService } from '../redis/redis.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let mockDatabaseService: any;
  let mockStorageService: any;
  let mockRedisService: any;

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    slug: 'test-org',
    subscriptionTier: 'free',
    screenQuota: 5,
    subscriptionStatus: 'active',
    storageUsedBytes: 0,
    storageQuotaBytes: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockDatabaseService = {
      organization: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      content: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
      },
      organizationOnboarding: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((fn) => fn({
        organization: {
          delete: jest.fn().mockResolvedValue(mockOrganization),
        },
      })),
    };

    mockStorageService = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
      isMinioAvailable: jest.fn().mockReturnValue(false),
    };

    mockRedisService = {
      del: jest.fn().mockResolvedValue(true),
    };

    service = new OrganizationsService(
      mockDatabaseService as DatabaseService,
      mockStorageService as StorageService,
      mockRedisService as RedisService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const createDto = {
      name: 'New Organization',
      slug: 'new-org',
    };

    it('should create an organization', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);
      mockDatabaseService.organization.create.mockResolvedValue({
        ...mockOrganization,
        ...createDto,
      });

      const result = await service.create(createDto);

      expect(result).toBeDefined();
      expect(result.slug).toBe('new-org');
    });

    it('should throw ConflictException if slug already exists', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);

      await expect(service.create(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return paginated organizations', async () => {
      mockDatabaseService.organization.findMany.mockResolvedValue([mockOrganization]);
      mockDatabaseService.organization.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });

    it('should use default pagination', async () => {
      mockDatabaseService.organization.findMany.mockResolvedValue([]);
      mockDatabaseService.organization.count.mockResolvedValue(0);

      await service.findAll({});

      expect(mockDatabaseService.organization.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 10,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return organization by id', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);

      const result = await service.findOne('org-123');

      expect(result).toEqual(mockOrganization);
    });

    it('should throw NotFoundException if organization not found', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);

      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug', () => {
    it('should return organization by slug', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);

      const result = await service.findBySlug('test-org');

      expect(result).toEqual(mockOrganization);
    });

    it('should throw NotFoundException if organization not found', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('invalid-slug')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    const updateDto = { name: 'Updated Organization' };

    it('should update organization', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.update.mockResolvedValue({
        ...mockOrganization,
        ...updateDto,
      });

      const result = await service.update('org-123', updateDto);

      expect(result.name).toBe('Updated Organization');
    });

    it('should throw NotFoundException if organization not found', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);

      await expect(service.update('invalid-id', updateDto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if new slug already exists', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDatabaseService.organization.findFirst.mockResolvedValue({ id: 'other-org' });

      await expect(service.update('org-123', { slug: 'existing-slug' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should delete organization in transaction, then clean up storage and cache', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDatabaseService.content.findMany.mockResolvedValue([
        { id: 'c1', url: 'minio://org-123/file.png' },
        { id: 'c2', url: 'https://example.com/file.png' },
      ]);
      mockDatabaseService.user.findMany.mockResolvedValue([
        { id: 'user-1' },
        { id: 'user-2' },
      ]);

      await service.remove('org-123', 'admin-user');

      // Should delete the organization inside a transaction
      expect(mockDatabaseService.$transaction).toHaveBeenCalled();

      // Should delete MinIO files AFTER successful DB delete (only minio:// URLs)
      expect(mockStorageService.deleteFile).toHaveBeenCalledTimes(1);
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith('org-123/file.png');

      // Should clear Redis cache for all users
      expect(mockRedisService.del).toHaveBeenCalledTimes(2);
      expect(mockRedisService.del).toHaveBeenCalledWith('user_auth:user-1');
      expect(mockRedisService.del).toHaveBeenCalledWith('user_auth:user-2');
    });

    it('should continue with cleanup even if MinIO delete fails', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDatabaseService.content.findMany.mockResolvedValue([
        { id: 'c1', url: 'minio://org-123/file.png' },
      ]);
      mockDatabaseService.user.findMany.mockResolvedValue([]);
      mockStorageService.deleteFile.mockRejectedValue(new Error('MinIO down'));

      await service.remove('org-123', 'admin-user');

      // Transaction should still have been called (DB delete succeeded)
      expect(mockDatabaseService.$transaction).toHaveBeenCalled();
    });

    it('should skip foreign MinIO objects during organization deletion cleanup', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(mockOrganization);
      mockDatabaseService.content.findMany.mockResolvedValue([
        { id: 'c1', url: 'minio://org-123/file.png' },
        { id: 'c2', url: 'minio://other-org/secret.png' },
      ]);
      mockDatabaseService.user.findMany.mockResolvedValue([]);

      await service.remove('org-123', 'admin-user');

      expect(mockStorageService.deleteFile).toHaveBeenCalledTimes(1);
      expect(mockStorageService.deleteFile).toHaveBeenCalledWith('org-123/file.png');
      expect(mockStorageService.deleteFile).not.toHaveBeenCalledWith('other-org/secret.png');
    });

    it('should throw NotFoundException if organization not found', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);

      await expect(service.remove('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('setOnboardingNudgeSent (customer-lifecycle write)', () => {
    it('upserts the right column for day1-pair-screen', async () => {
      mockDatabaseService.organizationOnboarding.upsert.mockResolvedValue({
        organizationId: 'org-1',
      });
      const ok = await service.setOnboardingNudgeSent('org-1', 'day1-pair-screen');
      expect(ok).toBe(true);
      const arg = mockDatabaseService.organizationOnboarding.upsert.mock.calls[0][0];
      expect(arg.where).toEqual({ organizationId: 'org-1' });
      expect(arg.create).toMatchObject({ organizationId: 'org-1', day1NudgeSentAt: expect.any(Date) });
      expect(arg.update).toMatchObject({ day1NudgeSentAt: expect.any(Date) });
    });

    it.each([
      ['day3-upload-content', 'day3NudgeSentAt'],
      ['day7-create-schedule', 'day7NudgeSentAt'],
    ] as const)('upserts the right column for %s (column %s)', async (key, col) => {
      mockDatabaseService.organizationOnboarding.upsert.mockResolvedValue({
        organizationId: 'org-1',
      });
      await service.setOnboardingNudgeSent('org-1', key);
      const arg = mockDatabaseService.organizationOnboarding.upsert.mock.calls[0][0];
      expect(arg.create[col]).toBeInstanceOf(Date);
      expect(arg.update[col]).toBeInstanceOf(Date);
    });
  });

  describe('setOnboardingCompleted (customer-lifecycle write)', () => {
    const ageMs = (days: number) => Date.now() - days * 24 * 60 * 60 * 1000;

    it('upserts completedAt=NOW() (idempotent) when org is >= 30 days old', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue({
        createdAt: new Date(ageMs(45)),
      });
      mockDatabaseService.organizationOnboarding.upsert.mockResolvedValue({
        organizationId: 'org-1',
      });
      const ok = await service.setOnboardingCompleted('org-1');
      expect(ok).toBe(true);
      const arg = mockDatabaseService.organizationOnboarding.upsert.mock.calls[0][0];
      expect(arg.create).toMatchObject({ organizationId: 'org-1', completedAt: expect.any(Date) });
      expect(arg.update).toMatchObject({ completedAt: expect.any(Date) });
    });

    it('refuses to mark complete when org is younger than 30 days', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue({
        createdAt: new Date(ageMs(5)),
      });
      const ok = await service.setOnboardingCompleted('org-1');
      expect(ok).toBe(false);
      expect(mockDatabaseService.organizationOnboarding.upsert).not.toHaveBeenCalled();
    });

    it('returns false (does not throw) when org id not found', async () => {
      mockDatabaseService.organization.findUnique.mockResolvedValue(null);
      const ok = await service.setOnboardingCompleted('missing');
      expect(ok).toBe(false);
      expect(mockDatabaseService.organizationOnboarding.upsert).not.toHaveBeenCalled();
    });
  });

  describe('sendOnboardingNudge (customer-lifecycle write — high blast radius)', () => {
    beforeEach(() => {
      // Default: claim succeeds (existing row had col=null, claim flipped it)
      mockDatabaseService.organizationOnboarding.updateMany.mockResolvedValue({ count: 1 });
      mockDatabaseService.organizationOnboarding.findUnique.mockResolvedValue(null);
      mockDatabaseService.organizationOnboarding.create.mockResolvedValue({
        organizationId: 'org-1',
      });
      mockDatabaseService.organizationOnboarding.update.mockResolvedValue({
        organizationId: 'org-1',
      });
      mockDatabaseService.user.findFirst.mockResolvedValue({ email: 'admin@acme.example' });
      // Reset env between tests
      delete process.env.LIFECYCLE_LIVE;
      delete process.env.LIFECYCLE_TEST_EMAILS;
    });

    afterAll(() => {
      delete process.env.LIFECYCLE_LIVE;
      delete process.env.LIFECYCLE_TEST_EMAILS;
    });

    it('returns dry_run when LIFECYCLE_LIVE unset and no TEST_EMAILS — DOES NOT call SMTP', async () => {
      const out = await service.sendOnboardingNudge('org-1', 'day1-pair-screen');
      expect(out).toEqual({
        sent: false,
        recipientCount: 0,
        recipientHashes: [],
        reason: 'dry_run',
      });
      // The claim was rolled back so the next cron firing can retry.
      expect(mockDatabaseService.organizationOnboarding.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ day1NudgeSentAt: null }),
        }),
      );
    });

    it('returns already_sent when dayN_NudgeSentAt is already set — DOES NOT call SMTP', async () => {
      // Claim failed (count=0 because the column was already non-null)
      mockDatabaseService.organizationOnboarding.updateMany.mockResolvedValue({ count: 0 });
      // Existence probe finds the row — dedup hit, not a missing-row case
      mockDatabaseService.organizationOnboarding.findUnique.mockResolvedValue({
        id: 'onb-1',
      });
      process.env.LIFECYCLE_LIVE = 'true'; // even with live=true, dedup prevents send
      const out = await service.sendOnboardingNudge('org-1', 'day1-pair-screen');
      expect(out.sent).toBe(false);
      expect(out.reason).toBe('already_sent');
      // No SMTP, no create, no further claim manipulation
      expect(mockDatabaseService.organizationOnboarding.create).not.toHaveBeenCalled();
    });

    it('returns no_admin when no admin/manager user found', async () => {
      mockDatabaseService.user.findFirst.mockResolvedValue(null);
      process.env.LIFECYCLE_LIVE = 'true';
      const out = await service.sendOnboardingNudge('org-1', 'day1-pair-screen');
      expect(out.sent).toBe(false);
      expect(out.reason).toBe('no_admin');
      // Claim rolled back so the next cron firing can retry.
      expect(mockDatabaseService.organizationOnboarding.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ day1NudgeSentAt: null }),
        }),
      );
    });

    it('NEVER returns plaintext recipient addresses — only sha256 hashes', async () => {
      process.env.LIFECYCLE_TEST_EMAILS = 'redirect@example.test';
      const out = await service.sendOnboardingNudge('org-1', 'day1-pair-screen');
      // recipient_hashes is populated; NEVER plaintext
      const serialized = JSON.stringify(out);
      expect(serialized).not.toContain('admin@acme.example');
      expect(serialized).not.toContain('redirect@example.test');
      // The hashes are deterministic 16-char hex prefixes
      if (out.recipientHashes.length > 0) {
        expect(out.recipientHashes[0]).toMatch(/^[a-f0-9]{16}$/);
      }
    });

    it('creates a fresh onboarding row when one does not exist (no double-claim)', async () => {
      // Claim count=0, AND no row exists → must create with col set in
      // one shot so the claim is visible to concurrent callers.
      mockDatabaseService.organizationOnboarding.updateMany.mockResolvedValue({ count: 0 });
      mockDatabaseService.organizationOnboarding.findUnique.mockResolvedValue(null);
      process.env.LIFECYCLE_LIVE = 'true';

      await service.sendOnboardingNudge('org-1', 'day1-pair-screen');

      expect(mockDatabaseService.organizationOnboarding.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: 'org-1',
          day1NudgeSentAt: expect.any(Date),
        }),
      });
    });
  });
});
