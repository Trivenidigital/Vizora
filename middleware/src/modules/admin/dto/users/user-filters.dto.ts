import { IsString, IsOptional, IsInt, Min, IsIn, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

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
  @Type(() => Boolean)
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
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
