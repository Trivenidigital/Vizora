import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { DisplaysService } from './displays.service';
import { CreateDisplayDto } from './dto/create-display.dto';
import { UpdateDisplayDto } from './dto/update-display.dto';
import { BulkDisplayIdsDto, BulkAssignPlaylistDto, BulkAssignGroupDto } from './dto/bulk-operations.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@UseGuards(RolesGuard)
@Controller('displays')
export class DisplaysController {
  constructor(private readonly displaysService: DisplaysService) {}

  @Post()
  @Roles('admin', 'manager')
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createDisplayDto: CreateDisplayDto,
  ) {
    return this.displaysService.create(organizationId, createDisplayDto);
  }

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.displaysService.findAll(organizationId, pagination);
  }

  @Post('bulk/delete')
  @Roles('admin')
  bulkDelete(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkDisplayIdsDto,
  ) {
    return this.displaysService.bulkDelete(organizationId, dto.displayIds);
  }

  @Post('bulk/assign-playlist')
  @Roles('admin', 'manager')
  bulkAssignPlaylist(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkAssignPlaylistDto,
  ) {
    return this.displaysService.bulkAssignPlaylist(organizationId, dto.displayIds, dto.playlistId);
  }

  @Post('bulk/assign-group')
  @Roles('admin', 'manager')
  bulkAssignGroup(
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: BulkAssignGroupDto,
  ) {
    return this.displaysService.bulkAssignGroup(organizationId, dto.displayIds, dto.displayGroupId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.displaysService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateDisplayDto: UpdateDisplayDto,
  ) {
    return this.displaysService.update(organizationId, id, updateDisplayDto);
  }

  @Post(':id/pair')
  @Roles('admin', 'manager')
  async generatePairingToken(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.displaysService.generatePairingToken(organizationId, id);
  }

  @Post(':deviceId/heartbeat')
  @Public()
  heartbeat(@Param('deviceId') deviceId: string) {
    return this.displaysService.updateHeartbeat(deviceId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.displaysService.remove(organizationId, id);
  }

  @Get(':id/tags')
  getTags(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.displaysService.getTags(organizationId, id);
  }

  @Post(':id/tags')
  @Roles('admin', 'manager')
  addTags(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() body: { tagIds: string[] },
  ) {
    return this.displaysService.addTags(organizationId, id, body.tagIds);
  }

  @Delete(':id/tags')
  @Roles('admin')
  removeTags(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() body: { tagIds: string[] },
  ) {
    return this.displaysService.removeTags(organizationId, id, body.tagIds);
  }

  @Post(':id/push-content')
  @Roles('admin', 'manager')
  pushContent(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() body: { contentId: string; duration?: number },
  ) {
    return this.displaysService.pushContent(
      organizationId,
      id,
      body.contentId,
      body.duration,
    );
  }
}
