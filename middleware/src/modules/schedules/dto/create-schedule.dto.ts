import {
  IsString,
  IsOptional,
  IsDateString,
  IsArray,
  IsInt,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

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

  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  daysOfWeek!: number[]; // 0-6 (Sunday-Saturday)

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsString()
  playlistId!: string;

  @IsOptional()
  @IsString()
  displayId?: string;

  @IsOptional()
  @IsString()
  displayGroupId?: string;
}
