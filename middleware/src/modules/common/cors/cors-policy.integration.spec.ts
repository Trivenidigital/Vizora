/**
 * Full-stack CORS integration tests.
 *
 * Boots a real Nest express application and wires it with `applyHttpSecurity`
 * — the same function main.ts calls — so helmet and the
 * real `cors` package run exactly as in production. Every assertion is on the
 * FINAL response headers.
 *
 * That shape is the point: PR #385 layered a null-origin middleware in front of
 * a static `credentials: true` cors(), and its own unit tests passed while the
 * real stack emitted `ACAO: null` + `ACAC: true`. Only a final-header
 * assertion catches that.
 *
 * A stub controller supplies the routes: CORS is decided by method, path and
 * origin before routing, not by the handler. CORP on media responses is set
 * by DeviceContentController itself and pinned in its controller spec.
 */
import { Controller, Get, INestApplication, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { applyHttpSecurity } from './cors-policy';

const DASHBOARD = 'https://vizora.cloud';
const CONTENT_ID = 'cmabc1234567890abcdefghij';

@Controller()
class StubController {
  @Post('devices/pairing/request') pairingRequest() { return { ok: true }; }
  @Get('devices/pairing/status/:code') pairingStatus() { return { ok: true }; }
  @Get('devices/auth/check') authCheck() { return { ok: true }; }
  @Get('devices/me/content') meContent() { return { ok: true }; }
  @Get('device-content/:id/file') file() { return { ok: true }; }
  @Post('devices/pairing/complete') pairingComplete() { return { ok: true }; }
  @Get('devices/pairing/active') pairingActive() { return { ok: true }; }
  @Get('displays') displays() { return { ok: true }; }
}

@Module({ controllers: [StubController] })
class StubModule {}

type Method = 'GET' | 'POST';
interface Case { method: Method; path: string }

const ALLOWED: Case[] = [
  { method: 'POST', path: '/api/v1/devices/pairing/request' },
  { method: 'GET', path: '/api/v1/devices/pairing/status/ABC123' },
  { method: 'GET', path: '/api/v1/devices/auth/check' },
  { method: 'GET', path: '/api/v1/devices/me/content' },
  { method: 'GET', path: '/api/v1/devices/me/content?since=2026-10-01' },
  { method: 'GET', path: `/api/v1/device-content/${CONTENT_ID}/file` },
];

const DENIED: Case[] = [
  { method: 'POST', path: '/api/v1/devices/pairing/complete' },
  { method: 'GET', path: '/api/v1/devices/pairing/active' },
  { method: 'GET', path: '/api/v1/displays' },
  { method: 'GET', path: '/api/v1/devices/auth/check/x' },
  { method: 'GET', path: '/api/v1/devices/auth/checkx' },
  { method: 'GET', path: '/x/api/v1/devices/auth/check' },
  { method: 'GET', path: '/api/devices/auth/check' },
  { method: 'GET', path: '/api/v1/devices/pairing/status/ABC123/x' },
  { method: 'GET', path: '/api/v1/devices/pairing/status/' },
  { method: 'GET', path: '/api/v1/devices/pairing/request' }, // wrong method
  { method: 'POST', path: '/api/v1/devices/auth/check' }, // wrong method
  { method: 'GET', path: `/api/v1/device-content/${CONTENT_ID}/filex` },
  { method: 'GET', path: '/api/v1/displays?x=/api/v1/devices/auth/check' },
];

async function boot(env: NodeJS.ProcessEnv): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ controllers: [], imports: [StubModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  applyHttpSecurity(app, env);
  app.setGlobalPrefix('api/v1');
  await app.init();
  return app;
}

function send(app: INestApplication, c: Case, origin: string | undefined) {
  const agent = request(app.getHttpServer());
  const r = c.method === 'POST' ? agent.post(c.path) : agent.get(c.path);
  return origin === undefined ? r : r.set('Origin', origin);
}

function preflight(app: INestApplication, path: string, method: string | undefined, origin = 'null') {
  const r = request(app.getHttpServer()).options(path).set('Origin', origin);
  return method === undefined ? r : r.set('Access-Control-Request-Method', method);
}

const PROD_ON = { NODE_ENV: 'production', CORS_ORIGIN: DASHBOARD, DEVICE_NULL_ORIGIN_CORS: 'enabled' };
const PROD_OFF = { NODE_ENV: 'production', CORS_ORIGIN: DASHBOARD };

describe('HTTP CORS — real stack (helmet + cors + Nest)', () => {
  const apps: INestApplication[] = [];
  const start = async (env: NodeJS.ProcessEnv) => {
    const app = await boot(env);
    apps.push(app);
    return app;
  };
  afterAll(async () => {
    await Promise.all(apps.map((a) => a.close()));
  });

  describe('flag ENABLED, Origin: null', () => {
    let app: INestApplication;
    beforeAll(async () => { app = await start(PROD_ON); });

    it.each(ALLOWED)('allowlisted $method $path: preflight grants ACAO null, no ACAC', async (c) => {
      const res = await preflight(app, c.path, c.method);
      expect(res.status).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('null');
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      expect(res.headers['access-control-allow-methods']).toBe('GET,POST');
      expect(res.headers['access-control-allow-headers']).toBe('Authorization,Content-Type');
      expect(res.headers['access-control-max-age']).toBe('600');
    });

    it.each(ALLOWED)('allowlisted $method $path: actual request gets ACAO null, no ACAC', async (c) => {
      const res = await send(app, c, 'null');
      expect(res.headers['access-control-allow-origin']).toBe('null');
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it.each(DENIED)('non-allowlisted $method $path: no ACAO, no ACAC (preflight + actual)', async (c) => {
      const pre = await preflight(app, c.path, c.method);
      expect(pre.headers['access-control-allow-origin']).toBeUndefined();
      expect(pre.headers['access-control-allow-credentials']).toBeUndefined();
      const res = await send(app, c, 'null');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it.each(['DELETE', 'PUT', 'PATCH', 'OPTIONS'])(
      'preflight asking for %s on an allowlisted path is rejected',
      async (m) => {
        const res = await preflight(app, '/api/v1/devices/auth/check', m);
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
        expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      },
    );

    it('preflight with no Access-Control-Request-Method is rejected', async () => {
      const res = await preflight(app, '/api/v1/devices/auth/check', undefined);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });

    it('preflight asking for POST on a GET-only allowlisted path is rejected', async () => {
      const res = await preflight(app, '/api/v1/devices/me/content', 'POST');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    // ' null' is not listed: HTTP strips optional whitespace around a header
    // value, so the server receives exactly 'null' (measured). The pure
    // delegate test in cors-policy.spec.ts covers the untrimmed string.
    it.each(['NULL', 'file://', 'Null', 'nul', 'null null'])(
      'Origin %j is not treated as null: normal (restricted) policy rejects it',
      async (origin) => {
        const res = await send(app, ALLOWED[2], origin);
        expect(res.headers['access-control-allow-origin']).toBeUndefined();
      },
    );

    it('missing Origin is not treated as null: no ACAO', async () => {
      const res = await send(app, ALLOWED[2], undefined);
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('flag DISABLED, Origin: null', () => {
    it.each([
      ['absent', PROD_OFF],
      ['"true"', { ...PROD_OFF, DEVICE_NULL_ORIGIN_CORS: 'true' }],
      ['"Enabled"', { ...PROD_OFF, DEVICE_NULL_ORIGIN_CORS: 'Enabled' }],
      ['"enabled " (trailing space)', { ...PROD_OFF, DEVICE_NULL_ORIGIN_CORS: 'enabled ' }],
    ])('flag %s: no ACAO and no ACAC on any path', async (_label, env) => {
      const app = await start(env);
      for (const c of [...ALLOWED, ...DENIED]) {
        const pre = await preflight(app, c.path, c.method);
        const res = await send(app, c, 'null');
        for (const r of [pre, res]) {
          expect({ c, acao: r.headers['access-control-allow-origin'] }).toEqual({ c, acao: undefined });
          expect({ c, acac: r.headers['access-control-allow-credentials'] }).toEqual({ c, acac: undefined });
        }
      }
    });
  });

  describe('dashboard origin is unchanged', () => {
    it.each([
      ['flag on', PROD_ON],
      ['flag off', PROD_OFF],
    ])('%s: %s gets ACAO + ACAC true on preflight and actual', async (_label, env) => {
      const app = await start(env);
      const pre = await preflight(app, '/api/v1/displays', 'DELETE', DASHBOARD);
      expect(pre.status).toBe(204);
      expect(pre.headers['access-control-allow-origin']).toBe(DASHBOARD);
      expect(pre.headers['access-control-allow-credentials']).toBe('true');
      expect(pre.headers['access-control-allow-methods']).toBe('GET,POST,PATCH,PUT,DELETE,OPTIONS');
      expect(pre.headers['access-control-allow-headers']).toBe(
        'Content-Type,Authorization,X-Requested-With,X-CSRF-Token',
      );
      for (const c of [...ALLOWED, ...DENIED]) {
        const res = await send(app, c, DASHBOARD);
        expect({ c, acao: res.headers['access-control-allow-origin'] }).toEqual({ c, acao: DASHBOARD });
        expect({ c, acac: res.headers['access-control-allow-credentials'] }).toEqual({ c, acac: 'true' });
      }
    });

    it('an unlisted origin is still rejected in a restricted env', async () => {
      const app = await start(PROD_ON);
      const res = await send(app, ALLOWED[2], 'https://evil.example');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('development (unrestricted) still reflects any non-null origin with credentials', async () => {
      const app = await start({ NODE_ENV: 'development', DEVICE_NULL_ORIGIN_CORS: 'enabled' });
      const res = await send(app, ALLOWED[2], 'http://localhost:3001');
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3001');
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  // The invariant, swept over every environment shape and flag state.
  describe('INVARIANT: no response to Origin: null ever carries ACAC', () => {
    it.each([
      ['production, flag on', PROD_ON],
      ['production, flag off', PROD_OFF],
      ['development, flag on', { NODE_ENV: 'development', DEVICE_NULL_ORIGIN_CORS: 'enabled' }],
      ['development, flag off', { NODE_ENV: 'development' }],
      ['staging, flag on', { NODE_ENV: 'staging', CORS_ORIGIN: DASHBOARD, DEVICE_NULL_ORIGIN_CORS: 'enabled' }],
    ])('%s', async (_label, env) => {
      const app = await start(env);
      for (const c of [...ALLOWED, ...DENIED]) {
        for (const m of [c.method, 'DELETE', undefined]) {
          const pre = await preflight(app, c.path, m);
          expect({ c, m, acac: pre.headers['access-control-allow-credentials'] }).toEqual({ c, m, acac: undefined });
        }
        const res = await send(app, c, 'null');
        expect({ c, acac: res.headers['access-control-allow-credentials'] }).toEqual({ c, acac: undefined });
      }
    });
  });

  // Evidence for what the delegate actually sees: the cors middleware is
  // app-level and runs before routing, so the global prefix is present in the
  // path and the query string is still attached to originalUrl.
  describe('request shape inside the cors delegate', () => {
    it('sees the full prefixed path; originalUrl carries the query string', async () => {
      const seen: Array<{ path: string; originalUrl: string; url: string }> = [];
      const moduleRef = await Test.createTestingModule({ imports: [StubModule] }).compile();
      const app = moduleRef.createNestApplication({ logger: false });
      app.enableCors((req: import('express').Request, cb: (e: Error | null, o: object) => void) => {
        seen.push({ path: req.path, originalUrl: req.originalUrl, url: req.url });
        cb(null, { origin: false });
      });
      app.setGlobalPrefix('api/v1');
      await app.init();
      apps.push(app);
      await request(app.getHttpServer()).get('/api/v1/devices/me/content?since=1').set('Origin', 'null');
      expect(seen).toEqual([
        {
          path: '/api/v1/devices/me/content',
          originalUrl: '/api/v1/devices/me/content?since=1',
          url: '/api/v1/devices/me/content?since=1',
        },
      ]);
    });
  });
});
