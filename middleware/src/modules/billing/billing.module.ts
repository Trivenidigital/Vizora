import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from '../database/database.module';
import { BillingService } from './billing.service';
import { BillingLifecycleService } from './billing-lifecycle.service';
import { BillingController } from './billing.controller';
import { WebhooksController } from './webhooks.controller';
import { StripeProvider } from './providers/stripe.provider';
import { RazorpayProvider } from './providers/razorpay.provider';
import { SubscriptionActiveGuard } from './guards/subscription-active.guard';
import { QuotaGuard } from './guards/quota.guard';
import { EntitlementService } from './entitlement.service';
import { EntitlementPublishGuard } from './guards/entitlement-publish.guard';
import { TenantEntitlementNotifier } from './tenant-entitlement.notifier';

@Module({
  imports: [ConfigModule, DatabaseModule, HttpModule],
  controllers: [BillingController, WebhooksController],
  providers: [
    BillingService,
    BillingLifecycleService,
    StripeProvider,
    RazorpayProvider,
    SubscriptionActiveGuard,
    QuotaGuard,
    EntitlementService,
    EntitlementPublishGuard,
    TenantEntitlementNotifier,
  ],
  exports: [BillingService, SubscriptionActiveGuard, QuotaGuard, EntitlementService, EntitlementPublishGuard],
})
export class BillingModule {}
