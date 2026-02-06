import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface CreatePlanDto {
  slug: string;
  name: string;
  description?: string;
  screenQuota: number;
  storageQuotaMb?: number;
  apiRateLimit?: number;
  priceUsdMonthly: number;
  priceUsdYearly: number;
  priceInrMonthly: number;
  priceInrYearly: number;
  stripePriceIdMonthly?: string;
  stripePriceIdYearly?: string;
  razorpayPlanIdMonthly?: string;
  razorpayPlanIdYearly?: string;
  features?: string[];
  featureFlags?: Record<string, unknown>;
  isActive?: boolean;
  isPublic?: boolean;
  sortOrder?: number;
  highlightText?: string;
}

export interface UpdatePlanDto extends Partial<CreatePlanDto> {}

@Injectable()
export class PlansService {
  private readonly logger = new Logger(PlansService.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Find all plans (includes inactive for admin view)
   */
  async findAll() {
    return this.db.plan.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        promotions: {
          include: {
            promotion: true,
          },
        },
      },
    });
  }

  /**
   * Find a single plan by ID
   */
  async findOne(id: string) {
    const plan = await this.db.plan.findUnique({
      where: { id },
      include: {
        promotions: {
          include: {
            promotion: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with ID ${id} not found`);
    }

    return plan;
  }

  /**
   * Find a plan by slug
   */
  async findBySlug(slug: string) {
    const plan = await this.db.plan.findUnique({
      where: { slug },
      include: {
        promotions: {
          include: {
            promotion: true,
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with slug '${slug}' not found`);
    }

    return plan;
  }

  /**
   * Find active, public plans only (for pricing page)
   */
  async findActive() {
    return this.db.plan.findMany({
      where: {
        isActive: true,
        isPublic: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Create a new plan
   */
  async create(dto: CreatePlanDto) {
    // Check for duplicate slug
    const existing = await this.db.plan.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(`Plan with slug '${dto.slug}' already exists`);
    }

    const plan = await this.db.plan.create({
      data: {
        slug: dto.slug,
        name: dto.name,
        description: dto.description,
        screenQuota: dto.screenQuota,
        storageQuotaMb: dto.storageQuotaMb ?? 5000,
        apiRateLimit: dto.apiRateLimit ?? 1000,
        priceUsdMonthly: dto.priceUsdMonthly,
        priceUsdYearly: dto.priceUsdYearly,
        priceInrMonthly: dto.priceInrMonthly,
        priceInrYearly: dto.priceInrYearly,
        stripePriceIdMonthly: dto.stripePriceIdMonthly,
        stripePriceIdYearly: dto.stripePriceIdYearly,
        razorpayPlanIdMonthly: dto.razorpayPlanIdMonthly,
        razorpayPlanIdYearly: dto.razorpayPlanIdYearly,
        features: dto.features ?? [],
        featureFlags: dto.featureFlags,
        isActive: dto.isActive ?? true,
        isPublic: dto.isPublic ?? true,
        sortOrder: dto.sortOrder ?? 0,
        highlightText: dto.highlightText,
      },
    });

    this.logger.log(`Created plan: ${plan.name} (${plan.slug})`);
    return plan;
  }

  /**
   * Update an existing plan
   */
  async update(id: string, dto: UpdatePlanDto) {
    // Verify plan exists
    await this.findOne(id);

    // Check slug uniqueness if changing
    if (dto.slug) {
      const existing = await this.db.plan.findFirst({
        where: {
          slug: dto.slug,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException(`Plan with slug '${dto.slug}' already exists`);
      }
    }

    const plan = await this.db.plan.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Updated plan: ${plan.name} (${plan.id})`);
    return plan;
  }

  /**
   * Soft delete a plan (set isActive=false)
   */
  async delete(id: string) {
    await this.findOne(id);

    const plan = await this.db.plan.update({
      where: { id },
      data: { isActive: false },
    });

    this.logger.log(`Soft deleted plan: ${plan.name} (${plan.id})`);
    return plan;
  }

  /**
   * Duplicate a plan with a new slug
   */
  async duplicate(id: string) {
    const original = await this.findOne(id);

    // Generate unique slug
    let newSlug = `${original.slug}-copy`;
    let counter = 1;

    while (await this.db.plan.findUnique({ where: { slug: newSlug } })) {
      newSlug = `${original.slug}-copy-${counter}`;
      counter++;
    }

    const duplicated = await this.db.plan.create({
      data: {
        slug: newSlug,
        name: `${original.name} (Copy)`,
        description: original.description,
        screenQuota: original.screenQuota,
        storageQuotaMb: original.storageQuotaMb,
        apiRateLimit: original.apiRateLimit,
        priceUsdMonthly: original.priceUsdMonthly,
        priceUsdYearly: original.priceUsdYearly,
        priceInrMonthly: original.priceInrMonthly,
        priceInrYearly: original.priceInrYearly,
        stripePriceIdMonthly: original.stripePriceIdMonthly,
        stripePriceIdYearly: original.stripePriceIdYearly,
        razorpayPlanIdMonthly: original.razorpayPlanIdMonthly,
        razorpayPlanIdYearly: original.razorpayPlanIdYearly,
        features: original.features,
        featureFlags: original.featureFlags,
        isActive: false, // Start as inactive
        isPublic: false, // Start as hidden
        sortOrder: original.sortOrder + 1,
        highlightText: null,
      },
    });

    this.logger.log(`Duplicated plan: ${original.name} -> ${duplicated.name}`);
    return duplicated;
  }

  /**
   * Reorder plans by updating sortOrder
   */
  async reorder(ids: string[]) {
    // Validate all IDs exist
    const plans = await this.db.plan.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });

    if (plans.length !== ids.length) {
      const foundIds = plans.map(p => p.id);
      const missingIds = ids.filter(id => !foundIds.includes(id));
      throw new NotFoundException(`Plans not found: ${missingIds.join(', ')}`);
    }

    // Update sort orders in transaction
    await this.db.$transaction(
      ids.map((id, index) =>
        this.db.plan.update({
          where: { id },
          data: { sortOrder: index },
        })
      )
    );

    this.logger.log(`Reordered ${ids.length} plans`);

    // Return updated plans
    return this.db.plan.findMany({
      where: { id: { in: ids } },
      orderBy: { sortOrder: 'asc' },
    });
  }
}
