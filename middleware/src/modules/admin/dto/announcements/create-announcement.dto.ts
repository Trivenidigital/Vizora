import { IsString, IsOptional, IsBoolean, IsArray, IsDateString, IsIn, MaxLength } from 'class-validator';

export class CreateAnnouncementDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @MaxLength(5000)
  message: string;

  @IsString()
  @IsOptional()
  @IsIn(['info', 'warning', 'critical', 'maintenance'])
  type?: 'info' | 'warning' | 'critical' | 'maintenance';

  @IsString()
  @IsOptional()
  @IsIn(['all', 'admins', 'specific_plans'])
  targetAudience?: 'all' | 'admins' | 'specific_plans';

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  targetPlans?: string[];

  @IsDateString()
  startsAt: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isDismissible?: boolean;

  @IsString()
  @IsOptional()
  linkUrl?: string;

  @IsString()
  @IsOptional()
  linkText?: string;
}
