import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';

export class CreateDisplayDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsString()
  deviceId!: string;

  @IsOptional()
  @IsEnum(['online', 'offline', 'error'])
  status?: string;

  @IsOptional()
  @IsEnum(['landscape', 'portrait'])
  orientation?: string;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
