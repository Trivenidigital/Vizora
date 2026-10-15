import { IsString, IsOptional, IsInt, Min, IsIn, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { toBooleanQuery } from '../../../common/dto/boolean-query.transform';

export class UserFiltersDto {
  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @IsInt()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  limit?: number;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  @IsIn(['admin', 'manager', 'viewer'])
  role?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(toBooleanQuery)
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  @Transform(toBooleanQuery)
  isSuperAdmin?: boolean;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsString()
  @IsOptional()
  @IsIn(['createdAt', 'email', 'lastName', 'lastLoginAt'])
  sortBy?: 'createdAt' | 'email' | 'lastName' | 'lastLoginAt';

  @IsString()
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';
}
