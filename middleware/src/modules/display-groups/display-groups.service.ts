import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateDisplayGroupDto } from './dto/create-display-group.dto';
import { UpdateDisplayGroupDto } from './dto/update-display-group.dto';
import { ManageDisplaysDto } from './dto/manage-displays.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class DisplayGroupsService {
  constructor(private readonly db: DatabaseService) {}

  async create(organizationId: string, dto: CreateDisplayGroupDto) {
    return this.db.displayGroup.create({
      data: {
        ...dto,
        organizationId,
      },
      include: {
        displays: {
          include: {
            display: true,
          },
        },
      },
    });
  }

  async findAll(organizationId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.displayGroup.findMany({
        where: { organizationId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              displays: true,
            },
          },
        },
      }),
      this.db.displayGroup.count({ where: { organizationId } }),
    ]);

    return new PaginatedResponse(data, total, page, limit);
  }

  async findOne(organizationId: string, id: string) {
    const group = await this.db.displayGroup.findFirst({
      where: { id, organizationId },
      include: {
        displays: {
          include: {
            display: true,
          },
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Display group not found');
    }

    return group;
  }

  async update(organizationId: string, id: string, dto: UpdateDisplayGroupDto) {
    await this.findOne(organizationId, id);

    return this.db.displayGroup.update({
      where: { id },
      data: dto,
      include: {
        displays: {
          include: {
            display: true,
          },
        },
      },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);

    return this.db.displayGroup.delete({
      where: { id },
    });
  }

  async addDisplays(organizationId: string, groupId: string, dto: ManageDisplaysDto) {
    await this.findOne(organizationId, groupId);

    // Verify all displayIds belong to the caller's organization
    const validDisplayCount = await this.db.display.count({
      where: { id: { in: dto.displayIds }, organizationId },
    });
    if (validDisplayCount !== dto.displayIds.length) {
      throw new NotFoundException('One or more displays not found');
    }

    await this.db.displayGroupMember.createMany({
      data: dto.displayIds.map((displayId) => ({
        displayGroupId: groupId,
        displayId,
      })),
      skipDuplicates: true,
    });

    return this.findOne(organizationId, groupId);
  }

  async removeDisplays(organizationId: string, groupId: string, dto: ManageDisplaysDto) {
    await this.findOne(organizationId, groupId);

    await this.db.displayGroupMember.deleteMany({
      where: {
        displayGroupId: groupId,
        displayId: { in: dto.displayIds },
      },
    });

    return this.findOne(organizationId, groupId);
  }
}
