import { IsString, IsOptional, IsInt, Min, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class AuditLogFiltersDto {
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
  adminUserId?: string;

  @IsString()
  @IsOptional()
  action?: string;

  @IsString()
  @IsOptional()
  targetType?: string;

  @IsString()
  @IsOptional()
  targetId?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
