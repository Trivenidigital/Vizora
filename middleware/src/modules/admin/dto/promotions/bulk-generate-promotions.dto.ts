import { IsString, IsInt, IsOptional, IsBoolean, IsArray, IsDateString, Min, IsIn, Max } from 'class-validator';

export class BulkGeneratePromotionsDto {
  @IsString()
  prefix: string;

  @IsInt()
  @Min(1)
  @Max(1000)
  count: number;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsIn(['percentage', 'fixed_amount', 'free_months'])
  discountType: string;

  @IsInt()
  @Min(0)
  discountValue: number;

  @IsString()
  @IsOptional()
  @IsIn(['usd', 'inr'])
  currency?: string;

  @IsInt()
  @IsOptional()
  @Min(1)
  maxRedemptions?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  maxPerCustomer?: number;

  @IsDateString()
  startsAt: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  applicablePlanIds?: string[];
}
