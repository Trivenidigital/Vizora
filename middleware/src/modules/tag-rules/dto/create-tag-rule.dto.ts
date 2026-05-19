import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PRIORITY_MAX, PRIORITY_MIN } from '../tag-rule.types';

export class CreateTagRuleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(1)
  tagId!: string;

  /**
   * Required at create time. Becomes nullable only via the playlist-delete
   * SetNull cascade after the row exists. The evaluator detects null and
   * logs WARN.
   */
  @IsString()
  @MinLength(1)
  playlistId!: string;

  @IsInt()
  @Min(PRIORITY_MIN, { message: `priority must be >= ${PRIORITY_MIN}` })
  @Max(PRIORITY_MAX, { message: `priority must be <= ${PRIORITY_MAX}` })
  @IsOptional()
  priority?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
