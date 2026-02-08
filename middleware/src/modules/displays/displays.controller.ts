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
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CheckQuota } from '../billing/decorators/check-quota.decorator';
import { DisplaysService } from './displays.service';
import { CreateDisplayDto } from './dto/create-display.dto';
import { UpdateDisplayDto } from './dto/update-display.dto';
import { UpdateQrOverlayDto } from './dto/update-qr-overlay.dto';
import { BulkDisplayIdsDto, BulkAssignPlaylistDto, BulkAssignGroupDto } from './dto/bulk-operations.dto';
import { ScreenshotResponseDto, ScreenshotResultDto } from './dto/screenshot.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@UseGuards(RolesGuard)
@Controller('displays')
export class DisplaysController {
  constructor(
    private readonly displaysService: DisplaysService,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  @Roles('admin', 'manager')
  @CheckQuota('screen')
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
  @Public() // Bypass user JWT guard -- device JWT verified manually below
  heartbeat(@Param('deviceId') deviceId: string, @Req() req: Request) {
    // Verify device JWT to prevent unauthenticated heartbeat calls
    const token = (req.headers.authorization as string)?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Device authentication required');
    }
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.DEVICE_JWT_SECRET,
      });
      if (payload.type !== 'device') {
        throw new UnauthorizedException('Invalid token type');
      }
      // Validate the device is sending its own heartbeat
      if (payload.deviceIdentifier !== deviceId && payload.sub !== deviceId) {
        throw new UnauthorizedException('Device identity mismatch');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired device token');
    }
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

  @Post(':id/screenshot')
  @Roles('admin', 'manager')
  async requestScreenshot(
    @Param('id') id: string,
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
    @Param('id') id: string,
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
    @Param('id') id: string,
    @Body() dto: UpdateQrOverlayDto,
  ) {
    return this.displaysService.updateQrOverlay(organizationId, id, dto);
  }

  @Delete(':id/qr-overlay')
  @Roles('admin', 'manager')
  async removeQrOverlay(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.displaysService.removeQrOverlay(organizationId, id);
  }
}
