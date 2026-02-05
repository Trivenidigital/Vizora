import { IsString, IsOptional, IsEnum, IsInt, IsObject, Min, IsDateString, IsIn } from 'class-validator';

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
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
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
  metadata?: Record<string, any>;

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
