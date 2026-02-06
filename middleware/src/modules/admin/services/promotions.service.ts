import { Injectable, NotFoundException, BadRequestException, ConflictException, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { DatabaseService } from '../../database/database.service';

export interface CreatePromotionDto {
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed_amount' | 'free_months';
  discountValue: number;
  currency?: string;
  maxRedemptions?: number;
  maxPerCustomer?: number;
  minPurchaseAmount?: number;
  startsAt: Date | string;
  expiresAt?: Date | string;
  isActive?: boolean;
  planIds?: string[];
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdatePromotionDto extends Partial<Omit<CreatePromotionDto, 'code'>> {}

export interface ValidationResult {
  valid: boolean;
  promotion?: {
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    currency: string | null;
  };
  error?: string;
}

@Injectable()
export class PromotionsService {
  private readonly logger = new Logger(PromotionsService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Find all promotions
   */
  async findAll() {
    return this.db.promotion.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        applicablePlans: {
          include: {
            plan: true,
          },
        },
        _count: {
          select: { redemptions: true },
        },
      },
    });
  }

  /**
   * Find a promotion by ID with redemption stats
   */
  async findOne(id: string) {
    const promotion = await this.db.promotion.findUnique({
      where: { id },
      include: {
        applicablePlans: {
          include: {
            plan: true,
          },
        },
        _count: {
          select: { redemptions: true },
        },
      },
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion with ID ${id} not found`);
    }

    return promotion;
  }

  /**
   * Find a promotion by code
   */
  async findByCode(code: string) {
    const promotion = await this.db.promotion.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        applicablePlans: {
          include: {
            plan: true,
          },
        },
      },
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion with code '${code}' not found`);
    }

    return promotion;
  }

  /**
   * Create a new promotion
   */
  async create(dto: CreatePromotionDto) {
    const code = dto.code.toUpperCase().trim();

    // Check for duplicate code
    const existing = await this.db.promotion.findUnique({
      where: { code },
    });

    if (existing) {
      throw new ConflictException(`Promotion with code '${code}' already exists`);
    }

    // Validate discount configuration
    this.validateDiscountConfig(dto);

    const promotion = await this.db.promotion.create({
      data: {
        code,
        name: dto.name,
        description: dto.description,
        discountType: dto.discountType,
        discountValue: dto.discountValue,
        currency: dto.currency,
        maxRedemptions: dto.maxRedemptions,
        maxPerCustomer: dto.maxPerCustomer ?? 1,
        minPurchaseAmount: dto.minPurchaseAmount,
        startsAt: new Date(dto.startsAt),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
        createdBy: dto.createdBy,
        metadata: dto.metadata,
        applicablePlans: dto.planIds
          ? {
              create: dto.planIds.map(planId => ({
                planId,
              })),
            }
          : undefined,
      },
      include: {
        applicablePlans: {
          include: {
            plan: true,
          },
        },
      },
    });

    this.logger.log(`Created promotion: ${promotion.code} (${promotion.id})`);
    return promotion;
  }

  /**
   * Update an existing promotion
   */
  async update(id: string, dto: UpdatePromotionDto) {
    await this.findOne(id);

    // Validate discount configuration if updating discount fields
    if (dto.discountType || dto.discountValue !== undefined || dto.currency !== undefined) {
      this.validateDiscountConfig({
        discountType: dto.discountType || 'percentage',
        discountValue: dto.discountValue || 0,
        currency: dto.currency,
      } as CreatePromotionDto);
    }

    const { planIds, ...updateData } = dto;

    // Handle plan associations update
    if (planIds !== undefined) {
      // Remove existing associations
      await this.db.planPromotion.deleteMany({
        where: { promotionId: id },
      });

      // Add new associations
      if (planIds.length > 0) {
        await this.db.planPromotion.createMany({
          data: planIds.map(planId => ({
            promotionId: id,
            planId,
          })),
        });
      }
    }

    const promotion = await this.db.promotion.update({
      where: { id },
      data: {
        ...updateData,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : undefined,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      include: {
        applicablePlans: {
          include: {
            plan: true,
          },
        },
      },
    });

    this.logger.log(`Updated promotion: ${promotion.code} (${promotion.id})`);
    return promotion;
  }

  /**
   * Delete a promotion
   */
  async delete(id: string) {
    await this.findOne(id);

    await this.db.promotion.delete({
      where: { id },
    });

    this.logger.log(`Deleted promotion: ${id}`);
    return { deleted: true };
  }

  /**
   * Validate a promotion code for a specific plan and organization
   */
  async validate(code: string, planId?: string, organizationId?: string): Promise<ValidationResult> {
    const promotion = await this.db.promotion.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        applicablePlans: true,
        redemptions: organizationId
          ? {
              where: { organizationId },
            }
          : false,
      },
    });

    if (!promotion) {
      return { valid: false, error: 'Promotion code not found' };
    }

    // Check if active
    if (!promotion.isActive) {
      return { valid: false, error: 'Promotion is no longer active' };
    }

    // Check date range
    const now = new Date();
    if (promotion.startsAt > now) {
      return { valid: false, error: 'Promotion has not started yet' };
    }

    if (promotion.expiresAt && promotion.expiresAt < now) {
      return { valid: false, error: 'Promotion has expired' };
    }

    // Check global redemption limit
    if (promotion.maxRedemptions !== null && promotion.currentRedemptions >= promotion.maxRedemptions) {
      return { valid: false, error: 'Promotion redemption limit reached' };
    }

    // Check per-customer limit
    if (organizationId && promotion.redemptions) {
      const customerRedemptions = Array.isArray(promotion.redemptions)
        ? promotion.redemptions.length
        : 0;
      if (customerRedemptions >= promotion.maxPerCustomer) {
        return { valid: false, error: 'You have already used this promotion' };
      }
    }

    // Check plan eligibility
    if (planId && promotion.applicablePlans.length > 0) {
      const isPlanEligible = promotion.applicablePlans.some(pp => pp.planId === planId);
      if (!isPlanEligible) {
        return { valid: false, error: 'Promotion is not valid for this plan' };
      }
    }

    return {
      valid: true,
      promotion: {
        id: promotion.id,
        code: promotion.code,
        discountType: promotion.discountType,
        discountValue: promotion.discountValue,
        currency: promotion.currency,
      },
    };
  }

  /**
   * Redeem a promotion code
   */
  async redeem(code: string, organizationId: string, discountApplied: number) {
    // Validate first
    const validation = await this.validate(code, undefined, organizationId);
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const promotion = await this.db.promotion.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promotion) {
      throw new NotFoundException(`Promotion with code '${code}' not found`);
    }

    // Create redemption record and increment counter
    const [redemption] = await this.db.$transaction([
      this.db.promotionRedemption.create({
        data: {
          promotionId: promotion.id,
          organizationId,
          discountApplied,
        },
      }),
      this.db.promotion.update({
        where: { id: promotion.id },
        data: {
          currentRedemptions: { increment: 1 },
        },
      }),
    ]);

    this.logger.log(`Redeemed promotion ${code} for org ${organizationId}, discount: ${discountApplied}`);
    return redemption;
  }

  /**
   * Bulk generate unique promotion codes
   */
  async bulkGenerate(baseCode: string, count: number) {
    const codes: string[] = [];
    const promotions = [];

    for (let i = 0; i < count; i++) {
      const uniquePart = crypto.randomBytes(4).toString('hex').toUpperCase();
      const code = `${baseCode.toUpperCase()}-${uniquePart}`;
      codes.push(code);
    }

    // Check for any existing codes (unlikely but possible)
    const existing = await this.db.promotion.findMany({
      where: { code: { in: codes } },
      select: { code: true },
    });

    const existingCodes = new Set(existing.map(p => p.code));
    const validCodes = codes.filter(c => !existingCodes.has(c));

    this.logger.log(`Bulk generated ${validCodes.length} promotion codes with base: ${baseCode}`);
    return validCodes;
  }

  /**
   * Get redemption history for a promotion
   */
  async getRedemptions(promotionId: string) {
    await this.findOne(promotionId);

    return this.db.promotionRedemption.findMany({
      where: { promotionId },
      orderBy: { redeemedAt: 'desc' },
    });
  }

  /**
   * Validate discount configuration
   */
  private validateDiscountConfig(dto: Pick<CreatePromotionDto, 'discountType' | 'discountValue' | 'currency'>) {
    if (dto.discountType === 'percentage') {
      if (dto.discountValue < 0 || dto.discountValue > 100) {
        throw new BadRequestException('Percentage discount must be between 0 and 100');
      }
    }

    if (dto.discountType === 'fixed_amount' && !dto.currency) {
      throw new BadRequestException('Currency is required for fixed amount discounts');
    }

    if (dto.discountValue < 0) {
      throw new BadRequestException('Discount value must be non-negative');
    }
  }
}
