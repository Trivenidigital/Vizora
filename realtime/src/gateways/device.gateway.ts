import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../services/redis.service';
import { HeartbeatService } from '../services/heartbeat.service';
import { PlaylistService } from '../services/playlist.service';
import { NotificationService } from '../services/notification.service';
import { MetricsService } from '../metrics/metrics.service';
import { DatabaseService } from '../database/database.service';
import { StorageService } from '../storage/storage.service';
import { WsValidationPipe } from './pipes/ws-validation.pipe';
import {
  HeartbeatMessageDto,
  ContentImpressionDto,
  ContentErrorDto,
  PlaylistRequestDto,
  ScreenshotResponseDto,
  JoinOrganizationDto,
  JoinRoomDto,
  LeaveRoomDto,
  createSuccessResponse,
  createErrorResponse,
} from './dto';
import {
  Playlist,
  PlaylistContentItem,
  DeviceCommand,
  BroadcastData,
} from '../types';
import * as Sentry from '@sentry/nestjs';
import { createHash } from 'node:crypto';
import { WsAllExceptionsFilter } from './filters/ws-exception.filter';
import { WsAuthGuard, WsDeviceGuard } from './guards/ws-auth.guard';
import { redactSensitiveTokens } from '../utils/redact-sensitive-url';
import {
  hashDeviceToken,
  isCurrentDeviceToken,
  deviceTokenGraceKey,
  DEVICE_TOKEN_GRACE_MIN_TTL_SECONDS,
  DEVICE_TOKEN_GRACE_MAX_TTL_SECONDS,
  DeviceTokenGrace,
} from './device-token-hash';
import {
  authenticateDeviceHandshake,
  DeviceHandshakePayload,
} from './device-handshake-auth';
import {
  redactDeviceContentMetadata,
  redactDevicePayload,
  redactDevicePlaylist,
} from '../services/device-content-payload';

interface DevicePayload {
  sub: string; // device ID
  deviceIdentifier: string;
  organizationId: string;
  type: 'device';
  jti?: string;
  exp?: number; // JWT expiry (epoch seconds) — drives the 90d refresh (PR-8)
}

interface UserPayload {
  sub: string; // user ID
  email: string;
  organizationId: string;
  type?: string;
  jti?: string;
  iat?: number; // issued-at (epoch seconds), set by jsonwebtoken — used for password-change session invalidation
}

type AuthPayload =
  | { kind: 'device'; payload: DevicePayload }
  | { kind: 'user'; payload: UserPayload };

interface DeliveryAck {
  ok?: boolean;
  error?: string;
}

interface DeliveryResult {
  delivered: boolean;
  reason?: string;
  legacy?: boolean;
}

type PendingPlaylistDeliveryStatus = 'none' | 'delivered' | 'requeued' | 'deferred' | 'skipped';

type PendingCommandDeliveryResult = {
  delivered: number;
  requeued: number;
  skipped: boolean;
  shouldBackoff: boolean;
};

const HEARTBEAT_REPLAY_BASE_DELAY_MS = 15000;
const HEARTBEAT_REPLAY_MAX_DELAY_MS = 300000;
const HEARTBEAT_REPLAY_MAX_FAILURES = 5;
const HEARTBEAT_DB_REFRESH_INTERVAL_MS = 60_000;

// PR-8 — server-side device-JWT 90d refresh. Device tokens are signed 90d and
// nothing previously re-issued them, so every device hard-expired 90 days after
// pairing and could never re-auth (latent fleet-wide outage). When a device
// connects/heartbeats within DEVICE_TOKEN_REFRESH_WITHIN_DAYS of expiry we mint
// a fresh 90d token with the same claims and push it over `token:refresh`.
const DEVICE_TOKEN_REFRESH_WITHIN_DAYS = 14;
const DEVICE_TOKEN_REFRESH_WITHIN_MS =
  DEVICE_TOKEN_REFRESH_WITHIN_DAYS * 24 * 60 * 60 * 1000;
