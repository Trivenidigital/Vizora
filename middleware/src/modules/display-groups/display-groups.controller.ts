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
import { DisplayGroupsService } from './display-groups.service';
import { CreateDisplayGroupDto } from './dto/create-display-group.dto';
import { UpdateDisplayGroupDto } from './dto/update-display-group.dto';
import { ManageDisplaysDto } from './dto/manage-displays.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(RolesGuard)
@Controller('display-groups')
export class DisplayGroupsController {
  constructor(private readonly displayGroupsService: DisplayGroupsService) {}

  @Post()
  @Roles('admin', 'manager')
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createDisplayGroupDto: CreateDisplayGroupDto,
  ) {
    return this.displayGroupsService.create(organizationId, createDisplayGroupDto);
  }

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.displayGroupsService.findAll(organizationId, pagination);
  }

  @Get(':id')
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.displayGroupsService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateDisplayGroupDto: UpdateDisplayGroupDto,
  ) {
    return this.displayGroupsService.update(organizationId, id, updateDisplayGroupDto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.displayGroupsService.remove(organizationId, id);
  }

  @Post(':id/displays')
  @Roles('admin', 'manager')
  addDisplays(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() manageDisplaysDto: ManageDisplaysDto,
  ) {
    return this.displayGroupsService.addDisplays(organizationId, id, manageDisplaysDto);
  }

  @Delete(':id/displays')
  @Roles('admin', 'manager')
  removeDisplays(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() manageDisplaysDto: ManageDisplaysDto,
  ) {
    return this.displayGroupsService.removeDisplays(organizationId, id, manageDisplaysDto);
  }
}
