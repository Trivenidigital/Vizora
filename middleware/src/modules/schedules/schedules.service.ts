import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@vizora/database';
import { DatabaseService } from '../database/database.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CheckConflictsDto } from './dto/check-conflicts.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

const MINUTES_PER_DAY = 24 * 60;
const DAYS_PER_WEEK = 7;
const MINUTES_PER_WEEK = DAYS_PER_WEEK * MINUTES_PER_DAY;

type ScheduleWindow = {
  daysOfWeek: number[];
  startTime?: number | null;
  endTime?: number | null;
};

const previousDay = (day: number) => (day + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
const nextDay = (day: number) => (day + 1) % DAYS_PER_WEEK;

const expandAdjacentDays = (days: number[]): number[] => Array.from(new Set(
  days.flatMap((day) => [day, previousDay(day), nextDay(day)]),
));

const expandWeeklyIntervals = (window: ScheduleWindow): Array<{ start: number; end: number }> => {
  return window.daysOfWeek.flatMap((day) => {
    if (window.startTime == null || window.endTime == null || window.startTime === window.endTime) {
      return [{ start: day * MINUTES_PER_DAY, end: (day + 1) * MINUTES_PER_DAY }];
    }

    const start = day * MINUTES_PER_DAY + window.startTime;
    const end = window.startTime < window.endTime
      ? day * MINUTES_PER_DAY + window.endTime
      : (day + 1) * MINUTES_PER_DAY + window.endTime;
    return [{ start, end }];
  });
};

const intervalsOverlap = (
  left: { start: number; end: number },
  right: { start: number; end: number },
): boolean => {
  return [-MINUTES_PER_WEEK, 0, MINUTES_PER_WEEK].some((shift) => {
    const shiftedRight = { start: right.start + shift, end: right.end + shift };
    return left.start < shiftedRight.end && shiftedRight.start < left.end;
  });
};

const schedulesOverlapInTime = (candidate: ScheduleWindow, existing: ScheduleWindow): boolean => {
  const candidateIntervals = expandWeeklyIntervals(candidate);
  const existingIntervals = expandWeeklyIntervals(existing);
  return candidateIntervals.some((candidateInterval) => (
    existingIntervals.some((existingInterval) => intervalsOverlap(candidateInterval, existingInterval))
  ));
};

const isScheduleActiveAt = (schedule: ScheduleWindow, dayOfWeek: number, currentTime: number): boolean => {
  const point = dayOfWeek * MINUTES_PER_DAY + currentTime;
  return expandWeeklyIntervals(schedule).some((interval) => (
    [point - MINUTES_PER_WEEK, point, point + MINUTES_PER_WEEK].some((shiftedPoint) => (
      interval.start <= shiftedPoint && shiftedPoint < interval.end
    ))
  ));
};

@Injectable()
export class SchedulesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

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

    const schedule = await this.db.schedule.create({
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
    this.eventEmitter.emit('schedule.created', { entityId: schedule.id, organizationId });
    return schedule;
  }

  async findAll(
    organizationId: string,
    pagination: PaginationDto,
    filters?: { displayId?: string; displayGroupId?: string; isActive?: boolean },
  ) {
    const { page = 1, limit = 10 } = pagination;
    const skip = (page - 1) * limit;

    const where: Prisma.ScheduleWhereInput = { organizationId };
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
    // Fetch the display's timezone to compute "now" in local time
    const display = await this.db.display.findFirst({
      where: { id: displayId, organizationId },
      select: { timezone: true, isDisabled: true },
    });
    if (!display || display.isDisabled) {
      throw new NotFoundException('Display not found');
    }
    const timezone = display.timezone || 'UTC';

    // Compute current day/time in the display's timezone
    const now = new Date();
    const localStr = now.toLocaleString('en-US', { timeZone: timezone });
    const localNow = new Date(localStr);
    const dayOfWeek = localNow.getDay();
    const currentTime = localNow.getHours() * 60 + localNow.getMinutes();

    const candidateDays = [dayOfWeek, previousDay(dayOfWeek)];
    const activeCandidates = await this.db.schedule.findMany({
      where: {
        organizationId,
        isActive: true,
        startDate: { lte: now },
        daysOfWeek: { hasSome: candidateDays },
        AND: [
          {
            OR: [{ endDate: null }, { endDate: { gte: now } }],
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

    return activeCandidates.filter((schedule) => (
      isScheduleActiveAt(
        {
          daysOfWeek: schedule.daysOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
        dayOfWeek,
        currentTime,
      )
    ));
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

    const targetUpdate =
      updateScheduleDto.displayId
        ? { displayId: updateScheduleDto.displayId, displayGroupId: null }
        : updateScheduleDto.displayGroupId
          ? { displayId: null, displayGroupId: updateScheduleDto.displayGroupId }
          : {};

    const updated = await this.db.schedule.update({
      where: { id },
      data: {
        ...updateScheduleDto,
        ...targetUpdate,
        startDate: updateScheduleDto.startDate ? new Date(updateScheduleDto.startDate) : undefined,
        endDate: updateScheduleDto.endDate ? new Date(updateScheduleDto.endDate) : undefined,
      },
      include: {
        playlist: true,
        display: true,
        displayGroup: true,
      },
    });
    this.eventEmitter.emit('schedule.updated', { entityId: id, organizationId });
    return updated;
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
    const where: Prisma.ScheduleWhereInput = {
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
      where.OR = [
        { displayGroupId: dto.displayGroupId },
        { display: { groups: { some: { displayGroupId: dto.displayGroupId } } } },
        {
          displayGroup: {
            displays: {
              some: {
                display: {
                  groups: { some: { displayGroupId: dto.displayGroupId } },
                },
              },
            },
          },
        },
      ];
    }

    // Filter by overlapping days
    if (dto.daysOfWeek && dto.daysOfWeek.length > 0) {
      where.daysOfWeek = { hasSome: expandAdjacentDays(dto.daysOfWeek) };
    }

    // Date-range overlap filter — without this, schedules in non-
    // overlapping date windows (e.g. one ending in 2025, the other
    // starting in 2026) were flagged as conflicting solely because
    // they shared daysOfWeek + display. Both bounds are optional;
    // an open-ended schedule (no startDate / endDate) on either
    // side falls back to "always-overlapping in time" for that side.
    const dateConditions: Prisma.ScheduleWhereInput[] = [];
    if (dto.endDate) {
      // Candidate ends BEFORE existing starts → no overlap; exclude
      // anything whose startDate is strictly after the candidate's end.
      dateConditions.push({
        OR: [
          { startDate: null },
          { startDate: { lte: new Date(dto.endDate) } },
        ],
      });
    }
    if (dto.startDate) {
      // Existing ended BEFORE candidate starts → no overlap; exclude
      // anything whose endDate is strictly before the candidate's start.
      dateConditions.push({
        OR: [
          { endDate: null },
          { endDate: { gte: new Date(dto.startDate) } },
        ],
      });
    }
    if (dateConditions.length > 0) {
      where.AND = dateConditions;
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
      return schedulesOverlapInTime(
        {
          daysOfWeek: dto.daysOfWeek,
          startTime: dto.startTime,
          endTime: dto.endTime,
        },
        {
          daysOfWeek: schedule.daysOfWeek,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
        },
      );
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
    const result = await this.db.schedule.delete({
      where: { id },
    });
    this.eventEmitter.emit('schedule.deleted', { entityId: id, organizationId });
    return result;
  }
}
