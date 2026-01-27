import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  create(
    @Body('organizationId') organizationId: string,
    @Body() createScheduleDto: CreateScheduleDto,
  ) {
    return this.schedulesService.create(organizationId, createScheduleDto);
  }

  @Get()
  findAll(
    @Query('organizationId') organizationId: string,
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
  findActiveSchedules(@Param('displayId') displayId: string) {
    return this.schedulesService.findActiveSchedules(displayId);
  }

  @Get(':id')
  findOne(
    @Query('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.schedulesService.findOne(organizationId, id);
  }

  @Patch(':id')
  update(
    @Query('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateScheduleDto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(organizationId, id, updateScheduleDto);
  }

  @Delete(':id')
  remove(
    @Query('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.schedulesService.remove(organizationId, id);
  }
}
