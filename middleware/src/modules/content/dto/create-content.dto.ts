import { IsString, IsOptional, IsEnum, IsInt, IsObject, Min } from 'class-validator';

export class CreateContentDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['image', 'video', 'url', 'html', 'pdf'])
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
}
