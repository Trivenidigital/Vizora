import { IsString, IsOptional, IsBoolean, IsIn } from 'class-validator';

export class UpdateConfigDto {
  @IsOptional()
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
