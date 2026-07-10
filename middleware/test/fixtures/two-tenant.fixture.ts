/**
 * B12 — canonical two-tenant fixture for isolation + revocation E2E.
 *
 * Builds the scenario the audit called for: two tenants, each with a paired
 * device + content + playlist + an active (overlapping) schedule; tenant B on a
 * lapsed subscription; and tenant A additionally owns one deliberately-revoked
 * device (disabled) so the revocation leg has a genuine 410 subject.
 *
 * Reusable across E2E specs. All helpers drive the real HTTP API (via supertest)
 * so assertions exercise the deployed request path, not mocks.
 */
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import type { DatabaseService } from '../../src/modules/database/database.service';

type Envelope<T> = { success: boolean; data: T };
export const dataOf = <T>(body: Envelope<T>): T => {
  if (!body.success) throw new Error(`Expected success envelope, got ${JSON.stringify(body)}`);
  return body.data;
};

const cookieHeaderFromSetCookie = (setCookie: string | string[] | undefined): string => {
  const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return cookies.map((c) => c.split(';')[0]).join('; ');
};

const withoutCsrfCookie = (cookieHeader: string): string =>
  cookieHeader.split(';').map((c) => c.trim()).filter((c) => c && !c.startsWith('vizora_csrf_token=')).join('; ');

async function csrfHeaders(app: INestApplication) {
  const res = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
  return {
    Cookie: cookieHeaderFromSetCookie(res.headers['set-cookie']),
    'X-CSRF-Token': String(res.headers['x-csrf-token']),
  };
}

export async function browserCsrfHeaders(app: INestApplication, authCookie: string) {
  const csrf = await csrfHeaders(app);
  return {
    Cookie: [withoutCsrfCookie(authCookie), csrf.Cookie].filter(Boolean).join('; '),
    'X-CSRF-Token': csrf['X-CSRF-Token'],
  };
}

export interface TenantHandle {
  organizationId: string;
  userId: string;
  email: string;
  password: string;
  authCookie: string;
  authToken: string;
  device: { displayId: string; deviceIdentifier: string; deviceToken: string };
  contentId: string;
  playlistId: string;
  scheduleId: string;
  /** tenant A only: a paired-then-disabled device for the 410 revocation test. */
  revokedDeviceToken?: string;
  revokedDisplayId?: string;
}

async function registerAndLogin(app: INestApplication, suffix: string, ts: number) {
  const email = `b12-${suffix}-${ts}@example.com`;
  const password = 'SecureP@ssw0rd!';
  const reg = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ email, password, firstName: 'B12', lastName: `Tenant-${suffix}`, organizationName: `B12 ${suffix} ${ts}`, organizationSlug: `b12-${suffix}-${ts}` })
    .expect(201);
  const regData = dataOf<{ user: { id: string; organizationId: string } }>(reg.body);
  const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201);
  const loginData = dataOf<{ access_token: string }>(login.body);
  return {
    userId: regData.user.id,
    organizationId: regData.user.organizationId,
    email,
    password,
    authToken: loginData.access_token,
    authCookie: cookieHeaderFromSetCookie(login.headers['set-cookie']),
  };
}

/**
 * Re-login for a fresh session cookie. A captured cookie works for writes while
 * fresh, but a `pairing/complete` (a `@RequiresSubscription` write) reusing an
 * older captured cookie after intervening activity 401s — so any late-in-suite
 * pairing must re-authenticate rather than reuse a stashed cookie.
 */
export async function freshLogin(app: INestApplication, email: string, password: string): Promise<string> {
  const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201);
  return cookieHeaderFromSetCookie(login.headers['set-cookie']);
}

async function pairDevice(app: INestApplication, authCookie: string, suffix: string, ts: number) {
  const deviceIdentifier = `b12-${suffix}-dev-${ts}`;
  const reqRes = await request(app.getHttpServer())
    .post('/api/v1/devices/pairing/request')
    .send({ deviceIdentifier, nickname: `B12 ${suffix}`, metadata: { platform: 'e2e' } })
    .expect(201);
  const code = dataOf<{ code: string }>(reqRes.body).code;
  const complete = await request(app.getHttpServer())
    .post('/api/v1/devices/pairing/complete')
    .set(await browserCsrfHeaders(app, authCookie))
    .send({ code, nickname: `B12 ${suffix}`, location: 'B12 Lab' })
    .expect(201);
  const displayId = (complete.body as { display: { id: string } }).display.id;
  const status = await request(app.getHttpServer()).get(`/api/v1/devices/pairing/status/${code}`).expect(200);
  const s = dataOf<{ deviceToken: string; deviceId: string }>(status.body);
  return { displayId, deviceIdentifier, deviceToken: s.deviceToken, code };
}

