import { IsString, IsInt, IsOptional, IsBoolean, IsArray, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePlanDto {
  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @Type(() => Number)
  @IsInt()
  @Min(-1)
  screenQuota: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(0)
  storageQuotaMb?: number;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(0)
  apiRateLimit?: number;

  @Type(() => Number)
  @IsInt()
  @Min(-1)
  priceUsdMonthly: number;

  @Type(() => Number)
  @IsInt()
  @Min(-1)
  priceUsdYearly: number;

  @Type(() => Number)
  @IsInt()
  @Min(-1)
  priceInrMonthly: number;

  @Type(() => Number)
  @IsInt()
  @Min(-1)
  priceInrYearly: number;

  @IsString()
  @IsOptional()
  stripePriceIdMonthly?: string;

  @IsString()
  @IsOptional()
  stripePriceIdYearly?: string;

  @IsString()
  @IsOptional()
  razorpayPlanIdMonthly?: string;

  @IsString()
  @IsOptional()
  razorpayPlanIdYearly?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  features?: string[];

  @IsOptional()
  featureFlags?: Record<string, any>;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @IsString()
  @IsOptional()
  highlightText?: string;
}
