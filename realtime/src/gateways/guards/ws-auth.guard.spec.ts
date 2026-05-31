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

    it('should reuse a fresh token validation within the short guard cache window', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(1_000);
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
      await expect(guard.canActivate(createContext(client))).resolves.toBe(true);

      expect(databaseService.display.findUnique).toHaveBeenCalledTimes(1);
      jest.restoreAllMocks();
    });
  });
});
