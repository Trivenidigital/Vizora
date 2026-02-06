import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class ValidatePromotionDto {
  @IsString()
  code: string;

  @IsString()
  @IsOptional()
  planId?: string;

  @IsString()
  @IsOptional()
  organizationId?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  cartAmount?: number;

  @IsString()
  @IsOptional()
  currency?: string;
}
