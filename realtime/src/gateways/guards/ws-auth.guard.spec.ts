import { ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { createHash } from 'node:crypto';
import { WsAuthGuard, WsDeviceGuard } from './ws-auth.guard';
import { DatabaseService } from '../../database/database.service';

describe('WebSocket auth guards', () => {
  const hashToken = (token: string) =>
    createHash('sha256').update(token).digest('hex');

  const createContext = (client: Record<string, any>): ExecutionContext => ({
    switchToWs: () => ({
      getClient: () => client,
    }),
  } as any);

  describe('WsAuthGuard', () => {
    it('should reject sockets without authenticated device or user data', () => {
      const guard = new WsAuthGuard();

      expect(() => guard.canActivate(createContext({ id: 'socket-1', data: {} }))).toThrow(
        WsException,
      );
    });
  });

  describe('WsDeviceGuard', () => {
    let databaseService: jest.Mocked<DatabaseService>;

    beforeEach(() => {
      databaseService = {
        display: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'device-1',
            organizationId: 'org-1',
            isDisabled: false,
            jwtToken: hashToken('valid-token'),
          }),
        },
      } as any;
    });

    // The three identity conditions below are what actually returns a revoked TV to the
    // pairing screen in production. Measured 2026-08-21 on vizora.cloud: with the
    // middleware -> realtime `device:revoked` dispatch deliberately blocked, a deleted
    // device was still disconnected on its next heartbeat (~10s, twice, deterministic —
    // it is bounded by the 15s beat, not a timer). This guard depends only on Postgres:
    // no Redis, no pub/sub, no internal API. Until now only the token-hash conditions
    // were covered, so the row-level ones — the exact case production exercises — were
    // asserted nowhere.
    const liveSocket = (overrides: Record<string, any> = {}) => ({
      id: 'socket-1',
      data: {
        deviceId: 'device-1',
        organizationId: 'org-1',
        deviceTokenHash: hashToken('valid-token'),
        ...overrides,
      },
      emit: jest.fn(),
      disconnect: jest.fn(),
    });

    it('should reject a device whose display row is gone (deleted while connected)', async () => {
      databaseService.display.findUnique.mockResolvedValue(null);
      const guard = new WsDeviceGuard(databaseService);
      const client = liveSocket();

      await expect(guard.canActivate(createContext(client))).rejects.toThrow(WsException);

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'device_token_stale' });
      expect(client.disconnect).toHaveBeenCalledWith(true);
      // Prove the verdict came from a real lookup, not a short-circuit on socket state.
      expect(databaseService.display.findUnique).toHaveBeenCalledWith({
        where: { id: 'device-1' },
        select: { organizationId: true, isDisabled: true, jwtToken: true },
      });
    });

    it('should reject a device the operator has disabled', async () => {
      databaseService.display.findUnique.mockResolvedValue({
        id: 'device-1',
        organizationId: 'org-1',
        isDisabled: true,
        jwtToken: hashToken('valid-token'),
      } as any);
      const guard = new WsDeviceGuard(databaseService);
      const client = liveSocket();

      await expect(guard.canActivate(createContext(client))).rejects.toThrow(WsException);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject a device whose row was reassigned to another organization', async () => {
      // Token hash still matches — only the tenant moved. Without this condition a
      // reassigned device would keep streaming its former tenant's content.
      databaseService.display.findUnique.mockResolvedValue({
        id: 'device-1',
        organizationId: 'org-2',
        isDisabled: false,
        jwtToken: hashToken('valid-token'),
      } as any);
      const guard = new WsDeviceGuard(databaseService);
      const client = liveSocket();

      await expect(guard.canActivate(createContext(client))).rejects.toThrow(WsException);
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject device sockets whose token hash is no longer current', async () => {
      const guard = new WsDeviceGuard(databaseService);
      const client = {
        id: 'socket-1',
        data: {
          deviceId: 'device-1',
          organizationId: 'org-1',
          deviceTokenHash: hashToken('stale-token'),
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      await expect(guard.canActivate(createContext(client))).rejects.toThrow(WsException);

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'device_token_stale' });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should reject device sockets when the stored token hash is malformed', async () => {
      databaseService.display.findUnique.mockResolvedValueOnce({
        id: 'device-1',
        organizationId: 'org-1',
        isDisabled: false,
        jwtToken: 'legacy-plaintext-token',
      } as any);
      const guard = new WsDeviceGuard(databaseService);
      const client = {
        id: 'socket-1',
        data: {
          deviceId: 'device-1',
          organizationId: 'org-1',
          deviceTokenHash: hashToken('valid-token'),
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      await expect(guard.canActivate(createContext(client))).rejects.toThrow(WsException);

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'device_token_stale' });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });

    it('should allow device sockets whose token hash is still current', async () => {
      const guard = new WsDeviceGuard(databaseService);
      const client = {
        id: 'socket-1',
        data: {
          deviceId: 'device-1',
          organizationId: 'org-1',
          deviceTokenHash: hashToken('valid-token'),
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      await expect(guard.canActivate(createContext(client))).resolves.toBe(true);
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should revalidate every guarded device message so re-pair invalidates immediately', async () => {
      const guard = new WsDeviceGuard(databaseService);
      const client = {
        id: 'socket-1',
        data: {
          deviceId: 'device-1',
          organizationId: 'org-1',
          deviceTokenHash: hashToken('valid-token'),
        },
        emit: jest.fn(),
        disconnect: jest.fn(),
      };

      await expect(guard.canActivate(createContext(client))).resolves.toBe(true);
      databaseService.display.findUnique.mockResolvedValueOnce({
        id: 'device-1',
        organizationId: 'org-1',
        isDisabled: false,
        jwtToken: hashToken('new-current-token'),
      } as any);
      await expect(guard.canActivate(createContext(client))).rejects.toThrow(WsException);

      expect(databaseService.display.findUnique).toHaveBeenCalledTimes(2);
      expect(client.emit).toHaveBeenCalledWith('error', { message: 'device_token_stale' });
      expect(client.disconnect).toHaveBeenCalledWith(true);
    });
  });
});
