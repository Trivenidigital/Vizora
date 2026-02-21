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
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CheckConflictsDto } from './dto/check-conflicts.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@UseGuards(RolesGuard)
@Controller('schedules')
export class SchedulesController {
  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  @Roles('admin', 'manager')
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createScheduleDto: CreateScheduleDto,
  ) {
    return this.schedulesService.create(organizationId, createScheduleDto);
  }

  @Post('check-conflicts')
  @Roles('admin', 'manager')
  checkConflicts(
    @CurrentUser('organizationId') organizationId: string,
    @Body() checkConflictsDto: CheckConflictsDto,
  ) {
    return this.schedulesService.checkConflicts(organizationId, checkConflictsDto);
  }

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
    @Query('displayId') displayId?: string,
    @Query('displayGroupId') displayGroupId?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.schedulesService.findAll(organizationId, pagination, {
      displayId,
      displayGroupId,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get('active/:displayId')
  @Public() // Bypass user JWT guard -- device JWT verified manually below
  findActiveSchedules(@Param('displayId') displayId: string, @Req() req: Request) {
    // Verify device JWT to prevent unauthenticated schedule access
    const token = (req.headers.authorization as string)?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Device authentication required');
    }
    let organizationId: string;
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.DEVICE_JWT_SECRET,
      });
      if (payload.type !== 'device') {
        throw new UnauthorizedException('Invalid token type');
      }
      organizationId = payload.organizationId;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired device token');
    }
    return this.schedulesService.findActiveSchedules(displayId, organizationId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.schedulesService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(organizationId, id, updateScheduleDto);
  }

  @Post(':id/duplicate')
  @Roles('admin', 'manager')
  duplicate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.schedulesService.duplicate(organizationId, id);
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.schedulesService.remove(organizationId, id);
  }
}