async function publishSchedule(app: INestApplication, authCookie: string, displayId: string, suffix: string, ts: number) {
  const contentRes = await request(app.getHttpServer())
    .post('/api/v1/content')
    .set(await browserCsrfHeaders(app, authCookie))
    .send({ name: `B12 ${suffix} Content`, type: 'url', url: `https://example.com/b12-${suffix}-${ts}`, duration: 10 })
    .expect(201);
  const contentId = dataOf<{ id: string }>(contentRes.body).id;

  const playlistRes = await request(app.getHttpServer())
    .post('/api/v1/playlists')
    .set(await browserCsrfHeaders(app, authCookie))
    .send({ name: `B12 ${suffix} Playlist`, loop: true, items: [{ contentId, duration: 10 }] })
    .expect(201);
  const playlistId = dataOf<{ id: string }>(playlistRes.body).id;

  // Overlapping schedule: active now, all days — both tenants' schedules overlap.
  const startDate = new Date(Date.now() - 60_000).toISOString();
  const scheduleRes = await request(app.getHttpServer())
    .post('/api/v1/schedules')
    .set(await browserCsrfHeaders(app, authCookie))
    .send({ name: `B12 ${suffix} Schedule`, startDate, daysOfWeek: [0, 1, 2, 3, 4, 5, 6], isActive: true, priority: 100, playlistId, displayId })
    .expect(201);
  const scheduleId = dataOf<{ id: string }>(scheduleRes.body).id;
  return { contentId, playlistId, scheduleId };
}

export interface TwoTenantFixture {
  tenantA: TenantHandle;
  tenantB: TenantHandle;
  organizationIds: string[];
  userIds: string[];
  pairingCodes: string[];
}

export async function setupTwoTenants(
  app: INestApplication,
  db: DatabaseService,
  ts: number,
): Promise<TwoTenantFixture> {
  const organizationIds: string[] = [];
  const userIds: string[] = [];
  const pairingCodes: string[] = [];

  const buildTenant = async (suffix: string): Promise<TenantHandle> => {
    const acct = await registerAndLogin(app, suffix, ts);
    organizationIds.push(acct.organizationId);
    userIds.push(acct.userId);
    const dev = await pairDevice(app, acct.authCookie, suffix, ts);
    pairingCodes.push(dev.code);
    const pub = await publishSchedule(app, acct.authCookie, dev.displayId, suffix, ts);
    return {
      organizationId: acct.organizationId,
      userId: acct.userId,
      email: acct.email,
      password: acct.password,
      authCookie: acct.authCookie,
      authToken: acct.authToken,
      device: { displayId: dev.displayId, deviceIdentifier: dev.deviceIdentifier, deviceToken: dev.deviceToken },
      contentId: pub.contentId,
      playlistId: pub.playlistId,
      scheduleId: pub.scheduleId,
    };
  };

  const tenantA = await buildTenant('a');

  // Tenant A: one deliberately-revoked device (paired then disabled) — the
  // genuine 410 subject for the revocation leg. Paired here, while A's session
  // cookie is fresh, then disabled.
  const revoked = await pairDevice(app, tenantA.authCookie, 'a-revoked', ts);
  pairingCodes.push(revoked.code);
  await db.display.update({ where: { id: revoked.displayId }, data: { isDisabled: true } });
  tenantA.revokedDeviceToken = revoked.deviceToken;
  tenantA.revokedDisplayId = revoked.displayId;

  const tenantB = await buildTenant('b');

  // Tenant B: lapsed subscription (past_due, mid-ladder) — the "one lapsed
  // subscription" element. Kept credentialed; entitlement is separate from auth.
  await db.organization.update({
    where: { id: tenantB.organizationId },
    data: { subscriptionStatus: 'past_due', entitlementStateSince: new Date() },
  });

  return { tenantA, tenantB, organizationIds, userIds, pairingCodes };
}

export async function teardownFixture(db: DatabaseService, fx: TwoTenantFixture) {
  // Deleting the users then orgs is enough — Display/Content/Playlist/Schedule
  // cascade off Organization. Pairing Redis keys carry a TTL and expire on their own.
  for (const id of fx.userIds) await db.user.delete({ where: { id } }).catch(() => {});
  for (const id of fx.organizationIds) await db.organization.delete({ where: { id } }).catch(() => {});
}
