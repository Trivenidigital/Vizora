import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { WebhooksController } from './webhooks.controller';
import { StripeProvider } from './providers/stripe.provider';
import { RazorpayProvider } from './providers/razorpay.provider';
import { SubscriptionActiveGuard } from './guards/subscription-active.guard';
import { QuotaGuard } from './guards/quota.guard';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [BillingController, WebhooksController],
  providers: [
    BillingService,
    StripeProvider,
    RazorpayProvider,
    SubscriptionActiveGuard,
    QuotaGuard,
  ],
  exports: [BillingService, SubscriptionActiveGuard, QuotaGuard],
})
export class BillingModule {}
