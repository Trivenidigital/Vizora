import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FlagContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
