import { IsString, IsOptional, IsIn, IsObject } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsString()
  @IsOptional()
  @IsIn(['info', 'warning', 'critical'])
  severity?: string;

  @IsString()
  @IsOptional()
  @IsIn(['device_offline', 'device_online', 'content_expired', 'system'])
  type?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsString()
  @IsOptional()
  userId?: string;
}
