import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresSubscription } from '../billing/decorators/requires-subscription.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FleetService } from './fleet.service';
import { SendCommandDto } from './dto/send-command.dto';

@UseGuards(RolesGuard)
@RequiresSubscription()
@Controller('fleet')
export class FleetController {
  constructor(private readonly fleetService: FleetService) {}

  @Post('commands')
  @Roles('admin', 'manager')
  async sendCommand(
    @CurrentUser() user: any,
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: SendCommandDto,
  ) {
    // Emergency override requires admin role
    if (dto.payload?.priority === 'emergency' && user.role !== 'admin') {
      throw new ForbiddenException('Emergency override requires admin role');
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
    @Param('commandId') commandId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.fleetService.clearOverride(orgId, commandId);
  }
}
