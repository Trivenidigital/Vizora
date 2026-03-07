import { IsString, IsInt, IsOptional, IsBoolean, IsArray, IsDateString, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePromotionDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsIn(['percentage', 'fixed_amount', 'free_months'])
  discountType: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountValue: number;

  @IsString()
  @IsOptional()
  @IsIn(['usd', 'inr'])
  currency?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  maxRedemptions?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(1)
  maxPerCustomer?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(0)
  minPurchaseAmount?: number;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  applicablePlanIds?: string[];

  @IsOptional()
  metadata?: Record<string, any>;
}
