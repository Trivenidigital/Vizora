import { IsString, IsIn, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({
    description: 'New plan ID to switch to',
    enum: ['basic', 'pro', 'enterprise'],
    example: 'pro',
  })
  @IsString()
  @IsIn(['basic', 'pro', 'enterprise'])
  @IsOptional()
  planId?: string;

  @ApiPropertyOptional({
    description: 'If true, subscription will be cancelled at the end of the current billing period',
    example: false,
  })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  cancelAtPeriodEnd?: boolean;
}
