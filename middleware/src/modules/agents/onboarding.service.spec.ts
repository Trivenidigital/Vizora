import { Test } from '@nestjs/testing';
import { OnboardingService } from './onboarding.service';
import { DatabaseService } from '../database/database.service';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let db: {
    organizationOnboarding: {
      upsert: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    db = {
      organizationOnboarding: {
        upsert: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const mod = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();
    service = mod.get(OnboardingService);
  });

  it('accepts { orgId } payload (new convention)', async () => {
    await service.onUserWelcomed({ orgId: 'o1', userId: 'u1' });
    expect(db.organizationOnboarding.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'o1' },
        update: {},
      }),
    );
  });

  it('accepts { organizationId } payload (existing convention from validation-monitor)', async () => {
    await service.onContentCreated({
      action: 'created',
      entityType: 'content',
      entityId: 'c1',
      organizationId: 'o1',
    } as unknown as { orgId: string });
    expect(db.organizationOnboarding.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'o1' } }),
    );
  });

  it('upserts with an EMPTY update to avoid overwriting an already-set timestamp (idempotent)', async () => {
    await service.onDisplayPaired({ orgId: 'o1', displayId: 'd1' });
    const call = db.organizationOnboarding.upsert.mock.calls[0][0];
    expect(call.update).toEqual({});
    expect(call.create).toHaveProperty('firstScreenPairedAt');
  });

  it('uses updateMany with null-filter to fill missing timestamp on existing rows', async () => {
    await service.onPlaylistCreated({ orgId: 'o1', playlistId: 'p1' });
    expect(db.organizationOnboarding.updateMany).toHaveBeenCalledWith({
      where: { organizationId: 'o1', firstPlaylistCreatedAt: null },
      data: expect.objectContaining({ firstPlaylistCreatedAt: expect.any(Date) }),
    });
  });

  it('does nothing and does not throw when orgId missing (publisher bug)', async () => {
    await service.onUserWelcomed({ orgId: '', userId: 'u1' });
    expect(db.organizationOnboarding.upsert).not.toHaveBeenCalled();
  });

  it('swallows DB errors (fire-and-forget) so publisher is never impacted', async () => {
    db.organizationOnboarding.upsert.mockRejectedValueOnce(new Error('boom'));
    await expect(
      service.onScheduleCreated({ orgId: 'o1', scheduleId: 's1' }),
    ).resolves.toBeUndefined();
  });
});
