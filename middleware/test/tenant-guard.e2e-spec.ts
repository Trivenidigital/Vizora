import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DatabaseModule } from '../src/modules/database/database.module';
import { DatabaseService } from '../src/modules/database/database.service';
import { runWithTenantContext } from '../src/modules/database/tenant-context';

/**
 * Proves the tenant-guard chain end-to-end at the data layer: a bound
 * AsyncLocalStorage tenant context reaches the Prisma $use hook (getTenantContext)
 * during an awaited query, and the guard acts on it. This is the link the pure
 * evaluateTenantOp unit tests can't cover (that the ALS scope actually propagates
 * across the await into the hook).
 *
 * Runs in log mode (NODE_ENV=test → non-prod default), so the guard only warns —
 * safe to run against real rows.
 */
describe('tenant-guard wiring (e2e, log mode)', () => {
  let db: DatabaseService;
  let warnSpy: jest.SpyInstance;

  beforeAll(async () => {
    const mod: TestingModule = await Test.createTestingModule({ imports: [DatabaseModule] }).compile();
    db = mod.get(DatabaseService);
    await db.onModuleInit();
  }, 60000);

  afterAll(async () => { await db.$disconnect(); });

  beforeEach(() => { warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined as never); });
  afterEach(() => { warnSpy.mockRestore(); });

  const guardWarned = () =>
    warnSpy.mock.calls.some((c) => typeof c[0] === 'string' && c[0].includes('[tenant-guard]'));

  it('bound tenant context reaches the $use hook — a bare-id write on a guarded model WARNS', async () => {
    await runWithTenantContext({ organizationId: 'org-ghost', bypass: false }, async () => {
      // Bare-id updateMany (no organizationId) on a guarded model, no rows matched.
      await db.playlist.updateMany({ where: { id: 'does-not-exist' }, data: { name: 'x' } });
    });
    expect(guardWarned()).toBe(true);
  });

  it('a bypass context does NOT warn (admin/system escape hatch)', async () => {
    await runWithTenantContext({ organizationId: null, bypass: true }, async () => {
      await db.playlist.updateMany({ where: { id: 'does-not-exist' }, data: { name: 'x' } });
    });
    expect(guardWarned()).toBe(false);
  });

  it('an org-scoped write does NOT warn', async () => {
    await runWithTenantContext({ organizationId: 'org-ghost', bypass: false }, async () => {
      await db.playlist.updateMany({ where: { id: 'x', organizationId: 'org-ghost' }, data: { name: 'x' } });
    });
    expect(guardWarned()).toBe(false);
  });

  it('a non-guarded model (Organization) does NOT warn even with a bare where', async () => {
    await runWithTenantContext({ organizationId: 'org-ghost', bypass: false }, async () => {
      await db.organization.updateMany({ where: { id: 'does-not-exist' }, data: {} });
    });
    expect(guardWarned()).toBe(false);
  });
});
