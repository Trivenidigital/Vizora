import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateConfigDto {
  @IsOptional()
  value: any;

  @IsString()
  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'json'])
  dataType?: 'string' | 'number' | 'boolean' | 'json';

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
