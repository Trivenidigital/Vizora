import { ForbiddenException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { SuperAdminGuard } from '../../admin/guards/super-admin.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';

/**
 * The API-key principal is the entire tenant boundary for anything an API key
 * can reach, and this codebase gives it no second layer:
 *
 *   - tenant-guard.ts:155 explicitly PASSES all reads, and defaults to the
 *     non-blocking 'log' mode anyway;
 *   - @CurrentUser is a bare optional-chain read, so an absent organizationId
 *     yields `undefined`;
 *   - buildContentListWhere spreads that straight into a Prisma `where`, and
 *     Prisma treats `undefined` as "no filter" — an unscoped, HTTP 200
 *     cross-tenant read.
 *
 * So these tests assert on the BINDING itself, and each one is paired with the
 * mutation that must break it. A test that still passes when the binding is
 * removed proves nothing.
 */

const ctxFor = (request: any) => ({
  switchToHttp: () => ({ getRequest: () => request }),
  getHandler: () => undefined,
  getClass: () => undefined,
}) as any;

describe('ApiKeyGuard — principal binding', () => {
  const keyRecord = {
    id: 'key-1',
    organizationId: 'org-A',
    scopes: ['content:read'],
  };

  const buildGuard = () => {
    const apiKeysService = {
      validateKey: jest.fn().mockResolvedValue(keyRecord),
      updateLastUsed: jest.fn().mockResolvedValue(undefined),
    } as any;
    return { guard: new ApiKeyGuard(apiKeysService), apiKeysService };
  };

  it('binds the org to request.user, the contract controllers actually consume', async () => {
    // MUTATION: drop `request.user = principal` -> this fails, and every
    // org-scoped query silently goes global.
    const { guard } = buildGuard();
    const request: any = { headers: { 'x-api-key': 'vz_live_x' } };

    await guard.canActivate(ctxFor(request));

    expect(request.user).toBeDefined();
    expect(request.user.organizationId).toBe('org-A');
  });

  it('never carries an `id`, so an API key cannot be escalated to super-admin', async () => {
    /*
     * SuperAdminGuard reads request.user?.id and RE-QUERIES the database for
     * that user's isSuperAdmin — it never trusts the flag on the principal.
     * ApiKey.createdById is a real user FK, so an `id` added for nicer audit
     * logs would let it look that human up. Absence is the control.
     */
    const { guard } = buildGuard();
    const request: any = { headers: { 'x-api-key': 'vz_live_x' } };

    await guard.canActivate(ctxFor(request));

    expect('id' in request.user).toBe(false);
    expect(request.user.id).toBeUndefined();
  });

  it('is denied by SuperAdminGuard, which throws before any DB lookup', async () => {
    const { guard } = buildGuard();
    const request: any = { headers: { 'x-api-key': 'vz_live_x' } };
    await guard.canActivate(ctxFor(request));

    const db = { user: { findUnique: jest.fn() } } as any;
    const superAdmin = new SuperAdminGuard(db);

    await expect(superAdmin.canActivate(ctxFor(request))).rejects.toThrow(ForbiddenException);
    // The absence of `id` must short-circuit BEFORE the lookup — if this ever
    // reaches the DB, the escalation path is live again.
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('carries role: undefined, so a @Roles route denies by construction', async () => {
    // RolesGuard compares with strict ===, so undefined never matches a role.
    const { guard } = buildGuard();
    const request: any = { headers: { 'x-api-key': 'vz_live_x' } };
    await guard.canActivate(ctxFor(request));

    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(['admin']) } as any;
    const roles = new RolesGuard(reflector);

    expect(() => roles.canActivate(ctxFor(request))).toThrow(ForbiddenException);
  });

  it('states isSuperAdmin as present-and-false rather than omitting it', async () => {
    // A truthy value short-circuits tenant derivation to a global bypass, so
    // this is asserted explicitly rather than left to absence.
    const { guard } = buildGuard();
    const request: any = { headers: { 'x-api-key': 'vz_live_x' } };
    await guard.canActivate(ctxFor(request));

    expect(request.user.isSuperAdmin).toBe(false);
    expect(request.user.authType).toBe('api-key');
    expect(request.user.apiKeyScopes).toEqual(['content:read']);
  });

  it('sets no principal at all when the key is absent or rejected', async () => {
    // validateKey already filters revokedAt: null and unexpired keys, so a
    // revoked or expired key arrives here as null.
    const apiKeysService = {
      validateKey: jest.fn().mockResolvedValue(null),
      updateLastUsed: jest.fn(),
    } as any;
    const guard = new ApiKeyGuard(apiKeysService);

    const rejected: any = { headers: { 'x-api-key': 'vz_live_revoked' } };
    expect(await guard.canActivate(ctxFor(rejected))).toBe(false);
    expect(rejected.user).toBeUndefined();

    const missing: any = { headers: {} };
    expect(await guard.canActivate(ctxFor(missing))).toBe(false);
    expect(missing.user).toBeUndefined();
  });
});
