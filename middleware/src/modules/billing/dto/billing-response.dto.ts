import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response for subscription status queries
 */
export class SubscriptionStatusResponse {
  @ApiProperty({ description: 'Current subscription tier', example: 'basic' })
  subscriptionTier: string;

  @ApiProperty({
    description: 'Subscription status',
    example: 'active',
    enum: ['trial', 'active', 'past_due', 'canceled', 'incomplete'],
  })
  subscriptionStatus: string;

  @ApiProperty({ description: 'Maximum screens allowed for this plan', example: 25 })
  screenQuota: number;

  @ApiProperty({ description: 'Number of screens currently in use', example: 12 })
  screensUsed: number;

  @ApiPropertyOptional({
    description: 'ISO date string when trial ends (null if not on trial)',
    example: '2024-02-15T00:00:00.000Z',
  })
  trialEndsAt: string | null;

  @ApiPropertyOptional({
    description: 'ISO date string when current billing period ends',
    example: '2024-03-01T00:00:00.000Z',
  })
  currentPeriodEnd: string | null;

  @ApiProperty({
    description: 'Whether subscription will be cancelled at period end',
    example: false,
  })
  cancelAtPeriodEnd: boolean;

  @ApiPropertyOptional({
    description: 'Payment provider used',
    example: 'stripe',
    enum: ['stripe', 'razorpay', null],
  })
  paymentProvider: string | null;
}

/**
 * Response for available plan listing
 */
export class PlanResponse {
  @ApiProperty({ description: 'Plan ID', example: 'basic' })
  id: string;

  @ApiProperty({ description: 'Plan display name', example: 'Basic' })
  name: string;

  @ApiProperty({
    description: 'Maximum screens allowed (-1 for unlimited)',
    example: 25,
  })
  screenQuota: number;

  @ApiProperty({
    description: 'Price in smallest currency unit (cents/paise)',
    example: 2900,
  })
  price: number;

  @ApiProperty({ description: 'Currency code', example: 'usd' })
  currency: string;

  @ApiProperty({
    description: 'Billing interval',
    example: 'monthly',
    enum: ['monthly', 'yearly'],
  })
  interval: string;

  @ApiProperty({
    description: 'List of features included in this plan',
    example: ['Basic scheduling', 'Content upload', 'Up to 5 screens'],
    type: [String],
  })
  features: string[];

  @ApiProperty({
    description: 'Whether this is the current plan for the organization',
    example: false,
  })
  isCurrent: boolean;
}

/**
 * Response for quota usage queries
 */
export class QuotaResponse {
  @ApiProperty({ description: 'Maximum screens allowed for this plan', example: 25 })
  screenQuota: number;

  @ApiProperty({ description: 'Number of screens currently in use', example: 12 })
  screensUsed: number;

  @ApiProperty({ description: 'Remaining screen slots', example: 13 })
  remaining: number;

  @ApiProperty({
    description: 'Percentage of quota used (0-100)',
    example: 48,
  })
  percentUsed: number;
}

/**
 * Response for invoice history
 */
export class InvoiceResponse {
  @ApiProperty({ description: 'Invoice ID', example: 'inv_1234567890' })
  id: string;

  @ApiProperty({
    description: 'Amount in smallest currency unit (cents/paise)',
    example: 2900,
  })
  amount: number;

  @ApiProperty({ description: 'Currency code', example: 'usd' })
  currency: string;

  @ApiProperty({
    description: 'Invoice status',
    example: 'paid',
    enum: ['draft', 'open', 'paid', 'uncollectible', 'void'],
  })
  status: string;

  @ApiPropertyOptional({ description: 'Invoice description', example: 'Basic Plan - Monthly' })
  description: string | null;

  @ApiProperty({
    description: 'ISO date string when invoice was created',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: string;

  @ApiPropertyOptional({
    description: 'URL to download invoice PDF',
    example: 'https://stripe.com/invoices/inv_1234567890/pdf',
  })
  pdfUrl: string | null;
}

/**
 * Response for checkout session creation
 */
export class CheckoutSessionResponse {
  @ApiProperty({
    description: 'Checkout session URL to redirect user to',
    example: 'https://checkout.stripe.com/c/pay/cs_test_...',
  })
  checkoutUrl: string;

  @ApiProperty({ description: 'Checkout session ID', example: 'cs_test_...' })
  sessionId: string;
}

/**
 * Response for billing portal URL
 */
export class BillingPortalResponse {
  @ApiProperty({
    description: 'Billing portal URL to redirect user to',
    example: 'https://billing.stripe.com/p/session/...',
  })
  portalUrl: string;
}
