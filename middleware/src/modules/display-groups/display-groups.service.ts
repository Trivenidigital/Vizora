import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateDisplayGroupDto } from './dto/create-display-group.dto';
import { UpdateDisplayGroupDto } from './dto/update-display-group.dto';
import { ManageDisplaysDto } from './dto/manage-displays.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { DISPLAY_GROUP_MEMBER_WITH_DISPLAY_SELECT } from '../displays/display-response.select';

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
          select: DISPLAY_GROUP_MEMBER_WITH_DISPLAY_SELECT,
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
          displays: {
            select: {
              displayId: true,
            },
          },
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
          select: DISPLAY_GROUP_MEMBER_WITH_DISPLAY_SELECT,
        },
      },
    });

    if (!group) {
      throw new NotFoundException('Display group not found');
    }

    return group;
  }

  async update(organizationId: string, id: string, dto: UpdateDisplayGroupDto) {
    // Compound WHERE to close the TOCTOU race — previously findOne()
    // verified the org but update() used only `{id}`, so a parallel
    // request from another tenant during the gap between read and
    // write could mutate this row. R10 display-groups scout.
    const result = await this.db.displayGroup.updateMany({
      where: { id, organizationId },
      data: dto,
    });
    if (result.count === 0) {
      throw new NotFoundException('Display group not found');
    }
    return this.findOne(organizationId, id);
  }

  async remove(organizationId: string, id: string) {
    // Same TOCTOU close as update() — compound WHERE binds the delete
    // to the verified org.
    const result = await this.db.displayGroup.deleteMany({
      where: { id, organizationId },
    });
    if (result.count === 0) {
      throw new NotFoundException('Display group not found');
    }
    return { deleted: true, id };
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
