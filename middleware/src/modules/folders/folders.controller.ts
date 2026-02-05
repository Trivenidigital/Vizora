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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FoldersService } from './folders.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { MoveContentDto } from './dto/move-content.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(RolesGuard)
@Controller('folders')
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @Roles('admin', 'manager')
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createFolderDto: CreateFolderDto,
  ) {
    return this.foldersService.create(organizationId, createFolderDto);
  }

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query('format') format?: string,
  ) {
    if (format === 'tree') {
      return this.foldersService.findTree(organizationId);
    }
    return this.foldersService.findAll(organizationId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.foldersService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updateFolderDto: UpdateFolderDto,
  ) {
    return this.foldersService.update(organizationId, id, updateFolderDto);
  }

  @Delete(':id')
  @Roles('admin', 'manager')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.foldersService.remove(organizationId, id);
  }

  @Post(':id/content')
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.OK)
  moveContent(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() moveContentDto: MoveContentDto,
  ) {
    return this.foldersService.moveContent(organizationId, id, moveContentDto);
  }

  @Get(':id/content')
  getContents(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.foldersService.getContents(organizationId, id, pagination);
  }
}
