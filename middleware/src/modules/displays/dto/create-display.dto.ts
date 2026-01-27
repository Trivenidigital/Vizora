import { IsString, IsOptional, IsEnum, IsObject, MaxLength, MinLength } from 'class-validator';

export class CreateDisplayDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
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
