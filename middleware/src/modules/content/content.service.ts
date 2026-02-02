import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class ContentService {
  constructor(private readonly db: DatabaseService) {}

  // Map database content to API response format
  private mapContentResponse(content: any) {
    if (!content) return content;
    return {
      ...content,
      title: content.name, // Map name to title for frontend compatibility
      thumbnailUrl: content.thumbnail, // Map thumbnail to thumbnailUrl for frontend
    };
  }

  async create(organizationId: string, createContentDto: CreateContentDto) {
    const content = await this.db.content.create({
      data: {
        ...createContentDto,
        organizationId,
      },
    });
    return this.mapContentResponse(content);
  }

  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    filters?: { type?: string; status?: string },
  ) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    // Validate filter values - only allow whitelisted values
    const validTypes = ['image', 'video', 'url', 'html'];
    const validStatuses = ['active', 'archived', 'draft'];

    const where: any = { organizationId };
    if (filters?.type && validTypes.includes(filters.type)) {
      where.type = filters.type;
    }
    if (filters?.status && validStatuses.includes(filters.status)) {
      where.status = filters.status;
    }

    const [data, total] = await Promise.all([
      this.db.content.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      }),
      this.db.content.count({ where }),
    ]);

    // Map each content item to include thumbnailUrl
    const mappedData = data.map(item => this.mapContentResponse(item));
    return new PaginatedResponse(mappedData, total, page, limit);
  }

  async findOne(organizationId: string, id: string) {
    const content = await this.db.content.findFirst({
      where: { id, organizationId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        playlistItems: {
          include: {
            playlist: true,
          },
        },
      },
    });

    if (!content) {
      throw new NotFoundException('Content not found');
    }

    return this.mapContentResponse(content);
  }

  async update(organizationId: string, id: string, updateContentDto: UpdateContentDto) {
    await this.findOne(organizationId, id);

    const content = await this.db.content.update({
      where: { id },
      data: updateContentDto,
    });
    return this.mapContentResponse(content);
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.db.content.delete({
      where: { id },
    });
  }

  async archive(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.db.content.update({
      where: { id },
      data: { status: 'archived' },
    });
  }
}