const DEVICE_TOKEN_TTL = '90d';
// Cooldown so rapid reconnects near expiry mint at most one new token per device
// (prevents multiple in-flight tokens racing the single stored hash). Far larger
// than the grace window; a successful refresh pushes exp 90d out so no re-mint
// happens on the next connection regardless.
const DEVICE_TOKEN_REFRESH_COOLDOWN_SECONDS = 60 * 60; // 1 hour

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) || ['http://localhost:3001'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 2 * 1024 * 1024,
})
@UseFilters(new WsAllExceptionsFilter())
@UseGuards(WsAuthGuard)
export class DeviceGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  /**
   * Contract v1.1 item 2: register the device-handshake middleware. Running auth
   * as a Socket.IO connection middleware (rather than only post-connection in
   * handleConnection) is what lets a rejection surface on the client as a
   * structured `connect_error.data.code`. On success the verified payload is
   * stashed on socket.data so authenticateConnection does not re-verify.
   */
  afterInit(server: Server): void {
    server.use((socket, next) => {
      void this.runDeviceHandshake(socket, next);
    });
  }

  private async runDeviceHandshake(
    socket: Socket,
    next: (err?: Error) => void,
  ): Promise<void> {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      const result = await authenticateDeviceHandshake(token, {
        jwtService: this.jwtService,
        databaseService: this.databaseService,
        deviceSecret: process.env.DEVICE_JWT_SECRET,
        userSecret: process.env.JWT_SECRET,
        // PR-8: lets the handshake accept a device that reconnected on its old
        // token during an in-flight 90d refresh rotation (grace record).
        redis: this.redisService,
      });

      if (result.action === 'reject') {
        // err.message carries the legacy string (Electron client reads
        // connect_error.message); err.data.code carries the contract code
        // (the Android TV app reads connect_error.data.code).
        const err = new Error(result.message);
        (err as Error & { data?: { code: string } }).data = { code: result.code };
        next(err);
        return;
      }

      if (result.action === 'accept') {
        socket.data = socket.data || {};
        socket.data.deviceAuthPayload = result.payload;
        socket.data.deviceAuthTokenHash = result.tokenHash;
      }
      // 'pass' and 'accept' both continue; handleConnection finishes setup.
      next();
    } catch (err) {
      // Never convert an unexpected middleware error into a terminal code —
      // let the connection proceed so handleConnection classifies it (or
      // rejects with a plain string, which the device treats as transient).
      this.logger.warn(
        `Device handshake middleware error: ${err instanceof Error ? err.message : String(err)}`,
      );
      next();
    }
  }

  private readonly logger = new Logger(DeviceGateway.name);

  // 2.1: In-memory device status cache to avoid redundant DB writes
  private readonly deviceStatusCache: Map<string, string> = new Map();
  private readonly lastHeartbeatDbWrites: Map<string, number> = new Map();

  // 2.4: Connection rate limiting per IP
  private readonly connectionAttempts: Map<string, { count: number; resetAt: number }> = new Map();

  // 2.5: Device socket deduplication (deviceId -> socketId)
  private readonly deviceSockets: Map<string, string> = new Map();

  // Dashboard (user) sockets: userId -> set of socketIds. Lets the periodic
  // session-invalidation sweep target ONLY dashboard sockets (not the device
  // fleet) and disconnect a specific user's live sockets mid-session — closing
  // the connect-time-only residual from PR #112.
  private readonly dashboardSockets: Map<string, Set<string>> = new Map();

  // Reentrancy guard so a slow sweep (Redis latency) can't overlap itself.
  private sweepRunning = false;

  // Per-message rate limiting: socketId -> { count, resetAt }
  private readonly messageRates: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly heartbeatReplayState: Map<string, { failures: number; lastAttemptAt: number }> = new Map();
  private readonly pendingPlaylistReplayVersions: Map<string, number> = new Map();

  // Interval handles for cleanup (stored for proper teardown)
  private cleanupIntervals: ReturnType<typeof setInterval>[] = [];

  private getAckError(ack?: DeliveryAck): string | null {
    return ack?.ok === false ? ack.error || 'negative_ack' : null;
  }

  private supportsDeliveryAck(client: { data?: Record<string, any>; handshake?: { auth?: any } }): boolean {
    if (client.data?.deliveryAckCapable === true) {
      return true;
    }

    const capabilities = client.data?.capabilities ?? client.handshake?.auth?.capabilities;
    if (Array.isArray(capabilities)) {
      return capabilities.includes('deliveryAck');
    }

    return capabilities?.deliveryAck === true;
  }

  private async emitWithDeliveryAck(
    socket: { id?: string; data?: Record<string, any>; emit: Function },
    event: 'playlist:update' | 'command',
    payload: unknown,
  ): Promise<DeliveryResult> {
    if (!this.supportsDeliveryAck(socket)) {
      socket.emit(event, payload);
      return { delivered: true, legacy: true };
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('ack_timeout')), 10000);
        socket.emit(event, payload, (ack?: DeliveryAck) => {
          clearTimeout(timeout);
          const ackError = this.getAckError(ack);
          if (ackError) {
            reject(new Error(ackError));
            return;
          }
          resolve();
        });
      });
      return { delivered: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ack_timeout';
      return {
        delivered: false,
        reason: message === 'ack_timeout' ? 'ack_timeout' : 'negative_ack',
      };
    }
  }

  private isActiveDeviceSocket(client: { id?: string }, deviceId: string): boolean {
    return this.deviceSockets.get(deviceId) === client.id;
  }

  private isDeliveryDeviceSocket(client: { id?: string; data?: Record<string, any> }, deviceId: string): boolean {
    return (
      client.data?.deviceId === deviceId &&
      client.data?.isDashboard !== true &&
      this.isActiveDeviceSocket(client, deviceId)
    );
  }

  private async isCurrentDeliveryDeviceSocket(
    client: { id?: string; data?: Record<string, any>; emit?: (...args: any[]) => void; disconnect?: (close?: boolean) => void },
    deviceId: string,
  ): Promise<boolean> {
    if (!this.isDeliveryDeviceSocket(client, deviceId)) {
      return false;
    }

    const display = await this.databaseService.display.findUnique({
      where: { id: deviceId },
      select: { organizationId: true, isDisabled: true, jwtToken: true },
    });

    if (
      display &&
      display.organizationId === client.data?.organizationId &&
      !display.isDisabled &&
      isCurrentDeviceToken(display.jwtToken, client.data?.deviceTokenHash)
    ) {
      return true;
    }

    this.logger.warn(`Skipping delivery to stale device socket ${client.id} for device ${deviceId}`);
    client.emit?.('error', { message: 'device_token_stale' });
    client.disconnect?.(true);
    if (this.isActiveDeviceSocket(client, deviceId)) {
      this.deviceSockets.delete(deviceId);
      this.lastHeartbeatDbWrites.delete(deviceId);
    }
    return false;
  }

  private async filterCurrentDeliverySockets<T extends {
    id?: string;
    data?: Record<string, any>;
    emit?: (...args: any[]) => void;
    disconnect?: (close?: boolean) => void;
  }>(
    sockets: T[],
    deviceId: string,
  ): Promise<T[]> {
    const currentSockets: T[] = [];
    for (const socket of sockets) {
      if (await this.isCurrentDeliveryDeviceSocket(socket, deviceId)) {
        currentSockets.push(socket);
      }
    }
    return currentSockets;
  }

  private isDashboardSocket(client: { data?: Record<string, any> }): boolean {
    return client.data?.isDashboard === true || Boolean(client.data?.userId);
  }

  private async emitToOrganization(
    organizationId: string,
    event: string,
    data: Record<string, any>,
  ): Promise<number> {
    const allSockets = await this.server.in(`org:${organizationId}`).fetchSockets();
    let emitted = 0;
    const targetedNotificationUserId = event === 'notification:new' &&
      typeof data.userId === 'string' &&
      data.userId.trim() !== ''
      ? data.userId
      : null;

    for (const socket of allSockets as Array<{
      id?: string;
      data?: Record<string, any>;
      emit?: (...args: any[]) => void;
      disconnect?: (close?: boolean) => void;
    }>) {
      if (socket.data?.organizationId !== organizationId) {
        continue;
      }

      if (this.isDashboardSocket(socket)) {
        if (
          targetedNotificationUserId &&
          socket.data?.userId !== targetedNotificationUserId
        ) {
          continue;
        }
        socket.emit?.(event, data);
        emitted += 1;
        continue;
      }

      if (targetedNotificationUserId) {
        continue;
      }

      const socketDeviceId = socket.data?.deviceId;
      if (
        typeof socketDeviceId === 'string' &&
        await this.isCurrentDeliveryDeviceSocket(socket, socketDeviceId)
      ) {
        socket.emit?.(event, data);
        emitted += 1;
      }
    }

    return emitted;
  }

  hasActiveDeviceSocket(deviceId: string): boolean {
    const socketId = this.deviceSockets.get(deviceId);
    return Boolean(socketId && this.server?.sockets?.sockets?.has(socketId));
  }

  disconnectDevice(deviceId: string, reason = 'device_disconnected'): boolean {
    const socketId = this.deviceSockets.get(deviceId);
    if (!socketId) {
      return false;
    }

    const socket = this.server?.sockets?.sockets?.get(socketId);
    if (!socket) {
      this.deviceSockets.delete(deviceId);
      this.lastHeartbeatDbWrites.delete(deviceId);
      return false;
    }

    socket.data = {
      ...(socket.data || {}),
      suppressOfflineNotification: reason === 'device_disabled',
    };
    socket.emit('error', { message: reason });
    socket.disconnect(true);
    return true;
  }

  /**
   * Device Revocation Contract v1.1 item 3: notify a device it has been revoked.
   * Emits `device:revoked {reason}` to the device room as the fast-path trigger —
   * the device then confirms via GET /devices/auth/check (410) before purging, so
   * this event never destroys credentials on its own and a lost event is recovered
   * on the next reconnect+probe. We still force-disconnect a revoked device.
   * Broadcasts to the room (not a single socket) so all of the device's live
   * connections are covered.
   */
  revokeDevice(deviceId: string, reason = 'revoked'): boolean {
    if (!this.server) return false;
    this.server.to(`device:${deviceId}`).emit('device:revoked', { reason });
    return this.disconnectDevice(deviceId, 'device_disabled');
  }

  /**
   * Contract v1.1 item 3: entitlement suspend/resume for a whole tenant. Emits
   * `tenant:suspended` / `tenant:resumed` to the org room. Reversible — the device
   * holds on suspend (branded holding, credentials kept) and resumes on resume;
   * no disconnect, no credential change.
   */
  emitTenantEntitlement(
    organizationId: string,
    suspended: boolean,
    reason?: string,
  ): boolean {
    if (!this.server) return false;
    const event = suspended ? 'tenant:suspended' : 'tenant:resumed';
    this.server.to(`org:${organizationId}`).emit(event, { reason });
    return true;
  }

  private shouldAttemptHeartbeatReplay(deviceId: string): boolean {
    const state = this.heartbeatReplayState.get(deviceId);
    if (!state) {
      this.heartbeatReplayState.set(deviceId, { failures: 0, lastAttemptAt: Date.now() });
      return true;
    }

    if (state.failures >= HEARTBEAT_REPLAY_MAX_FAILURES) {
      return false;
    }

    const delayMs = Math.min(
      HEARTBEAT_REPLAY_BASE_DELAY_MS * 2 ** state.failures,
      HEARTBEAT_REPLAY_MAX_DELAY_MS,
    );
    if (Date.now() - state.lastAttemptAt < delayMs) {
      return false;
    }

    state.lastAttemptAt = Date.now();
    return true;
  }

  private recordHeartbeatReplayResult(deviceId: string, hadRequeue: boolean): void {
    if (!hadRequeue) {
      this.heartbeatReplayState.delete(deviceId);
      return;
    }

    const state = this.heartbeatReplayState.get(deviceId) ?? { failures: 0, lastAttemptAt: Date.now() };
    this.heartbeatReplayState.set(deviceId, {
      failures: state.failures + 1,
      lastAttemptAt: Date.now(),
    });
  }

  private resetHeartbeatReplayBackoff(deviceId: string): void {
    this.heartbeatReplayState.delete(deviceId);
  }

  private async clearPendingPlaylist(deviceId: string): Promise<void> {
    this.pendingPlaylistReplayVersions.set(
      deviceId,
      (this.pendingPlaylistReplayVersions.get(deviceId) ?? 0) + 1,
    );

    try {
      await this.redisService.deletePendingPlaylist(deviceId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to clear pending playlist for device ${deviceId}: ${message}`);
    }
  }

  private isPendingPlaylistReplayCurrent(deviceId: string, replayVersion: number): boolean {
    return (this.pendingPlaylistReplayVersions.get(deviceId) ?? 0) === replayVersion;
  }

  private async requeuePendingPlaylistIfCurrent(
    deviceId: string,
    playlist: Playlist,
    replayVersion: number,
    status: PendingPlaylistDeliveryStatus = 'requeued',
  ): Promise<PendingPlaylistDeliveryStatus> {
    if (!this.isPendingPlaylistReplayCurrent(deviceId, replayVersion)) {
      return 'skipped';
    }

    await this.redisService.setPendingPlaylist(deviceId, redactDevicePlaylist(playlist));
    return status;
  }

  private async requeuePendingCommands(deviceId: string, commands: DeviceCommand[]): Promise<number> {
    for (const command of commands) {
      await this.redisService.addDeviceCommand(deviceId, command);
    }
    return commands.length;
  }

  constructor(
    private jwtService: JwtService,
    private redisService: RedisService,
    private heartbeatService: HeartbeatService,
    private playlistService: PlaylistService,
    private notificationService: NotificationService,
    private metricsService: MetricsService,
    private databaseService: DatabaseService,
    private storageService: StorageService,
  ) {
    if (!process.env.API_BASE_URL && process.env.NODE_ENV === 'production') {
      this.logger.warn(
        'API_BASE_URL is not set — device content URLs will default to http://localhost:3000. Set API_BASE_URL for production.',
      );
    }

    // Periodically clean up expired rate limit entries (every 60s)
    this.cleanupIntervals.push(setInterval(() => this.cleanupRateLimitEntries(), 60000));
    // Periodically clean up expired message rate limit entries (every 60s)
    this.cleanupIntervals.push(setInterval(() => this.cleanupMessageRateLimits(), 60000));
    // Periodically clean up stale deviceStatusCache entries (every 5 min)
    this.cleanupIntervals.push(setInterval(() => this.cleanupStaleEntries(), 5 * 60 * 1000));
    // Periodically tear down dashboard sockets whose session was invalidated
    // mid-connection (password change / deactivation) — see sweepInvalidatedSessions.
    this.cleanupIntervals.push(setInterval(() => this.sweepInvalidatedSessions(), 60000));
    // Periodically reconcile the devices_online metric from the authoritative
    // presence map (deviceSockets). The inc/dec in MetricsService drifts after a
    // missed disconnect; this snapshot re-syncs it. Realtime runs single-instance
    // (PM2 instances:1) so a plain setInterval is safe — no leader election.
    this.cleanupIntervals.push(setInterval(() => this.reconcileDeviceMetrics(), 60000));
  }

  /**
   * Reconcile the devices_online gauge from the in-memory presence map.
   * deviceSockets (deviceId -> active socketId) is the authoritative set of
   * currently-connected devices; each socket carries its organizationId on
   * socket.data. Tally per org and hand the snapshot to MetricsService, which
   * reset()s and set()s the gauge. Sockets missing from the server (already
   * gone) are skipped so a stale map entry never inflates the count.
   */
  private reconcileDeviceMetrics(): void {
    const countsByOrg = new Map<string, number>();
    for (const socketId of this.deviceSockets.values()) {
      const socket = this.server?.sockets?.sockets?.get(socketId);
      const orgId = socket?.data?.organizationId;
      if (typeof orgId === 'string' && orgId) {
        countsByOrg.set(orgId, (countsByOrg.get(orgId) ?? 0) + 1);
      }
    }
    this.metricsService.reconcileDevicesOnline(countsByOrg);
  }

  async onModuleDestroy() {
    // Stop all periodic cleanup intervals
    for (const interval of this.cleanupIntervals) {
      clearInterval(interval);
    }
    this.cleanupIntervals = [];

    // Notify all connected clients to reconnect to another instance
    if (this.server) {
      this.logger.log('Graceful shutdown: notifying clients to reconnect...');
      this.server.emit('server:shutdown', { reconnect: true });

      // Give clients 2 seconds to process the shutdown notice
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Disconnect all sockets
      const sockets = await this.server.fetchSockets();
      for (const socket of sockets) {
        socket.disconnect(true);
      }
      this.logger.log(`Graceful shutdown: disconnected ${sockets.length} client(s)`);
    }
  }

  /**
   * Resolve minio:// URLs to API-served URLs that devices can access.
   */
  private resolveContentUrl(item: any): string {
    const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    if (item.content?.url?.startsWith('minio://')) {
      return `${apiBaseUrl}/api/v1/device-content/${item.content.id}/file`;
    }
    return item.content?.url || '';
  }

  /**
   * Check per-message rate limit for a socket.
   * Returns true if the message is allowed, false if rate-limited.
   * Limit: 60 messages per minute per socket.
   */
  private checkMessageRateLimit(client: Socket): boolean {
    const now = Date.now();
    const entry = this.messageRates.get(client.id);

    if (entry) {
      if (now > entry.resetAt) {
        this.messageRates.set(client.id, { count: 1, resetAt: now + 60000 });
      } else {
        entry.count++;
        if (entry.count > 60) {
          this.logger.warn(`Message rate limit exceeded for socket ${client.id} (device: ${client.data?.deviceId})`);
          client.emit('error', { message: 'rate_limited', detail: 'Too many messages. Please slow down.' });
          client.disconnect();
          return false;
        }
      }
    } else {
      this.messageRates.set(client.id, { count: 1, resetAt: now + 60000 });
    }

    return true;
  }

  /**
   * Clean up expired message rate limit entries
   */
  private cleanupMessageRateLimits(): void {
    const now = Date.now();
    for (const [socketId, entry] of this.messageRates) {
      if (now > entry.resetAt) {
        this.messageRates.delete(socketId);
      }
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  private cleanupRateLimitEntries(): void {
    const now = Date.now();
    for (const [ip, entry] of this.connectionAttempts) {
      if (now > entry.resetAt) {
        this.connectionAttempts.delete(ip);
      }
    }
  }

  /**
   * Clean up stale deviceStatusCache entries that no longer have active sockets.
   */
  private cleanupStaleEntries(): void {
    const activeDeviceIds = new Set<string>();
    for (const [deviceId, socketId] of this.deviceSockets) {
      if (this.server?.sockets?.sockets?.has(socketId)) {
        activeDeviceIds.add(deviceId);
      } else {
        this.deviceSockets.delete(deviceId);
      }
    }

    let cleaned = 0;
    for (const deviceId of this.deviceStatusCache.keys()) {
      if (!activeDeviceIds.has(deviceId)) {
        this.deviceStatusCache.delete(deviceId);
        this.lastHeartbeatDbWrites.delete(deviceId);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} stale deviceStatusCache entries`);
    }
  }

  /**
   * Periodically tear down dashboard sockets whose session was invalidated AFTER
   * they connected. PR #112 added these checks at connect-time only; a socket
   * established before a password change / account deactivation otherwise keeps
   * streaming until it reconnects. This re-applies the handshake checks to the
   * in-memory `dashboardSockets` map (dashboard sockets only — never devices).
   *
   * Per distinct user: one `exists(user_revoked:)` + one `get(pwd_changed:)`.
   * - user_revoked → disconnect ALL that user's sockets (no iat needed).
   * - pwd_changed  → per-socket: disconnect only sockets whose token iat predates
   *                  the change (strict `<`, matching the connect-time guard, so a
   *                  fresh post-change login's socket survives). Sockets without a
   *                  stored tokenIat are fail-open here (same as the connect-time
   *                  guard) but still caught by the user_revoked branch.
   *
   * Reentrancy-guarded (first async cleanup interval — a slow Redis cycle must not
   * overlap itself); per-user try/catch so one user's Redis error never aborts the
   * sweep; whole body wrapped so an unexpected throw can't leak out of setInterval.
   */
  private async sweepInvalidatedSessions(): Promise<void> {
    if (this.sweepRunning || this.dashboardSockets.size === 0) {
      return;
    }
    this.sweepRunning = true;
    try {
      // Snapshot userIds so concurrent connect/disconnect can't mutate mid-iteration.
      for (const userId of Array.from(this.dashboardSockets.keys())) {
        try {
          const socketIds = this.dashboardSockets.get(userId);
          if (!socketIds || socketIds.size === 0) {
            continue;
          }

          const revoked = await this.redisService.exists(`user_revoked:${userId}`);
          let pwdChangedAt: number | null = null;
          if (!revoked) {
            const pc = await this.redisService.get(`pwd_changed:${userId}`);
            pwdChangedAt = pc ? Number(pc) : null;
            if (pwdChangedAt === null) {
              continue; // Nothing to enforce for this user this cycle.
            }
          }

          for (const socketId of Array.from(socketIds)) {
            const socket = this.server.sockets.sockets.get(socketId);
            if (!socket) {
              // Socket already gone; drop the stale entry defensively.
              socketIds.delete(socketId);
              continue;
            }
            const tokenIat = socket.data?.tokenIat;
            const expiredByPwd =
              typeof tokenIat === 'number' &&
              pwdChangedAt !== null &&
              tokenIat < pwdChangedAt;
            if (revoked || expiredByPwd) {
              const reason = revoked ? 'revoked' : 'password_changed';
              // Emit before the forced disconnect so the dashboard can show a
              // "signed out" state instead of a silent drop. handleDisconnect
              // owns removing the socketId from dashboardSockets.
              socket.emit('session:expired', { reason });
              socket.disconnect(true);
              this.logger.log(
                `Session sweep: disconnected dashboard socket ${socketId} (user: ${userId}, reason: ${reason})`,
              );
            }
          }
        } catch (err) {
          this.logger.warn(
            `Session sweep failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Session sweep aborted: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.sweepRunning = false;
    }
  }

  async handleConnection(client: Socket) {
    try {
      // Step 1: Rate limiting
      if (!this.validateConnectionRate(client)) {
        return;
      }

      // Step 2: Authentication (JWT verify + revocation + dedup)
      const authResult = await this.authenticateConnection(client);
      if (!authResult) {
        return;
      }

      // User/dashboard connections: join org room and send current device statuses
      if (authResult.kind === 'user') {
        const orgId = authResult.payload.organizationId;
        const userId = authResult.payload.sub;
        await client.join(`org:${orgId}`);

        // Store the token's iat + register this dashboard socket so the periodic
        // sweep can invalidate it mid-session if the user's password changes or
        // their account is deactivated after they connected (PR #112 only checked
        // at connect-time). iat is per-socket so two tabs (pre/post change) are
        // torn down independently.
        client.data.userId = userId;
        client.data.isDashboard = true;
        client.data.tokenIat = authResult.payload.iat;
        let userSockets = this.dashboardSockets.get(userId);
        if (!userSockets) {
          userSockets = new Set();
          this.dashboardSockets.set(userId, userSockets);
        }
        userSockets.add(client.id);

        this.logger.log(`Dashboard client joined org:${orgId} (user: ${userId}, socket: ${client.id})`);

        // Send current device statuses so dashboard has accurate state on connect
        await this.sendDeviceStatusCatchUp(client, orgId);
        return;
      }

      // Device connection flow
      const deviceId = authResult.payload.sub;
      const orgId = authResult.payload.organizationId;

      // Step 4: Room joins + Redis status
      await this.setupDeviceRooms(client, deviceId, orgId);

      // Step 5: Send initial state (playlist, config, pending commands)
      await this.sendInitialState(client, deviceId, orgId);

      // Step 6: Status broadcast + metrics + notifications
      await this.broadcastDeviceOnline(client, deviceId, orgId);

      // Step 7: PR-8 — mint + push a fresh 90d token if this one is near expiry.
      // Runs last so a refresh hiccup can never block the connect path (it also
      // has its own try/catch and never throws).
      await this.maybeRefreshDeviceToken(client);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Connection error: ${errorMessage}`);
      client.disconnect();
    }
  }

  /**
   * Validate connection rate limiting for the client IP.
   * Returns true if the connection is allowed, false if rate-limited.
   */
  private validateConnectionRate(client: Socket): boolean {
    const token = this.getTokenFromClient(client);
    const clientIp = client.handshake.address;
    const rateKey = token
      ? `token:${createHash('sha256').update(token).digest('hex').slice(0, 16)}`
      : `ip:${clientIp}`;
    const now = Date.now();
    const rateEntry = this.connectionAttempts.get(rateKey);

    if (rateEntry) {
      if (now > rateEntry.resetAt) {
        // Reset window
        this.connectionAttempts.set(rateKey, { count: 1, resetAt: now + 60000 });
      } else {
        rateEntry.count++;
        if (rateEntry.count > 10) {
          this.logger.warn(`Connection rate limited for ${token ? 'token' : 'IP'}: ${token ? rateKey : clientIp}`);
          client.emit('error', { message: 'rate_limited' });
          client.disconnect();
          return false;
        }
      }
    } else {
      this.connectionAttempts.set(rateKey, { count: 1, resetAt: now + 60000 });
    }

    return true;
  }

  /**
   * Extract JWT token from client connection.
   * Tries auth.token first (device clients), then falls back to httpOnly cookie (dashboard clients).
   */
  private getTokenFromClient(client: Socket): string | null {
    // Try auth.token first (device clients)
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    // Fall back to httpOnly cookie (dashboard clients)
    const cookies = client.handshake.headers?.cookie;
    if (cookies) {
      const match = cookies.match(/vizora_auth_token=([^;]+)/);
      if (match) return match[1];
    }

    return null;
  }

  /**
   * Authenticate the connection: verify JWT (device or user), check revocation, deduplicate sockets.
   * Returns a discriminated union on success, or null if connection was rejected.
   */
  private async authenticateConnection(client: Socket): Promise<AuthPayload | null> {
    // Contract v1.1 item 2: if the handshake middleware already verified this
    // device (accept), trust its result — do NOT re-verify or re-query. The
    // middleware is the single device-auth authority; here we only do the
    // post-connection bookkeeping (dedup + socket.data). Middleware rejections
    // never reach handleConnection at all.
    const preVerified = client.data?.deviceAuthPayload as
      | DeviceHandshakePayload
      | undefined;
    if (preVerified) {
      const deviceId = preVerified.sub;
      const existingSocketId = this.deviceSockets.get(deviceId);
      if (existingSocketId) {
        const existingSocket = this.server?.sockets?.sockets?.get(existingSocketId);
        if (existingSocket) {
          this.logger.log(`Disconnecting stale socket ${existingSocketId} for device ${deviceId}`);
          existingSocket.disconnect(true);
        }
      }
      this.deviceSockets.set(deviceId, client.id);

      client.data.deviceId = deviceId;
      client.data.organizationId = preVerified.organizationId;
      client.data.deviceIdentifier = preVerified.deviceIdentifier;
      client.data.capabilities = client.handshake.auth?.capabilities;
      client.data.deliveryAckCapable = this.supportsDeliveryAck(client);
      client.data.deviceTokenHash = client.data.deviceAuthTokenHash;
      client.data.deviceTokenExp = preVerified.exp; // PR-8 refresh trigger

      return { kind: 'device', payload: preVerified as DevicePayload };
    }

    const token = this.getTokenFromClient(client);

    if (!token) {
      this.logger.warn('Connection rejected: No token provided');
      client.disconnect();
      return null;
    }

    // Try device JWT first
    try {
      const payload = this.jwtService.verify<DevicePayload>(token, {
        secret: process.env.DEVICE_JWT_SECRET,
        algorithms: ['HS256'],
      });

      if (payload.type === 'device') {
        // Check if the token has been revoked
        if (payload.jti) {
          const isRevoked = await this.redisService.exists(`revoked_token:${payload.jti}`);
          if (isRevoked) {
            this.logger.warn(`Connection rejected: Token revoked (jti: ${payload.jti})`);
            client.disconnect();
            return null;
          }
        }

        const deviceId = payload.sub;
        const presentedTokenHash = hashDeviceToken(token);
        const device = await this.databaseService.display.findUnique({
          where: { id: deviceId },
          select: { id: true, organizationId: true, isDisabled: true, jwtToken: true },
        });
        if (!device || device.organizationId !== payload.organizationId) {
          this.logger.warn(
            `Connection rejected: Device not found or org mismatch (id: ${deviceId}, jwtOrg: ${payload.organizationId}, deviceOrg: ${device?.organizationId})`,
          );
          client.emit('error', { message: 'device_not_found' });
          client.disconnect();
          return null;
        }
        if (device.isDisabled) {
          this.logger.warn(`Connection rejected: Device is disabled (id: ${deviceId})`);
          client.emit('error', { message: 'device_disabled' });
          client.disconnect();
          return null;
        }
        if (!isCurrentDeviceToken(device.jwtToken, presentedTokenHash)) {
          this.logger.warn(`Connection rejected: Device token is not current (id: ${deviceId})`);
          client.emit('error', { message: 'device_token_stale' });
          client.disconnect();
          return null;
        }

        // 2.5: Device socket deduplication - disconnect old socket if device already connected
        const existingSocketId = this.deviceSockets.get(deviceId);
        if (existingSocketId) {
          const existingSocket = this.server?.sockets?.sockets?.get(existingSocketId);
          if (existingSocket) {
            this.logger.log(`Disconnecting stale socket ${existingSocketId} for device ${deviceId}`);
            existingSocket.disconnect(true);
          }
        }
        this.deviceSockets.set(deviceId, client.id);

        // Store device info in socket data
        client.data.deviceId = deviceId;
        client.data.organizationId = payload.organizationId;
        client.data.deviceIdentifier = payload.deviceIdentifier;
        client.data.capabilities = client.handshake.auth?.capabilities;
        client.data.deliveryAckCapable = this.supportsDeliveryAck(client);
        client.data.deviceTokenHash = presentedTokenHash;
        client.data.deviceTokenExp = payload.exp; // PR-8 refresh trigger

        return { kind: 'device', payload };
      }
    } catch {
      // Device JWT verification failed — try user JWT below
    }

    // Try user JWT
    try {
      const userPayload = this.jwtService.verify<UserPayload>(token, {
        secret: process.env.JWT_SECRET,
        algorithms: ['HS256'],
      });

      if (userPayload.sub && userPayload.organizationId && userPayload.type !== 'device') {
        // Check if the token has been revoked
        if (userPayload.jti) {
          const isRevoked = await this.redisService.exists(`revoked_token:${userPayload.jti}`);
          if (isRevoked) {
            this.logger.warn(`Connection rejected: User token revoked (jti: ${userPayload.jti})`);
            client.disconnect();
            return null;
          }
        }

        // Mirror the REST JwtStrategy.validate session checks (PR #111) for the
        // dashboard WebSocket handshake, which authenticates separately and
        // previously only checked per-token revocation. The middleware writes
        // these keys to the SAME Redis instance, so a stolen/other-device
        // dashboard socket can't keep streaming after the account is
        // deactivated or its password changed.
        //
        // (1) User-wide revocation — admin deactivation / self-delete.
        const isUserRevoked = await this.redisService.exists(`user_revoked:${userPayload.sub}`);
        if (isUserRevoked) {
          this.logger.warn(`Connection rejected: user revoked (sub: ${userPayload.sub})`);
          client.disconnect();
          return null;
        }

        // (2) Password-change session invalidation — reject tokens minted
        // before the last password change. Strict `<` so a fresh post-change
        // login (iat >= marker) connects. Fail-open if the token has no iat
        // (every middleware-issued token carries one — see JwtStrategy note).
        if (userPayload.iat) {
          const pwdChangedAt = await this.redisService.get(`pwd_changed:${userPayload.sub}`);
          if (pwdChangedAt && userPayload.iat < Number(pwdChangedAt)) {
            this.logger.warn(`Connection rejected: session expired by password change (sub: ${userPayload.sub})`);
            client.disconnect();
            return null;
          }
        }

        // Store user info in socket data
        client.data.userId = userPayload.sub;
        client.data.organizationId = userPayload.organizationId;
        client.data.isDashboard = true;

        this.logger.log(`Dashboard user connected: ${userPayload.sub} (${client.id})`);
        return { kind: 'user', payload: userPayload };
      }
    } catch {
      // User JWT also failed
    }

    this.logger.warn('Connection rejected: Invalid or unrecognized token');
    client.disconnect();
    return null;
  }

  /**
   * Join device and organization rooms, update Redis and DB status.
   */
  private async setupDeviceRooms(client: Socket, deviceId: string, orgId: string): Promise<void> {
    // Join device-specific room
    await client.join(`device:${deviceId}`);
    // Join organization room
    await client.join(`org:${orgId}`);

    // Update device status in Redis. A Redis outage must NOT block the
    // connect path: the DB write below is the durable source the dashboard
    // and the offline-scanner read from. Without this guard, a rejected
    // setex would propagate to handleConnection's catch → client.disconnect(),
    // the device would never join rooms or get its playlist, and the DB
    // status='online' write would never run — a Redis blip would take the
    // whole fleet offline. Log and continue so Postgres is the real fallback.
    try {
      await this.redisService.setDeviceStatus(deviceId, {
        status: 'online',
        lastHeartbeat: Date.now(),
        socketId: client.id,
        organizationId: orgId,
      });
    } catch (redisError: unknown) {
      const errorMessage = redisError instanceof Error ? redisError.message : 'Unknown error';
      this.logger.warn(`Failed to set Redis status for device ${deviceId}, continuing to DB write: ${errorMessage}`);
    }

    // 2.1: Only write to DB if status actually changed
    const previousStatus = this.deviceStatusCache.get(deviceId);
    if (previousStatus !== 'online') {
      try {
        await this.databaseService.display.updateMany({
          where: { id: deviceId },
          data: {
            status: 'online',
            lastHeartbeat: new Date(),
          },
        });
        this.lastHeartbeatDbWrites.set(deviceId, Date.now());
      } catch (dbError: unknown) {
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
        this.logger.warn(`Failed to update database for device ${deviceId}: ${errorMessage}`);
      }
    }
    this.deviceStatusCache.set(deviceId, 'online');

    this.logger.log(`Device connected: ${deviceId} (${client.id})`);
  }

  /**
   * Send initial state to the device: config, playlist, pending commands.
   */
  private async sendInitialState(client: Socket, deviceId: string, orgId: string): Promise<void> {
    try {
      // Check if device has an active content override
      const overrideCommandId = await this.redisService.get(`device:override:${deviceId}`);
      if (overrideCommandId) {
        // We still send the playlist even during an override. The TV app's
        // updatePlaylist() persists it to Preferences but does NOT interrupt the
        // active temporary content (guarded by the temporaryContent flag in main.ts).
        // When the override expires, resumePlaylist() restores savedPlaylistState.
        // On next restart, the device loads the newest playlist from Preferences.
        this.logger.log(`Device ${deviceId} has active override ${overrideCommandId} — sending playlist alongside override so device has fallback content`);
      }

      // Check for a pending playlist queued while the device was offline.
      // This takes priority over the DB query since it represents a more
      // recent assignment that the device missed.
      const deliveryStatus = await this.deliverPendingPlaylist(client, deviceId);
      if (deliveryStatus !== 'none' && deliveryStatus !== 'skipped') return;

      this.logger.debug(`Fetching playlist for device: ${deviceId}`);
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

      // Extract qrOverlay from display metadata for initial config
      const displayMetadata = (display?.metadata as Record<string, any>) || {};

      // Send initial configuration including qrOverlay
      client.emit('config', {
        heartbeatInterval: 15000, // 15 seconds
        cacheSize: 524288000, // 500MB
        autoUpdate: true,
        qrOverlay: displayMetadata.qrOverlay || null,
      });

      this.logger.debug(`Display found: ${!!display}, hasPlaylist: ${!!display?.currentPlaylist}, playlistId: ${display?.currentPlaylistId || 'none'}`);

      if (display?.currentPlaylist) {
        // Transform playlist to the format expected by the display client
        // Content URLs use the API base path — devices authenticate via
        // Authorization header with their stored JWT, not via URL query params
        const resolvedItems = await Promise.all(
          display.currentPlaylist.items.map(async (item: any) => {
            const resolvedUrl = this.resolveContentUrl(item);
            const baseItem = {
              id: item.id,
              contentId: item.contentId,
              duration: item.duration || 10,
              order: item.order,
              content: item.content ? {
                id: item.content.id,
                name: item.content.name,
                type: item.content.type,
                url: resolvedUrl,
                thumbnail: item.content.thumbnail,
                mimeType: item.content.mimeType,
                duration: item.content.duration,
                metadata: redactDeviceContentMetadata(item.content.metadata),
              } : null,
            };

            // Resolve layout content inline so devices receive self-contained data
            if (baseItem.content?.type === 'layout') {
              baseItem.content = await this.resolveLayoutContent(baseItem.content, orgId);
            }

            return baseItem;
          }),
        );

        const playlist = redactDevicePlaylist({
          id: display.currentPlaylist.id,
          name: display.currentPlaylist.name,
          items: resolvedItems,
          totalDuration: display.currentPlaylist.items.reduce(
            (sum: number, item: any) => sum + (item.duration || 10),
            0
          ),
          loopPlaylist: true,
        });

        client.emit('playlist:update', {
          playlist,
          timestamp: new Date().toISOString(),
        });

        this.logger.log(`Sent current playlist to device: ${deviceId} (playlist: ${display.currentPlaylist.name})`);
      } else {
        this.logger.log(`Device ${deviceId} has no assigned playlist`);
      }
    } catch (playlistError: unknown) {
      const playlistErrorMsg = playlistError instanceof Error ? playlistError.stack || playlistError.message : 'Unknown error';
      this.logger.error(`Failed to fetch playlist for device ${deviceId}: ${playlistErrorMsg}`);
      // Don't fail the connection if playlist fetch fails
    }

    // Deliver any commands that were queued while the device was offline
    try {
      await this.deliverPendingCommands(client, deviceId);
    } catch (cmdError: unknown) {
      const cmdErrorMsg = cmdError instanceof Error ? cmdError.message : 'Unknown error';
      this.logger.error(`Failed to deliver pending commands to device ${deviceId}: ${cmdErrorMsg}`);
    }
  }

  /**
   * Broadcast device online status, handle notifications, and record metrics.
   */
  private async broadcastDeviceOnline(client: Socket, deviceId: string, orgId: string): Promise<void> {
    // Cancel any pending offline notification for this device
    const wasOfflineLong = await this.notificationService.wasDeviceOfflineLong(deviceId);
    await this.notificationService.cancelOfflineNotification(deviceId);

    // If the device was offline for > 2 minutes, create an "online" notification
    if (wasOfflineLong) {
      try {
        const device = await this.databaseService.display.findUnique({
          where: { id: deviceId },
          select: { nickname: true, deviceIdentifier: true },
        });
        const deviceName = device?.nickname || device?.deviceIdentifier || deviceId;
        await this.notificationService.createOnlineNotification(
          deviceId,
          deviceName,
          orgId,
        );
        // Emit notification to current org-room sockets. Stale device
        // sockets are filtered/disconnected before any payload is sent.
        await this.emitToOrganization(orgId, 'notification:new', {
          type: 'device_online',
          deviceId,
          deviceName,
          timestamp: new Date().toISOString(),
        });
      } catch (notifError) {
        this.logger.warn(`Failed to create online notification for device ${deviceId}`);
      }
    }

    // Record metrics
    this.metricsService.recordConnection(orgId, 'connected');
    this.metricsService.updateDeviceStatus(deviceId, orgId, 'online');

    // Notify dashboard about device online status
    const now = new Date().toISOString();
    await this.emitToOrganization(orgId, 'device:status', {
      deviceId,
      status: 'online',
      lastSeen: now,
      timestamp: now,
    });
  }

  /**
   * PR-8 — server-side device-JWT 90d refresh.
   *
   * Device tokens are signed with a 90d expiry and nothing on the server used to
   * re-issue them, so every device hard-expired 90 days after pairing and could
   * never re-auth (the handshake returns AUTH_EXPIRED and the screen is stuck on
   * cache) — a latent fleet-wide outage. When a device connects or heartbeats
   * within DEVICE_TOKEN_REFRESH_WITHIN_DAYS of expiry we mint a fresh 90d token
   * with the SAME claims and push it via `token:refresh` (the Electron client
   * persists it and swaps `socket.auth.token`, so its NEXT reconnect uses it).
   *
   * Revocation-hash ordering — why this cannot lock a device out:
   *   1. Publish a short-lived grace record { prev: oldHash, next: newHash }
   *      FIRST, so the old token stays acceptable across the rotation.
   *   2. Rotate Display.jwtToken oldHash -> newHash, GUARDED on the stored hash
   *      still being oldHash — a concurrent re-pair/revoke makes the update
   *      no-op and we do NOT emit.
   *   3. Update this live socket's cached hash to newHash so delivery-time
   *      checks keep matching the DB.
   *   4. Emit the new token to the device.
   * During the grace window the handshake accepts EITHER token (new via the
   * rotated DB hash, old via the grace record — see authenticateDeviceHandshake).
   * After grace, only the new token (DB) is accepted, which the device already
   * holds in the normal case. Genuine revocation is unaffected: delete / disable
   * / org-reassign are checked before the token hash, and a re-pair changes the
   * stored hash so the grace's `next` no longer matches and the old token is
   * rejected.
   *
   * Residual (documented, now self-healing across the old token's whole
   * validity): F1 sets the grace TTL to the OLD token's remaining validity, so
   * if the socket drops in the ~RTT window before the client persists the new
   * token, the device is still accepted on its old token at ANY reconnect while
   * that token remains cryptographically valid — and is re-refreshed then. The
   * only unrecoverable case is a device that never receives the new token AND
   * stays offline until the old token itself hard-expires — the pre-existing 90d
   * expiry this refresh is designed to pre-empt (surfaces as AUTH_EXPIRED, screen
   * keeps cached content, re-pair restores it). This trades a *certain* 90-day
   * fleet-wide outage for a rare, graceful, per-device degradation.
   */
  private async maybeRefreshDeviceToken(client: Socket): Promise<void> {
    try {
      // Idempotent per socket — one mint per connection at most.
      if (client.data?.tokenRefreshIssued) return;

      const deviceId = client.data?.deviceId as string | undefined;
      const orgId = client.data?.organizationId as string | undefined;
      const deviceIdentifier = client.data?.deviceIdentifier as string | undefined;
      const currentHash = client.data?.deviceTokenHash as string | undefined;
      const exp = client.data?.deviceTokenExp as number | undefined;
      if (!deviceId || !orgId || !currentHash || typeof exp !== 'number') return;

      const msUntilExpiry = exp * 1000 - Date.now();
      // Far from expiry, or already expired (can't happen on a live socket) → skip.
      if (msUntilExpiry <= 0 || msUntilExpiry > DEVICE_TOKEN_REFRESH_WITHIN_MS) return;

      const deviceSecret = process.env.DEVICE_JWT_SECRET;
      if (!deviceSecret || deviceSecret.length < 32) {
        this.logger.warn(
          `Cannot refresh near-expiry token for device ${deviceId}: DEVICE_JWT_SECRET is missing or too short`,
        );
        return;
      }

      // Throttle: claim a per-device cooldown so a reconnect storm near expiry
      // mints exactly one new token (multiple in-flight tokens would race the
      // single stored hash). A claim failure means another connection just
      // refreshed — nothing to do on this socket.
      let claimed = false;
      try {
        claimed = await this.redisService.setNx(
          `device:token:refresh-cooldown:${deviceId}`,
          '1',
          DEVICE_TOKEN_REFRESH_COOLDOWN_SECONDS,
        );
      } catch (err) {
        // F2(a) — fail CLOSED. If the cooldown claim can't be confirmed we do
        // NOT know whether another connection is concurrently rotating; letting
        // this refresh proceed unthrottled could mint racing tokens against the
        // single stored hash. Skip entirely and let the next reconnect retry
        // (matching the security-critical handshake reads, which also fail
        // closed on a Redis error).
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(
          `Skipping token refresh for device ${deviceId}: cooldown claim failed (${msg})`,
        );
        return;
      }
      if (!claimed) {
        client.data.tokenRefreshIssued = true;
        return;
      }

      const newToken = this.jwtService.sign(
        {
          sub: deviceId,
          deviceIdentifier,
          organizationId: orgId,
          type: 'device',
        },
        { secret: deviceSecret, algorithm: 'HS256', expiresIn: DEVICE_TOKEN_TTL },
      );
      const newHash = hashDeviceToken(newToken);

      // 1) Grace FIRST — the old token stays valid across the rotation.
      // F1 — TTL equals the OLD token's remaining validity (`oldTokenExp - now`)
      // rather than a fixed 300s, so the old token stays grace-acceptable for
      // exactly as long as it is still cryptographically valid. A device that
      // never received/persisted the new token can then reconnect on the old one
      // at any point before it truly expires and be re-refreshed — closing the
      // permanent lockout tail. Floored so a near-zero remainder still yields a
      // usable window; capped at the 90d token lifetime.
      const nowSeconds = Math.floor(Date.now() / 1000);
      const graceTtlSeconds = Math.min(
        DEVICE_TOKEN_GRACE_MAX_TTL_SECONDS,
        Math.max(DEVICE_TOKEN_GRACE_MIN_TTL_SECONDS, exp - nowSeconds),
      );
      const graceKey = deviceTokenGraceKey(deviceId);
      const grace: DeviceTokenGrace = { prev: currentHash, next: newHash };
      try {
        await this.redisService.set(
          graceKey,
          JSON.stringify(grace),
          graceTtlSeconds,
        );
      } catch (err) {
        // Without the grace record a reconnect on the old token during the
        // rotation could be rejected — abort rather than risk a lockout.
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(
          `Skipping token refresh for device ${deviceId}: failed to set grace record (${msg})`,
        );
        return;
      }

      // 2) Rotate the stored hash, guarded so a concurrent re-pair/revoke aborts.
      let rotatedCount = 0;
      try {
        const rotated = await this.databaseService.display.updateMany({
          where: { id: deviceId, organizationId: orgId, jwtToken: currentHash },
          data: { jwtToken: newHash },
        });
        rotatedCount = rotated?.count ?? 0;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(`Token refresh DB rotation failed for device ${deviceId}: ${msg}`);
        await this.deleteOwnedGraceRecord(graceKey, grace);
        return;
      }
      if (rotatedCount === 0) {
        // Stored hash changed under us (re-pair / revoke / disable, or a
        // concurrent refresh already won). Do not emit a token bound to a hash
        // the DB no longer holds; drop OUR stale grace — F2(b): only if the key
        // still holds the record THIS invocation wrote, so we never collapse a
        // concurrent winner's grace window.
        await this.deleteOwnedGraceRecord(graceKey, grace);
        this.logger.warn(
          `Token refresh aborted for device ${deviceId}: stored hash changed (re-pair/revoke)`,
        );
        return;
      }

      // 3) Keep this live socket delivering under the rotated hash.
      client.data.deviceTokenHash = newHash;
      client.data.tokenRefreshIssued = true;

      // 4) Push the new token to this device socket. Payload shape is what the
      // Electron client consumes: { token } (device-client.ts on 'token:refresh').
      client.emit('token:refresh', { token: newToken });
      this.logger.log(
        `Refreshed device token for ${deviceId} (was within ${DEVICE_TOKEN_REFRESH_WITHIN_DAYS}d of expiry)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(
        `maybeRefreshDeviceToken failed for device ${client.data?.deviceId}: ${msg}`,
      );
    }
  }

  /**
   * F2(b) — delete a grace record only if it is still the exact {prev,next} this
   * refresh invocation wrote. On the abort paths (guarded rotation returned 0, or
   * the rotation update threw) a concurrent re-pair/refresh may already have
   * overwritten the grace key with ITS OWN record; blindly deleting would collapse
   * that winner's grace window and re-open the very lockout tail F1 closes. So we
   * re-read and compare before deleting; if it differs (or is gone/unparseable),
   * we leave it. Best-effort — a leftover grace whose `next` no longer equals
   * Display.jwtToken is rejected by isGraceAcceptedDeviceToken anyway.
   */
  private async deleteOwnedGraceRecord(
    graceKey: string,
    owned: DeviceTokenGrace,
  ): Promise<void> {
    try {
      const current = await this.redisService.get(graceKey);
      if (!current) return;
      let parsed: DeviceTokenGrace;
      try {
        parsed = JSON.parse(current) as DeviceTokenGrace;
      } catch {
        return; // Not parseable — not safely ours; leave it.
      }
      if (parsed?.prev === owned.prev && parsed?.next === owned.next) {
        await this.redisService.delete(graceKey);
      }
    } catch {
      // Swallow — cleanup is best-effort and must never fail the refresh path.
    }
  }

  /**
   * Send current device statuses to a newly connected dashboard client.
   * This ensures the dashboard has accurate online/offline state immediately,
   * even if the devices connected before the dashboard did.
   *
   * Capped at CATCH_UP_DEVICE_CAP devices per call. For larger fleets the
   * dashboard can paginate via REST and rely on incremental status updates
   * from then on. Without this cap, a single dashboard reconnect for a
   * 10k-device org would load the entire fleet into memory and emit 10k
   * events to one socket on the connection-handling path — which is what
   * the "stale-org outage" follow-up was about.
   */
  private static readonly CATCH_UP_DEVICE_CAP = 500;

  private async sendDeviceStatusCatchUp(client: Socket, orgId: string): Promise<void> {
    try {
      const cap = DeviceGateway.CATCH_UP_DEVICE_CAP;
      const devices = await this.databaseService.display.findMany({
        where: { organizationId: orgId },
        select: { id: true, status: true, lastHeartbeat: true },
        orderBy: { lastHeartbeat: 'desc' },
        take: cap + 1, // peek one past the cap so we know if more exist
      });

      const truncated = devices.length > cap;
      const toSend = truncated ? devices.slice(0, cap) : devices;

      const now = new Date().toISOString();
      const statusBatch = toSend.map((device) => {
        // Check in-memory cache first (most accurate for connected devices)
        const cachedStatus = this.deviceStatusCache.get(device.id);
        const status = cachedStatus || device.status || 'offline';
        return {
          deviceId: device.id,
          status,
          lastSeen: device.lastHeartbeat?.toISOString() || now,
          timestamp: now,
        };
      });

      if (statusBatch.length > 0) {
        client.emit('device:status:batch', statusBatch);
      }

      if (truncated) {
        this.logger.warn(
          `Device catch-up truncated at ${cap} for org ${orgId}; dashboard should paginate the remainder via REST and rely on incremental events afterwards`,
        );
      } else {
        this.logger.debug(`Sent status catch-up for ${toSend.length} devices to dashboard (org: ${orgId})`);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to send device status catch-up: ${errorMessage}`);
    }
  }

  async handleDisconnect(client: Socket) {
    // Clean up per-message rate limit entry for this socket
    this.messageRates.delete(client.id);

    // Deregister dashboard (user) sockets from the sweep map. Pure in-memory
    // bookkeeping (no I/O), so kept outside the try below.
    const dashUserId = client.data?.userId;
    if (dashUserId && client.data?.isDashboard) {
      const set = this.dashboardSockets.get(dashUserId);
      if (set) {
        set.delete(client.id);
        if (set.size === 0) this.dashboardSockets.delete(dashUserId);
      }
    }

    try {
      const deviceId = client.data?.deviceId;

      if (deviceId) {
        // 2.5: Only process disconnect if this socket is still the active one for the device
        const activeSocketId = this.deviceSockets.get(deviceId);
        if (activeSocketId && activeSocketId !== client.id) {
          this.logger.debug(`Ignoring disconnect for stale socket ${client.id} (device ${deviceId}, active: ${activeSocketId})`);
          return;
        }
        this.deviceSockets.delete(deviceId);
        this.lastHeartbeatDbWrites.delete(deviceId);

        // Update status in Redis. Guarded so a Redis outage doesn't skip the
        // durable DB offline write below (a disconnect must record offline in
        // Postgres even if Redis is unavailable).
        try {
          await this.redisService.setDeviceStatus(deviceId, {
            status: 'offline',
            lastHeartbeat: Date.now(),
            socketId: null,
            organizationId: client.data?.organizationId,
          });
        } catch (redisError: unknown) {
          const errorMessage = redisError instanceof Error ? redisError.message : 'Unknown error';
          this.logger.warn(`Failed to set Redis offline status for device ${deviceId}, continuing to DB write: ${errorMessage}`);
        }

        // 2.1: Update DB on disconnect (status transition) and clean up cache
        this.deviceStatusCache.delete(deviceId);
        let deviceName = deviceId;
        try {
          // updateMany (vs update) silently no-ops when the device row
          // no longer exists — happens during device deletion races and
          // for ephemeral test sockets. Prevents the noisy P2025 Prisma
          // log that disconnect.update used to produce on every stale
          // session. Read nickname/identifier in a separate findUnique
          // so the absent-row case stays log-free.
          const updated = await this.databaseService.display.updateMany({
            where: { id: deviceId },
            data: {
              status: 'offline',
              lastHeartbeat: new Date(),
            },
          });
          if (updated.count > 0) {
            const device = await this.databaseService.display.findUnique({
              where: { id: deviceId },
              select: { nickname: true, deviceIdentifier: true },
            });
            deviceName = device?.nickname || device?.deviceIdentifier || deviceId;
          }
        } catch (dbError: unknown) {
          const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
          this.logger.warn(`Failed to update database for device ${deviceId}: ${errorMessage}`);
        }

        this.logger.log(`Device disconnected: ${deviceId} (${client.id})`);

        // Organization-scoped operations (notifications, metrics, dashboard broadcast)
        const orgId = client.data?.organizationId;
        if (orgId) {
          try {
            if (client.data?.suppressOfflineNotification !== true) {
              await this.notificationService.scheduleOfflineNotification(
                deviceId,
                deviceName,
                orgId,
              );
            }
          } catch (notifError) {
            this.logger.warn(`Failed to schedule offline notification for device ${deviceId}`);
          }

          this.metricsService.recordConnection(orgId, 'disconnected');
          this.metricsService.updateDeviceStatus(deviceId, orgId, 'offline');

          const now = new Date().toISOString();
          await this.emitToOrganization(orgId, 'device:status', {
            deviceId,
            status: 'offline',
            lastSeen: now,
            timestamp: now,
          });
        }
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error in handleDisconnect for ${client.data?.deviceId}: ${errorMessage}`);
    }
  }

  @SubscribeMessage('heartbeat')
  @UseGuards(WsDeviceGuard)
  @UsePipes(new WsValidationPipe())
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: HeartbeatMessageDto,
  ) {
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
    const deviceId = client.data.deviceId;
    const startTime = Date.now();

    try {
      if (!this.isActiveDeviceSocket(client, deviceId)) {
        return createSuccessResponse({
          nextHeartbeatIn: 15000,
          commands: [],
        });
      }

      // Update heartbeat in Redis (cheap, always do this). Guarded so a Redis
      // outage does NOT skip the Postgres refresh below: if this threw, the
      // handler's catch would return an error ack and the DB lastHeartbeat
      // write would be skipped, and after HEARTBEAT_DB_REFRESH_INTERVAL_MS×… the
      // middleware offline-scanner would mark the entire live fleet offline from
      // a transient Redis blip. Log and continue so Postgres stays fresh.
      try {
        await this.redisService.setDeviceStatus(deviceId, {
          status: 'online',
          lastHeartbeat: Date.now(),
          socketId: client.id,
          organizationId: client.data.organizationId,
          metrics: data.metrics,
          currentContent: data.currentContent,
          // Contract v1.1: surface dark-screen signals for the fleet view. A device
          // that is connected but not (screenState=playing, playbackSource=live) is
          // the "on but dark/stale" case the fleet view previously could not see.
          screenState: data.screenState,
          playbackSource: data.playbackSource,
        });
      } catch (redisError: unknown) {
        const errorMessage = redisError instanceof Error ? redisError.message : 'Unknown error';
        this.logger.warn(`Failed to set Redis heartbeat status for device ${deviceId}, continuing to DB refresh: ${errorMessage}`);
      }

      // Keep Redis as the fast heartbeat path, but refresh Postgres often
      // enough that middleware's offline scanner does not see live devices as stale.
      const previousStatus = this.deviceStatusCache.get(deviceId);
      const lastHeartbeatDbWrite = this.lastHeartbeatDbWrites.get(deviceId) ?? 0;
      const shouldWriteHeartbeatToDb =
        previousStatus !== 'online' ||
        Date.now() - lastHeartbeatDbWrite >= HEARTBEAT_DB_REFRESH_INTERVAL_MS;

      if (shouldWriteHeartbeatToDb) {
        try {
          // updateMany — silently no-ops if the row was deleted between
          // the device's JWT issuance and this heartbeat (test sockets,
          // mid-flight device deletion). Avoids P2025 log noise without
          // losing the status-write semantics.
          await this.databaseService.display.updateMany({
            where: { id: deviceId },
            data: {
              status: 'online',
              lastHeartbeat: new Date(),
            },
          });
          this.lastHeartbeatDbWrites.set(deviceId, Date.now());
        } catch (dbError: unknown) {
          const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
          this.logger.warn(`Failed to update database for device ${deviceId}: ${errorMessage}`);
        }
        this.deviceStatusCache.set(deviceId, 'online');
      }

      // Process heartbeat (store in ClickHouse, etc.)
      await this.heartbeatService.processHeartbeat(deviceId, data);

      // Update device metrics if available
      if (data.metrics) {
        this.metricsService.updateDeviceMetrics(
          client.data.organizationId,
          data.metrics.cpuUsage || 0,
          data.metrics.memoryUsage || 0,
        );
      }

      // Record successful heartbeat with duration
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordHeartbeat(deviceId, true, duration);

      // PR-8 — also refresh near-expiry tokens on heartbeat so a device that
      // stays connected continuously (never reconnects) still gets a fresh token
      // before its 90d expiry. Idempotent per socket + throttled via cooldown.
      await this.maybeRefreshDeviceToken(client);

      void this.replayPendingDeliveries(client, deviceId);

      return createSuccessResponse({
        nextHeartbeatIn: 15000,
        commands: [],
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Heartbeat error for ${deviceId}: ${errorMessage}`);

      // Record failed heartbeat
      const duration = (Date.now() - startTime) / 1000;
      this.metricsService.recordHeartbeat(deviceId, false, duration);

      // Report to Sentry
      Sentry.captureException(error, {
        tags: { deviceId, event: 'heartbeat' },
      });

      return createErrorResponse('Failed to process heartbeat');
    }
  }

  @SubscribeMessage('content:impression')
  @UseGuards(WsDeviceGuard)
  @UsePipes(new WsValidationPipe())
  async handleContentImpression(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ContentImpressionDto,
  ) {
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
    const deviceId = client.data.deviceId;
    const organizationId = typeof client.data.organizationId === 'string'
      ? client.data.organizationId
      : undefined;

    try {
      // Log impression for analytics
      await this.heartbeatService.logImpression(deviceId, data, organizationId);

      // Record metrics
      this.metricsService.recordImpression(deviceId, data.contentId);

      return createSuccessResponse();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Impression error for ${deviceId}: ${errorMessage}`);
      Sentry.captureException(error, {
        tags: { deviceId, event: 'content:impression' },
      });
      return createErrorResponse('Failed to log impression');
    }
  }

  @SubscribeMessage('content:error')
  @UseGuards(WsDeviceGuard)
  @UsePipes(new WsValidationPipe())
  async handleContentError(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ContentErrorDto,
  ) {
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
    const deviceId = client.data.deviceId;

    this.logger.warn(`Content error on ${deviceId}: ${data.errorType} - ${data.contentId}`);

    try {
      const sanitizedData = redactSensitiveTokens(data);

      // Log error for analytics
      await this.heartbeatService.logError(deviceId, sanitizedData);

      // Record metrics
      this.metricsService.recordContentError(deviceId, data.errorType);

      // Report content errors to Sentry
      Sentry.captureMessage(`Content error on device ${deviceId}`, {
        level: 'warning',
        tags: {
          deviceId,
          errorType: data.errorType,
          contentId: data.contentId,
        },
        extra: {
          errorMessage: sanitizedData.errorMessage,
          errorCode: sanitizedData.errorCode,
          context: sanitizedData.context,
        },
      });

      return createSuccessResponse();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error logging failed for ${deviceId}: ${errorMessage}`);
      Sentry.captureException(error, {
        tags: { deviceId, event: 'content:error' },
      });
      return createErrorResponse('Failed to log error');
    }
  }

  @SubscribeMessage('playlist:request')
  @UseGuards(WsDeviceGuard)
  @UsePipes(new WsValidationPipe())
  async handlePlaylistRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: PlaylistRequestDto,
  ) {
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
    const deviceId = client.data.deviceId;

    try {
      // Get current playlist for device
      const playlist = await this.playlistService.getDevicePlaylist(
        deviceId,
        data?.forceRefresh,
      );

      return createSuccessResponse({ playlist });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Playlist request error for ${deviceId}: ${errorMessage}`);
      return createErrorResponse('Failed to get playlist');
    }
  }

  /**
   * Deliver a pending playlist that was queued in Redis while the device was offline.
   * The pending playlist has pre-resolved content URLs from sendPlaylistUpdate().
   * Returns true if a pending playlist was found and delivered (or re-queued).
   */
  private async deliverPendingPlaylist(client: Socket, deviceId: string): Promise<PendingPlaylistDeliveryStatus> {
    if (!this.isActiveDeviceSocket(client, deviceId)) {
      this.logger.debug(`Skipping pending playlist delivery for stale socket ${client.id} (device ${deviceId})`);
      return 'skipped';
    }

    const replayVersion = this.pendingPlaylistReplayVersions.get(deviceId) ?? 0;
    const pendingPlaylist = await this.redisService.getPendingPlaylist(deviceId);
    if (!pendingPlaylist) return 'none';
    const safePendingPlaylist = redactDevicePlaylist(pendingPlaylist);

    this.logger.log(`Delivering pending playlist to device ${deviceId} (queued while offline)`);

    // Re-queue if the active client changed or disconnected after the atomic Redis consume.
    if (!this.isActiveDeviceSocket(client, deviceId) || !client.connected) {
      this.logger.warn(`Device ${deviceId} disconnected before pending playlist delivery - re-queuing`);
      return this.requeuePendingPlaylistIfCurrent(deviceId, safePendingPlaylist, replayVersion, 'deferred');
    }

    // Fetch display metadata for config (qrOverlay etc.)
    const displayForConfig = await this.databaseService.display.findUnique({
      where: { id: deviceId },
      select: { metadata: true },
    });

    if (!this.isPendingPlaylistReplayCurrent(deviceId, replayVersion)) {
      this.logger.debug(`Skipping stale pending playlist replay for device ${deviceId}`);
      return 'skipped';
    }

    if (!this.isActiveDeviceSocket(client, deviceId) || !client.connected) {
      this.logger.warn(`Device ${deviceId} disconnected before pending playlist delivery - re-queuing`);
      return this.requeuePendingPlaylistIfCurrent(deviceId, safePendingPlaylist, replayVersion, 'deferred');
    }

    const configMetadata = (displayForConfig?.metadata as Record<string, any>) || {};
    client.emit('config', {
      heartbeatInterval: 15000,
      cacheSize: 524288000,
      autoUpdate: true,
      qrOverlay: configMetadata.qrOverlay || null,
    });

    if (!this.isPendingPlaylistReplayCurrent(deviceId, replayVersion)) {
      this.logger.debug(`Skipping stale pending playlist replay for device ${deviceId}`);
      return 'skipped';
    }

    const result = await this.emitWithDeliveryAck(client, 'playlist:update', {
      playlist: safePendingPlaylist,
      timestamp: new Date().toISOString(),
    });

    if (!this.isPendingPlaylistReplayCurrent(deviceId, replayVersion)) {
      this.logger.debug(`Ignoring stale pending playlist replay result for device ${deviceId}`);
      return 'skipped';
    }

    if (!this.isActiveDeviceSocket(client, deviceId) || !client.connected) {
      this.logger.warn(`Device ${deviceId} changed sockets during pending playlist delivery - re-queuing`);
      return this.requeuePendingPlaylistIfCurrent(deviceId, safePendingPlaylist, replayVersion, 'deferred');
    }

    if (result.delivered) {
      this.logger.log(
        result.legacy
          ? `Pending playlist delivered to legacy device ${deviceId} (best-effort)`
          : `Pending playlist delivered to device ${deviceId} (acknowledged)`,
      );
    } else {
      this.logger.warn(`Pending playlist ${result.reason || 'delivery failure'} for device ${deviceId} - re-queuing`);
      return this.requeuePendingPlaylistIfCurrent(deviceId, safePendingPlaylist, replayVersion);
    }
    return 'delivered';
  }

  private async deliverPendingCommands(client: Socket, deviceId: string): Promise<PendingCommandDeliveryResult> {
    if (!this.isActiveDeviceSocket(client, deviceId)) {
      this.logger.debug(`Skipping pending command delivery for stale socket ${client.id} (device ${deviceId})`);
      return { delivered: 0, requeued: 0, skipped: true, shouldBackoff: false };
    }

    const pendingCommands = await this.redisService.getDeviceCommands(deviceId);
    if (pendingCommands.length === 0) {
      return { delivered: 0, requeued: 0, skipped: false, shouldBackoff: false };
    }

    this.logger.log(`Delivering ${pendingCommands.length} pending command(s) to device ${deviceId}`);
    let delivered = 0;
    let requeued = 0;
    for (let index = 0; index < pendingCommands.length; index += 1) {
      const cmd = pendingCommands[index];
      if (!this.isActiveDeviceSocket(client, deviceId) || !client.connected) {
        this.logger.warn(`Device ${deviceId} disconnected before pending command delivery - re-queuing remaining commands`);
        requeued += await this.requeuePendingCommands(deviceId, pendingCommands.slice(index));
        return { delivered, requeued, skipped: false, shouldBackoff: false };
      }

      const result = await this.emitWithDeliveryAck(client, 'command', cmd);
      if (!this.isActiveDeviceSocket(client, deviceId) || !client.connected) {
        this.logger.warn(`Device ${deviceId} changed sockets during pending command delivery - re-queuing current and remaining commands`);
        requeued += await this.requeuePendingCommands(deviceId, pendingCommands.slice(index));
        return { delivered, requeued, skipped: false, shouldBackoff: false };
      }

      if (!result.delivered) {
        this.logger.warn(`Pending command ${cmd.type} ${result.reason || 'delivery failure'} for device ${deviceId} - re-queuing`);
        await this.redisService.addDeviceCommand(deviceId, cmd);
        requeued += 1;
      } else {
        delivered += 1;
      }
    }
    return { delivered, requeued, skipped: false, shouldBackoff: requeued > 0 };
  }

  private async replayPendingDeliveries(client: Socket, deviceId: string): Promise<void> {
    if (!this.isActiveDeviceSocket(client, deviceId)) {
      this.logger.debug(`Skipping heartbeat pending replay for stale socket ${client.id} (device ${deviceId})`);
      return;
    }

    if (!this.shouldAttemptHeartbeatReplay(deviceId)) {
      return;
    }

    let hadRequeue = false;
    try {
      const playlistResult = await this.deliverPendingPlaylist(client, deviceId);
      hadRequeue = hadRequeue || playlistResult === 'requeued';
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to replay pending playlist for device ${deviceId}: ${message}`);
      hadRequeue = true;
    }

    try {
      const commandResult = await this.deliverPendingCommands(client, deviceId);
      hadRequeue = hadRequeue || commandResult.shouldBackoff;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to replay pending commands for device ${deviceId}: ${message}`);
      hadRequeue = true;
    }

    this.recordHeartbeatReplayResult(deviceId, hadRequeue);
  }

  // Admin methods (called from API)
  async sendPlaylistUpdate(deviceId: string, playlist: Playlist): Promise<{ delivered: boolean; reason?: string }> {
    // Resolve minio:// URLs to API-served URLs before sending to device
    // Devices authenticate content requests via Authorization header with their stored JWT
    const resolvedPlaylist = redactDevicePlaylist({
      ...playlist,
      items: (playlist.items || []).map((item: PlaylistContentItem) => {
        const resolvedUrl = this.resolveContentUrl(item);
        return {
          ...item,
          content: item.content ? {
            ...item.content,
            url: resolvedUrl,
          } : item.content,
        };
      }),
    });

    // Get all sockets in the device room
    const roomName = `device:${deviceId}`;
    const allSockets = await this.server.in(roomName).fetchSockets();
    const sockets = await this.filterCurrentDeliverySockets(allSockets as any[], deviceId);

    if (sockets.length === 0) {
      this.logger.warn(`pushPlaylist: no sockets in room ${roomName} for device ${deviceId} — queuing for reconnect`);
      await this.redisService.setPendingPlaylist(deviceId, resolvedPlaylist);
      this.resetHeartbeatReplayBackoff(deviceId);
      return { delivered: false, reason: 'no_sockets' };
    }

    // Use Socket.IO acknowledgment with 10s timeout — try all sockets,
    // succeed if at least one acknowledges
    let anyAcknowledged = false;
    let failureReason = 'ack_timeout';
    for (const socket of sockets) {
      const result = await this.emitWithDeliveryAck(socket as any, 'playlist:update', {
        playlist: resolvedPlaylist,
        timestamp: new Date().toISOString(),
      });
      if (result.delivered) {
        anyAcknowledged = true;
        continue;
      }

      failureReason = result.reason || 'ack_timeout';
      this.logger.warn(`pushPlaylist: ${failureReason} for socket ${socket.id} on device ${deviceId}`);
    }

    if (!anyAcknowledged) {
      this.logger.warn(`pushPlaylist: all sockets timed out for device ${deviceId} — queuing for reconnect`);
      await this.redisService.setPendingPlaylist(deviceId, resolvedPlaylist);
      this.resetHeartbeatReplayBackoff(deviceId);
      return { delivered: false, reason: failureReason };
    }

    this.logger.log(`Sent playlist update to device: ${deviceId} (acknowledged)`);
    await this.clearPendingPlaylist(deviceId);
    return { delivered: true };
  }

  async sendCommand(deviceId: string, command: DeviceCommand): Promise<{ delivered: boolean; reason?: string }> {
    const commandWithTimestamp = { ...command, timestamp: new Date().toISOString() };
    const roomName = `device:${deviceId}`;
    const allSockets = await this.server.in(roomName).fetchSockets();
    const sockets = await this.filterCurrentDeliverySockets(allSockets as any[], deviceId);

    if (sockets.length === 0) {
      this.logger.warn(`sendCommand: no sockets for device ${deviceId} — queuing`);
      await this.redisService.addDeviceCommand(deviceId, commandWithTimestamp);
      this.resetHeartbeatReplayBackoff(deviceId);
      return { delivered: false, reason: 'no_sockets' };
    }

    let anyAcknowledged = false;
    let failureReason = 'ack_timeout';
    for (const socket of sockets) {
      const result = await this.emitWithDeliveryAck(socket as any, 'command', commandWithTimestamp);
      if (result.delivered) {
        anyAcknowledged = true;
        continue;
      }

      failureReason = result.reason || 'ack_timeout';
      this.logger.warn(`sendCommand: ${failureReason} for socket ${socket.id} on device ${deviceId}`);
    }

    if (!anyAcknowledged) {
      this.logger.warn(`sendCommand: all sockets timed out for device ${deviceId} — queuing`);
      await this.redisService.addDeviceCommand(deviceId, commandWithTimestamp);
      this.resetHeartbeatReplayBackoff(deviceId);
      return { delivered: false, reason: failureReason };
    }

    this.logger.log(`Sent command ${command.type} to device: ${deviceId} (acknowledged)`);
    return { delivered: true };
  }

  async broadcastToOrganization(organizationId: string, event: string, data: BroadcastData): Promise<void> {
    const emitted = await this.emitToOrganization(organizationId, event, {
      ...data,
      timestamp: new Date().toISOString(),
    });

    this.logger.log(`Broadcast ${event} to ${emitted} socket(s) in organization: ${organizationId}`);
  }

  /**
   * Allow dashboard clients to join organization rooms
   * This enables them to receive device status updates
   */
  @SubscribeMessage('join:organization')
  @UsePipes(new WsValidationPipe())
  async handleJoinOrganization(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinOrganizationDto,
  ) {
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
    if (!data?.organizationId) {
      return createErrorResponse('Organization ID required');
    }

    // Verify the client belongs to the requested organization
    if (client.data.organizationId !== data.organizationId) {
      this.logger.warn(
        `Client ${client.id} unauthorized to join org room: ${data.organizationId} (belongs to ${client.data.organizationId})`,
      );
      client.emit('error', {
        message: 'Unauthorized: you do not belong to this organization',
      });
      return createErrorResponse('Unauthorized: organization mismatch');
    }

    // Join the organization room
    await client.join(`org:${data.organizationId}`);
    client.data.isDashboard = true;

    this.logger.log(`Dashboard client ${client.id} joined org room: ${data.organizationId}`);

    client.emit('joined:organization', {
      organizationId: data.organizationId,
      timestamp: new Date().toISOString(),
    });

    return createSuccessResponse({ joined: true, organizationId: data.organizationId });
  }

  /**
   * Allow clients to join rooms with authorization checks.
   * - device:{id} rooms: client must be that device, or belong to the device's org
   * - org:{id} rooms: client must belong to that organization
   * - All other room patterns are rejected
   */
  @SubscribeMessage('join:room')
  @UsePipes(new WsValidationPipe())
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: JoinRoomDto,
  ) {
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
    if (!data?.room) {
      return createErrorResponse('Room name required');
    }

    const deviceMatch = data.room.match(/^device:(.+)$/);
    const orgMatch = data.room.match(/^org:(.+)$/);

    if (deviceMatch) {
      const targetDeviceId = deviceMatch[1];
      // Allow if client IS this device
      if (client.data.deviceId === targetDeviceId) {
        await client.join(data.room);
        this.logger.log(`Device ${client.id} joined own room: ${data.room}`);
        return createSuccessResponse({ joined: true, room: data.room });
      }
      // Allow if client belongs to the same organization as the device
      if (client.data.organizationId) {
        try {
          const device = await this.databaseService.display.findUnique({
            where: { id: targetDeviceId },
            select: { organizationId: true },
          });
          if (device && device.organizationId === client.data.organizationId) {
            await client.join(data.room);
            this.logger.log(`Client ${client.id} joined device room: ${data.room} (same org)`);
            return createSuccessResponse({ joined: true, room: data.room });
          }
        } catch (dbError: unknown) {
          const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
          this.logger.warn(`Failed to verify device org for room join: ${errorMessage}`);
        }
      }
      this.logger.warn(`Client ${client.id} unauthorized to join device room: ${data.room}`);
      client.emit('error', { message: 'Unauthorized: cannot join this device room' });
      return createErrorResponse('Unauthorized: cannot join this device room');
    }

    if (orgMatch) {
      const targetOrgId = orgMatch[1];
      if (client.data.organizationId !== targetOrgId) {
        this.logger.warn(`Client ${client.id} unauthorized to join org room: ${data.room}`);
        client.emit('error', { message: 'Unauthorized: you do not belong to this organization' });
        return createErrorResponse('Unauthorized: organization mismatch');
      }
      await client.join(data.room);
      this.logger.log(`Client ${client.id} joined org room: ${data.room}`);
      return createSuccessResponse({ joined: true, room: data.room });
    }

    // Reject unknown room patterns
    this.logger.warn(`Client ${client.id} attempted to join unrecognized room: ${data.room}`);
    client.emit('error', { message: 'Invalid room name' });
    return createErrorResponse('Invalid room name');
  }

  /**
   * Allow clients to leave rooms with authorization check
   */
  @SubscribeMessage('leave:room')
  @UsePipes(new WsValidationPipe())
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaveRoomDto,
  ) {
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
    if (!data?.room) {
      return createErrorResponse('Room name required');
    }

    // B.3: Verify client is actually a member of the room before leaving
    if (!client.rooms.has(data.room)) {
      this.logger.warn(`Client ${client.id} attempted to leave room they are not in: ${data.room}`);
      return createErrorResponse('Not a member of this room');
    }

    await client.leave(data.room);
    this.logger.log(`Client ${client.id} left room: ${data.room}`);

    return createSuccessResponse({ left: true, room: data.room });
  }

  /**
   * Handle screenshot response from device
   * Device sends base64-encoded image data which we upload to MinIO
   */
  @SubscribeMessage('screenshot:response')
  @UseGuards(WsDeviceGuard)
  @UsePipes(new WsValidationPipe())
  async handleScreenshotResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: ScreenshotResponseDto,
  ) {
    if (!this.checkMessageRateLimit(client)) return createErrorResponse('rate_limited');
    const deviceId = client.data.deviceId;
    const organizationId = client.data.organizationId;

    // Reject oversized screenshot data (max 2MB base64)
    if (data.imageData && data.imageData.length > 2 * 1024 * 1024) {
      this.logger.warn(`Screenshot data too large from device ${deviceId}: ${data.imageData.length} chars`);
      return createErrorResponse('Screenshot data too large (max 2MB)');
    }

    // B.5: Validate base64 format before attempting decode
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(data.imageData)) {
      this.logger.warn(`Invalid base64 format in screenshot from device ${deviceId}`);
      return createErrorResponse('Invalid base64 format');
    }

    this.logger.log(`Screenshot received from device ${deviceId} (requestId: ${data.requestId})`);

    try {
      // Validate MinIO is available
      if (!this.storageService.isMinioAvailable()) {
        this.logger.error('MinIO not available, cannot save screenshot');
        return createErrorResponse('Storage service unavailable');
      }

      // Convert base64 to buffer
      const imageBuffer = Buffer.from(data.imageData, 'base64');

      // B.4: Validate PNG/JPEG magic numbers
      const pngMagic = [0x89, 0x50, 0x4e, 0x47];
      const jpegMagic = [0xff, 0xd8, 0xff];
      const isPng = imageBuffer.length >= 4 && pngMagic.every((b, i) => imageBuffer[i] === b);
      const isJpeg = imageBuffer.length >= 3 && jpegMagic.every((b, i) => imageBuffer[i] === b);

      if (!isPng && !isJpeg) {
        this.logger.warn(`Screenshot from device ${deviceId} has invalid image format (not PNG or JPEG)`);
        return createErrorResponse('Invalid image format: only PNG and JPEG are accepted');
      }

      // Generate object key
      const objectKey = this.storageService.generateScreenshotKey(organizationId, deviceId);

      // Upload to MinIO
      await this.storageService.uploadScreenshot(imageBuffer, objectKey);

      // Generate presigned URL (valid for 7 days)
      const presignedUrl = await this.storageService.getPresignedUrl(objectKey, 7 * 24 * 3600);

      // Update display record in database (with org check for security)
      await this.databaseService.display.update({
        where: { id: deviceId, organizationId },
        data: {
          lastScreenshot: JSON.stringify({
            url: presignedUrl,
            width: data.width,
            height: data.height,
          }),
          lastScreenshotAt: new Date(),
        },
      });

      this.logger.log(`Screenshot saved for device ${deviceId}: ${objectKey}`);

      // Emit screenshot:ready event to organization room so dashboard can update
      await this.emitToOrganization(organizationId, 'screenshot:ready', {
        deviceId,
        requestId: data.requestId,
        url: presignedUrl,
        width: data.width,
        height: data.height,
        capturedAt: data.timestamp,
        timestamp: new Date().toISOString(),
      });

      return createSuccessResponse({ saved: true });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to save screenshot for ${deviceId}: ${errorMessage}`);
      Sentry.captureException(error, {
        tags: { deviceId, event: 'screenshot:response' },
      });
      return createErrorResponse('Failed to save screenshot');
    }
  }

  /**
   * Send a QR overlay update to a specific device
   */
  async sendQrOverlayUpdate(deviceId: string, qrOverlay: any): Promise<void> {
    const roomName = `device:${deviceId}`;
    const allSockets = await this.server.in(roomName).fetchSockets();
    const sockets = await this.filterCurrentDeliverySockets(allSockets as any[], deviceId);

    for (const socket of sockets) {
      socket.emit?.('qr-overlay:update', {
        qrOverlay,
        timestamp: new Date().toISOString(),
      });
    }
    this.logger.log(`Sent QR overlay update to ${sockets.length} active socket(s) for device: ${deviceId}`);
  }

  /**
   * Resolve layout content by fetching all zone playlists and content inline.
   * Returns a self-contained layout object that devices can render without
   * additional API calls.
   */
  private async resolveLayoutContent(content: any, organizationId: string): Promise<any> {
    const metadata = (redactDeviceContentMetadata(content.metadata) as Record<string, any>) || {};
    const zones = metadata.zones || [];

    const resolvedZones = await Promise.all(
      zones.map(async (zone: any) => {
        const resolved: any = { ...zone };

        // Resolve playlist content for zone
        if (zone.playlistId) {
          try {
            const playlist = await this.databaseService.playlist.findFirst({
              where: { id: zone.playlistId, organizationId },
              include: {
                items: {
                  include: { content: true },
                  orderBy: { order: 'asc' },
                },
              },
            });

            if (playlist) {
              resolved.resolvedPlaylist = {
                id: playlist.id,
                name: playlist.name,
                items: (playlist.items || []).map((item: any) => {
                  const resolvedUrl = this.resolveContentUrl(item);
                  return {
                    id: item.id,
                    contentId: item.contentId,
                    duration: item.duration || 10,
                    order: item.order,
                    content: item.content ? {
                      id: item.content.id,
                      name: item.content.name,
                      type: item.content.type,
                      url: resolvedUrl,
                      thumbnail: item.content.thumbnail,
                      mimeType: item.content.mimeType,
                      duration: item.content.duration,
                    } : null,
                  };
                }),
              };
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to resolve playlist ${zone.playlistId} for layout zone ${zone.id}: ${errorMessage}`);
          }
        }

        // Resolve single content for zone
        if (zone.contentId) {
          try {
            const zoneContent = await this.databaseService.content.findFirst({
              where: { id: zone.contentId, organizationId },
            });

            if (zoneContent) {
              const apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
              let contentUrl = zoneContent.url || '';
              if (contentUrl.startsWith('minio://')) {
                contentUrl = `${apiBaseUrl}/api/v1/device-content/${zoneContent.id}/file`;
              }

              resolved.resolvedContent = {
                id: zoneContent.id,
                name: zoneContent.name,
                type: zoneContent.type,
                url: contentUrl,
                thumbnail: zoneContent.thumbnail,
                mimeType: zoneContent.mimeType,
                duration: zoneContent.duration,
              };
            }
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.warn(`Failed to resolve content ${zone.contentId} for layout zone ${zone.id}: ${errorMessage}`);
          }
        }

        return resolved;
      }),
    );

    return redactDevicePayload({
      ...content,
      metadata: {
        ...metadata,
        zones: resolvedZones,
      },
    });
  }
}
