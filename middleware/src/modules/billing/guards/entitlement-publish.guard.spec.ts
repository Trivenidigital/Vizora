import { ForbiddenException } from '@nestjs/common';
import { EntitlementPublishGuard } from './entitlement-publish.guard';

/** B3 — publish-lock gate. Blocks NEW publishing at publish_locked/suspended;
 *  allows everything else; fails OPEN on infra error (dunning tool, not security). */
describe('EntitlementPublishGuard', () => {
  const makeCtx = (organizationId?: string, body?: Record<string, unknown>) => ({
    switchToHttp: () => ({ getRequest: () => ({ user: { organizationId }, body }) }),
  }) as any;

  const guard = (status: string | null, throwOnRead = false) => {
    const db = {
      organization: {
        findUnique: throwOnRead
          ? jest.fn().mockRejectedValue(new Error('DB down'))
          : jest.fn().mockResolvedValue(status === null ? null : { subscriptionStatus: status }),
      },
    };
    return new EntitlementPublishGuard(db as any);
  };

  it('allows publishing when active', async () => {
    expect(await guard('active').canActivate(makeCtx('o1'))).toBe(true);
  });

  it('allows publishing when past_due (grace — screens play, publishing allowed)', async () => {
    expect(await guard('past_due').canActivate(makeCtx('o1'))).toBe(true);
  });

  it('BLOCKS publishing when publish_locked', async () => {
    await expect(guard('publish_locked').canActivate(makeCtx('o1'))).rejects.toThrow(ForbiddenException);
  });

  it('BLOCKS publishing when suspended', async () => {
    await expect(guard('suspended').canActivate(makeCtx('o1'))).rejects.toThrow(ForbiddenException);
  });

  it('fails OPEN on a DB error (does not block a paying customer on a blip)', async () => {
    expect(await guard('publish_locked', true).canActivate(makeCtx('o1'))).toBe(true);
  });

  it('defers to the auth guard when there is no organization on the request', async () => {
    expect(await guard('publish_locked').canActivate(makeCtx(undefined))).toBe(true);
  });

  // Fleet command carve-out: POST /fleet/commands multiplexes device commands.
  // Only `push_content` is a publish; the rest stay available while locked.
  it('allows a non-publish fleet command (reboot) even when publish_locked', async () => {
    expect(
      await guard('publish_locked').canActivate(makeCtx('o1', { command: 'reboot' })),
    ).toBe(true);
  });

  it('BLOCKS the fleet push_content command when publish_locked', async () => {
    await expect(
      guard('publish_locked').canActivate(makeCtx('o1', { command: 'push_content' })),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows the fleet push_content command when active', async () => {
    expect(
      await guard('active').canActivate(makeCtx('o1', { command: 'push_content' })),
    ).toBe(true);
  });
});
