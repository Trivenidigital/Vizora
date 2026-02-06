import { IsString, IsInt, IsOptional, IsBoolean, IsArray, Min } from 'class-validator';

export class CreatePlanDto {
  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(-1)
  screenQuota: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  storageQuotaMb?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  apiRateLimit?: number;

  @IsInt()
  @Min(-1)
  priceUsdMonthly: number;

  @IsInt()
  @Min(-1)
  priceUsdYearly: number;

  @IsInt()
  @Min(-1)
  priceInrMonthly: number;

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

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;

  @IsString()
  @IsOptional()
  highlightText?: string;
}
