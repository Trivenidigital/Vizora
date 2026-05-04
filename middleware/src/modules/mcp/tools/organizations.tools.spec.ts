import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { listOnboardingCandidatesTool } from './organizations.tools';
import type { McpRequestContext } from '../auth/mcp-context';

function ctx(opts: {
  scopes: string[];
  organizationId?: string | null;
}): McpRequestContext {
  return {
    tokenId: 'tok_1',
    organizationId: opts.organizationId === undefined ? null : opts.organizationId,
    agentName: 'hermes-customer-lifecycle',
    scopes: opts.scopes,
  };
}

function makeOrgs(rows: Array<Record<string, unknown>>) {
  return {
    listOnboardingCandidates: jest.fn().mockResolvedValue(rows),
  };
}

describe('listOnboardingCandidatesTool', () => {
  it('throws ForbiddenException when scope missing', async () => {
    await expect(
      listOnboardingCandidatesTool({}, ctx({ scopes: [] }), makeOrgs([]) as never),
    ).rejects.toThrow(ForbiddenException);
  });

  it('REJECTS per-org tokens with BadRequest (INVALID_INPUT) — platform-only tool', async () => {
    const orgScopedCtx = ctx({ scopes: ['customer:read'], organizationId: 'org_1' });
    await expect(
      listOnboardingCandidatesTool({}, orgScopedCtx, makeOrgs([]) as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts platform-scope tokens (organizationId=null)', async () => {
    const platformCtx = ctx({ scopes: ['customer:read'], organizationId: null });
    const out = await listOnboardingCandidatesTool(
      {},
      platformCtx,
      makeOrgs([
        {
          organizationId: 'o1',
          tier: 'pro',
          daysSinceSignup: 5,
          milestoneFlags: {
            welcomed: true,
            screenPaired: false,
            contentUploaded: false,
            playlistCreated: false,
            scheduleCreated: false,
          },
          nudgesSent: { day1: false, day3: false, day7: false },
        },
      ]) as never,
    );
    expect(out.candidates).toHaveLength(1);
    expect(out.total).toBe(1);
  });

  it('returns wire-shape (snake_case) with milestone_flags / nudges_sent renamed', async () => {
    const platformCtx = ctx({ scopes: ['customer:read'], organizationId: null });
    const out = await listOnboardingCandidatesTool(
      {},
      platformCtx,
      makeOrgs([
        {
          organizationId: 'o1',
          tier: 'enterprise',
          daysSinceSignup: 3,
          milestoneFlags: {
            welcomed: true,
            screenPaired: true,
            contentUploaded: false,
            playlistCreated: false,
            scheduleCreated: false,
          },
          nudgesSent: { day1: true, day3: false, day7: false },
        },
      ]) as never,
    );
    expect(out.candidates[0]).toEqual({
      organization_id: 'o1',
      tier: 'enterprise',
      days_since_signup: 3,
      milestone_flags: {
        welcomed: true,
        screen_paired: true,
        content_uploaded: false,
        playlist_created: false,
        schedule_created: false,
      },
      nudges_sent: { day1: true, day3: false, day7: false },
    });
  });

  it('NEVER returns org name, admin email, billing fields, or any free-text — D13 contract enforced at the wire shape', async () => {
    const platformCtx = ctx({ scopes: ['customer:read'], organizationId: null });
    // Service tries to leak — Zod schema must strip these
    const leaky = {
      listOnboardingCandidates: jest.fn().mockResolvedValue([
        {
          organizationId: 'o1',
          tier: 'pro',
          daysSinceSignup: 5,
          milestoneFlags: {
            welcomed: true,
            screenPaired: false,
            contentUploaded: false,
            playlistCreated: false,
            scheduleCreated: false,
          },
          nudgesSent: { day1: false, day3: false, day7: false },
          // PII a buggy service might leak
          name: 'Acme Corp',
          adminEmail: 'admin@acme.example',
          subscriptionStatus: 'active',
          billingAccountId: 'cus_xyz123',
        },
      ]),
    };
    const out = await listOnboardingCandidatesTool({}, platformCtx, leaky as never);
    const row = out.candidates[0] as Record<string, unknown>;
    expect(row).not.toHaveProperty('name');
    expect(row).not.toHaveProperty('adminEmail');
    expect(row).not.toHaveProperty('subscription_status');
    expect(row).not.toHaveProperty('billing_account_id');
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('Acme Corp');
    expect(serialized).not.toContain('admin@acme.example');
    expect(serialized).not.toContain('cus_xyz123');
  });

  it('forwards lookback_days + limit to the service', async () => {
    const platformCtx = ctx({ scopes: ['customer:read'], organizationId: null });
    const svc = makeOrgs([]);
    await listOnboardingCandidatesTool(
      { lookback_days: 7, limit: 50 },
      platformCtx,
      svc as never,
    );
    expect(svc.listOnboardingCandidates).toHaveBeenCalledWith({
      lookbackDays: 7,
      limit: 50,
    });
  });

  it('rejects lookback_days > 90 via Zod', async () => {
    const platformCtx = ctx({ scopes: ['customer:read'], organizationId: null });
    await expect(
      listOnboardingCandidatesTool(
        { lookback_days: 365 },
        platformCtx,
        makeOrgs([]) as never,
      ),
    ).rejects.toThrow();
  });
});
