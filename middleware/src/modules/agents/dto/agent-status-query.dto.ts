import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Pagination for GET /api/v1/agents/status (D20).
 * Extends shared PaginationDto so limits/validation stay consistent.
 */
export class AgentStatusQueryDto extends PaginationDto {}
