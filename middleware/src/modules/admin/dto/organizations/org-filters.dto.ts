import { IsString, IsOptional, IsInt, Min, IsIn, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { toBooleanQuery } from '../../../common/dto/boolean-query.transform';

export class OrgFiltersDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  @IsIn(['trial', 'active', 'past_due', 'canceled', 'suspended'])
  subscriptionStatus?: string;

  @IsString()
  @IsOptional()
  @IsIn(['free', 'basic', 'pro', 'enterprise'])
  subscriptionTier?: string;

  @IsString()
  @IsOptional()
  @IsIn(['stripe', 'razorpay'])
  paymentProvider?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(toBooleanQuery)
  hasOverduePayment?: boolean;

  @IsString()
  @IsOptional()
  @IsIn(['createdAt', 'name', 'subscriptionTier', 'screenQuota'])
  sortBy?: 'createdAt' | 'name' | 'subscriptionTier' | 'screenQuota';

  @IsString()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
