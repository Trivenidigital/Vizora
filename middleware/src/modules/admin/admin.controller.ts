import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SuperAdminGuard } from './guards/super-admin.guard';

// Services
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

// DTOs
import {
  CreatePlanDto,
  UpdatePlanDto,
  ReorderPlansDto,
  CreatePromotionDto,
  UpdatePromotionDto,
  ValidatePromotionDto,
  BulkGeneratePromotionsDto,
  OrgFiltersDto,
  UpdateOrgAdminDto,
  ExtendTrialDto,
  OrgNotesDto,
  UserFiltersDto,
  UpdateUserAdminDto,
  UpdateConfigDto,
  BulkConfigDto,
  BlockIpDto,
  AuditLogFiltersDto,
  CreateAnnouncementDto,
  UpdateAnnouncementDto,
} from './dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(
    private readonly plansService: PlansService,
    private readonly promotionsService: PromotionsService,
    private readonly systemConfigService: SystemConfigService,
    private readonly adminAuditService: AdminAuditService,
    private readonly organizationsAdminService: OrganizationsAdminService,
    private readonly usersAdminService: UsersAdminService,
    private readonly platformHealthService: PlatformHealthService,
    private readonly platformStatsService: PlatformStatsService,
    private readonly securityAdminService: SecurityAdminService,
    private readonly announcementsService: AnnouncementsService,
  ) {}

  // ============================================================================
  // PLANS
  // ============================================================================

  @Get('plans')
  async getPlans() {
    return this.plansService.findAll();
  }

  @Get('plans/:id')
  async getPlan(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Post('plans')
  async createPlan(
    @Body() dto: CreatePlanDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const plan = await this.plansService.create(dto);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'plan.create',
      targetType: 'plan',
      targetId: plan.id,
      details: { slug: dto.slug, name: dto.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return plan;
  }

  @Put('plans/:id')
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const plan = await this.plansService.update(id, dto);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'plan.update',
      targetType: 'plan',
      targetId: id,
      details: dto,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return plan;
  }

  @Delete('plans/:id')
  async deletePlan(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const result = await this.plansService.delete(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'plan.delete',
      targetType: 'plan',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  @Post('plans/:id/duplicate')
  @HttpCode(HttpStatus.OK)
  async duplicatePlan(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const plan = await this.plansService.duplicate(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'plan.duplicate',
      targetType: 'plan',
      targetId: plan.id,
      details: { originalPlanId: id },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return plan;
  }

  @Put('plans/reorder')
  async reorderPlans(
    @Body() dto: ReorderPlansDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const ids = dto.plans.map((p) => p.id);
    const result = await this.plansService.reorder(ids);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'plan.reorder',
      details: { planIds: ids },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  // ============================================================================
  // PROMOTIONS
  // ============================================================================

  @Get('promotions')
  async getPromotions() {
    return this.promotionsService.findAll();
  }

  @Get('promotions/:id')
  async getPromotion(@Param('id') id: string) {
    return this.promotionsService.findOne(id);
  }

  @Post('promotions')
  async createPromotion(
    @Body() dto: CreatePromotionDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const promotion = await this.promotionsService.create({
      ...dto,
      createdBy: adminId,
      planIds: dto.applicablePlanIds,
    });

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'promotion.create',
      targetType: 'promotion',
      targetId: promotion.id,
      details: { code: dto.code, name: dto.name },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return promotion;
  }

  @Put('promotions/:id')
  async updatePromotion(
    @Param('id') id: string,
    @Body() dto: UpdatePromotionDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const promotion = await this.promotionsService.update(id, dto as any);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'promotion.update',
      targetType: 'promotion',
      targetId: id,
      details: dto,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return promotion;
  }

  @Delete('promotions/:id')
  async deletePromotion(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const result = await this.promotionsService.delete(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'promotion.delete',
      targetType: 'promotion',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  @Post('promotions/validate')
  @HttpCode(HttpStatus.OK)
  async validatePromotion(@Body() dto: ValidatePromotionDto) {
    return this.promotionsService.validate(dto.code, dto.planId, dto.organizationId);
  }

  @Post('promotions/bulk-generate')
  @HttpCode(HttpStatus.OK)
  async bulkGeneratePromotions(
    @Body() dto: BulkGeneratePromotionsDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const codes = await this.promotionsService.bulkGenerate(dto.prefix, dto.count);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'promotion.bulk_generate',
      details: { prefix: dto.prefix, count: dto.count, generated: codes.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return { codes, count: codes.length };
  }

  @Get('promotions/:id/redemptions')
  async getPromotionRedemptions(@Param('id') id: string) {
    return this.promotionsService.getRedemptions(id);
  }

  // ============================================================================
  // ORGANIZATIONS
  // ============================================================================

  @Get('organizations')
  async getOrganizations(@Query() filters: OrgFiltersDto) {
    return this.organizationsAdminService.findAll({
      search: filters.search,
      status: filters.subscriptionStatus,
      subscriptionTier: filters.subscriptionTier,
      skip: filters.page ? (filters.page - 1) * (filters.limit || 20) : 0,
      take: filters.limit || 20,
      sortBy: filters.sortBy as any,
      sortOrder: filters.sortOrder as any,
    });
  }

  @Get('organizations/:id')
  async getOrganization(@Param('id') id: string) {
    return this.organizationsAdminService.findOne(id);
  }

  @Put('organizations/:id')
  async updateOrganization(
    @Param('id') id: string,
    @Body() dto: UpdateOrgAdminDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const org = await this.organizationsAdminService.update(id, {
      name: dto.name,
      subscriptionTier: dto.subscriptionTier,
      subscriptionStatus: dto.subscriptionStatus,
      screenQuota: dto.screenQuota,
      trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : undefined,
      country: dto.country,
      billingEmail: dto.billingEmail,
    });

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'organization.update',
      targetType: 'organization',
      targetId: id,
      details: dto,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return org;
  }

  @Delete('organizations/:id')
  async deleteOrganization(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const result = await this.organizationsAdminService.delete(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'organization.delete',
      targetType: 'organization',
      targetId: id,
      details: { organizationName: result.organizationName },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  @Post('organizations/:id/extend-trial')
  @HttpCode(HttpStatus.OK)
  async extendTrial(
    @Param('id') id: string,
    @Body() dto: ExtendTrialDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const org = await this.organizationsAdminService.extendTrial(id, dto.days);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'organization.extend_trial',
      targetType: 'organization',
      targetId: id,
      details: { days: dto.days, reason: dto.reason, newTrialEndsAt: org.trialEndsAt },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return org;
  }

  @Post('organizations/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendOrganization(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const org = await this.organizationsAdminService.suspend(id, body.reason);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'organization.suspend',
      targetType: 'organization',
      targetId: id,
      details: { reason: body.reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return org;
  }

  @Post('organizations/:id/unsuspend')
  @HttpCode(HttpStatus.OK)
  async unsuspendOrganization(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const org = await this.organizationsAdminService.unsuspend(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'organization.unsuspend',
      targetType: 'organization',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return org;
  }

  @Get('organizations/:id/stats')
  async getOrganizationStats(@Param('id') id: string) {
    return this.organizationsAdminService.getStats(id);
  }

  @Post('organizations/:id/notes')
  @HttpCode(HttpStatus.OK)
  async addOrganizationNote(
    @Param('id') id: string,
    @Body() dto: OrgNotesDto,
    @CurrentUser('userId') adminId: string,
  ) {
    return this.organizationsAdminService.addNote(id, dto.notes, adminId);
  }

  // ============================================================================
  // USERS
  // ============================================================================

  @Get('users')
  async getUsers(@Query() filters: UserFiltersDto) {
    return this.usersAdminService.findAll({
      search: filters.search,
      organizationId: filters.organizationId,
      role: filters.role,
      isActive: filters.isActive,
      isSuperAdmin: filters.isSuperAdmin,
      skip: filters.page ? (filters.page - 1) * (filters.limit || 20) : 0,
      take: filters.limit || 20,
      sortBy: filters.sortBy as any,
      sortOrder: filters.sortOrder as any,
    });
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.usersAdminService.findOne(id);
  }

  @Put('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateUserAdminDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const user = await this.usersAdminService.update(id, dto);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'user.update',
      targetType: 'user',
      targetId: id,
      details: dto,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return user;
  }

  @Post('users/:id/disable')
  @HttpCode(HttpStatus.OK)
  async disableUser(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const user = await this.usersAdminService.disable(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'user.disable',
      targetType: 'user',
      targetId: id,
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return user;
  }

  @Post('users/:id/enable')
  @HttpCode(HttpStatus.OK)
  async enableUser(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const user = await this.usersAdminService.enable(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'user.enable',
      targetType: 'user',
      targetId: id,
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return user;
  }

  @Post('users/:id/reset-password')
  @HttpCode(HttpStatus.OK)
  async resetUserPassword(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const result = await this.usersAdminService.resetPassword(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'user.reset_password',
      targetType: 'user',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  @Post('users/:id/grant-super-admin')
  @HttpCode(HttpStatus.OK)
  async grantSuperAdmin(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const user = await this.usersAdminService.grantSuperAdmin(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'user.grant_super_admin',
      targetType: 'user',
      targetId: id,
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return user;
  }

  @Post('users/:id/revoke-super-admin')
  @HttpCode(HttpStatus.OK)
  async revokeSuperAdmin(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const user = await this.usersAdminService.revokeSuperAdmin(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'user.revoke_super_admin',
      targetType: 'user',
      targetId: id,
      details: { email: user.email },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return user;
  }

  // ============================================================================
  // HEALTH
  // ============================================================================

  @Get('health')
  async getHealth() {
    return this.platformHealthService.getOverallHealth();
  }

  @Get('health/services')
  async getServiceStatus() {
    return this.platformHealthService.getServiceStatus();
  }

  @Get('health/database')
  async getDatabaseHealth() {
    return this.platformHealthService.checkDatabase();
  }

  @Get('health/errors')
  async getErrorRates(@Query('hours') hours?: string) {
    return this.platformHealthService.getErrorRates(hours ? parseInt(hours, 10) : 24);
  }

  @Get('health/uptime')
  async getUptime(@Query('days') days?: string) {
    return this.platformHealthService.getUptimeHistory(days ? parseInt(days, 10) : 7);
  }

  // ============================================================================
  // STATS
  // ============================================================================

  @Get('stats/overview')
  async getStatsOverview() {
    return this.platformStatsService.getOverview();
  }

  @Get('stats/revenue')
  async getRevenueStats(@Query('period') period?: string) {
    return this.platformStatsService.getRevenue(period as any);
  }

  @Get('stats/signups')
  async getSignupStats(@Query('period') period?: string) {
    return this.platformStatsService.getSignups(period as any);
  }

  @Get('stats/churn')
  async getChurnStats(@Query('period') period?: string) {
    return this.platformStatsService.getChurn(period as any);
  }

  @Get('stats/usage')
  async getUsageStats() {
    return this.platformStatsService.getUsageStats();
  }

  @Get('stats/plans')
  async getPlanBreakdown() {
    return this.platformStatsService.getByPlan();
  }

  @Get('stats/geographic')
  async getGeographicStats() {
    return this.platformStatsService.getGeographic();
  }

  // ============================================================================
  // BILLING (Read-only views for admin)
  // ============================================================================

  @Get('billing/transactions')
  async getBillingTransactions(@Query() filters: { page?: number; limit?: number; status?: string }) {
    // This would need a dedicated billing service method for admin view
    // For now, return placeholder
    return { data: [], total: 0, message: 'Use billing module for detailed transactions' };
  }

  @Get('billing/failed-payments')
  async getFailedPayments() {
    // This would need a dedicated billing service method
    return { data: [], total: 0, message: 'Use billing module for failed payments' };
  }

  // ============================================================================
  // CONFIG
  // ============================================================================

  @Get('config')
  async getAllConfig() {
    return this.systemConfigService.findAll();
  }

  @Get('config/:key')
  async getConfig(@Param('key') key: string) {
    return this.systemConfigService.getRecord(key);
  }

  @Put('config/:key')
  async setConfig(
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const config = await this.systemConfigService.set(key, dto.value, adminId, {
      dataType: dto.dataType as any,
      category: dto.category,
      description: dto.description,
      isSecret: dto.isSecret,
    });

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'config.update',
      targetType: 'config',
      targetId: key,
      details: { category: dto.category },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return config;
  }

  @Delete('config/:key')
  async deleteConfig(
    @Param('key') key: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const result = await this.systemConfigService.delete(key);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'config.delete',
      targetType: 'config',
      targetId: key,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  @Post('config/bulk')
  @HttpCode(HttpStatus.OK)
  async bulkUpdateConfig(
    @Body() dto: BulkConfigDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const result = await this.systemConfigService.bulkUpdate(
      dto.configs.map((c) => ({ key: c.key, value: c.value })),
      adminId,
    );

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'config.bulk_update',
      details: { keys: dto.configs.map((c) => c.key) },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  // ============================================================================
  // SECURITY
  // ============================================================================

  @Get('security/audit-log')
  async getAuditLog(@Query() filters: AuditLogFiltersDto) {
    return this.adminAuditService.findAll({
      adminUserId: filters.adminUserId,
      action: filters.action,
      targetType: filters.targetType,
      targetId: filters.targetId,
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
      page: filters.page,
      limit: filters.limit,
    });
  }

  @Get('security/ip-blocklist')
  async getIpBlocklist() {
    return this.securityAdminService.getIpBlocklist();
  }

  @Post('security/ip-blocklist')
  @HttpCode(HttpStatus.CREATED)
  async blockIp(
    @Body() dto: BlockIpDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const entry = await this.securityAdminService.blockIp(
      {
        ipAddress: dto.ipAddress,
        reason: dto.reason,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
      adminId,
    );

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'security.block_ip',
      targetType: 'ip_blocklist',
      targetId: entry.id,
      details: { ipAddress: dto.ipAddress, reason: dto.reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return entry;
  }

  @Delete('security/ip-blocklist/:id')
  async unblockIp(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const entry = await this.securityAdminService.unblockIp(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'security.unblock_ip',
      targetType: 'ip_blocklist',
      targetId: id,
      details: { ipAddress: entry.ipAddress },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return entry;
  }

  @Get('security/api-keys')
  async getAllApiKeys() {
    return this.securityAdminService.getAllApiKeys();
  }

  @Post('security/api-keys/:id/revoke')
  @HttpCode(HttpStatus.OK)
  async revokeApiKey(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const result = await this.securityAdminService.revokeApiKey(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'security.revoke_api_key',
      targetType: 'api_key',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  // ============================================================================
  // ANNOUNCEMENTS
  // ============================================================================

  @Get('announcements')
  async getAnnouncements() {
    return this.announcementsService.findAll();
  }

  @Get('announcements/:id')
  async getAnnouncement(@Param('id') id: string) {
    return this.announcementsService.findOne(id);
  }

  @Post('announcements')
  async createAnnouncement(
    @Body() dto: CreateAnnouncementDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const announcement = await this.announcementsService.create(
      {
        title: dto.title,
        message: dto.message,
        type: dto.type as any,
        targetAudience: dto.targetAudience as any,
        targetPlans: dto.targetPlans,
        startsAt: new Date(dto.startsAt),
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
        isDismissible: dto.isDismissible,
        linkUrl: dto.linkUrl,
        linkText: dto.linkText,
      },
      adminId,
    );

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'announcement.create',
      targetType: 'announcement',
      targetId: announcement.id,
      details: { title: dto.title },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return announcement;
  }

  @Put('announcements/:id')
  async updateAnnouncement(
    @Param('id') id: string,
    @Body() dto: UpdateAnnouncementDto,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const announcement = await this.announcementsService.update(id, dto as any);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'announcement.update',
      targetType: 'announcement',
      targetId: id,
      details: dto,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return announcement;
  }

  @Delete('announcements/:id')
  async deleteAnnouncement(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const result = await this.announcementsService.delete(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'announcement.delete',
      targetType: 'announcement',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return result;
  }

  @Post('announcements/:id/publish')
  @HttpCode(HttpStatus.OK)
  async publishAnnouncement(
    @Param('id') id: string,
    @CurrentUser('userId') adminId: string,
    @Req() req: Request,
  ) {
    const announcement = await this.announcementsService.publish(id);

    await this.adminAuditService.log({
      adminUserId: adminId,
      action: 'announcement.publish',
      targetType: 'announcement',
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return announcement;
  }
}
