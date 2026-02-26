import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { BillingService } from './billing.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('subscription')
  async getSubscription(@CurrentUser('organizationId') organizationId: string) {
    return this.billingService.getSubscriptionStatus(organizationId);
  }

  @Get('plans')
  async getPlans(
    @CurrentUser('organizationId') organizationId: string,
    @Query('country') country?: string,
  ) {
    return this.billingService.getPlans(organizationId, country);
  }

  @Post('checkout')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async createCheckout(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.billingService.createCheckoutSession(organizationId, dto);
  }

  @Post('upgrade')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async upgrade(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.billingService.updateSubscription(organizationId, dto);
  }

  @Post('downgrade')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async downgrade(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.billingService.updateSubscription(organizationId, { ...dto, cancelAtPeriodEnd: false });
  }

  @Post('cancel')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser('organizationId') organizationId: string,
    @Query('immediately') immediately?: string,
  ) {
    return this.billingService.cancelSubscription(organizationId, immediately === 'true');
  }

  @Post('reactivate')
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async reactivate(@CurrentUser('organizationId') organizationId: string) {
    return this.billingService.reactivateSubscription(organizationId);
  }

  @Get('portal')
  @Roles('admin')
  async getPortalUrl(
    @CurrentUser('organizationId') organizationId: string,
    @Query('returnUrl') returnUrl: string,
  ) {
    return this.billingService.getBillingPortalUrl(organizationId, returnUrl);
  }

  @Get('invoices')
  @Roles('admin')
  async getInvoices(
    @CurrentUser('organizationId') organizationId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = Math.min(parseInt(limit, 10) || 10, 100);
    return this.billingService.getInvoices(organizationId, parsedLimit);
  }

  @Get('quota')
  async getQuota(@CurrentUser('organizationId') organizationId: string) {
    return this.billingService.getQuotaUsage(organizationId);
  }
}
