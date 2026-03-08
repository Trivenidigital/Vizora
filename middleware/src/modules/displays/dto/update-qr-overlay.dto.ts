import { IsString, IsBoolean, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateQrOverlayDto {
  @Type(() => Boolean)
  @IsBoolean()
  enabled: boolean;

  @IsString()
  url: string;

  @IsEnum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(60)
  @Max(300)
  size?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  opacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  margin?: number;

  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @IsOptional()
  @IsString()
  label?: string;
}
