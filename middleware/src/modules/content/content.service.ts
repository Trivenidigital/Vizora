import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateContentDto } from './dto/create-content.dto';
import { UpdateContentDto } from './dto/update-content.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class ContentService {
  constructor(private readonly db: DatabaseService) {}

  async create(organizationId: string, createContentDto: CreateContentDto) {
    return this.db.content.create({
      data: {
        ...createContentDto,
        organizationId,
      },
    });
  }

  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    filters?: { type?: string; status?: string },
  ) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (filters?.type) where.type = filters.type;
    if (filters?.status) where.status = filters.status;

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

    return new PaginatedResponse(data, total, page, limit);
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

    return content;
  }

  async update(organizationId: string, id: string, updateContentDto: UpdateContentDto) {
    await this.findOne(organizationId, id);

    return this.db.content.update({
      where: { id },
      data: updateContentDto,
    });
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
