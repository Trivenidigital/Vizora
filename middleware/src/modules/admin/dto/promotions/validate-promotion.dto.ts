import { IsString, IsOptional, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ValidatePromotionDto {
  @IsString()
  code: string;

  @IsString()
  @IsOptional()
  planId?: string;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @Type(() => Number)
  @IsInt()
  @IsOptional()
  @Min(0)
  cartAmount?: number;

  @IsString()
  @IsOptional()
  currency?: string;
}
