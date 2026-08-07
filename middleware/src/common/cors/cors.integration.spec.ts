/**
 * Full-stack CORS integration tests.
 *
 * These boot a real NestExpressApplication wired with the SAME production
 * pieces main.ts uses — helmet, the scoped CORP override, and
 * `app.enableCors(createCorsDelegate())` — and assert on the FINAL response
 * headers after every middleware has run.
 *
 * That end-to-end shape is the point: an earlier design layered a custom
 * null-origin middleware in front of a static `credentials: true` cors(),
 * which emitted `Access-Control-Allow-Origin: null` together with
 * `Access-Control-Allow-Credentials: true`. Unit tests of the custom
 * middleware alone passed. Only a final-response assertion catches it.
 *
 * No database is required: a stub controller supplies the routes, because CORS
 * is decided by path and origin, not by the handler.
 */
import { Controller, Get, Module, Post } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import request from 'supertest';
import {
  createCorsDelegate,
  isDeviceContentPath,
  isNullOriginCorsEnabled,
} from './cors-policy';

const BROWSER_ORIGIN = 'https://dashboard.vizora.io';

@Controller()
class StubController {
  @Post('devices/pairing/request') pairingRequest() { return { ok: true }; }
  @Get('devices/pairing/status/:code') pairingStatus() { return { ok: true }; }
  @Get('devices/auth/check') authCheck() { return { ok: true }; }
  @Get('device-content/:id/file') deviceContent() { return { ok: true }; }
  @Post('devices/pairing/complete') pairingComplete() { return { ok: true }; }
  @Get('devices/pairing/active') pairingActive() { return { ok: true }; }
  @Get('displays') displays() { return { ok: true }; }
  @Get('content') content() { return { ok: true }; }
}

@Module({ controllers: [StubController] })
class StubModule {}

/** Mirrors main.ts bootstrap order exactly for the parts that affect CORS/CORP. */
async function createApp(
  env: Record<string, string | undefined>,
): Promise<{ app: NestExpressApplication; restoreEnv: () => void }> {
  const previous = { ...process.env };
  Object.assign(process.env, env);
  // Ensure an unset flag really is unset (fail-closed default under test).
  if (env.DEVICE_NULL_ORIGIN_CORS === undefined) delete process.env.DEVICE_NULL_ORIGIN_CORS;

  const app = await NestFactory.create<NestExpressApplication>(StubModule, { logger: false });
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production',
    crossOriginEmbedderPolicy: false,
  }));
  if (isNullOriginCorsEnabled()) {
    app.use((req: Request, res: Response, next: NextFunction) => {
      if (isDeviceContentPath(req.originalUrl || req.url)) {
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      }
      next();
    });
  }
  app.enableCors(createCorsDelegate());
  app.setGlobalPrefix('api/v1');
  await app.init();

  // Returned rather than attached to `app`: the Nest application object is a
  // Proxy that refuses arbitrary property writes.
  const restoreEnv = () => {
    for (const key of Object.keys(env)) delete process.env[key];
    Object.assign(process.env, previous);
  };
  return { app, restoreEnv };
}

const ACAO = 'access-control-allow-origin';
const ACAC = 'access-control-allow-credentials';

const DEVICE_ROUTES: Array<{ method: 'get' | 'post'; path: string }> = [
  { method: 'post', path: '/api/v1/devices/pairing/request' },
  { method: 'get', path: '/api/v1/devices/pairing/status/ABC123' },
  { method: 'get', path: '/api/v1/devices/auth/check' },
  { method: 'get', path: '/api/v1/device-content/abc/file' },
];

const EXCLUDED_ROUTES: Array<{ method: 'get' | 'post'; path: string }> = [
  { method: 'post', path: '/api/v1/devices/pairing/complete' },
  { method: 'get', path: '/api/v1/devices/pairing/active' },
  { method: 'get', path: '/api/v1/displays' },
  { method: 'get', path: '/api/v1/content' },
];

