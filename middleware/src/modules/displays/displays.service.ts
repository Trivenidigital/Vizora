import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateDisplayDto } from './dto/create-display.dto';
import { UpdateDisplayDto } from './dto/update-display.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class DisplaysService {
  constructor(private readonly db: DatabaseService) {}

  async create(organizationId: string, createDisplayDto: CreateDisplayDto) {
    const existing = await this.db.display.findUnique({
      where: { deviceId: createDisplayDto.deviceId },
    });

    if (existing) {
      throw new ConflictException('Display with this device ID already exists');
    }

    return this.db.display.create({
      data: {
        ...createDisplayDto,
        organizationId,
      },
    });
  }

  async findAll(organizationId: string, pagination: PaginationDto) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.db.display.findMany({
        where: { organizationId },
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
      this.db.display.count({ where: { organizationId } }),
    ]);

    return new PaginatedResponse(data, total, page, limit);
  }

  async findOne(organizationId: string, id: string) {
    const display = await this.db.display.findFirst({
      where: { id, organizationId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        groups: {
          include: {
            displayGroup: true,
          },
        },
        schedules: {
          where: { isActive: true },
          include: {
            playlist: true,
          },
        },
      },
    });

    if (!display) {
      throw new NotFoundException('Display not found');
    }

    return display;
  }

  async update(organizationId: string, id: string, updateDisplayDto: UpdateDisplayDto) {
    await this.findOne(organizationId, id);

    if (updateDisplayDto.deviceId) {
      const existing = await this.db.display.findFirst({
        where: {
          deviceId: updateDisplayDto.deviceId,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Display with this device ID already exists');
      }
    }

    return this.db.display.update({
      where: { id },
      data: updateDisplayDto,
    });
  }

  async updateHeartbeat(deviceId: string) {
    return this.db.display.update({
      where: { deviceId },
      data: {
        lastHeartbeat: new Date(),
        status: 'online',
      },
    });
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.db.display.delete({
      where: { id },
    });
  }
}
