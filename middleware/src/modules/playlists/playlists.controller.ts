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
import { PlaylistsService } from './playlists.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { ReorderPlaylistDto } from './dto/reorder-playlist.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(RolesGuard)
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Post()
  @Roles('admin', 'manager')
  create(
    @CurrentUser('organizationId') organizationId: string,
    @Body() createPlaylistDto: CreatePlaylistDto,
  ) {
    return this.playlistsService.create(organizationId, createPlaylistDto);
  }

  @Get()
  findAll(
    @CurrentUser('organizationId') organizationId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.playlistsService.findAll(organizationId, pagination);
  }

  @Get(':id')
  findOne(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.playlistsService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updatePlaylistDto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.update(organizationId, id, updatePlaylistDto);
  }

  @Post(':id/duplicate')
  @Roles('admin', 'manager')
  duplicate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.playlistsService.duplicate(organizationId, id);
  }

  @Post(':id/reorder')
  @Roles('admin', 'manager')
  reorder(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() reorderDto: ReorderPlaylistDto,
  ) {
    return this.playlistsService.reorder(organizationId, id, reorderDto.itemIds);
  }

  @Post(':id/items')
  @Roles('admin', 'manager')
  addItem(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') playlistId: string,
    @Body('contentId') contentId: string,
    @Body('duration') duration?: number,
  ) {
    return this.playlistsService.addItem(organizationId, playlistId, contentId, duration);
  }

  @Delete(':id/items/:itemId')
  @Roles('admin')
  removeItem(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') playlistId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.playlistsService.removeItem(organizationId, playlistId, itemId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.playlistsService.remove(organizationId, id);
  }
}
