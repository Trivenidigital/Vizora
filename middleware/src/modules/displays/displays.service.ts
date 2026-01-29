import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { DatabaseService } from '../database/database.service';
import { CreateDisplayDto } from './dto/create-display.dto';
import { UpdateDisplayDto } from './dto/update-display.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';

@Injectable()
export class DisplaysService {
  private readonly logger = new Logger(DisplaysService.name);
  private readonly realtimeUrl = process.env.REALTIME_URL || 'http://localhost:3002';

  constructor(
    private readonly db: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
  ) {}

  async create(organizationId: string, createDisplayDto: CreateDisplayDto) {
    const { deviceId, name, ...rest } = createDisplayDto;
    
    const existing = await this.db.display.findUnique({
      where: { deviceIdentifier: deviceId },
    });

    if (existing) {
      throw new ConflictException('Display with this device ID already exists');
    }

    return this.db.display.create({
      data: {
        ...rest,
        deviceIdentifier: deviceId,
        nickname: name,
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

    const { deviceId, name, currentPlaylistId, ...rest } = updateDisplayDto;

    if (deviceId) {
      const existing = await this.db.display.findFirst({
        where: {
          deviceIdentifier: deviceId,
          NOT: { id },
        },
      });

      if (existing) {
        throw new ConflictException('Display with this device ID already exists');
      }
    }

    // Validate playlist exists and belongs to same organization if provided
    let playlist = null;
    if (currentPlaylistId !== undefined) {
      if (currentPlaylistId) {
        this.logger.log(`Looking for playlist: ${currentPlaylistId} in org: ${organizationId}`);
        playlist = await this.db.playlist.findFirst({
          where: {
            id: currentPlaylistId,
            organizationId,
          },
          include: {
            items: {
              include: {
                content: true,
              },
            },
          },
        });

        this.logger.log(`Playlist found: ${playlist ? 'YES' : 'NO'}`);
        if (playlist) {
          this.logger.log(`Playlist org: ${playlist.organizationId}`);
        } else {
          // DEBUG: Log all playlists to see what's happening
          const allPlaylists = await this.db.playlist.findMany({ where: { organizationId } });
          this.logger.error(`All playlists in org ${organizationId}: ${JSON.stringify(allPlaylists.map(p => ({ id: p.id, name: p.name })))}`);
        }

        if (!playlist) {
          throw new NotFoundException('Playlist not found or does not belong to your organization');
        }
      }
    }

    const updatedDisplay = await this.db.display.update({
      where: { id },
      data: {
        ...rest,
        ...(deviceId && { deviceIdentifier: deviceId }),
        ...(name && { nickname: name }),
        ...(currentPlaylistId !== undefined && { currentPlaylistId }),
      },
    });

    // If playlist was updated, notify the realtime service to push update to device
    // Fire-and-forget - don't block the response if realtime service is down
    if (currentPlaylistId !== undefined && playlist) {
      this.notifyPlaylistUpdate(updatedDisplay.id, playlist).catch(error => {
        this.logger.error(`Failed to notify realtime service, but update succeeded: ${error.message}`);
      });
    }

    return updatedDisplay;
  }

  private async notifyPlaylistUpdate(displayId: string, playlist: any) {
    try {
      const url = `${this.realtimeUrl}/api/push/playlist`;
      this.logger.log(`Attempting to notify realtime at: ${url}`);
      const response = await firstValueFrom(
        this.httpService.post(url, {
          deviceId: displayId,
          playlist,
        })
      );
      this.logger.log(`Notified realtime service of playlist update for display ${displayId}`);
      this.logger.log(`Response: ${JSON.stringify(response.data)}`);
    } catch (error) {
      this.logger.error(`Failed to notify realtime service: ${error.message}`);
      // Don't throw - this is a background notification, main operation already succeeded
    }
  }

  async updateHeartbeat(deviceIdentifier: string) {
    return this.db.display.update({
      where: { deviceIdentifier },
      data: {
        lastHeartbeat: new Date(),
        status: 'online',
      },
    });
  }

  async generatePairingToken(organizationId: string, id: string) {
    const display = await this.findOne(organizationId, id);

    // Generate device JWT token
    const pairingToken = this.jwtService.sign({
      sub: display.id,
      deviceIdentifier: display.deviceIdentifier,
      organizationId: display.organizationId,
      type: 'device',
    });

    // Update display with pairing info
    await this.db.display.update({
      where: { id },
      data: {
        jwtToken: pairingToken,
        pairedAt: new Date(),
        status: 'pairing',
      },
    });

    return {
      pairingToken,
      expiresIn: '30d',
      displayId: display.id,
      deviceIdentifier: display.deviceIdentifier,
    };
  }

  async remove(organizationId: string, id: string) {
    await this.findOne(organizationId, id);
    return this.db.display.delete({
      where: { id },
    });
  }
}
