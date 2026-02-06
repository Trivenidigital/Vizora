import { IsArray, ValidateNested, IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

class ConfigItem {
  @IsString()
  key: string;

  value: any;

  @IsString()
  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'json'])
  dataType?: string;

  @IsString()
  @IsOptional()
  @IsIn(['general', 'security', 'limits', 'features'])
  category?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isSecret?: boolean;
}

export class BulkConfigDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfigItem)
  configs: ConfigItem[];
}
