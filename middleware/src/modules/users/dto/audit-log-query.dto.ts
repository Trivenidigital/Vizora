import { IsOptional, IsString, IsISO8601 } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Query for `GET /api/v1/audit-logs`.
 *
 * This exists because the global ValidationPipe runs with `whitelist: true` AND
 * `forbidNonWhitelisted: true` (main.ts). `@Query() pagination: PaginationDto`
 * validates the WHOLE query object, not just the two pagination keys — so any
 * additional named `@Query('action')`-style parameter is an unknown property on
 * PaginationDto and the request is rejected outright:
 *
 *   GET /api/v1/audit-logs?page=1&limit=20&startDate=2026-10-10
 *   -> 400 {"message":["property startDate should not exist"]}
 *
 * Every one of the five filters the audit-log page offers (action, entity type,
 * user, start date, end date) returned 400 that way. The page catches the
 * failure, toasts "Failed to load audit logs" and leaves the previous rows on
 * screen, so the operator sees UNFILTERED data with no sign the filter failed.
 *
 * Declaring the filters on the DTO is what makes them reach the service. Do not
 * "fix" a future filter by adding another bare `@Query('x')` next to a DTO — add
 * the field here instead.
 */
export class AuditLogQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  /** Date-only (YYYY-MM-DD) is accepted: ISO 8601 covers it. */
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}
