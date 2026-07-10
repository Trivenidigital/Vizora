import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../database/database.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CheckQuota } from '../billing/decorators/check-quota.decorator';
import { RequiresSubscription } from '../billing/decorators/requires-subscription.decorator';
import { EntitlementPublishGuard } from '../billing/guards/entitlement-publish.guard';
import { DisplaysService } from './displays.service';
import { CreateDisplayDto } from './dto/create-display.dto';
import { UpdateDisplayDto } from './dto/update-display.dto';
import { UpdateQrOverlayDto } from './dto/update-qr-overlay.dto';
import { BulkDisplayIdsDto, BulkAssignPlaylistDto, BulkAssignGroupDto } from './dto/bulk-operations.dto';
import { ScreenshotResponseDto, ScreenshotResultDto } from './dto/screenshot.dto';
import { AssignTagsDto, RemoveTagsDto } from './dto/tag-operations.dto';
import { PushContentDto } from './dto/push-content.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import {
  getDeviceTokenFromRequest,
  verifyCurrentDeviceToken,
} from '../common/device-token-auth.util';

@UseGuards(RolesGuard)
@RequiresSubscription()
@Controller('displays')
export class DisplaysController {
  constructor(
    private readonly displaysService: DisplaysService,
    private readonly jwtService: JwtService,
    private readonly databaseService: DatabaseService,
  ) {}

  @Post()
  @Roles('admin', 'manager')
  @CheckQuota('screen')
  @HttpCode(HttpStatus.CREATED)
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

  // Publishing NEW content to screens (assigning a playlist to displays) is
  // gated at the publish_locked/suspended rungs — screens keep playing their
  // current playlist, but a past-due tenant can't push new playlists out.
  @Post('bulk/assign-playlist')
  @Roles('admin', 'manager')
  @UseGuards(EntitlementPublishGuard)
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
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.displaysService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDisplayDto: UpdateDisplayDto,
  ) {
    return this.displaysService.update(organizationId, id, updateDisplayDto);
  }

  @Post(':id/pair')
  @Roles('admin', 'manager')
  async generatePairingToken(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.displaysService.generatePairingToken(organizationId, id);
  }

  @Post(':deviceId/heartbeat')
  @Public() // Bypass user JWT guard -- device JWT verified manually below
  async heartbeat(@Param('deviceId', ParseUUIDPipe) deviceId: string, @Req() req: Request) {
    const verified = await verifyCurrentDeviceToken({
      jwtService: this.jwtService,
      databaseService: this.databaseService,
      token: getDeviceTokenFromRequest(req),
      expectedDisplayId: deviceId,
    });
    return this.displaysService.updateHeartbeat(verified.payload.sub, {
      organizationId: verified.payload.organizationId,
      tokenHash: verified.tokenHash,
    });
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.displaysService.remove(organizationId, id);
  }

  @Get(':id/tags')
  getTags(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.displaysService.getTags(organizationId, id);
  }

  @Post(':id/tags')
  @Roles('admin', 'manager')
  addTags(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTagsDto,
  ) {
    return this.displaysService.addTags(organizationId, id, dto.tagIds);
  }

  @Post(':id/tags/remove')
  @Roles('admin')
  removeTags(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveTagsDto,
  ) {
    return this.displaysService.removeTags(organizationId, id, dto.tagIds);
  }

  @Post(':id/disable')
  @Roles('admin')
  async disableDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.displaysService.disableDevice(id, organizationId);
  }

  @Post(':id/enable')
  @Roles('admin')
  async enableDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
  ) {
    return this.displaysService.enableDevice(id, organizationId);
  }

  // Pushing NEW content to a display is a publish action — gated at
  // publish_locked/suspended. The screen keeps playing its current content.
  @Post(':id/push-content')
  @Roles('admin', 'manager')
  @UseGuards(EntitlementPublishGuard)
  pushContent(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PushContentDto,
  ) {
    return this.displaysService.pushContent(
      organizationId,
      id,
      dto.contentId,
      dto.duration,
    );
  }

  @Post(':id/screenshot')
  @Roles('admin', 'manager')
  async requestScreenshot(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
  ): Promise<ScreenshotResponseDto> {
    const { requestId } = await this.displaysService.requestScreenshot(organizationId, id);
    return {
      requestId,
      status: 'pending',
    };
  }

  @Get(':id/screenshot')
  @Roles('admin', 'manager', 'viewer')
  async getScreenshot(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('organizationId') organizationId: string,
  ): Promise<ScreenshotResultDto | null> {
    const screenshot = await this.displaysService.getLastScreenshot(organizationId, id);

    if (!screenshot) {
      return null;
    }

    return {
      url: screenshot.url,
      capturedAt: screenshot.capturedAt.toISOString(),
      width: screenshot.width,
      height: screenshot.height,
    };
  }

  @Patch(':id/qr-overlay')
  @Roles('admin', 'manager')
  async updateQrOverlay(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQrOverlayDto,
  ) {
    return this.displaysService.updateQrOverlay(organizationId, id, dto);
  }

  @Delete(':id/qr-overlay')
  @Roles('admin', 'manager')
  async removeQrOverlay(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.displaysService.removeQrOverlay(organizationId, id);
  }
}
