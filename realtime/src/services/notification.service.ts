import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from './redis.service';
import { DatabaseService } from '../database/database.service';

interface ScheduledOfflineNotification {
  deviceId: string;
  deviceName: string;
  organizationId: string;
  scheduledFor: number; // Unix timestamp in ms
  disconnectedAt: number; // Unix timestamp in ms
}

@Injectable()
export class NotificationService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private readonly OFFLINE_DELAY_MS = 120000; // 2 minutes
  private readonly REDIS_KEY_PREFIX = 'notify:offline:';
  private readonly REDIS_FIRED_KEY_PREFIX = 'notify:fired-offline:';
  private intervalId: NodeJS.Timeout | null = null;
  private isCheckingPendingNotifications = false;

  constructor(
    private readonly redisService: RedisService,
    private readonly databaseService: DatabaseService,
  ) {}

  async onModuleInit() {
    // Start the periodic check for pending notifications
    // We use setInterval instead of @Cron to have more control in tests
    this.intervalId = setInterval(() => {
      this.checkPendingNotifications().catch((err) => {
        this.logger.error('Error checking pending notifications:', err);
      });
    }, 30000); // Check every 30 seconds

    this.logger.log('Notification service initialized');
  }

  onModuleDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.logger.log('Notification service destroyed');
  }

  /**
   * Schedule an offline notification for a device
   * The notification will be created after OFFLINE_DELAY_MS if not cancelled
   */
  async scheduleOfflineNotification(
    deviceId: string,
    deviceName: string,
    organizationId: string,
  ): Promise<void> {
    const now = Date.now();
    const scheduledFor = now + this.OFFLINE_DELAY_MS;

    const data: ScheduledOfflineNotification = {
      deviceId,
      deviceName,
      organizationId,
      scheduledFor,
      disconnectedAt: now,
    };

    const key = `${this.REDIS_KEY_PREFIX}${deviceId}`;
    // Store with 5-minute TTL (longer than the 2-minute delay to handle delays in processing)
    await this.redisService.set(key, JSON.stringify(data), 300);

    this.logger.log(
      `Scheduled offline notification for device ${deviceId} at ${new Date(scheduledFor).toISOString()}`,
    );
  }

  /**
   * Cancel a scheduled offline notification for a device
   * Called when the device reconnects before the notification fires
   */
  async cancelOfflineNotification(deviceId: string): Promise<boolean> {
    const key = `${this.REDIS_KEY_PREFIX}${deviceId}`;
    const firedKey = `${this.REDIS_FIRED_KEY_PREFIX}${deviceId}`;
    const [exists, firedExists] = await Promise.all([
      this.redisService.exists(key),
      this.redisService.exists(firedKey),
    ]);

    if (exists) {
      await this.redisService.delete(key);
      this.logger.log(`Cancelled offline notification for device ${deviceId}`);
    }

    if (firedExists) {
      await this.redisService.delete(firedKey);
      this.logger.log(`Cleared fired offline notification marker for device ${deviceId}`);
    }

    return Boolean(exists || firedExists);
  }

  /**
   * Check if a device was offline for more than 2 minutes
   * Returns true if the device had a pending offline notification
   */
  async wasDeviceOfflineLong(deviceId: string): Promise<boolean> {
    const key = `${this.REDIS_KEY_PREFIX}${deviceId}`;
    const dataStr = await this.redisService.get(key);

    if (!dataStr) {
      return Boolean(await this.redisService.exists(`${this.REDIS_FIRED_KEY_PREFIX}${deviceId}`));
    }

    try {
      const data: ScheduledOfflineNotification = JSON.parse(dataStr);
      const now = Date.now();
      // Check if the scheduled time has passed (device was offline > 2 min)
      return now >= data.scheduledFor;
    } catch {
      return false;
    }
  }

  /**
   * Periodically check for pending offline notifications and create them
   */
  async checkPendingNotifications(): Promise<void> {
    if (this.isCheckingPendingNotifications) {
      this.logger.warn('Skipping overlapping pending notification check');
      return;
    }

    this.isCheckingPendingNotifications = true;
    const now = Date.now();

    // Scan for all pending offline notification keys
    // Note: In production with many devices, consider using Redis SCAN
    const pattern = `${this.REDIS_KEY_PREFIX}*`;

    try {
      // Get all keys matching the pattern
      const keys = await this.scanKeys(pattern);

      for (const key of keys) {
        try {
          const dataStr = await this.redisService.get(key);
          if (!dataStr) continue;

          const data: ScheduledOfflineNotification = JSON.parse(dataStr);

          // Check if it's time to send the notification
          if (now >= data.scheduledFor) {
            // Create the notification in the database
            await this.createOfflineNotification(data);

            await this.redisService.set(
              `${this.REDIS_FIRED_KEY_PREFIX}${data.deviceId}`,
              JSON.stringify({ ...data, firedAt: now }),
              86400,
            );

            // Remove the scheduled notification from Redis
            await this.redisService.delete(key);

            this.logger.log(
              `Created offline notification for device ${data.deviceId}`,
            );
          }
        } catch (error) {
          const err = error as {
            code?: string;
            meta?: { field_name?: string; constraint?: string; modelName?: string };
          };
          const fieldName = err?.meta?.field_name ?? '';
          const constraint = err?.meta?.constraint ?? '';
          const isOrgFkViolation =
            err?.code === 'P2003' &&
            (fieldName.toLowerCase().includes('organization') ||
              constraint.toLowerCase().includes('organization'));

          if (isOrgFkViolation) {
            try {
              await this.redisService.delete(key);
              this.logger.warn(
                `Dropped orphaned notification key ${key} (P2003 on ${fieldName || constraint || 'organizationId'}; referenced org deleted)`,
              );
            } catch (deleteError) {
              this.logger.error(
                `Failed to delete orphan notification key ${key} after organization P2003:`,
                deleteError,
              );
            }
          } else {
            this.logger.error(
              `Error processing notification key ${key} (code=${err?.code ?? 'none'}, field=${fieldName || 'none'}):`,
              error,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error('Error scanning for pending notifications:', error);
    } finally {
      this.isCheckingPendingNotifications = false;
    }
  }

  /**
   * Create an offline notification in the database
   */
  private async createOfflineNotification(
    data: ScheduledOfflineNotification,
  ): Promise<void> {
    await this.databaseService.notification.create({
      data: {
        title: 'Device Offline',
        message: `Device "${data.deviceName}" has gone offline.`,
        type: 'device_offline',
        severity: 'warning',
        metadata: {
          deviceId: data.deviceId,
          deviceName: data.deviceName,
          disconnectedAt: new Date(data.disconnectedAt).toISOString(),
        },
        organizationId: data.organizationId,
      },
    });
  }

  /**
   * Create an online notification when a device reconnects after being offline > 2 min
   */
  async createOnlineNotification(
    deviceId: string,
    deviceName: string,
    organizationId: string,
  ): Promise<void> {
    await this.databaseService.notification.create({
      data: {
        title: 'Device Online',
        message: `Device "${deviceName}" is back online.`,
        type: 'device_online',
        severity: 'info',
        metadata: {
          deviceId,
          deviceName,
        },
        organizationId,
      },
    });

    this.logger.log(`Created online notification for device ${deviceId}`);
  }

  /**
   * Helper to scan Redis keys matching a pattern
   */
  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';
    try {
      do {
        const result = await this.redisService.getRedis().scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = result[0];
        keys.push(...result[1]);
      } while (cursor !== '0');
    } catch (error) {
      this.logger.warn(`Failed to scan Redis keys: ${(error as Error).message}`);
    }
    return keys;
  }

  /**
   * Get a notification for real-time emission
   */
  async getNotificationForEmit(notificationId: string) {
    return this.databaseService.notification.findUnique({
      where: { id: notificationId },
    });
  }
}
