import { IsOptional, IsString, IsIn } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Query for `GET /api/v1/schedules`.
 *
 * Same defect as AuditLogQueryDto, same cause: the global ValidationPipe runs
 * with `whitelist: true` AND `forbidNonWhitelisted: true`, and `@Query()
 * pagination: PaginationDto` validates the WHOLE query object. A bare
 * `@Query('displayId')` beside it is an unknown property on PaginationDto, so
 * the request is rejected before the handler runs:
 *
 *   GET /api/v1/schedules?page=1&limit=10&isActive=true
 *   -> 400 {"message":["property isActive should not exist"]}
 *
 * All three schedule filters (displayId, displayGroupId, isActive) failed that
 * way. Declaring them here is what lets them through.
 *
 * `isActive` stays a STRING. The service compares it against 'true'/'false'
 * itself, and turning it into a boolean here would silently change that
 * comparison. Only the two literals are accepted, so a typo is a 400 rather
 * than a filter that quietly matches nothing.
 */
export class ScheduleQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  displayId?: string;

  @IsOptional()
  @IsString()
  displayGroupId?: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  isActive?: string;
}
