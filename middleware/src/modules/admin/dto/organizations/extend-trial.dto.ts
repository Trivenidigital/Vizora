import { IsInt, Min, Max, IsString, IsOptional } from 'class-validator';

export class ExtendTrialDto {
  @IsInt()
  @Min(1)
  @Max(365)
  days: number;

  @IsString()
  @IsOptional()
  reason?: string;
}
