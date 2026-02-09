import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

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

  @IsBoolean()
  @IsOptional()
  isSecret?: boolean;
}
