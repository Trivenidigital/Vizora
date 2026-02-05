import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@UseGuards(RolesGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @Roles('admin')
  async create(
    @Body() dto: CreateApiKeyDto,
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.apiKeysService.create(organizationId, userId, dto);
  }

  @Get()
  @Roles('admin', 'manager')
  async findAll(@CurrentUser('organizationId') organizationId: string) {
    return this.apiKeysService.findAll(organizationId);
  }

  @Delete(':id')
  @Roles('admin')
  async revoke(
    @Param('id') id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    await this.apiKeysService.revoke(organizationId, id);
    return { success: true };
  }
}
