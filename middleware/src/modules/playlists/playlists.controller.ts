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
import { ParseIdPipe } from '../common/pipes/parse-id.pipe';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequiresSubscription } from '../billing/decorators/requires-subscription.decorator';
import { PlaylistsService } from './playlists.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { ReorderPlaylistDto } from './dto/reorder-playlist.dto';
import { UpdatePlaylistItemDto } from './dto/update-playlist-item.dto';
import { AddPlaylistItemDto } from './dto/add-playlist-item.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(RolesGuard)
@RequiresSubscription()
@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Post()
  @Roles('admin', 'manager')
  @HttpCode(HttpStatus.CREATED)
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
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.playlistsService.findOne(organizationId, id);
  }

  @Patch(':id')
  @Roles('admin', 'manager')
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
    @Body() updatePlaylistDto: UpdatePlaylistDto,
  ) {
    return this.playlistsService.update(organizationId, id, updatePlaylistDto);
  }

  @Post(':id/duplicate')
  @Roles('admin', 'manager')
  duplicate(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.playlistsService.duplicate(organizationId, id);
  }

  @Post(':id/reorder')
  @Roles('admin', 'manager')
  reorder(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
    @Body() reorderDto: ReorderPlaylistDto,
  ) {
    return this.playlistsService.reorder(organizationId, id, reorderDto.itemIds);
  }

  @Post(':id/items')
  @Roles('admin', 'manager')
  addItem(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) playlistId: string,
    @Body() dto: AddPlaylistItemDto,
  ) {
    return this.playlistsService.addItem(organizationId, playlistId, dto.contentId, dto.duration);
  }

  @Patch(':id/items/:itemId')
  @Roles('admin', 'manager')
  updateItem(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) playlistId: string,
    @Param('itemId', ParseIdPipe) itemId: string,
    @Body() updateDto: UpdatePlaylistItemDto,
  ) {
    return this.playlistsService.updateItem(organizationId, playlistId, itemId, updateDto);
  }

  @Delete(':id/items/:itemId')
  @Roles('admin')
  removeItem(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) playlistId: string,
    @Param('itemId', ParseIdPipe) itemId: string,
  ) {
    return this.playlistsService.removeItem(organizationId, playlistId, itemId);
  }

  @Delete(':id')
  @Roles('admin')
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id', ParseIdPipe) id: string,
  ) {
    return this.playlistsService.remove(organizationId, id);
  }
}
