import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { WEBHOOK_DELIVERY_STATUSES } from '../webhook.types';

/**
 * Query DTO for GET /webhooks/:id/deliveries.
 *
 * Extends PaginationDto (page + limit, limit capped at 100 globally).
 * Optional status filter — the @IsIn enum is the closed set defined in
 * webhook.types.ts, so DTO + service stay in sync without duplication.
 */
export class ListDeliveriesDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @IsIn(WEBHOOK_DELIVERY_STATUSES as readonly string[])
  status?: string;
}
