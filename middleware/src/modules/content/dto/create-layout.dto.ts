import { IsString, IsOptional, IsEnum, IsArray, IsNumber, IsObject, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class LayoutZoneDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  gridArea: string;

  @IsOptional()
  @IsString()
  playlistId?: string;

  @IsOptional()
  @IsString()
  contentId?: string;

  @IsOptional()
  @IsString()
  widgetId?: string;
}

export class CreateLayoutDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['split-horizontal', 'split-vertical', 'grid-2x2', 'main-sidebar', 'l-shape', 'custom'])
  layoutType: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayoutZoneDto)
  zones: LayoutZoneDto[];

  @IsOptional()
  @IsObject()
  gridTemplate?: { columns: string; rows: string };

  @IsOptional()
  @IsNumber()
  @Min(0)
  gap?: number;

  @IsOptional()
  @IsString()
  backgroundColor?: string;
}
