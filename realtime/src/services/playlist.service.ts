import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';
import { DatabaseService } from '../database/database.service';
import { Playlist } from '../types';

interface InstantPublish {
  playlistId: string;
  deviceId: string;
  expiresAt?: string;
  publishedAt: string;
}

@Injectable()
export class PlaylistService {
  private readonly logger = new Logger(PlaylistService.name);

  constructor(
    private redisService: RedisService,
    private databaseService: DatabaseService,
  ) {}

  /**
   * Get current playlist for a device.
   * Queries the database for the playlist assigned to the device,
   * falling back to the organization default if none assigned.
   */
  async getDevicePlaylist(deviceId: string, forceRefresh = false): Promise<Playlist | null> {
    try {
      // Try to get from cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = await this.redisService.getCachedPlaylist(deviceId);

        if (cached) {
          this.logger.debug(`Returning cached playlist for device: ${deviceId}`);
          return cached;
        }
      }

      // Query the database for the device's assigned playlist
      const display = await this.databaseService.display.findUnique({
        where: { id: deviceId },
        include: {
          currentPlaylist: {
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

      if (display?.currentPlaylist) {
        const playlist: any = {
          id: display.currentPlaylist.id,
          name: display.currentPlaylist.name,
          organizationId: display.organizationId,
          isActive: true,
          items: display.currentPlaylist.items.map((item: any) => ({
            id: item.id,
            contentId: item.contentId,
            order: item.order,
            duration: item.duration || 10,
            content: item.content ? {
              id: item.content.id,
              name: item.content.name,
              type: item.content.type,
              url: item.content.url,
              thumbnailUrl: item.content.thumbnail,
              metadata: item.content.metadata,
            } : undefined,
          })),
          createdAt: display.currentPlaylist.createdAt?.toISOString?.() || new Date().toISOString(),
          updatedAt: display.currentPlaylist.updatedAt?.toISOString?.() || new Date().toISOString(),
        };

        // Cache the playlist
        await this.redisService.cachePlaylist(deviceId, playlist);

        this.logger.debug(`Returning DB playlist for device: ${deviceId} (playlist: ${playlist.name})`);
        return playlist;
      }

      // Fallback: try the organization's default playlist
      if (display?.organizationId) {
        const orgPlaylist = await this.databaseService.playlist.findFirst({
          where: {
            organizationId: display.organizationId,
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
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (orgPlaylist) {
          const playlist: any = {
            id: orgPlaylist.id,
            name: orgPlaylist.name,
            organizationId: display.organizationId,
            isActive: true,
            items: orgPlaylist.items.map((item: any) => ({
              id: item.id,
              contentId: item.contentId,
              order: item.order,
              duration: item.duration || 10,
              content: item.content ? {
                id: item.content.id,
                name: item.content.name,
                type: item.content.type,
                url: item.content.url,
                thumbnailUrl: item.content.thumbnail,
                metadata: item.content.metadata,
              } : undefined,
            })),
            createdAt: orgPlaylist.createdAt?.toISOString?.() || new Date().toISOString(),
            updatedAt: orgPlaylist.updatedAt?.toISOString?.() || new Date().toISOString(),
          };

          // Cache the fallback playlist
          await this.redisService.cachePlaylist(deviceId, playlist);

          this.logger.debug(`Returning org fallback playlist for device: ${deviceId} (playlist: ${playlist.name})`);
          return playlist;
        }
      }

      this.logger.debug(`No playlist found for device: ${deviceId}`);
      return null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get playlist for ${deviceId}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Update playlist for a device
   */
  async updateDevicePlaylist(deviceId: string, playlist: Playlist): Promise<void> {
    try {
      // Cache the playlist
      await this.redisService.cachePlaylist(deviceId, playlist);

      this.logger.log(`Updated playlist for device: ${deviceId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update playlist for ${deviceId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get instant publish for a device
   */
  async getInstantPublish(deviceId: string): Promise<InstantPublish | null> {
    try {
      const key = `instant:${deviceId}`;
      const data = await this.redisService.get(key);

      if (!data) {
        return null;
      }

      const instantPublish: InstantPublish = JSON.parse(data);

      // Check if expired
      if (instantPublish.expiresAt && new Date(instantPublish.expiresAt) < new Date()) {
        await this.redisService.delete(key);
        return null;
      }

      return instantPublish;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get instant publish for ${deviceId}: ${errorMessage}`);
      return null;
    }
  }

  /**
   * Set instant publish for a device
   */
  async setInstantPublish(
    deviceId: string,
    playlistId: string,
    expiresAt?: Date,
  ): Promise<void> {
    try {
      const key = `instant:${deviceId}`;
      const ttl = expiresAt
        ? Math.floor((expiresAt.getTime() - Date.now()) / 1000)
        : 3600; // 1 hour default

      const instantPublish: InstantPublish = {
        playlistId,
        deviceId,
        expiresAt: expiresAt?.toISOString(),
        publishedAt: new Date().toISOString(),
      };

      await this.redisService.set(key, JSON.stringify(instantPublish), ttl);

      this.logger.log(`Set instant publish for device: ${deviceId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to set instant publish for ${deviceId}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Clear instant publish for a device
   */
  async clearInstantPublish(deviceId: string): Promise<void> {
    try {
      const key = `instant:${deviceId}`;
      await this.redisService.delete(key);

      this.logger.log(`Cleared instant publish for device: ${deviceId}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to clear instant publish for ${deviceId}: ${errorMessage}`);
      throw error;
    }
  }
}
