import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CheckConflictsDto } from './dto/check-conflicts.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class SchedulesService {
  constructor(private readonly db: DatabaseService) {}

  async create(organizationId: string, createScheduleDto: CreateScheduleDto) {
    if (!createScheduleDto.displayId && !createScheduleDto.displayGroupId) {
      throw new BadRequestException('Either displayId or displayGroupId must be provided');
    }

    if (createScheduleDto.displayId && createScheduleDto.displayGroupId) {
      throw new BadRequestException('Cannot specify both displayId and displayGroupId');
    }

    // Validate foreign keys belong to the same organization
    if (createScheduleDto.displayId) {
      const display = await this.db.display.findFirst({
        where: { id: createScheduleDto.displayId, organizationId },
      });
      if (!display) {
        throw new NotFoundException('Display not found');
      }
    }

    if (createScheduleDto.displayGroupId) {
      const displayGroup = await this.db.displayGroup.findFirst({
        where: { id: createScheduleDto.displayGroupId, organizationId },
      });
      if (!displayGroup) {
        throw new NotFoundException('Display group not found');
      }
    }

    if (createScheduleDto.playlistId) {
      const playlist = await this.db.playlist.findFirst({
        where: { id: createScheduleDto.playlistId, organizationId },
      });
      if (!playlist) {
        throw new NotFoundException('Playlist not found');
      }
    }

    return this.db.schedule.create({
      data: {
        ...createScheduleDto,
        startDate: new Date(createScheduleDto.startDate),
        endDate: createScheduleDto.endDate ? new Date(createScheduleDto.endDate) : null,
        organizationId,
      },
      include: {
        playlist: true,
        display: true,
        displayGroup: true,
      },
    });
  }

  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    filters?: { displayId?: string; displayGroupId?: string; isActive?: boolean },
  ) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };
    if (filters?.displayId) where.displayId = filters.displayId;
    if (filters?.displayGroupId) where.displayGroupId = filters.displayGroupId;
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    const [data, total] = await Promise.all([
      this.db.schedule.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        include: {
          playlist: {
            include: {
              _count: {
                select: { items: true },
              },
            },
          },
          display: true,
          displayGroup: true,
        },
      }),
      this.db.schedule.count({ where }),
    ]);

    return new PaginatedResponse(data, total, page, limit);
  }

  async findOne(organizationId: string, id: string) {
    const schedule = await this.db.schedule.findFirst({
      where: { id, organizationId },
      include: {
        playlist: {
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
        },
        display: true,
        displayGroup: {
          include: {
            displays: {
              include: {
                display: true,
              },
            },
          },
        },
      },
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async findActiveSchedules(displayId: string, organizationId: string) {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    return this.db.schedule.findMany({
      where: {
        organizationId,
        isActive: true,
        startDate: { lte: now },
        daysOfWeek: { has: dayOfWeek },
        AND: [
          {
            OR: [{ endDate: null }, { endDate: { gte: now } }],
          },
          {
            OR: [
              { startTime: null, endTime: null },
              {
                AND: [
                  { startTime: { lte: currentTime } },
                  { endTime: { gte: currentTime } },
                ],
              },
            ],
          },
          {
            OR: [{ displayId }, { displayGroup: { displays: { some: { displayId } } } }],
          },
        ],
      },
      orderBy: { priority: 'desc' },
      include: {
        playlist: {
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
        },
      },
    });
  }

  async update(organizationId: string, id: string, updateScheduleDto: UpdateScheduleDto) {
    await this.findOne(organizationId, id);

    if (updateScheduleDto.displayId && updateScheduleDto.displayGroupId) {
      throw new BadRequestException('Cannot specify both displayId and displayGroupId');
    }

    // Validate foreign keys belong to the same organization
    if (updateScheduleDto.displayId) {
      const display = await this.db.display.findFirst({
        where: { id: updateScheduleDto.displayId, organizationId },
      });
      if (!display) {
        throw new NotFoundException('Display not found');
      }
    }

    if (updateScheduleDto.displayGroupId) {
      const displayGroup = await this.db.displayGroup.findFirst({
        where: { id: updateScheduleDto.displayGroupId, organizationId },
      });
      if (!displayGroup) {
        throw new NotFoundException('Display group not found');
      }
    }

    if (updateScheduleDto.playlistId) {
      const playlist = await this.db.playlist.findFirst({
        where: { id: updateScheduleDto.playlistId, organizationId },
      });
      if (!playlist) {
        throw new NotFoundException('Playlist not found');
      }
    }

    return this.db.schedule.update({
      where: { id },
      data: {
        ...updateScheduleDto,
        startDate: updateScheduleDto.startDate ? new Date(updateScheduleDto.startDate) : undefined,
        endDate: updateScheduleDto.endDate ? new Date(updateScheduleDto.endDate) : undefined,
      },
      include: {
        playlist: true,
        display: true,
        displayGroup: true,
      },
    });
  }

  async duplicate(organizationId: string, id: string) {
    const original = await this.findOne(organizationId, id);

    return this.db.schedule.create({
      data: {
        name: `${original.name} (Copy)`,
        description: original.description,
        playlistId: original.playlistId,
        displayId: original.displayId,
        displayGroupId: original.displayGroupId,
        startDate: original.startDate,
        endDate: original.endDate,
        startTime: original.startTime,
        endTime: original.endTime,
        daysOfWeek: original.daysOfWeek,
        priority: original.priority,
        isActive: false, // Duplicated schedules start inactive
        organizationId,
      },
      include: {
        playlist: true,
        display: true,
        displayGroup: true,
      },
    });
  }

  async checkConflicts(organizationId: string, dto: CheckConflictsDto) {
    const where: any = {
      organizationId,
      isActive: true,
    };

    // Filter by display or display group
    if (dto.displayId) {
      where.OR = [
        { displayId: dto.displayId },
        { displayGroup: { displays: { some: { displayId: dto.displayId } } } },
      ];
    } else if (dto.displayGroupId) {
      where.displayGroupId = dto.displayGroupId;
    }

    // Filter by overlapping days
    if (dto.daysOfWeek && dto.daysOfWeek.length > 0) {
      where.daysOfWeek = { hasSome: dto.daysOfWeek };
    }

    // Exclude specific schedule (useful when editing)
    if (dto.excludeScheduleId) {
      where.id = { not: dto.excludeScheduleId };
    }

    const potentialConflicts = await this.db.schedule.findMany({
      where,
      include: {
        playlist: { select: { id: true, name: true } },
        display: { select: { id: true, nickname: true } },
        displayGroup: { select: { id: true, name: true } },
      },
    });

    // Check time overlap
    const conflicts = potentialConflicts.filter(schedule => {
      if (!dto.startTime || !dto.endTime || !schedule.startTime || !schedule.endTime) {
        return true; // All-day schedules always conflict
      }
      // Time overlap check: NOT (newEnd <= existingStart OR newStart >= existingEnd)
      return !(dto.endTime <= schedule.startTime || dto.startTime >= schedule.endTime);
    });

    return {
      hasConflicts: conflicts.length > 0,
      conflicts: conflicts.map(c => ({
        id: c.id,
        name: c.name,
        startTime: c.startTime,
        endTime: c.endTime,
        daysOfWeek: c.daysOfWeek,
        playlist: c.playlist,
        display: c.display,
        displayGroup: c.displayGroup,
      })),
    };
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.db.schedule.delete({
      where: { id },
    });
  }
}
