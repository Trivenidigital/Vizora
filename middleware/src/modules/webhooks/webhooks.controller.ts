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
  UseGuards,
} from '@nestjs/common';
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { WebhooksService } from './webhooks.service';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { UpdateWebhookDto } from './dto/update-webhook.dto';

/**
 * O5 — Outbound webhook subscriptions CRUD.
 *
 * Mutations require @Roles('admin') — webhooks are a security-sensitive
 * surface (sends payloads to operator-configured URLs).
 *
 * Secrets are NEVER returned in GET responses — only at create time. If
 * an admin loses the secret, they must rotate via PATCH with a new secret
 * value.
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
}
