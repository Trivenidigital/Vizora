import { IsNotEmpty, IsString, IsOptional, MaxLength, IsIn } from 'class-validator';

export class AiGenerateDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  prompt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @IsOptional()
  @IsString()
  @IsIn(['landscape', 'portrait', 'square'])
  orientation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  style?: string;
}
