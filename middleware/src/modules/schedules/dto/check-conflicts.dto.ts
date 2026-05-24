import { IsString, IsOptional, IsArray, IsInt, IsDateString, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

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
  @Transform(({ value }) => Array.isArray(value) ? value.map(Number) : value)
  daysOfWeek: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  startTime?: number; // Minutes from midnight (0-1439)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1439)
  endTime?: number; // Minutes from midnight (0-1439)

  /**
   * Date-range filters for the candidate schedule. Without these,
   * checkConflicts was matching schedules that share daysOfWeek +
   * display but run in completely disjoint date ranges (e.g., a
   * 2025 Christmas-week schedule reported as conflicting with a
   * proposed 2026 Diwali-week schedule). Both are optional —
   * absence means "no upper/lower bound" — to preserve the
   * existing "open-ended schedule" shape.
   */
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  excludeScheduleId?: string;
}
