import { IsString, IsOptional, IsArray, IsInt, Min, Max } from 'class-validator';

export class CheckConflictsDto {
  @IsOptional()
  @IsString()
  displayId?: string;

  @IsOptional()
  @IsString()
  displayGroupId?: string;

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek: number[];

  @IsOptional()
  @IsString()
  startTime?: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  excludeScheduleId?: string;
}
