import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

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
