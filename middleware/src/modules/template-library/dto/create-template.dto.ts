import { IsString, IsOptional, IsEnum, IsInt, IsArray, IsObject, Min, Max, MinLength } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  @MinLength(1)
  templateHtml!: string;

  @IsEnum(['retail', 'restaurant', 'corporate', 'education', 'healthcare', 'events', 'general', 'indian'])
  category!: string;

  @IsOptional()
  @IsEnum(['beginner', 'intermediate', 'advanced'])
  difficulty?: string;

  @IsOptional()
  @IsEnum(['landscape', 'portrait', 'both'])
  orientation?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsObject()
  sampleData?: Record<string, any>;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(300)
  duration?: number;
}
