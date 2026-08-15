import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  RawBodyRequest,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly billingService: BillingService) {}

  /**
   * Map a webhook processing failure to the RIGHT status code (B-M5).
   *
   * Every non-503 failure used to become `401 Invalid webhook signature`,
   * including ones that had nothing to do with signatures — a DB constraint
   * violation, a Prisma timeout, a bug in a handler. Two concrete harms:
   * the operator debugging a real incident goes hunting for a secret mismatch
   * that does not exist, and Razorpay/Stripe both DISABLE a webhook endpoint
   * after sustained failures, so a transient internal fault masquerading as an
   * auth failure can cost the endpoint itself.
   *
   * Only genuine verification failures are 401 now. Everything else surfaces as
   * 500 with the real error logged — which is also the correct signal to the
   * PSP, because a 5xx is what makes it retry.
   */
  private toHttpError(provider: 'Stripe' | 'Razorpay', error: unknown): never {
    if (error instanceof ServiceUnavailableException) throw error;

    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('not configured')) {
      throw new ServiceUnavailableException(`${provider} webhook handler not configured`);
    }

    // Stripe throws StripeSignatureVerificationError; the Razorpay provider
    // throws Error('Invalid webhook signature') / ('Missing or invalid webhook
    // signature'). Both mention the signature; nothing downstream does.
    if (/signature/i.test(message)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    this.logger.error(
      `${provider} webhook processing failed (NOT a signature problem): ${message}`,
      error instanceof Error ? error.stack : undefined,
    );
    throw new InternalServerErrorException('Webhook processing failed');
  }

  @Post('stripe')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing stripe-signature header');
    }
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body not available');
    }
    try {
      return await this.billingService.handleWebhookEvent('stripe', { rawBody, signature });
    } catch (error) {
      this.toHttpError('Stripe', error);
    }
  }

  @Post('razorpay')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleRazorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    if (!signature) {
      throw new UnauthorizedException('Missing x-razorpay-signature header');
    }
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body not available');
    }
    try {
      return await this.billingService.handleWebhookEvent('razorpay', { rawBody, signature });
    } catch (error) {
      this.toHttpError('Razorpay', error);
    }
  }
}
