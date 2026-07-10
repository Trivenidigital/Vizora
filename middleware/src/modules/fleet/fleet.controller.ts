import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresSubscription } from '../billing/decorators/requires-subscription.decorator';
import { EntitlementPublishGuard } from '../billing/guards/entitlement-publish.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FleetService } from './fleet.service';
import { SendCommandDto } from './dto/send-command.dto';

@UseGuards(RolesGuard)
@RequiresSubscription()
@Controller('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  // This endpoint multiplexes device commands. EntitlementPublishGuard enforces
  // ONLY the `push_content` command at the publish_locked/suspended rungs (its
  // fleet carve-out lets reload/restart/reboot/clear_cache/update through, since
  // those are device management, not publishing NEW content).
  @Post('commands')
  @Roles('admin', 'manager')
  @UseGuards(EntitlementPublishGuard)
  async sendCommand(
    @CurrentUser() user: any,
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: SendCommandDto,
  ) {
    // Emergency override requires admin role
    if (dto.payload?.priority === 'emergency' && user.role !== 'admin') {
      throw new ForbiddenException('Emergency override requires admin role');
    }
    if (dto.command === 'update' && user.role !== 'admin') {
      throw new ForbiddenException('Display app updates require admin role');
    }
    return this.fleetService.sendCommand(orgId, user.id, user.role, dto);
  }

  @Get('overrides/active')
  @Roles('admin', 'manager')
  async getActiveOverrides(@CurrentUser('organizationId') orgId: string) {
    return this.fleetService.getActiveOverrides(orgId);
  }

  @Delete('overrides/:commandId')
  @Roles('admin')
  async clearOverride(
    @Param('commandId', new ParseUUIDPipe()) commandId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.fleetService.clearOverride(orgId, commandId);
  }
}
