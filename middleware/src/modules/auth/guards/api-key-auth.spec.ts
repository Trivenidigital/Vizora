import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ScopesGuard } from './scopes.guard';

/**
 * Proof obligations for API-key authentication on the one enabled route.
 *
 * Each is paired with the mutation that must break it. The binding has no
 * second layer behind it — the tenant guard passes reads and defaults to
 * non-blocking — so a test that still passes under its mutation proves nothing.
 */

const ctx = (request: any, meta: Record<string, any> = {}) => ({
  switchToHttp: () => ({ getRequest: () => request }),
  getHandler: () => 'handler',
  getClass: () => 'class',
  __meta: meta,
}) as any;

const reflectorFor = (meta: Record<string, any>) => ({
  getAllAndOverride: (key: string) => meta[key],
}) as any;

describe('API-key authentication', () => {
  // B2: an entitled org — these tests are about opt-in and precedence, which
  // only come into play once the entitlement gate has passed. The gate is
  // covered in api-keys/guards/api-key.guard.spec.ts.
  const validKey = {
    id: 'key-1',
    organizationId: 'org-A',
    scopes: ['read:content'],
    organization: { subscriptionTier: 'pro', subscriptionStatus: 'active' },
  };

  const apiKeyGuardFor = (record: any) => {
    const service = {
      validateKey: jest.fn().mockResolvedValue(record),
      updateLastUsed: jest.fn().mockResolvedValue(undefined),
    } as any;
    // Real ApiKeyGuard so the principal it builds is the one under test.
    const { ApiKeyGuard } = require('../../api-keys/guards/api-key.guard');
    return new ApiKeyGuard(service);
  };

  describe('opt-in and precedence', () => {
    it('binds the API-key principal on a route that opted in', async () => {
      // MUTATION: remove @AllowApiKey (allowApiKey: false) -> falls through to
      // JWT and the key is ignored entirely.
      const guard = new JwtAuthGuard(reflectorFor({ allowApiKey: true }), apiKeyGuardFor(validKey));
      const request: any = { headers: { 'x-api-key': 'vz_live_x' } };

      await expect(guard.canActivate(ctx(request))).resolves.toBe(true);
      expect(request.user.organizationId).toBe('org-A');
      expect(request.user.authType).toBe('api-key');
    });

    it('rejects an invalid key rather than falling back to a session', async () => {
      // A silent fall-through would let a broken integration appear to work as
      // whichever human happened to be signed in.
      const guard = new JwtAuthGuard(reflectorFor({ allowApiKey: true }), apiKeyGuardFor(null));
      const request: any = { headers: { 'x-api-key': 'vz_live_revoked' } };

      await expect(guard.canActivate(ctx(request))).rejects.toThrow(UnauthorizedException);
      expect(request.user).toBeUndefined();
    });

    it('resolves JWT + API key together to exactly one principal, key-first', async () => {
      const guard = new JwtAuthGuard(reflectorFor({ allowApiKey: true }), apiKeyGuardFor(validKey));
      const request: any = {
        headers: { 'x-api-key': 'vz_live_x', cookie: 'access_token=jwt-for-org-B' },
        user: { organizationId: 'org-B', role: 'admin', id: 'user-1' },
      };

      await expect(guard.canActivate(ctx(request))).resolves.toBe(true);

      // Exactly one principal survives, and it is the key's — not a blend.
      expect(request.user.authType).toBe('api-key');
      expect(request.user.organizationId).toBe('org-A');
      expect(request.user.role).toBeUndefined();
      expect('id' in request.user).toBe(false);
    });

    it('leaves a route that did not opt in on JWT only', async () => {
      // Fail-closed: dropping @AllowApiKey reverts to the session path rather
      // than leaving the route open, which @Public() + a composite would not.
      const guard = new JwtAuthGuard(reflectorFor({}), apiKeyGuardFor(validKey));
      const request: any = { headers: { 'x-api-key': 'vz_live_x' } };
      const superCalled = jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
        .mockReturnValue(true as any);

      await guard.canActivate(ctx(request));

      expect(superCalled).toHaveBeenCalled();
      expect(request.user).toBeUndefined();
      superCalled.mockRestore();
    });

    it('leaves a public route untouched', async () => {
      const guard = new JwtAuthGuard(reflectorFor({ isPublic: true }), apiKeyGuardFor(validKey));
      const request: any = { headers: { 'x-api-key': 'vz_live_x' } };

      // Returns synchronously on this path — the guard is only async when it
      // actually takes the api-key branch, so that the global request path
      // keeps its existing synchronous-throw contract.
      expect(await guard.canActivate(ctx(request))).toBe(true);
      expect(request.user).toBeUndefined();
    });
  });

  describe('scopes', () => {
    it('allows an API-key principal holding the required scope', () => {
      const guard = new ScopesGuard(reflectorFor({ requiredScopes: ['read:content'] }));
      const request = { user: { authType: 'api-key', apiKeyScopes: ['read:content'] } };

      expect(guard.canActivate(ctx(request))).toBe(true);
    });

    it('denies an API-key principal missing the required scope', () => {
      // MUTATION: bypass the scope check -> this passes and the eight scopes
      // advertised in the UI go back to gating nothing.
      const guard = new ScopesGuard(reflectorFor({ requiredScopes: ['read:content'] }));
      const request = { user: { authType: 'api-key', apiKeyScopes: ['read:displays'] } };

      expect(() => guard.canActivate(ctx(request))).toThrow(ForbiddenException);
    });

    it('does not apply key scopes to a human session', () => {
      // Applying them would silently lock the dashboard out of its own routes.
      const guard = new ScopesGuard(reflectorFor({ requiredScopes: ['read:content'] }));
      const request = { user: { organizationId: 'org-A', role: 'admin', id: 'user-1' } };

      expect(guard.canActivate(ctx(request))).toBe(true);
    });

    it('accepts read:all for a read requirement — it is the UI default', () => {
      // MUTATION: drop the read:all superset rule -> this fails, and a key
      // created by accepting the defaults is refused by the only endpoint that
      // accepts keys.
      const guard = new ScopesGuard(reflectorFor({ requiredScopes: ['read:content'] }));
      const request = { user: { authType: 'api-key', apiKeyScopes: ['read:all'] } };

      expect(guard.canActivate(ctx(request))).toBe(true);
    });

    it('does NOT let read:all satisfy a write requirement', () => {
      // Widening a route from read to write must not silently inherit
      // authorization from a key issued for reading.
      const guard = new ScopesGuard(reflectorFor({ requiredScopes: ['write:content'] }));
      const request = { user: { authType: 'api-key', apiKeyScopes: ['read:all'] } };

      expect(() => guard.canActivate(ctx(request))).toThrow(ForbiddenException);
    });

    it('is inert on routes declaring no scopes', () => {
      const guard = new ScopesGuard(reflectorFor({}));
      expect(guard.canActivate(ctx({ user: { authType: 'api-key', apiKeyScopes: [] } }))).toBe(true);
    });
  });
});

