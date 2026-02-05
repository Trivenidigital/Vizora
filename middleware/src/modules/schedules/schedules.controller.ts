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
  constructor(private readonly schedulesService: SchedulesService) {}

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
  @Public()
  findActiveSchedules(@Param('displayId') displayId: string) {
    return this.schedulesService.findActiveSchedules(displayId);
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
