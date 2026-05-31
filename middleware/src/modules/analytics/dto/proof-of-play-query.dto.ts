import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

/**
 * O2 — Filter + pagination query DTO for proof-of-play reports.
 *
 * All filter fields are optional. Defaults: page=1, limit=50, no date or
 * resource filters (returns all impressions in the org).
 */
export class ProofOfPlayQueryDto {
  /** ISO date string. Inclusive lower bound on ContentImpression.date. */
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  /** ISO date string. Inclusive upper bound on ContentImpression.date. */
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  contentId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  displayId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  playlistId?: string;

  /** Filter by displays carrying a specific Tag (joins via DisplayTag). */
  @IsOptional()
  @IsString()
  @MinLength(1)
  displayTagId?: string;

  /**
   * Optional IANA timezone for the CSV `timestamp` column (e.g.
   * `America/New_York`, `Asia/Kolkata`). Without this, timestamps
   * render as UTC ISO strings and operators in non-UTC orgs have
   * to mentally subtract their offset on every row. Invalid
   * strings silently fall back to UTC inside the service so the
   * export never 500s on a typo'd dropdown value.
   */
  @IsOptional()
  @IsString()
  @MinLength(1)
  tz?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number = 50;
}
