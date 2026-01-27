import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class PlaylistsService {
  constructor(private readonly db: DatabaseService) {}

  async create(organizationId: string, createPlaylistDto: CreatePlaylistDto) {
    const { items, ...playlistData } = createPlaylistDto;

    const playlist = await this.db.playlist.create({
      data: {
        ...playlistData,
        organizationId,
        items: items
          ? {
              create: items.map((item, index) => ({
                contentId: item.contentId,
                order: item.order ?? index,
                duration: item.duration,
              })),
            }
          : undefined,
      },
      include: {
        items: {
          include: {
            content: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    return playlist;
  }

  async findAll(organizationId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.playlist.findMany({
        where: { organizationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              items: true,
              schedules: true,
            },
          },
        },
      }),
      this.db.playlist.count({ where: { organizationId } }),
    ]);

    return new PaginatedResponse(data, total, page, limit);
  }

  async findOne(organizationId: string, id: string) {
    const playlist = await this.db.playlist.findFirst({
      where: { id, organizationId },
      include: {
        items: {
          include: {
            content: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
        schedules: {
          where: { isActive: true },
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }

    return playlist;
  }

  async update(organizationId: string, id: string, updatePlaylistDto: UpdatePlaylistDto) {
    await this.findOne(organizationId, id);

    const { items, ...playlistData } = updatePlaylistDto;

    if (items) {
      await this.db.playlistItem.deleteMany({
        where: { playlistId: id },
      });
    }

    return this.db.playlist.update({
      where: { id },
      data: {
        ...playlistData,
        items: items
          ? {
              create: items.map((item, index) => ({
                contentId: item.contentId,
                order: item.order ?? index,
                duration: item.duration,
              })),
            }
          : undefined,
      },
      include: {
        items: {
          include: {
            content: true,
          },
          orderBy: {
            order: 'asc',
          },
        },
      },
    });
  }

  async addItem(organizationId: string, playlistId: string, contentId: string, duration?: number) {
    await this.findOne(organizationId, playlistId);

    const maxOrder = await this.db.playlistItem.findFirst({
      where: { playlistId },
      orderBy: { order: 'desc' },
      select: { order: true },
    });

    return this.db.playlistItem.create({
      data: {
        playlistId,
        contentId,
        order: (maxOrder?.order ?? -1) + 1,
        duration,
      },
      include: {
        content: true,
      },
    });
  }

  async removeItem(organizationId: string, playlistId: string, itemId: string) {
    await this.findOne(organizationId, playlistId);

    return this.db.playlistItem.delete({
      where: { id: itemId },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.db.playlist.delete({
      where: { id },
    });
  }
}
