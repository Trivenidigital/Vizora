import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PromotionsService, CreatePromotionDto } from './promotions.service';
import { DatabaseService } from '../../database/database.service';

describe('PromotionsService', () => {
  let service: PromotionsService;
  let mockDb: any;

  const mockPromotion = {
    id: 'promo-123',
    code: 'LAUNCH50',
    name: 'Launch Discount',
    description: '50% off for early adopters',
    discountType: 'percentage',
    discountValue: 50,
    currency: null,
    maxRedemptions: 100,
    maxPerCustomer: 1,
    currentRedemptions: 10,
    minPurchaseAmount: null,
    startsAt: new Date('2026-01-01'),
    expiresAt: new Date('2026-12-31'),
    isActive: true,
    createdBy: 'admin-123',
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    applicablePlans: [],
    redemptions: [],
    _count: { redemptions: 10 },
  };

  beforeEach(() => {
    mockDb = {
      promotion: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      planPromotion: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      promotionRedemption: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    service = new PromotionsService(mockDb as DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return all promotions with redemption counts', async () => {
      mockDb.promotion.findMany.mockResolvedValue([mockPromotion]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0]._count.redemptions).toBe(10);
      expect(mockDb.promotion.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
        include: {
          applicablePlans: { include: { plan: true } },
          _count: { select: { redemptions: true } },
        },
      });
    });
  });

  describe('findOne', () => {
    it('should return a promotion by ID', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(mockPromotion);

      const result = await service.findOne('promo-123');

      expect(result).toEqual(mockPromotion);
    });

    it('should throw NotFoundException for non-existent promotion', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCode', () => {
    it('should return a promotion by code (case-insensitive)', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(mockPromotion);

      const result = await service.findByCode('launch50');

      expect(result).toEqual(mockPromotion);
      expect(mockDb.promotion.findUnique).toHaveBeenCalledWith({
        where: { code: 'LAUNCH50' },
        include: {
          applicablePlans: { include: { plan: true } },
        },
      });
    });
  });

  describe('create', () => {
    const createDto: CreatePromotionDto = {
      code: 'SUMMER20',
      name: 'Summer Sale',
      discountType: 'percentage',
      discountValue: 20,
      startsAt: new Date('2026-06-01'),
      expiresAt: new Date('2026-08-31'),
    };

    it('should create a new promotion', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(null);
      mockDb.promotion.create.mockResolvedValue({ id: 'new-promo', ...createDto, code: 'SUMMER20' });

      const result = await service.create(createDto);

      expect(result.code).toBe('SUMMER20');
      expect(mockDb.promotion.create).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate code', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(mockPromotion);

      await expect(service.create({ ...createDto, code: 'LAUNCH50' })).rejects.toThrow(ConflictException);
    });

    it('should create promotion with plan associations', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(null);
      mockDb.promotion.create.mockResolvedValue({
        id: 'new-promo',
        ...createDto,
        applicablePlans: [{ planId: 'plan-1' }],
      });

      await service.create({ ...createDto, planIds: ['plan-1'] });

      expect(mockDb.promotion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          applicablePlans: {
            create: [{ planId: 'plan-1' }],
          },
        }),
        include: expect.any(Object),
      });
    });

    it('should throw BadRequestException for percentage > 100', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...createDto, discountType: 'percentage', discountValue: 150 })
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for fixed_amount without currency', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ ...createDto, discountType: 'fixed_amount', discountValue: 1000 })
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept fixed_amount with currency', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(null);
      mockDb.promotion.create.mockResolvedValue({
        id: 'new-promo',
        discountType: 'fixed_amount',
        discountValue: 1000,
        currency: 'usd',
      });

      const result = await service.create({
        ...createDto,
        discountType: 'fixed_amount',
        discountValue: 1000,
        currency: 'usd',
      });

      expect(result.discountType).toBe('fixed_amount');
    });
  });

  describe('update', () => {
    it('should update an existing promotion', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(mockPromotion);
      mockDb.promotion.update.mockResolvedValue({ ...mockPromotion, name: 'Updated Name' });

      const result = await service.update('promo-123', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
    });

    it('should update plan associations', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(mockPromotion);
      mockDb.planPromotion.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.planPromotion.createMany.mockResolvedValue({ count: 2 });
      mockDb.promotion.update.mockResolvedValue(mockPromotion);

      await service.update('promo-123', { planIds: ['plan-1', 'plan-2'] });

      expect(mockDb.planPromotion.deleteMany).toHaveBeenCalledWith({
        where: { promotionId: 'promo-123' },
      });
      expect(mockDb.planPromotion.createMany).toHaveBeenCalledWith({
        data: [
          { promotionId: 'promo-123', planId: 'plan-1' },
          { promotionId: 'promo-123', planId: 'plan-2' },
        ],
      });
    });
  });

  describe('delete', () => {
    it('should delete a promotion', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(mockPromotion);
      mockDb.promotion.delete.mockResolvedValue(mockPromotion);

      const result = await service.delete('promo-123');

      expect(result).toEqual({ deleted: true });
      expect(mockDb.promotion.delete).toHaveBeenCalledWith({
        where: { id: 'promo-123' },
      });
    });
  });

  describe('validate', () => {
    it('should return valid for active promotion', async () => {
      mockDb.promotion.findUnique.mockResolvedValue({
        ...mockPromotion,
        applicablePlans: [],
        redemptions: [],
      });

      const result = await service.validate('LAUNCH50');

      expect(result.valid).toBe(true);
      expect(result.promotion).toBeDefined();
    });

    it('should return invalid for non-existent code', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(null);

      const result = await service.validate('INVALID');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Promotion code not found');
    });

    it('should return invalid for inactive promotion', async () => {
      mockDb.promotion.findUnique.mockResolvedValue({
        ...mockPromotion,
        isActive: false,
      });

      const result = await service.validate('LAUNCH50');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Promotion is no longer active');
    });

    it('should return invalid for expired promotion', async () => {
      mockDb.promotion.findUnique.mockResolvedValue({
        ...mockPromotion,
        expiresAt: new Date('2020-01-01'),
      });

      const result = await service.validate('LAUNCH50');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Promotion has expired');
    });

    it('should return invalid for promotion not yet started', async () => {
      mockDb.promotion.findUnique.mockResolvedValue({
        ...mockPromotion,
        startsAt: new Date('2099-01-01'),
      });

      const result = await service.validate('LAUNCH50');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Promotion has not started yet');
    });

    it('should return invalid when redemption limit reached', async () => {
      mockDb.promotion.findUnique.mockResolvedValue({
        ...mockPromotion,
        maxRedemptions: 10,
        currentRedemptions: 10,
      });

      const result = await service.validate('LAUNCH50');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Promotion redemption limit reached');
    });

    it('should return invalid when per-customer limit reached', async () => {
      mockDb.promotion.findUnique.mockResolvedValue({
        ...mockPromotion,
        maxPerCustomer: 1,
        redemptions: [{ organizationId: 'org-123' }],
      });

      const result = await service.validate('LAUNCH50', undefined, 'org-123');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('You have already used this promotion');
    });

    it('should return invalid for ineligible plan', async () => {
      mockDb.promotion.findUnique.mockResolvedValue({
        ...mockPromotion,
        applicablePlans: [{ planId: 'plan-pro' }],
        redemptions: [],
      });

      const result = await service.validate('LAUNCH50', 'plan-basic');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Promotion is not valid for this plan');
    });
  });

  describe('redeem', () => {
    it('should create redemption and increment counter', async () => {
      mockDb.promotion.findUnique
        .mockResolvedValueOnce({ ...mockPromotion, applicablePlans: [], redemptions: [] })
        .mockResolvedValueOnce(mockPromotion);
      mockDb.$transaction.mockResolvedValue([
        { id: 'redemption-1', promotionId: 'promo-123', organizationId: 'org-123', discountApplied: 2499 },
        { id: 'promo-123', currentRedemptions: 11 },
      ]);

      const result = await service.redeem('LAUNCH50', 'org-123', 2499);

      expect(result.promotionId).toBe('promo-123');
      expect(result.discountApplied).toBe(2499);
    });

    it('should throw BadRequestException for invalid code', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(null);

      await expect(service.redeem('INVALID', 'org-123', 1000)).rejects.toThrow(BadRequestException);
    });
  });

  describe('bulkGenerate', () => {
    it('should generate multiple unique codes', async () => {
      mockDb.promotion.findMany.mockResolvedValue([]);

      const result = await service.bulkGenerate('BATCH', 5);

      expect(result).toHaveLength(5);
      result.forEach(code => {
        expect(code).toMatch(/^BATCH-[A-F0-9]{8}$/);
      });
    });

    it('should filter out existing codes', async () => {
      mockDb.promotion.findMany.mockResolvedValue([{ code: 'BATCH-12345678' }]);

      const result = await service.bulkGenerate('BATCH', 3);

      // All generated codes should not include the existing one
      expect(result.every(code => code !== 'BATCH-12345678')).toBe(true);
    });
  });

  describe('getRedemptions', () => {
    it('should return redemption history for a promotion', async () => {
      mockDb.promotion.findUnique.mockResolvedValue(mockPromotion);
      mockDb.promotionRedemption.findMany.mockResolvedValue([
        { id: 'r-1', promotionId: 'promo-123', organizationId: 'org-1', discountApplied: 2499 },
        { id: 'r-2', promotionId: 'promo-123', organizationId: 'org-2', discountApplied: 2499 },
      ]);

      const result = await service.getRedemptions('promo-123');

      expect(result).toHaveLength(2);
      expect(mockDb.promotionRedemption.findMany).toHaveBeenCalledWith({
        where: { promotionId: 'promo-123' },
        orderBy: { redeemedAt: 'desc' },
      });
    });
  });
});
