import { Redis } from 'ioredis';
import { Display, Controller } from '../types';
import { REDIS_KEYS, EXPIRATION, getRedisClient } from '../config/redis';

export class RedisStateManager {
  private redis: Redis;

  constructor() {
    this.redis = getRedisClient();
  }

  // Display Management
  async saveDisplay(display: Display): Promise<void> {
    const displayData = {
      id: display.id,
      socketId: display.socket.id,
      pairingCode: display.pairingCode,
      status: display.status,
      lastSeen: display.lastSeen.toISOString()
    };

    await this.redis
      .multi()
      .hset(
        `${REDIS_KEYS.displays}:${display.id}`,
        displayData
      )
      .set(
        `${REDIS_KEYS.pairingCodes}:${display.pairingCode}`,
        display.id,
        'EX',
        EXPIRATION.pairingCode
      )
      .expire(`${REDIS_KEYS.displays}:${display.id}`, EXPIRATION.display)
      .exec();
  }

  async getDisplay(displayId: string): Promise<Partial<Display> | null> {
    const displayData = await this.redis.hgetall(`${REDIS_KEYS.displays}:${displayId}`);
    if (!displayData || Object.keys(displayData).length === 0) return null;

    return {
      ...displayData,
      lastSeen: new Date(displayData.lastSeen)
    };
  }

  async getDisplayByPairingCode(pairingCode: string): Promise<string | null> {
    return await this.redis.get(`${REDIS_KEYS.pairingCodes}:${pairingCode}`);
  }

  async removeDisplay(displayId: string, pairingCode: string): Promise<void> {
    await this.redis
      .multi()
      .del(`${REDIS_KEYS.displays}:${displayId}`)
      .del(`${REDIS_KEYS.pairingCodes}:${pairingCode}`)
      .exec();
  }

  // Controller Management
  async saveController(controller: Controller): Promise<void> {
    const controllerData = {
      id: controller.id,
      socketId: controller.socket.id,
      connectedDisplays: Array.from(controller.connectedDisplays)
    };

    await this.redis
      .multi()
      .hset(
        `${REDIS_KEYS.controllers}:${controller.id}`,
        controllerData
      )
      .expire(`${REDIS_KEYS.controllers}:${controller.id}`, EXPIRATION.controller)
      .exec();
  }

  async getController(controllerId: string): Promise<Partial<Controller> | null> {
    const controllerData = await this.redis.hgetall(`${REDIS_KEYS.controllers}:${controllerId}`);
    if (!controllerData || Object.keys(controllerData).length === 0) return null;

    return {
      ...controllerData,
      connectedDisplays: new Set(JSON.parse(controllerData.connectedDisplays))
    };
  }

  async removeController(controllerId: string): Promise<void> {
    await this.redis.del(`${REDIS_KEYS.controllers}:${controllerId}`);
  }

  // Display-Controller Relationship
  async linkDisplayToController(displayId: string, controllerId: string): Promise<void> {
    await this.redis
      .multi()
      .sadd(`${REDIS_KEYS.displayControllers}:${displayId}`, controllerId)
      .expire(`${REDIS_KEYS.displayControllers}:${displayId}`, EXPIRATION.controller)
      .exec();
  }

  async getDisplayControllers(displayId: string): Promise<string[]> {
    return await this.redis.smembers(`${REDIS_KEYS.displayControllers}:${displayId}`);
  }

  async unlinkDisplayFromController(displayId: string, controllerId: string): Promise<void> {
    await this.redis.srem(`${REDIS_KEYS.displayControllers}:${displayId}`, controllerId);
  }

  // Cleanup
  async cleanupStaleDisplays(): Promise<void> {
    const now = new Date();
    const displays = await this.redis.keys(`${REDIS_KEYS.displays}:*`);

    for (const displayKey of displays) {
      const display = await this.getDisplay(displayKey.split(':')[2]);
      if (display && new Date(display.lastSeen).getTime() + EXPIRATION.display * 1000 < now.getTime()) {
        await this.removeDisplay(display.id, display.pairingCode);
      }
    }
  }
} 