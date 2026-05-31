import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { ListDeliveriesDto } from './dto/list-deliveries.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

/**
 * O5 — Outbound webhook subscriptions CRUD + delivery audit.
 *
 * Mutations require @Roles('admin') — webhooks are a security-sensitive
 * surface (sends payloads to operator-configured URLs).
 *
 * Secrets are NEVER returned in any response — customers keep their own
 * copy of the secret they submitted at create time. To rotate, PATCH
 * with a new secret value.
 *
 * Delivery audit (GET /:id/deliveries) is admin/manager only — delivery
 * rows expose endpoint health and error messages; not as sensitive as
 * secrets, but still operational/security-adjacent.
 */
@UseGuards(RolesGuard)
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly service: WebhooksService) {}

  @Post()
  @Roles('admin')
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.service.create(organizationId, dto);
  }

  @Get()
  findAll(@CurrentUser('organizationId') organizationId: string) {
    return this.service.findAll(organizationId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.service.findOne(organizationId, id);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.service.update(organizationId, id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.service.remove(organizationId, id);
  }

  /**
   * Paginated audit log for one webhook. Newest-first. Returns rows for
   * every delivery attempt — success, failure, or SSRF-blocked — so
   * customers can debug their endpoint.
   *
   * Admin or manager only. Viewer is intentionally excluded — delivery
   * details leak endpoint health and upstream error text.
   */
  @Get(':id/deliveries')
  @Roles('admin', 'manager')
  findDeliveries(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
    @Query() query: ListDeliveriesDto,
  ) {
    return this.service.findDeliveries(organizationId, id, query);
  }
}
