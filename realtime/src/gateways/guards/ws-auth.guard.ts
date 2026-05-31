import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { DatabaseService } from '../../database/database.service';
import { isCurrentDeviceToken } from '../device-token-hash';

const DEVICE_TOKEN_REVALIDATION_CACHE_MS = 1000;

/**
 * Defense-in-depth guard for WebSocket message handlers.
 * Verifies that client.data was populated during connection authentication.
 * Connection-time auth is the primary gate; this guard prevents message
 * handling if authentication data is somehow missing.
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient<Socket>();

    if (!client.data?.deviceId && !client.data?.userId) {
      this.logger.warn(`Unauthenticated message attempt from socket ${client.id}`);
      throw new WsException('Not authenticated');
    }

    return true;
  }
}

/**
 * Guard that restricts WebSocket message handlers to device clients only.
 * Dashboard users (who have userId but not deviceId) are rejected.
 * Use on handlers like heartbeat, content:impression, content:error, playlist:request.
 */
@Injectable()
export class WsDeviceGuard implements CanActivate {
  private readonly logger = new Logger(WsDeviceGuard.name);

  constructor(private readonly databaseService: DatabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<Socket>();

    if (!client.data?.deviceId) {
      this.logger.warn(`Non-device message attempt from socket ${client.id}`);
      throw new WsException('Device-only endpoint');
    }

    const validatedAt = client.data.deviceTokenValidatedAt;
    const validatedHash = client.data.deviceTokenValidatedHash;
    if (
      typeof validatedAt === 'number' &&
      validatedHash === client.data.deviceTokenHash &&
      Date.now() - validatedAt <= DEVICE_TOKEN_REVALIDATION_CACHE_MS
    ) {
      return true;
    }

    const display = await this.databaseService.display.findUnique({
      where: { id: client.data.deviceId },
      select: { organizationId: true, isDisabled: true, jwtToken: true },
    });

    if (
      !display ||
      display.organizationId !== client.data.organizationId ||
      display.isDisabled ||
      !isCurrentDeviceToken(display.jwtToken, client.data.deviceTokenHash)
    ) {
      this.logger.warn(`Stale device socket rejected: ${client.data.deviceId} (${client.id})`);
      client.emit('error', { message: 'device_token_stale' });
      client.disconnect(true);
      throw new WsException('Device token stale');
    }

    client.data.deviceTokenValidatedAt = Date.now();
    client.data.deviceTokenValidatedHash = client.data.deviceTokenHash;

    return true;
  }
}