describe('CORS integration — flag ENABLED', () => {
  let app: NestExpressApplication;
  let restoreEnv: () => void;

  beforeAll(async () => {
    ({ app, restoreEnv } = await createApp({
      NODE_ENV: 'production',
      CORS_ORIGIN: BROWSER_ORIGIN,
      DEVICE_NULL_ORIGIN_CORS: 'enabled',
    }));
  });

  afterAll(async () => {
    restoreEnv();
    await app.close();
  });

  describe('device routes accept a null origin without credentials', () => {
    it.each(DEVICE_ROUTES)('$method $path', async ({ method, path }) => {
      const res = await request(app.getHttpServer())[method](path).set('Origin', 'null');
      expect(res.headers[ACAO]).toBe('null');
      expect(res.headers[ACAC]).toBeUndefined();
      expect(res.headers['vary']).toContain('Origin');
    });

    it('answers the pairing preflight with 204 and no credentials', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/v1/devices/pairing/request')
        .set('Origin', 'null')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');
      expect(res.status).toBe(204);
      expect(res.headers[ACAO]).toBe('null');
      expect(res.headers[ACAC]).toBeUndefined();
      expect(res.headers['access-control-allow-headers'].toLowerCase()).toContain('content-type');
      expect(res.headers['access-control-max-age']).toBe('600');
    });

    it('answers the auth-check preflight (Authorization header)', async () => {
      const res = await request(app.getHttpServer())
        .options('/api/v1/devices/auth/check')
        .set('Origin', 'null')
        .set('Access-Control-Request-Method', 'GET')
        .set('Access-Control-Request-Headers', 'authorization');
      expect(res.status).toBe(204);
      expect(res.headers[ACAO]).toBe('null');
      expect(res.headers[ACAC]).toBeUndefined();
      expect(res.headers['access-control-allow-headers'].toLowerCase()).toContain('authorization');
    });
  });

  describe('excluded routes grant a null origin nothing', () => {
    it.each(EXCLUDED_ROUTES)('$method $path', async ({ method, path }) => {
      const res = await request(app.getHttpServer())[method](path).set('Origin', 'null');
      expect(res.headers[ACAO]).toBeUndefined();
      expect(res.headers[ACAC]).toBeUndefined();
    });

    it.each(EXCLUDED_ROUTES)('preflight $path', async ({ method, path }) => {
      const res = await request(app.getHttpServer())
        .options(path)
        .set('Origin', 'null')
        .set('Access-Control-Request-Method', method.toUpperCase());
      expect(res.headers[ACAO]).toBeUndefined();
      expect(res.headers[ACAC]).toBeUndefined();
    });
  });

  // THE security invariant: blanket, exhaustive, both verbs.
  it('NEVER returns Access-Control-Allow-Credentials for any null-origin request', async () => {
    for (const { method, path } of [...DEVICE_ROUTES, ...EXCLUDED_ROUTES]) {
      const actual = await request(app.getHttpServer())[method](path).set('Origin', 'null');
      expect(actual.headers[ACAC]).toBeUndefined();

      const preflight = await request(app.getHttpServer())
        .options(path)
        .set('Origin', 'null')
        .set('Access-Control-Request-Method', method.toUpperCase());
      expect(preflight.headers[ACAC]).toBeUndefined();
    }
  });

  it('rejects path-prefix bypass attempts', async () => {
    for (const path of [
      '/evil/api/v1/devices/auth/check',
      '/api/v1/devices/pairing/requestX',
    ]) {
      const res = await request(app.getHttpServer())
        .options(path)
        .set('Origin', 'null')
        .set('Access-Control-Request-Method', 'GET');
      expect(res.headers[ACAO]).toBeUndefined();
      expect(res.headers[ACAC]).toBeUndefined();
    }
  });

  it('does not accept file:// as a null origin', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/devices/auth/check')
      .set('Origin', 'file://');
    expect(res.headers[ACAO]).toBeUndefined(); // not in the browser allowlist either
  });

  describe('browser clients are unaffected', () => {
    it('keeps ACAO and credentials on a cookie-authenticated route', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/displays')
        .set('Origin', BROWSER_ORIGIN);
      expect(res.headers[ACAO]).toBe(BROWSER_ORIGIN);
      expect(res.headers[ACAC]).toBe('true');
    });

    it('keeps credentials for a browser origin on a device route', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/devices/pairing/status/ABC123')
        .set('Origin', BROWSER_ORIGIN);
      expect(res.headers[ACAO]).toBe(BROWSER_ORIGIN);
      expect(res.headers[ACAC]).toBe('true');
    });

    it('grants an unknown origin no ACAO', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/displays')
        .set('Origin', 'https://evil.example');
      expect(res.headers[ACAO]).toBeUndefined();
    });
  });

  describe('CORP is relaxed only on the device-content route', () => {
    it('sets cross-origin on device-content', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/device-content/abc/file');
      expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
    });

    it.each(['/api/v1/displays', '/api/v1/devices/auth/check', '/api/v1/content'])(
      'leaves helmet default same-origin on %s',
      async (path) => {
        const res = await request(app.getHttpServer()).get(path);
        expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
      },
    );
  });
});

describe('CORS integration — flag DISABLED (default)', () => {
  let app: NestExpressApplication;
  let restoreEnv: () => void;

  beforeAll(async () => {
    // DEVICE_NULL_ORIGIN_CORS intentionally omitted → fail-closed default
    ({ app, restoreEnv } = await createApp({ NODE_ENV: 'production', CORS_ORIGIN: BROWSER_ORIGIN }));
  });

  afterAll(async () => {
    restoreEnv();
    await app.close();
  });

  it.each(DEVICE_ROUTES)('grants a null origin nothing on $path', async ({ method, path }) => {
    const res = await request(app.getHttpServer())[method](path).set('Origin', 'null');
    expect(res.headers[ACAO]).toBeUndefined();
    expect(res.headers[ACAC]).toBeUndefined();
  });

  it('leaves CORP at helmet default on device-content', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/device-content/abc/file');
    expect(res.headers['cross-origin-resource-policy']).toBe('same-origin');
  });

  it('still serves browser clients normally', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/displays')
      .set('Origin', BROWSER_ORIGIN);
    expect(res.headers[ACAO]).toBe(BROWSER_ORIGIN);
    expect(res.headers[ACAC]).toBe('true');
  });
});
