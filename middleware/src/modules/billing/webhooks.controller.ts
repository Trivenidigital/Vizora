import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { BillingService } from './billing.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly billingService: BillingService) {}

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
      if (error instanceof ServiceUnavailableException) throw error;
      if (error?.message?.includes('not configured')) {
        throw new ServiceUnavailableException('Stripe webhook handler not configured');
      }
      throw new UnauthorizedException('Invalid webhook signature');
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
      if (error instanceof ServiceUnavailableException) throw error;
      if (error?.message?.includes('not configured')) {
        throw new ServiceUnavailableException('Razorpay webhook handler not configured');
      }
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
