import { Test, TestingModule } from '@nestjs/testing';
import { DataRetentionService } from './data-retention.service';
import { DatabaseService } from '../database/database.service';

describe('DataRetentionService', () => {
  let service: DataRetentionService;
  let db: DatabaseService;

  const mockDeleteMany = jest.fn().mockResolvedValue({ count: 0 });

  beforeEach(async () => {
    mockDeleteMany.mockClear().mockResolvedValue({ count: 0 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataRetentionService,
        {
          provide: DatabaseService,
          useValue: {
            auditLog: { deleteMany: mockDeleteMany },
            notification: { deleteMany: mockDeleteMany },
            passwordResetToken: { deleteMany: mockDeleteMany },
          },
        },
      ],
    }).compile();

    service = module.get<DataRetentionService>(DataRetentionService);
    db = module.get<DatabaseService>(DatabaseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runRetentionPolicy', () => {
    it('should purge audit logs older than 90 days', async () => {
      const auditDeleteMany = jest.fn().mockResolvedValue({ count: 5 });
      (db.auditLog as any).deleteMany = auditDeleteMany;

      await service.runRetentionPolicy();

      expect(auditDeleteMany).toHaveBeenCalledTimes(1);
      const call = auditDeleteMany.mock.calls[0][0];
      expect(call.where.createdAt.lt).toBeInstanceOf(Date);

      // Verify the cutoff is approximately 90 days ago
      const cutoff = call.where.createdAt.lt as Date;
      const expectedMs = 90 * 24 * 60 * 60 * 1000;
      const actualMs = Date.now() - cutoff.getTime();
      expect(Math.abs(actualMs - expectedMs)).toBeLessThan(5000); // within 5 seconds
    });

    it('should purge dismissed notifications older than 30 days', async () => {
      const notifDeleteMany = jest.fn().mockResolvedValue({ count: 3 });
      (db.notification as any).deleteMany = notifDeleteMany;

      await service.runRetentionPolicy();

      // First notification call is dismissed notifications
      const dismissedCall = notifDeleteMany.mock.calls[0][0];
      expect(dismissedCall.where.dismissedAt).toEqual({
        not: null,
        lt: expect.any(Date),
      });

      // Verify 30-day cutoff
      const cutoff = dismissedCall.where.dismissedAt.lt as Date;
      const expectedMs = 30 * 24 * 60 * 60 * 1000;
      const actualMs = Date.now() - cutoff.getTime();
      expect(Math.abs(actualMs - expectedMs)).toBeLessThan(5000);
    });

    it('should purge read non-dismissed notifications older than 30 days', async () => {
      const notifDeleteMany = jest.fn().mockResolvedValue({ count: 2 });
      (db.notification as any).deleteMany = notifDeleteMany;

      await service.runRetentionPolicy();

      // Second notification call is read (non-dismissed) notifications
      const readCall = notifDeleteMany.mock.calls[1][0];
      expect(readCall.where.read).toBe(true);
      expect(readCall.where.dismissedAt).toBeNull();
      expect(readCall.where.createdAt.lt).toBeInstanceOf(Date);
    });

    it('should purge expired password reset tokens', async () => {
      const tokenDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
      (db.passwordResetToken as any).deleteMany = tokenDeleteMany;

      await service.runRetentionPolicy();

      expect(tokenDeleteMany).toHaveBeenCalledTimes(1);
      const call = tokenDeleteMany.mock.calls[0][0];
      expect(call.where.expiresAt.lt).toBeInstanceOf(Date);
    });

    it('should handle errors gracefully without throwing', async () => {
      (db.auditLog as any).deleteMany = jest.fn().mockRejectedValue(new Error('DB down'));

      await expect(service.runRetentionPolicy()).resolves.not.toThrow();
    });

    it('should log purge counts', async () => {
      const logSpy = jest.spyOn(service['logger'], 'log');

      (db.auditLog as any).deleteMany = jest.fn().mockResolvedValue({ count: 10 });
      (db.notification as any).deleteMany = jest
        .fn()
        .mockResolvedValueOnce({ count: 5 })
        .mockResolvedValueOnce({ count: 3 });
      (db.passwordResetToken as any).deleteMany = jest.fn().mockResolvedValue({ count: 2 });

      await service.runRetentionPolicy();

      expect(logSpy).toHaveBeenCalledWith('Starting daily data retention cleanup...');
      expect(logSpy).toHaveBeenCalledWith('Purged 10 audit logs older than 90 days');
      expect(logSpy).toHaveBeenCalledWith('Purged 5 dismissed notifications older than 30 days');
      expect(logSpy).toHaveBeenCalledWith('Purged 3 read notifications older than 30 days');
      expect(logSpy).toHaveBeenCalledWith('Purged 2 expired password reset tokens');
      expect(logSpy).toHaveBeenCalledWith(
        'Data retention cleanup complete: 10 audit logs, 8 notifications, 2 tokens',
      );
    });
  });
});
