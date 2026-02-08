import { IsString, IsOptional, IsBoolean, IsIn, MaxLength } from 'class-validator';

export class BrandingConfigDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsString()
  primaryColor: string;

  @IsString()
  secondaryColor: string;

  @IsOptional()
  @IsString()
  accentColor?: string;

  @IsOptional()
  @IsIn(['sans', 'serif', 'mono'])
  fontFamily?: string;

  @IsBoolean()
  showPoweredBy: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  customDomain?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  customCSS?: string;
}
