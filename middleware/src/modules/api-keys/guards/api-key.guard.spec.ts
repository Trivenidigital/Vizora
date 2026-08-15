import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { ApiKeysService } from '../api-keys.service';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let mockApiKeysService: jest.Mocked<ApiKeysService>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  /**
   * The org relation rides along on validateKey's single query (B2), so every
   * fixture here carries it. Entitled by default — an API-capable plan is the
   * precondition for the pre-existing valid-key assertions below.
   */
  const keyWithPlan = (subscriptionTier: string, subscriptionStatus: string) => ({
    id: 'key-123',
    name: 'Test API Key',
    prefix: 'vz_live_',
    hashedKey: 'hashed-key',
    scopes: ['read:all', 'write:content'],
    lastUsedAt: null,
    expiresAt: null,
    revokedAt: null,
    organizationId: 'org-123',
    createdById: 'user-123',
    createdAt: new Date(),
    organization: { subscriptionTier, subscriptionStatus },
  });

  const mockApiKey = keyWithPlan('pro', 'active');

  const originalGateEnv = process.env.API_KEY_ENTITLEMENT_GATE_ENABLED;

  afterEach(() => {
    if (originalGateEnv === undefined) {
      delete process.env.API_KEY_ENTITLEMENT_GATE_ENABLED;
    } else {
      process.env.API_KEY_ENTITLEMENT_GATE_ENABLED = originalGateEnv;
    }
  });

  beforeEach(() => {
    // Deterministic default: gate ACTIVE (absent env == enabled).
    delete process.env.API_KEY_ENTITLEMENT_GATE_ENABLED;

    mockApiKeysService = {
      create: jest.fn(),
      findAll: jest.fn(),
      validateKey: jest.fn(),
      revoke: jest.fn(),
      updateLastUsed: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockRequest = {
      headers: {},
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;

    guard = new ApiKeyGuard(mockApiKeysService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return false when no API key header is present', async () => {
      mockRequest.headers = {};

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
      expect(mockApiKeysService.validateKey).not.toHaveBeenCalled();
    });

    it('should return false when API key is invalid', async () => {
      mockRequest.headers = { 'x-api-key': 'vz_live_invalid' };
      mockApiKeysService.validateKey.mockResolvedValue(null);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
      expect(mockApiKeysService.validateKey).toHaveBeenCalledWith('vz_live_invalid');
    });

    it('should return true and set request context for valid API key', async () => {
      const validKey = 'vz_live_validkey12345678901234567890123';
      mockRequest.headers = { 'x-api-key': validKey };
      mockApiKeysService.validateKey.mockResolvedValue(mockApiKey);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockApiKeysService.validateKey).toHaveBeenCalledWith(validKey);
      expect(mockRequest.organizationId).toBe('org-123');
      expect(mockRequest.apiKeyScopes).toEqual(['read:all', 'write:content']);
      expect(mockRequest.apiKeyId).toBe('key-123');
    });

    it('should update lastUsed timestamp for valid key', async () => {
      const validKey = 'vz_live_validkey12345678901234567890123';
      mockRequest.headers = { 'x-api-key': validKey };
      mockApiKeysService.validateKey.mockResolvedValue(mockApiKey);

      await guard.canActivate(mockExecutionContext);

      // Wait a tick for the fire-and-forget to execute
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockApiKeysService.updateLastUsed).toHaveBeenCalledWith('key-123');
    });

    it('should return false for revoked key', async () => {
      mockRequest.headers = { 'x-api-key': 'vz_live_revokedkey' };
      mockApiKeysService.validateKey.mockResolvedValue(null); // Revoked keys return null

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
    });

    it('should return false for expired key', async () => {
      mockRequest.headers = { 'x-api-key': 'vz_live_expiredkey' };
      mockApiKeysService.validateKey.mockResolvedValue(null); // Expired keys return null

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(false);
    });

    it('should handle updateLastUsed errors silently', async () => {
      const validKey = 'vz_live_validkey12345678901234567890123';
      mockRequest.headers = { 'x-api-key': validKey };
      mockApiKeysService.validateKey.mockResolvedValue(mockApiKey);
      mockApiKeysService.updateLastUsed.mockRejectedValue(new Error('DB error'));

      // Should not throw and should return true
      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });
  });

  /**
   * B2 — entitlement gate.
   *
   * The gate lives HERE rather than on any route, because ApiKeyGuard is the
   * single api-key authentication path in the codebase: JwtAuthGuard delegates
   * to it and nothing else validates a key. Every current and future
   * @AllowApiKey route therefore inherits this check with no per-route wiring
   * to forget.
   */
  describe('entitlement gate (B2)', () => {
    const validKey = 'vz_live_validkey12345678901234567890123';

    beforeEach(() => {
      mockRequest.headers = { 'x-api-key': validKey };
    });

    const expectDenied = async () => {
      await expect(guard.canActivate(mockExecutionContext)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    };

    describe('entitled plans are allowed', () => {
      it.each([
        ['pro', 'active'],
        ['enterprise', 'active'],
        // Dunning rungs that keep access, per the B3 ladder.
        ['pro', 'past_due'],
        ['pro', 'publish_locked'],
      ])('allows tier=%s status=%s', async (tier, status) => {
        mockApiKeysService.validateKey.mockResolvedValue(keyWithPlan(tier, status) as any);

        await expect(guard.canActivate(mockExecutionContext)).resolves.toBe(true);
      });
    });

    describe('unentitled plans are denied with 403', () => {
      it('denies a free org holding a valid key — the downgrade case', async () => {
        mockApiKeysService.validateKey.mockResolvedValue(keyWithPlan('free', 'active') as any);

        await expectDenied();
      });

      it.each([
        ['basic', 'active'],
        // Fresh signup: orgs trial on the free tier, so trials deny naturally.
        ['free', 'trial'],
        ['pro', 'suspended'],
        ['pro', 'canceled'],
      ])('denies tier=%s status=%s', async (tier, status) => {
        mockApiKeysService.validateKey.mockResolvedValue(keyWithPlan(tier, status) as any);

        await expectDenied();
      });

      it('fails closed when the organization relation is missing', async () => {
        const orphan = { ...mockApiKey, organization: null };
        mockApiKeysService.validateKey.mockResolvedValue(orphan as any);

        await expectDenied();
      });

      it('THROWS rather than returning false, so the response is 403 not 401', async () => {
        mockApiKeysService.validateKey.mockResolvedValue(keyWithPlan('free', 'active') as any);

        // JwtAuthGuard turns a `false` return into 401 "Invalid API key". A
        // valid credential lacking entitlement must not be reported that way.
        const outcome = await guard.canActivate(mockExecutionContext).catch((err) => err);

        expect(outcome).toBeInstanceOf(ForbiddenException);
        expect((outcome as ForbiddenException).getStatus()).toBe(403);
        expect((outcome as ForbiddenException).message).not.toMatch(/invalid api key/i);
      });

      it('denies BEFORE binding a tenant principal to request.user', async () => {
        mockApiKeysService.validateKey.mockResolvedValue(keyWithPlan('free', 'active') as any);

        await expectDenied();

        expect(mockRequest.user).toBeUndefined();
        expect(mockRequest.organizationId).toBeUndefined();
        expect(mockRequest.apiKeyScopes).toBeUndefined();
      });

      it('does not stamp lastUsedAt for a denied key', async () => {
        mockApiKeysService.validateKey.mockResolvedValue(keyWithPlan('free', 'active') as any);

        await expectDenied();
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(mockApiKeysService.updateLastUsed).not.toHaveBeenCalled();
      });
    });

    describe('denial log', () => {
      it('records org/key ids and plan tokens but NEVER key material', async () => {
        const warn = jest.spyOn(guard['logger'], 'warn').mockImplementation(() => undefined);
        mockApiKeysService.validateKey.mockResolvedValue(keyWithPlan('free', 'active') as any);

        await expectDenied();

        expect(warn).toHaveBeenCalledTimes(1);
        const line = warn.mock.calls[0][0] as string;

        expect(line).toContain('api_key_entitlement_denied');
        expect(line).toContain('org=org-123');
        expect(line).toContain('keyId=key-123');
        expect(line).toContain('tier=free');
        expect(line).toContain('status=active');

        // Canary: neither the presented secret nor its stored hash may leak.
        expect(line).not.toContain(validKey);
        expect(line).not.toContain('validkey');
        expect(line).not.toContain('hashed-key');

        warn.mockRestore();
      });
    });

    describe('kill switch', () => {
      it("lets an unentitled org through when explicitly set to 'false'", async () => {
        process.env.API_KEY_ENTITLEMENT_GATE_ENABLED = 'false';
        mockApiKeysService.validateKey.mockResolvedValue(keyWithPlan('free', 'active') as any);

        await expect(guard.canActivate(mockExecutionContext)).resolves.toBe(true);
        expect(mockRequest.user).toMatchObject({ organizationId: 'org-123' });
      });

      it('is ACTIVE when the variable is unset (enabled by default)', async () => {
        delete process.env.API_KEY_ENTITLEMENT_GATE_ENABLED;
        mockApiKeysService.validateKey.mockResolvedValue(keyWithPlan('free', 'active') as any);

        await expectDenied();
      });

      it.each(['true', 'FALSE', '0', '', 'no'])(
        'stays ACTIVE for the non-disabling value %p — only exact \'false\' disables',
        async (value) => {
          process.env.API_KEY_ENTITLEMENT_GATE_ENABLED = value;
          mockApiKeysService.validateKey.mockResolvedValue(keyWithPlan('free', 'active') as any);

          await expectDenied();
        },
      );

      it('is read at call time, so a mid-process env change takes effect', async () => {
        mockApiKeysService.validateKey.mockResolvedValue(keyWithPlan('free', 'active') as any);

        await expectDenied();

        process.env.API_KEY_ENTITLEMENT_GATE_ENABLED = 'false';
        await expect(guard.canActivate(mockExecutionContext)).resolves.toBe(true);
      });
    });

    describe('unchanged behavior', () => {
      it('still returns false (401 path) for an invalid key, entitlement notwithstanding', async () => {
        mockApiKeysService.validateKey.mockResolvedValue(null);

        await expect(guard.canActivate(mockExecutionContext)).resolves.toBe(false);
      });

      it('binds the full principal for an entitled key', async () => {
        mockApiKeysService.validateKey.mockResolvedValue(mockApiKey);

        await expect(guard.canActivate(mockExecutionContext)).resolves.toBe(true);
        expect(mockRequest.user).toEqual({
          organizationId: 'org-123',
          authType: 'api-key',
          apiKeyId: 'key-123',
          apiKeyScopes: ['read:all', 'write:content'],
          isSuperAdmin: false,
          role: undefined,
        });
      });
    });
  });
});
