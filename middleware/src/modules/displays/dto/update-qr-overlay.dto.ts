import { IsString, IsBoolean, IsOptional, IsEnum, IsNumber, Min, Max } from 'class-validator';

export class UpdateQrOverlayDto {
  @IsBoolean()
  enabled: boolean;

  @IsString()
  url: string;

  @IsEnum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  @IsOptional()
  @IsNumber()
  @Min(60)
  @Max(300)
  size?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  opacity?: number;

  @IsOptional()
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
