import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateFeatureFlagsDto {
  @IsOptional()
  @IsBoolean()
  weatherWidget?: boolean;

  @IsOptional()
  @IsBoolean()
  rssWidget?: boolean;

  @IsOptional()
  @IsBoolean()
  clockWidget?: boolean;

  @IsOptional()
  @IsBoolean()
  fleetControl?: boolean;

  @IsOptional()
  @IsBoolean()
  contentModeration?: boolean;

  @IsOptional()
  @IsBoolean()
  customBranding?: boolean;

  @IsOptional()
  @IsBoolean()
  advancedAnalytics?: boolean;

  @IsOptional()
  @IsBoolean()
  emergencyOverride?: boolean;
}
