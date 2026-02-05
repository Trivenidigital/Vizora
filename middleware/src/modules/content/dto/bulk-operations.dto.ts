import { IsArray, IsOptional, IsString, IsInt, IsDateString, ArrayMinSize, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class BulkUpdateDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  replacementContentId?: string;
}

export class BulkArchiveDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];
}

export class BulkRestoreDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];
}

export class BulkDeleteDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];
}

export class BulkTagDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  contentIds!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  tagIds!: string[];

  @IsOptional()
  @IsString()
  operation?: 'add' | 'remove' | 'replace'; // Default is 'add'
}

export class BulkDurationDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  ids!: string[];

  @IsInt()
  @Min(1)
  duration!: number;
}
