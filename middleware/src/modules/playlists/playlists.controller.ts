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
import { PlaylistsService } from './playlists.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Post()
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
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() updatePlaylistDto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.update(organizationId, id, updatePlaylistDto);
  }

  @Post(':id/items')
  addItem(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') playlistId: string,
    @Body('contentId') contentId: string,
    @Body('duration') duration?: number,
  ) {
    return this.playlistsService.addItem(organizationId, playlistId, contentId, duration);
  }

  @Delete(':id/items/:itemId')
  removeItem(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') playlistId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.playlistsService.removeItem(organizationId, playlistId, itemId);
  }

  @Delete(':id')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.playlistsService.remove(organizationId, id);
  }
}
