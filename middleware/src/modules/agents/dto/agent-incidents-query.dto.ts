import { PaginationDto } from '../../common/dto/pagination.dto';

/**
 * Pagination for GET /api/v1/agents/incidents. Extends shared PaginationDto
 * so limits/validation stay consistent with the rest of the admin surface.
 */
export class AgentIncidentsQueryDto extends PaginationDto {}
