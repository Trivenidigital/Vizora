import { IsOptional, IsString } from 'class-validator';

export class CloneTemplateDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
