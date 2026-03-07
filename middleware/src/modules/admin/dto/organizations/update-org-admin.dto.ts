import { IsString, IsOptional, IsInt, Min, IsIn, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateOrgAdminDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  @IsIn(['free', 'basic', 'pro', 'enterprise'])
  subscriptionTier?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(-1)
  screenQuota?: number;

  @IsString()
  @IsOptional()
  @IsIn(['trial', 'active', 'past_due', 'canceled', 'suspended'])
  subscriptionStatus?: string;

  @IsString()
  @IsOptional()
  billingEmail?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsDateString()
  @IsOptional()
  trialEndsAt?: string;

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isFeatureFlagged?: boolean;

  @IsOptional()
  settings?: Record<string, any>;

  @IsString()
  @IsOptional()
  notes?: string;
}
