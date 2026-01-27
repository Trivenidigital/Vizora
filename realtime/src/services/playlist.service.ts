import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

@Injectable()
export class PlaylistService {
  private readonly logger = new Logger(PlaylistService.name);

  constructor(private redisService: RedisService) {}

  /**
   * Get current playlist for a device
   * In production, this would fetch from MongoDB
   */
  async getDevicePlaylist(deviceId: string): Promise<any | null> {
    try {
      // Try to get from cache first
      const cached = await this.redisService.getCachedPlaylist(deviceId);

      if (cached) {
        this.logger.debug(`Returning cached playlist for device: ${deviceId}`);
        return cached;
      }

      // TODO: In production, fetch from MongoDB
      // const playlist = await this.fetchFromMongoDB(deviceId);

      // For now, return a default playlist structure
      const defaultPlaylist = {
        id: 'default',
        name: 'Default Playlist',
        items: [],
        totalDuration: 0,
        loopPlaylist: true,
      };

      return defaultPlaylist;
    } catch (error) {
      this.logger.error(`Failed to get playlist for ${deviceId}:`, error);
      return null;
    }
  }

  /**
   * Update playlist for a device
   */
  async updateDevicePlaylist(deviceId: string, playlist: any): Promise<void> {
    try {
      // Cache the playlist
      await this.redisService.cachePlaylist(deviceId, playlist);

      this.logger.log(`Updated playlist for device: ${deviceId}`);
    } catch (error) {
      this.logger.error(`Failed to update playlist for ${deviceId}:`, error);
      throw error;
    }
  }

  /**
   * Get instant publish for a device
   */
  async getInstantPublish(deviceId: string): Promise<any | null> {
    try {
      const key = `instant:${deviceId}`;
      const data = await this.redisService.get(key);

      if (!data) {
        return null;
      }

      const instantPublish = JSON.parse(data);

      // Check if expired
      if (instantPublish.expiresAt && new Date(instantPublish.expiresAt) < new Date()) {
        await this.redisService.delete(key);
        return null;
      }

      return instantPublish;
    } catch (error) {
      this.logger.error(`Failed to get instant publish for ${deviceId}:`, error);
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

      const instantPublish = {
        playlistId,
        deviceId,
        expiresAt: expiresAt?.toISOString(),
        publishedAt: new Date().toISOString(),
      };

      await this.redisService.set(key, JSON.stringify(instantPublish), ttl);

      this.logger.log(`Set instant publish for device: ${deviceId}`);
    } catch (error) {
      this.logger.error(`Failed to set instant publish for ${deviceId}:`, error);
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
    } catch (error) {
      this.logger.error(`Failed to clear instant publish for ${deviceId}:`, error);
      throw error;
    }
  }
}
