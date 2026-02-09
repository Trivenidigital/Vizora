import {
  Controller,
  Post,
  Req,
  Headers,
  HttpCode,
  HttpStatus,
  RawBodyRequest,
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
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new Error('Raw body not available');
    }
    return this.billingService.handleWebhookEvent('stripe', { rawBody, signature });
  }

  @Post('razorpay')
  @Public()
  @HttpCode(HttpStatus.OK)
  async handleRazorpayWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody) {
      throw new Error('Raw body not available');
    }
    return this.billingService.handleWebhookEvent('razorpay', { rawBody, signature });
  }
}
