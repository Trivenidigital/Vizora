import { IsString, IsIn, IsOptional, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCheckoutDto {
  @ApiProperty({
    description: 'The plan ID to subscribe to',
    enum: ['basic', 'pro'],
    example: 'basic',
  })
  @IsString()
  @IsIn(['basic', 'pro'])
  planId: string;

  @ApiProperty({
    description: 'Billing interval',
    enum: ['monthly', 'yearly'],
    example: 'monthly',
  })
  @IsString()
  @IsIn(['monthly', 'yearly'])
  interval: 'monthly' | 'yearly';

  @ApiPropertyOptional({
    description: 'URL to redirect to on successful checkout',
    example: 'https://app.vizora.io/billing/success',
  })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  successUrl?: string;

  @ApiPropertyOptional({
    description: 'URL to redirect to if checkout is cancelled',
    example: 'https://app.vizora.io/billing/cancel',
  })
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  cancelUrl?: string;
}
