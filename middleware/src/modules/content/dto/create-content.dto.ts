import { IsString, IsOptional, IsEnum, IsInt, IsObject, Min, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateContentDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['image', 'video', 'url', 'html', 'pdf', 'template'])
  type!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  thumbnail?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  fileSize?: number;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  fileHash?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  // Content expiration fields
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  replacementContentId?: string;

  // Template orientation filter (for filtering templates by display orientation)
  @IsOptional()
  @IsIn(['landscape', 'portrait', 'both'])
  templateOrientation?: 'landscape' | 'portrait' | 'both';
}
