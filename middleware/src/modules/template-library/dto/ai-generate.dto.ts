import { IsNotEmpty, IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

export class AiGenerateDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  prompt!: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  @IsIn(['landscape', 'portrait', 'square'])
  orientation?: string;

  @IsOptional()
  @IsString()
  style?: string;
}
