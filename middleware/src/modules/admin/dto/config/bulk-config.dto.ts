import { IsArray, ValidateNested, IsString, IsOptional, IsBoolean, IsIn, IsDefined } from 'class-validator';
import { Type } from 'class-transformer';

class ConfigItem {
  @IsString()
  key: string;

  // Needs a decorator to be whitelisted at all: undecorated, the (now live)
  // nested validation rejected EVERY bulk save with "property value should not
  // exist". The controller forwards c.value, so it must be present.
  @IsDefined()
  value: string | number | boolean | Record<string, unknown>;

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

  @Type(() => Boolean)
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
