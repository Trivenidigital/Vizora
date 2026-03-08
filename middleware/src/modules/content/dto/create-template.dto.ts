import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  IsObject,
  IsBoolean,
  IsArray,
  Min,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Data source configuration for template
 */
export class DataSourceDto {
  @IsEnum(['rest_api', 'json_url', 'manual'])
  type!: 'rest_api' | 'json_url' | 'manual';

  @IsOptional()
  @IsUrl({}, { message: 'URL must be a valid URL' })
  url?: string;

  @IsOptional()
  @IsEnum(['GET', 'POST'])
  method?: 'GET' | 'POST';

  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @IsOptional()
  @IsString()
  jsonPath?: string;

  @IsOptional()
  @IsObject()
  manualData?: Record<string, unknown>;
}

/**
 * Refresh configuration for template
 */
export class RefreshConfigDto {
  @Type(() => Boolean)
  @IsBoolean()
  enabled!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  intervalMinutes!: number;
}

/**
 * DTO for creating a new content template
 */
export class CreateTemplateDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  templateHtml!: string;

  @ValidateNested()
  @Type(() => DataSourceDto)
  dataSource!: DataSourceDto;

  @ValidateNested()
  @Type(() => RefreshConfigDto)
  refreshConfig!: RefreshConfigDto;

  @IsOptional()
  @IsObject()
  sampleData?: Record<string, unknown>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration?: number;
}
