import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { DeviceAuthCheckService } from './device-auth-check.service';
import { DatabaseService } from '../database/database.service';
import { hashDeviceToken } from '../common/device-token-auth.util';

/**
 * Contract v1.1 item 4 — negative suite. These assert the fleet-safety
 * invariants: a 410 is reachable ONLY for a genuinely revoked device, transient
 * failures never become terminal codes, and cross-tenant tokens cannot 410
 * another tenant's device.
 */
describe('DeviceAuthCheckService', () => {
  let service: DeviceAuthCheckService;
  let jwt: { verify: jest.Mock };
  let db: { display: { findUnique: jest.Mock } };

  const VALID_TOKEN = 'valid.device.token';
  const validPayload = {
    sub: 'display-1',
    deviceIdentifier: 'dev-1',
    organizationId: 'org-1',
    type: 'device' as const,
  };

  beforeEach(async () => {
    jwt = { verify: jest.fn() };
    db = { display: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeviceAuthCheckService,
        { provide: JwtService, useValue: jwt },
        { provide: DatabaseService, useValue: db },
      ],
    }).compile();

    service = module.get(DeviceAuthCheckService);
    process.env.DEVICE_JWT_SECRET = 'x'.repeat(32);
  });

  const currentDisplay = (over: Record<string, unknown> = {}) => ({
    id: 'display-1',
    organizationId: 'org-1',
    isDisabled: false,
    jwtToken: hashDeviceToken(VALID_TOKEN),
    organization: { subscriptionStatus: 'active' },
    ...over,
  });

  it('200 ok for a valid, active, current device', async () => {
    jwt.verify.mockReturnValue(validPayload);
    db.display.findUnique.mockResolvedValue(currentDisplay());
    const r = await service.evaluate(VALID_TOKEN);
    expect(r).toEqual({ httpStatus: 200, body: { status: 'ok' } });
  });

  // ---- 401: transient/credential problems must NEVER be 410 ----

  it('401 AUTH_EXPIRED for an expired token — never 410', async () => {
    jwt.verify.mockImplementation(() => {
      const e = new Error('jwt expired');
      e.name = 'TokenExpiredError';
      throw e;
    });
    const r = await service.evaluate(VALID_TOKEN);
    expect(r.httpStatus).toBe(401);
    expect(r.body).toEqual({ code: 'AUTH_EXPIRED' });
    expect(db.display.findUnique).not.toHaveBeenCalled(); // no DB touch, no 410 path
  });

  it('401 AUTH_INVALID for a bad-signature token — never 410', async () => {
    jwt.verify.mockImplementation(() => {
      const e = new Error('invalid signature');
      e.name = 'JsonWebTokenError';
      throw e;
    });
    const r = await service.evaluate('garbage');
    expect(r).toEqual({ httpStatus: 401, body: { code: 'AUTH_INVALID' } });
  });

  it('401 AUTH_INVALID for a malformed payload (wrong type) — never 410', async () => {
    jwt.verify.mockReturnValue({ ...validPayload, type: 'user' });
    const r = await service.evaluate(VALID_TOKEN);
    expect(r).toEqual({ httpStatus: 401, body: { code: 'AUTH_INVALID' } });
    expect(db.display.findUnique).not.toHaveBeenCalled();
  });

  // ---- 410: only genuinely revoked device states ----

  it('410 DEVICE_REVOKED when the display row is gone (deleted)', async () => {
    jwt.verify.mockReturnValue(validPayload);
    db.display.findUnique.mockResolvedValue(null);
    const r = await service.evaluate(VALID_TOKEN);
    expect(r).toEqual({ httpStatus: 410, body: { code: 'DEVICE_REVOKED' } });
  });

  it('410 DEVICE_REVOKED when the device is admin-disabled (blocked)', async () => {
    jwt.verify.mockReturnValue(validPayload);
    db.display.findUnique.mockResolvedValue(currentDisplay({ isDisabled: true }));
    const r = await service.evaluate(VALID_TOKEN);
    expect(r.httpStatus).toBe(410);
  });

  it('410 DEVICE_REVOKED when the token was rotated away (re-pair/unpair)', async () => {
    jwt.verify.mockReturnValue(validPayload);
    db.display.findUnique.mockResolvedValue(
      currentDisplay({ jwtToken: hashDeviceToken('a-different-newer-token') }),
    );
    const r = await service.evaluate(VALID_TOKEN);
    expect(r.httpStatus).toBe(410);
  });

  // ---- cross-tenant: the mass-unpair primitive must be impossible ----

  it('does NOT 410 tenant B\'s device using tenant A\'s revoked token', async () => {
    // Tenant A's token claims org-A/display-A. The DB row it names belongs to
    // org-B now (reassigned). This is an org mismatch on the token's OWN display,
    // which is a revoked binding for THAT token — it cannot 410 an unrelated
    // display, because the lookup is keyed on the token's own `sub`.
    jwt.verify.mockReturnValue({ ...validPayload, organizationId: 'org-A' });
    db.display.findUnique.mockResolvedValue(
      currentDisplay({ organizationId: 'org-B' }),
    );
    const r = await service.evaluate(VALID_TOKEN);
    // The token's binding is stale → 410 for the token's own device only.
    expect(r.httpStatus).toBe(410);
    // Critically, the lookup was by the token's own sub — never a caller-supplied id.
    expect(db.display.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'display-1' } }),
    );
  });

  // ---- 403: reversible entitlement suspension (keeps credentials) ----

  it('403 TENANT_SUSPENDED for a valid device whose org is suspended', async () => {
    jwt.verify.mockReturnValue(validPayload);
    db.display.findUnique.mockResolvedValue(
      currentDisplay({ organization: { subscriptionStatus: 'suspended' } }),
    );
    const r = await service.evaluate(VALID_TOKEN);
    expect(r).toEqual({ httpStatus: 403, body: { code: 'TENANT_SUSPENDED' } });
  });

  it('does NOT suspend free / canceled-but-downgraded tenants (still 200)', async () => {
    for (const status of ['free', 'canceled', 'past_due', 'trial', 'active']) {
      jwt.verify.mockReturnValue(validPayload);
      db.display.findUnique.mockResolvedValue(
        currentDisplay({ organization: { subscriptionStatus: status } }),
      );
      const r = await service.evaluate(VALID_TOKEN);
      expect(r.httpStatus).toBe(200);
    }
  });

  // ---- transport-layer: infra failure must NOT become a terminal code ----

  it('propagates a DB failure (does not convert it into 401/403/410)', async () => {
    jwt.verify.mockReturnValue(validPayload);
    db.display.findUnique.mockRejectedValue(new Error('DB down'));
    await expect(service.evaluate(VALID_TOKEN)).rejects.toThrow('DB down');
  });
});
