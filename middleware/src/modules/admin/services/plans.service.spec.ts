import { NotFoundException, ConflictException } from '@nestjs/common';
import { PlansService, CreatePlanDto } from './plans.service';
import { DatabaseService } from '../../database/database.service';

describe('PlansService', () => {
  let service: PlansService;
  let mockDb: any;

  const mockPlan = {
    id: 'plan-123',
    slug: 'pro',
    name: 'Pro Plan',
    description: 'Professional plan for growing businesses',
    screenQuota: 25,
    storageQuotaMb: 10000,
    apiRateLimit: 5000,
    priceUsdMonthly: 4999, // $49.99
    priceUsdYearly: 47988, // $479.88
    priceInrMonthly: 399900, // INR 3999
    priceInrYearly: 3839000, // INR 38390
    stripePriceIdMonthly: 'price_stripe_monthly',
    stripePriceIdYearly: 'price_stripe_yearly',
    razorpayPlanIdMonthly: 'plan_rp_monthly',
    razorpayPlanIdYearly: 'plan_rp_yearly',
    features: ['analytics', 'api_access', 'priority_support'],
    featureFlags: { advancedAnalytics: true },
    isActive: true,
    isPublic: true,
    sortOrder: 1,
    highlightText: 'Most Popular',
    createdAt: new Date(),
    updatedAt: new Date(),
    promotions: [],
  };

  beforeEach(() => {
    mockDb = {
      plan: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new PlansService(mockDb as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all plans sorted by sortOrder', async () => {
      const plans = [mockPlan, { ...mockPlan, id: 'plan-456', slug: 'basic', sortOrder: 0 }];
      mockDb.plan.findMany.mockResolvedValue(plans);

      const result = await service.findAll();

      expect(result).toEqual(plans);
      expect(mockDb.plan.findMany).toHaveBeenCalledWith({
        orderBy: { sortOrder: 'asc' },
        include: {
          promotions: {
            include: { promotion: true },
          },
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a plan by ID', async () => {
      mockDb.plan.findUnique.mockResolvedValue(mockPlan);

      const result = await service.findOne('plan-123');

      expect(result).toEqual(mockPlan);
      expect(mockDb.plan.findUnique).toHaveBeenCalledWith({
        where: { id: 'plan-123' },
        include: {
          promotions: {
            include: { promotion: true },
          },
        },
      });
    });

    it('should throw NotFoundException for non-existent plan', async () => {
      mockDb.plan.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findBySlug', () => {
    it('should return a plan by slug', async () => {
      mockDb.plan.findUnique.mockResolvedValue(mockPlan);

      const result = await service.findBySlug('pro');

      expect(result).toEqual(mockPlan);
      expect(mockDb.plan.findUnique).toHaveBeenCalledWith({
        where: { slug: 'pro' },
        include: {
          promotions: {
            include: { promotion: true },
          },
        },
      });
    });

    it('should throw NotFoundException for non-existent slug', async () => {
      mockDb.plan.findUnique.mockResolvedValue(null);

      await expect(service.findBySlug('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findActive', () => {
    it('should return only active and public plans', async () => {
      const activePlans = [mockPlan];
      mockDb.plan.findMany.mockResolvedValue(activePlans);

      const result = await service.findActive();

      expect(result).toEqual(activePlans);
      expect(mockDb.plan.findMany).toHaveBeenCalledWith({
        where: { isActive: true, isPublic: true },
        orderBy: { sortOrder: 'asc' },
      });
    });
  });

  describe('create', () => {
    const createDto: CreatePlanDto = {
      slug: 'enterprise',
      name: 'Enterprise Plan',
      screenQuota: -1,
      priceUsdMonthly: 19999,
      priceUsdYearly: 191988,
      priceInrMonthly: 1499900,
      priceInrYearly: 14399000,
    };

    it('should create a new plan', async () => {
      mockDb.plan.findUnique.mockResolvedValue(null);
      mockDb.plan.create.mockResolvedValue({ id: 'new-plan', ...createDto });

      const result = await service.create(createDto);

      expect(result).toHaveProperty('id', 'new-plan');
      expect(mockDb.plan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: 'enterprise',
          name: 'Enterprise Plan',
          screenQuota: -1,
          storageQuotaMb: 5000,
          apiRateLimit: 1000,
        }),
      });
    });

    it('should throw ConflictException for duplicate slug', async () => {
      mockDb.plan.findUnique.mockResolvedValue(mockPlan);

      await expect(service.create({ ...createDto, slug: 'pro' })).rejects.toThrow(ConflictException);
    });

    it('should use default values for optional fields', async () => {
      mockDb.plan.findUnique.mockResolvedValue(null);
      mockDb.plan.create.mockResolvedValue({ id: 'new-plan', ...createDto });

      await service.create(createDto);

      expect(mockDb.plan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          storageQuotaMb: 5000,
          apiRateLimit: 1000,
          features: [],
          isActive: true,
          isPublic: true,
          sortOrder: 0,
        }),
      });
    });
  });

  describe('update', () => {
    it('should update an existing plan', async () => {
      mockDb.plan.findUnique.mockResolvedValue(mockPlan);
      mockDb.plan.findFirst.mockResolvedValue(null);
      mockDb.plan.update.mockResolvedValue({ ...mockPlan, name: 'Updated Pro Plan' });

      const result = await service.update('plan-123', { name: 'Updated Pro Plan' });

      expect(result.name).toBe('Updated Pro Plan');
      expect(mockDb.plan.update).toHaveBeenCalledWith({
        where: { id: 'plan-123' },
        data: { name: 'Updated Pro Plan' },
      });
    });

    it('should throw ConflictException for duplicate slug on update', async () => {
      mockDb.plan.findUnique.mockResolvedValue(mockPlan);
      mockDb.plan.findFirst.mockResolvedValue({ id: 'other-plan', slug: 'basic' });

      await expect(service.update('plan-123', { slug: 'basic' })).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException for non-existent plan', async () => {
      mockDb.plan.findUnique.mockResolvedValue(null);

      await expect(service.update('non-existent', { name: 'Test' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should soft delete a plan by setting isActive to false', async () => {
      mockDb.plan.findUnique.mockResolvedValue(mockPlan);
      mockDb.plan.update.mockResolvedValue({ ...mockPlan, isActive: false });

      const result = await service.delete('plan-123');

      expect(result.isActive).toBe(false);
      expect(mockDb.plan.update).toHaveBeenCalledWith({
        where: { id: 'plan-123' },
        data: { isActive: false },
      });
    });
  });

  describe('duplicate', () => {
    it('should duplicate a plan with new slug', async () => {
      mockDb.plan.findUnique
        .mockResolvedValueOnce(mockPlan) // findOne
        .mockResolvedValueOnce(null); // slug check
      mockDb.plan.create.mockResolvedValue({
        ...mockPlan,
        id: 'new-plan',
        slug: 'pro-copy',
        name: 'Pro Plan (Copy)',
        isActive: false,
        isPublic: false,
      });

      const result = await service.duplicate('plan-123');

      expect(result.slug).toBe('pro-copy');
      expect(result.name).toBe('Pro Plan (Copy)');
      expect(result.isActive).toBe(false);
    });

    it('should generate unique slug if copy already exists', async () => {
      mockDb.plan.findUnique
        .mockResolvedValueOnce(mockPlan) // findOne
        .mockResolvedValueOnce({ id: 'existing' }) // pro-copy exists
        .mockResolvedValueOnce(null); // pro-copy-1 available
      mockDb.plan.create.mockResolvedValue({
        ...mockPlan,
        id: 'new-plan',
        slug: 'pro-copy-1',
      });

      const result = await service.duplicate('plan-123');

      expect(result.slug).toBe('pro-copy-1');
    });
  });

  describe('reorder', () => {
    it('should reorder plans by updating sortOrder', async () => {
      const planIds = ['plan-1', 'plan-2', 'plan-3'];
      mockDb.plan.findMany.mockResolvedValue(
        planIds.map(id => ({ id }))
      );
      mockDb.$transaction.mockImplementation(async (ops) => {
        return Promise.all(ops);
      });
      mockDb.plan.update.mockImplementation(async ({ where, data }) => ({
        id: where.id,
        sortOrder: data.sortOrder,
      }));

      const result = await service.reorder(planIds);

      expect(mockDb.$transaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid plan IDs', async () => {
      mockDb.plan.findMany.mockResolvedValue([{ id: 'plan-1' }]);

      await expect(service.reorder(['plan-1', 'plan-2', 'plan-3'])).rejects.toThrow(NotFoundException);
    });
  });
});
