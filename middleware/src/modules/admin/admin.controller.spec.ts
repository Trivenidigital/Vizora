import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { PlansService } from './services/plans.service';
import { PromotionsService } from './services/promotions.service';
import { SystemConfigService } from './services/system-config.service';
import { AdminAuditService } from './services/admin-audit.service';
import { OrganizationsAdminService } from './services/organizations-admin.service';
import { UsersAdminService } from './services/users-admin.service';
import { PlatformHealthService } from './services/platform-health.service';
import { PlatformStatsService } from './services/platform-stats.service';
import { SecurityAdminService } from './services/security-admin.service';
import { AnnouncementsService } from './services/announcements.service';
import { SuperAdminGuard } from './guards/super-admin.guard';
import { DatabaseService } from '../database/database.service';

describe('AdminController', () => {
  let controller: AdminController;
  let mockPlansService: jest.Mocked<PlansService>;
  let mockPromotionsService: jest.Mocked<PromotionsService>;
  let mockSystemConfigService: jest.Mocked<SystemConfigService>;
  let mockAdminAuditService: jest.Mocked<AdminAuditService>;
  let mockOrganizationsAdminService: jest.Mocked<OrganizationsAdminService>;
  let mockUsersAdminService: jest.Mocked<UsersAdminService>;
  let mockPlatformHealthService: jest.Mocked<PlatformHealthService>;
  let mockPlatformStatsService: jest.Mocked<PlatformStatsService>;
  let mockSecurityAdminService: jest.Mocked<SecurityAdminService>;
  let mockAnnouncementsService: jest.Mocked<AnnouncementsService>;

  const adminId = 'admin-123';
  const mockRequest = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
  } as any;

  beforeEach(async () => {
    mockPlansService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      duplicate: jest.fn(),
      reorder: jest.fn(),
    } as any;

    mockPromotionsService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      validate: jest.fn(),
      bulkGenerate: jest.fn(),
      getRedemptions: jest.fn(),
    } as any;

    mockSystemConfigService = {
      findAll: jest.fn(),
      getRecord: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      bulkUpdate: jest.fn(),
    } as any;

    mockAdminAuditService = {
      log: jest.fn(),
      findAll: jest.fn(),
    } as any;

    mockOrganizationsAdminService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      extendTrial: jest.fn(),
      suspend: jest.fn(),
      unsuspend: jest.fn(),
      getStats: jest.fn(),
      addNote: jest.fn(),
    } as any;

    mockUsersAdminService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      disable: jest.fn(),
      enable: jest.fn(),
      resetPassword: jest.fn(),
      grantSuperAdmin: jest.fn(),
      revokeSuperAdmin: jest.fn(),
    } as any;

    mockPlatformHealthService = {
      getOverallHealth: jest.fn(),
      getServiceStatus: jest.fn(),
      checkDatabase: jest.fn(),
      getErrorRates: jest.fn(),
      getUptimeHistory: jest.fn(),
    } as any;

    mockPlatformStatsService = {
      getOverview: jest.fn(),
      getRevenue: jest.fn(),
      getSignups: jest.fn(),
      getChurn: jest.fn(),
      getUsageStats: jest.fn(),
      getByPlan: jest.fn(),
      getGeographic: jest.fn(),
    } as any;

    mockSecurityAdminService = {
      getIpBlocklist: jest.fn(),
      blockIp: jest.fn(),
      unblockIp: jest.fn(),
      getAllApiKeys: jest.fn(),
      revokeApiKey: jest.fn(),
    } as any;

    mockAnnouncementsService = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      publish: jest.fn(),
    } as any;

    // Mock DatabaseService for SuperAdminGuard
    const mockDatabaseService = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ isSuperAdmin: true }),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: PlansService, useValue: mockPlansService },
        { provide: PromotionsService, useValue: mockPromotionsService },
        { provide: SystemConfigService, useValue: mockSystemConfigService },
        { provide: AdminAuditService, useValue: mockAdminAuditService },
        { provide: OrganizationsAdminService, useValue: mockOrganizationsAdminService },
        { provide: UsersAdminService, useValue: mockUsersAdminService },
        { provide: PlatformHealthService, useValue: mockPlatformHealthService },
        { provide: PlatformStatsService, useValue: mockPlatformStatsService },
        { provide: SecurityAdminService, useValue: mockSecurityAdminService },
        { provide: AnnouncementsService, useValue: mockAnnouncementsService },
        { provide: DatabaseService, useValue: mockDatabaseService },
        SuperAdminGuard,
      ],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ============================================================================
  // PLANS TESTS
  // ============================================================================

  describe('Plans', () => {
    const mockPlan = {
      id: 'plan-123',
      slug: 'pro',
      name: 'Pro Plan',
      screenQuota: 50,
      priceUsdMonthly: 4999,
      priceUsdYearly: 49999,
      priceInrMonthly: 399900,
      priceInrYearly: 3999900,
    };

    it('should get all plans', async () => {
      mockPlansService.findAll.mockResolvedValue([mockPlan] as any);

      const result = await controller.getPlans();

      expect(result).toEqual([mockPlan]);
      expect(mockPlansService.findAll).toHaveBeenCalled();
    });

    it('should get a plan by ID', async () => {
      mockPlansService.findOne.mockResolvedValue(mockPlan as any);

      const result = await controller.getPlan('plan-123');

      expect(result).toEqual(mockPlan);
      expect(mockPlansService.findOne).toHaveBeenCalledWith('plan-123');
    });

    it('should create a plan and log the action', async () => {
      const createDto = {
        slug: 'enterprise',
        name: 'Enterprise',
        screenQuota: 100,
        priceUsdMonthly: 9999,
        priceUsdYearly: 99999,
        priceInrMonthly: 799900,
        priceInrYearly: 7999900,
      };
      mockPlansService.create.mockResolvedValue({ id: 'new-plan', ...createDto } as any);

      const result = await controller.createPlan(createDto as any, adminId, mockRequest);

      expect(result.id).toBe('new-plan');
      expect(mockPlansService.create).toHaveBeenCalledWith(createDto);
      expect(mockAdminAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: adminId,
          action: 'plan.create',
          targetType: 'plan',
        }),
      );
    });

    it('should update a plan', async () => {
      const updateDto = { name: 'Updated Pro Plan' };
      mockPlansService.update.mockResolvedValue({ ...mockPlan, ...updateDto } as any);

      const result = await controller.updatePlan('plan-123', updateDto as any, adminId, mockRequest);

      expect(result.name).toBe('Updated Pro Plan');
      expect(mockPlansService.update).toHaveBeenCalledWith('plan-123', updateDto);
    });

    it('should delete a plan', async () => {
      mockPlansService.delete.mockResolvedValue({ isActive: false } as any);

      await controller.deletePlan('plan-123', adminId, mockRequest);

      expect(mockPlansService.delete).toHaveBeenCalledWith('plan-123');
      expect(mockAdminAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'plan.delete' }),
      );
    });

    it('should duplicate a plan', async () => {
      mockPlansService.duplicate.mockResolvedValue({ ...mockPlan, id: 'plan-copy' } as any);

      const result = await controller.duplicatePlan('plan-123', adminId, mockRequest);

      expect(result.id).toBe('plan-copy');
      expect(mockPlansService.duplicate).toHaveBeenCalledWith('plan-123');
    });
  });

  // ============================================================================
  // PROMOTIONS TESTS
  // ============================================================================

  describe('Promotions', () => {
    const mockPromotion = {
      id: 'promo-123',
      code: 'LAUNCH50',
      name: 'Launch Discount',
      discountType: 'percentage',
      discountValue: 50,
    };

    it('should get all promotions', async () => {
      mockPromotionsService.findAll.mockResolvedValue([mockPromotion] as any);

      const result = await controller.getPromotions();

      expect(result).toEqual([mockPromotion]);
    });

    it('should create a promotion', async () => {
      const createDto = {
        code: 'SUMMER25',
        name: 'Summer Sale',
        discountType: 'percentage',
        discountValue: 25,
        startsAt: '2026-06-01',
      };
      mockPromotionsService.create.mockResolvedValue({ id: 'new-promo', ...createDto } as any);

      const result = await controller.createPromotion(createDto as any, adminId, mockRequest);

      expect(result.id).toBe('new-promo');
      expect(mockAdminAuditService.log).toHaveBeenCalled();
    });

    it('should validate a promotion code', async () => {
      mockPromotionsService.validate.mockResolvedValue({ valid: true, promotion: mockPromotion as any });

      const result = await controller.validatePromotion({ code: 'LAUNCH50' });

      expect(result.valid).toBe(true);
      expect(mockPromotionsService.validate).toHaveBeenCalledWith('LAUNCH50', undefined, undefined);
    });

    it('should bulk generate promotion codes', async () => {
      mockPromotionsService.bulkGenerate.mockResolvedValue(['SUMMER-ABC123', 'SUMMER-DEF456']);

      const result = await controller.bulkGeneratePromotions(
        { prefix: 'SUMMER', count: 2 } as any,
        adminId,
        mockRequest,
      );

      expect(result.codes).toHaveLength(2);
      expect(result.count).toBe(2);
    });
  });

  // ============================================================================
  // ORGANIZATIONS TESTS
  // ============================================================================

  describe('Organizations', () => {
    const mockOrg = {
      id: 'org-123',
      name: 'Test Org',
      subscriptionTier: 'pro',
      subscriptionStatus: 'active',
    };

    it('should get all organizations with filters', async () => {
      mockOrganizationsAdminService.findAll.mockResolvedValue({
        data: [mockOrg],
        total: 1,
        skip: 0,
        take: 20,
      });

      const result = await controller.getOrganizations({ page: 1, limit: 20 });

      expect(result.data).toEqual([mockOrg]);
      expect(result.total).toBe(1);
    });

    it('should extend trial period', async () => {
      mockOrganizationsAdminService.extendTrial.mockResolvedValue({
        ...mockOrg,
        trialEndsAt: new Date('2026-03-01'),
      } as any);

      const result = await controller.extendTrial(
        'org-123',
        { days: 30, reason: 'Customer request' },
        adminId,
        mockRequest,
      );

      expect(mockOrganizationsAdminService.extendTrial).toHaveBeenCalledWith('org-123', 30);
      expect(mockAdminAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'organization.extend_trial' }),
      );
    });

    it('should suspend an organization', async () => {
      mockOrganizationsAdminService.suspend.mockResolvedValue({
        ...mockOrg,
        subscriptionStatus: 'suspended',
      } as any);

      await controller.suspendOrganization('org-123', { reason: 'TOS violation' }, adminId, mockRequest);

      expect(mockOrganizationsAdminService.suspend).toHaveBeenCalledWith('org-123', 'TOS violation');
    });

    it('should unsuspend an organization', async () => {
      mockOrganizationsAdminService.unsuspend.mockResolvedValue({
        ...mockOrg,
        subscriptionStatus: 'active',
      } as any);

      await controller.unsuspendOrganization('org-123', adminId, mockRequest);

      expect(mockOrganizationsAdminService.unsuspend).toHaveBeenCalledWith('org-123');
    });
  });

  // ============================================================================
  // USERS TESTS
  // ============================================================================

  describe('Users', () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      isSuperAdmin: false,
      isActive: true,
    };

    it('should get all users with filters', async () => {
      mockUsersAdminService.findAll.mockResolvedValue({
        data: [mockUser],
        total: 1,
        skip: 0,
        take: 20,
      });

      const result = await controller.getUsers({ page: 1, limit: 20 });

      expect(result.data).toEqual([mockUser]);
    });

    it('should disable a user', async () => {
      mockUsersAdminService.disable.mockResolvedValue({ ...mockUser, isActive: false } as any);

      const result = await controller.disableUser('user-123', adminId, mockRequest);

      expect(result.isActive).toBe(false);
      expect(mockAdminAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.disable' }),
      );
    });

    it('should enable a user', async () => {
      mockUsersAdminService.enable.mockResolvedValue({ ...mockUser, isActive: true } as any);

      const result = await controller.enableUser('user-123', adminId, mockRequest);

      expect(result.isActive).toBe(true);
    });

    it('should reset user password', async () => {
      mockUsersAdminService.resetPassword.mockResolvedValue({ temporaryPassword: 'temp123!' });

      const result = await controller.resetUserPassword('user-123', adminId, mockRequest);

      expect(result.temporaryPassword).toBe('temp123!');
    });

    it('should grant super admin privileges', async () => {
      mockUsersAdminService.grantSuperAdmin.mockResolvedValue({ ...mockUser, isSuperAdmin: true } as any);

      const result = await controller.grantSuperAdmin('user-123', adminId, mockRequest);

      expect(result.isSuperAdmin).toBe(true);
      expect(mockAdminAuditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.grant_super_admin' }),
      );
    });

    it('should revoke super admin privileges', async () => {
      mockUsersAdminService.revokeSuperAdmin.mockResolvedValue({ ...mockUser, isSuperAdmin: false } as any);

      const result = await controller.revokeSuperAdmin('user-123', adminId, mockRequest);

      expect(result.isSuperAdmin).toBe(false);
    });
  });

  // ============================================================================
  // HEALTH TESTS
  // ============================================================================

  describe('Health', () => {
    it('should get overall health status', async () => {
      mockPlatformHealthService.getOverallHealth.mockResolvedValue({
        overall: 'healthy',
        services: {},
        timestamp: '2026-02-05T00:00:00Z',
      } as any);

      const result = await controller.getHealth();

      expect(result.overall).toBe('healthy');
    });

    it('should get service status', async () => {
      mockPlatformHealthService.getServiceStatus.mockResolvedValue([
        { name: 'middleware', port: 3000, status: 'healthy' },
      ] as any);

      const result = await controller.getServiceStatus();

      expect(result).toHaveLength(1);
    });
  });

  // ============================================================================
  // STATS TESTS
  // ============================================================================

  describe('Stats', () => {
    it('should get platform overview', async () => {
      mockPlatformStatsService.getOverview.mockResolvedValue({
        totalOrganizations: 100,
        totalUsers: 500,
        totalDisplays: 1000,
      } as any);

      const result = await controller.getStatsOverview();

      expect(result.totalOrganizations).toBe(100);
    });

    it('should get revenue stats', async () => {
      mockPlatformStatsService.getRevenue.mockResolvedValue({
        period: 'month',
        mrr: 50000,
        arr: 600000,
      } as any);

      const result = await controller.getRevenueStats('month');

      expect(result.mrr).toBe(50000);
    });
  });

  // ============================================================================
  // CONFIG TESTS
  // ============================================================================

  describe('Config', () => {
    it('should get all config', async () => {
      mockSystemConfigService.findAll.mockResolvedValue([
        { key: 'max_file_size', value: 100, dataType: 'number' },
      ] as any);

      const result = await controller.getAllConfig();

      expect(result).toHaveLength(1);
    });

    it('should set config value', async () => {
      mockSystemConfigService.set.mockResolvedValue({
        key: 'max_file_size',
        value: 200,
      } as any);

      const result = await controller.setConfig(
        'max_file_size',
        { value: 200, dataType: 'number' },
        adminId,
        mockRequest,
      );

      expect(result.value).toBe(200);
    });
  });

  // ============================================================================
  // SECURITY TESTS
  // ============================================================================

  describe('Security', () => {
    it('should get IP blocklist', async () => {
      mockSecurityAdminService.getIpBlocklist.mockResolvedValue([
        { id: 'block-1', ipAddress: '192.168.1.1', isActive: true },
      ] as any);

      const result = await controller.getIpBlocklist();

      expect(result).toHaveLength(1);
    });

    it('should block an IP', async () => {
      mockSecurityAdminService.blockIp.mockResolvedValue({
        id: 'block-2',
        ipAddress: '10.0.0.1',
        reason: 'Suspicious activity',
      } as any);

      const result = await controller.blockIp(
        { ipAddress: '10.0.0.1', reason: 'Suspicious activity' },
        adminId,
        mockRequest,
      );

      expect(result.ipAddress).toBe('10.0.0.1');
    });

    it('should get all API keys', async () => {
      mockSecurityAdminService.getAllApiKeys.mockResolvedValue([
        { id: 'key-1', name: 'Production Key', prefix: 'vz_live_' },
      ] as any);

      const result = await controller.getAllApiKeys();

      expect(result).toHaveLength(1);
    });

    it('should revoke an API key', async () => {
      mockSecurityAdminService.revokeApiKey.mockResolvedValue({ revoked: true, keyId: 'key-1' });

      const result = await controller.revokeApiKey('key-1', adminId, mockRequest);

      expect(result.revoked).toBe(true);
    });
  });

  // ============================================================================
  // ANNOUNCEMENTS TESTS
  // ============================================================================

  describe('Announcements', () => {
    const mockAnnouncement = {
      id: 'ann-123',
      title: 'System Maintenance',
      message: 'We will be down for maintenance',
      type: 'maintenance',
      isActive: false,
    };

    it('should get all announcements', async () => {
      mockAnnouncementsService.findAll.mockResolvedValue([mockAnnouncement] as any);

      const result = await controller.getAnnouncements();

      expect(result).toHaveLength(1);
    });

    it('should create an announcement', async () => {
      mockAnnouncementsService.create.mockResolvedValue({ ...mockAnnouncement, id: 'new-ann' } as any);

      const result = await controller.createAnnouncement(
        {
          title: 'New Feature',
          message: 'Check out our new feature',
          startsAt: '2026-02-05',
        } as any,
        adminId,
        mockRequest,
      );

      expect(result.id).toBe('new-ann');
    });

    it('should publish an announcement', async () => {
      mockAnnouncementsService.publish.mockResolvedValue({ ...mockAnnouncement, isActive: true } as any);

      const result = await controller.publishAnnouncement('ann-123', adminId, mockRequest);

      expect(result.isActive).toBe(true);
    });
  });
});
