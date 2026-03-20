import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { RedisService } from '../redis/redis.service';
import { CircuitBreakerService } from '../common/services/circuit-breaker.service';
import { SendCommandDto } from './dto/send-command.dto';

// Custom exception since NestJS doesn't export TooManyRequestsException
import { HttpException, HttpStatus } from '@nestjs/common';

export class TooManyRequestsException extends HttpException {
  constructor(message = 'Too many requests') {
    super(message, HttpStatus.TOO_MANY_REQUESTS);
  }
}

interface ResolvedTarget {
  deviceIds: string[];
  targetName: string;
}

interface GatewayBroadcastResult {
  devicesOnline: number;
}

@Injectable()
export class FleetService {
  private readonly logger = new Logger(FleetService.name);
  private readonly realtimeUrl =
    process.env.REALTIME_URL || 'http://localhost:3002';

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
    private readonly httpService: HttpService,
    private readonly circuitBreaker: CircuitBreakerService,
  ) {}

  async sendCommand(
    orgId: string,
    userId: string,
    userRole: string,
    dto: SendCommandDto,
  ) {
    // Check rate limit
    await this.checkRateLimit(orgId);

    // Resolve target to device IDs
    const { deviceIds, targetName } = await this.resolveTargetDevices(
      orgId,
      dto.target,
    );

    const commandId = crypto.randomUUID();

    // Call gateway broadcast
    const { devicesOnline } = await this.callGatewayBroadcast(deviceIds, {
      commandId,
      command: dto.command,
      payload: dto.payload || {},
    });

    const devicesQueued = deviceIds.length - devicesOnline;

    // Handle emergency override with push_content
    const duration = dto.payload?.duration ?? 60;
    if (
      dto.command === 'push_content' &&
      dto.payload?.priority === 'emergency'
    ) {
      await this.createOverride(
        orgId,
        commandId,
        dto.payload.contentId || 'unknown',
        'Emergency content',
        dto.target.type,
        dto.target.id,
        targetName,
        duration,
        userId,
        deviceIds,
      );
    }

    // Create audit log entry
    await this.createAuditEntry(orgId, userId, commandId, dto, deviceIds.length);

    return {
      commandId,
      command: dto.command,
      target: { type: dto.target.type, id: dto.target.id, name: targetName },
      devicesTargeted: deviceIds.length,
      devicesOnline,
      devicesQueued,
    };
  }

  async resolveTargetDevices(
    orgId: string,
    target: { type: string; id: string },
  ): Promise<ResolvedTarget> {
    switch (target.type) {
      case 'device': {
        const device = await this.db.display.findFirst({
          where: { id: target.id, organizationId: orgId },
        });
        if (!device) {
          throw new NotFoundException(
            `Device ${target.id} not found in organization`,
          );
        }
        return { deviceIds: [device.id], targetName: device.nickname || device.id };
      }
      case 'group': {
        const group = await this.db.displayGroup.findFirst({
          where: { id: target.id, organizationId: orgId },
        });
        if (!group) {
          throw new NotFoundException(
            `Group ${target.id} not found in organization`,
          );
        }
        const members = await this.db.displayGroupMember.findMany({
          where: { displayGroupId: target.id },
          select: { displayId: true },
        });
        return {
          deviceIds: members.map((m: { displayId: string }) => m.displayId),
          targetName: group.name,
        };
      }
      case 'organization': {
        const displays = await this.db.display.findMany({
          where: { organizationId: orgId },
          select: { id: true },
        });
        return {
          deviceIds: displays.map((d: { id: string }) => d.id),
          targetName: 'All Devices',
        };
      }
      default:
        throw new NotFoundException(`Unknown target type: ${target.type}`);
    }
  }

  async callGatewayBroadcast(
    deviceIds: string[],
    command: { commandId: string; command: string; payload: Record<string, any> },
  ): Promise<GatewayBroadcastResult> {
    const url = `${this.realtimeUrl}/api/commands/broadcast`;
    const headers: Record<string, string> = {};
    if (process.env.INTERNAL_API_SECRET) {
      headers['x-internal-api-key'] = process.env.INTERNAL_API_SECRET;
    }

    const result = await this.circuitBreaker.executeWithFallback(
      'fleet-gateway',
      async () => {
        const response = await firstValueFrom(
          this.httpService.post(
            url,
            { deviceIds, ...command },
            { headers },
          ),
        );
        return response.data;
      },
      () => ({ devicesOnline: 0 }),
    );

    return { devicesOnline: result?.devicesOnline ?? 0 };
  }

  async createOverride(
    orgId: string,
    commandId: string,
    contentId: string,
    contentTitle: string,
    targetType: string,
    targetId: string,
    targetName: string,
    duration: number,
    userId: string,
    deviceIds: string[],
  ): Promise<void> {
    const ttl = duration * 60;
    const overrideData = JSON.stringify({
      commandId,
      contentId,
      contentTitle,
      targetType,
      targetId,
      targetName,
      duration,
      userId,
      deviceIds,
      createdAt: new Date().toISOString(),
    });

    const client = this.redis.getClient();
    if (!client) {
      this.logger.warn('Redis not available, skipping override tracking');
      return;
    }

    // Add commandId to org's override index set
    await client.sadd(`overrides:index:${orgId}`, commandId);
    await client.expire(`overrides:index:${orgId}`, 86400); // 24h sliding window

    // Store override details with TTL
    await this.redis.set(`override:${orgId}:${commandId}`, overrideData, ttl);

    // Set per-device override keys
    for (const deviceId of deviceIds) {
      await this.redis.set(`device:override:${deviceId}`, commandId, ttl);
    }
  }

  async getActiveOverrides(orgId: string): Promise<any[]> {
    const client = this.redis.getClient();
    if (!client) return [];

    // Fast path: check set cardinality
    const count = await client.scard(`overrides:index:${orgId}`);
    if (count === 0) return [];

    // Get all command IDs in the index
    const commandIds = await client.smembers(`overrides:index:${orgId}`);

    const overrides: any[] = [];
    const expiredIds: string[] = [];

    for (const id of commandIds) {
      const data = await this.redis.get(`override:${orgId}:${id}`);
      if (data) {
        overrides.push(JSON.parse(data));
      } else {
        expiredIds.push(id);
      }
    }

    // Clean up expired entries from the index
    if (expiredIds.length > 0) {
      for (const id of expiredIds) {
        await client.srem(`overrides:index:${orgId}`, id);
      }
    }

    return overrides;
  }

  async clearOverride(
    orgId: string,
    commandId: string,
  ): Promise<{ commandId: string; devicesNotified: number }> {
    const data = await this.redis.get(`override:${orgId}:${commandId}`);
    if (!data) {
      throw new NotFoundException(`Override ${commandId} not found`);
    }

    const override = JSON.parse(data);
    const deviceIds: string[] = override.deviceIds || [];

    // Delete override data
    await this.redis.del(`override:${orgId}:${commandId}`);

    // Remove from index set
    const client = this.redis.getClient();
    if (client) {
      await client.srem(`overrides:index:${orgId}`, commandId);
    }

    // Delete per-device override keys
    for (const deviceId of deviceIds) {
      await this.redis.del(`device:override:${deviceId}`);
    }

    // Notify devices to clear override
    await this.callGatewayBroadcast(deviceIds, {
      commandId,
      command: 'CLEAR_OVERRIDE',
      payload: {},
    });

    return { commandId, devicesNotified: deviceIds.length };
  }

  async checkRateLimit(orgId: string): Promise<void> {
    const key = `fleet:ratelimit:${orgId}`;
    const count = await this.redis.incr(key);
    await this.redis.expire(key, 60);

    if (count > 10) {
      throw new TooManyRequestsException(
        'Fleet command rate limit exceeded. Max 10 commands per minute.',
      );
    }
  }

  private async createAuditEntry(
    orgId: string,
    userId: string,
    commandId: string,
    dto: SendCommandDto,
    deviceCount: number,
  ): Promise<void> {
    try {
      await this.db.auditLog.create({
        data: {
          organizationId: orgId,
          userId,
          action: 'fleet_command',
          entityType: 'fleet',
          entityId: commandId,
          changes: {
            command: dto.command,
            target: dto.target,
            payload: dto.payload || {},
            deviceCount,
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error}`);
    }
  }
}