describe('API-key auth — degraded and malformed inputs', () => {
  const ctx2 = (request: any) => ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => 'handler',
    getClass: () => 'class',
  }) as any;
  const reflector2 = (meta: Record<string, any>) => ({
    getAllAndOverride: (key: string) => meta[key],
  }) as any;

  it('falls back to JWT when ApiKeyGuard is unavailable, rather than erroring or opening', () => {
    // The guard is the global APP_GUARD; a DI regression must not open a route.
    const guard = new JwtAuthGuard(reflector2({ allowApiKey: true }), undefined);
    const request: any = { headers: { 'x-api-key': 'vz_live_x' } };
    const superSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue(true as any);

    guard.canActivate(ctx2(request));

    expect(superSpy).toHaveBeenCalled();
    expect(request.user).toBeUndefined();
    superSpy.mockRestore();
  });

  it('ignores a duplicated x-api-key header, which arrives as an array', async () => {
    // `['a','b']` is truthy; without a string check it would reach validateKey
    // as an array and the comparison semantics are not obvious.
    const service = { validateKey: jest.fn(), updateLastUsed: jest.fn() } as any;
    const { ApiKeyGuard } = require('../../api-keys/guards/api-key.guard');
    const guard = new JwtAuthGuard(reflector2({ allowApiKey: true }), new ApiKeyGuard(service));
    const request: any = { headers: { 'x-api-key': ['vz_a', 'vz_b'] } };
    const superSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue(true as any);

    await guard.canActivate(ctx2(request));

    expect(service.validateKey).not.toHaveBeenCalled();
    expect(request.user).toBeUndefined();
    superSpy.mockRestore();
  });

  it('ignores an empty x-api-key header', async () => {
    const service = { validateKey: jest.fn(), updateLastUsed: jest.fn() } as any;
    const { ApiKeyGuard } = require('../../api-keys/guards/api-key.guard');
    const guard = new JwtAuthGuard(reflector2({ allowApiKey: true }), new ApiKeyGuard(service));
    const request: any = { headers: { 'x-api-key': '' } };
    const superSpy = jest
      .spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate')
      .mockReturnValue(true as any);

    await guard.canActivate(ctx2(request));

    expect(service.validateKey).not.toHaveBeenCalled();
    superSpy.mockRestore();
  });
});
