import { IsInt, Min, Max, IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class ExtendTrialDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
