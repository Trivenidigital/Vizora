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
import { DisplaysService } from './displays.service';
import { CreateDisplayDto } from './dto/create-display.dto';
import { UpdateDisplayDto } from './dto/update-display.dto';
import { PaginationDto } from '../common/dto/pagination.dto';

@Controller('displays')
export class DisplaysController {
  constructor(private readonly displaysService: DisplaysService) {}

  @Post()
  create(
    @Body('organizationId') organizationId: string,
    @Body() createDisplayDto: CreateDisplayDto,
  ) {
    return this.displaysService.create(organizationId, createDisplayDto);
  }

  @Get()
  findAll(
    @Query('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.displaysService.findAll(organizationId, pagination);
  }

  @Get(':id')
  findOne(
    @Query('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.displaysService.findOne(organizationId, id);
  }

  @Patch(':id')
  update(
    @Query('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateDisplayDto: UpdateDisplayDto,
  ) {
    return this.displaysService.update(organizationId, id, updateDisplayDto);
  }

  @Post(':deviceId/heartbeat')
  heartbeat(@Param('deviceId') deviceId: string) {
    return this.displaysService.updateHeartbeat(deviceId);
  }

  @Delete(':id')
  remove(
    @Query('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.displaysService.remove(organizationId, id);
  }
}
