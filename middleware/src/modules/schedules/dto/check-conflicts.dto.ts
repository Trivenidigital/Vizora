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
  @IsInt()
  @Min(0)
  @Max(1439)
  startTime?: number; // Minutes from midnight (0-1439)

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1439)
  endTime?: number; // Minutes from midnight (0-1439)

  @IsOptional()
  @IsString()
  excludeScheduleId?: string;
}
