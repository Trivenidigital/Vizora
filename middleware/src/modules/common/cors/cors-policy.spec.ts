import type { Request } from 'express';
import {
  buildCorsOptionsDelegate,
  isDeviceNullOriginRoute,
  resolveDeviceNullOriginFlag,
} from './cors-policy';

function req(method: string, url: string, headers: Record<string, string> = {}): Request {
  return { method, url, originalUrl: url, headers } as unknown as Request;
}

function decide(
  delegate: ReturnType<typeof buildCorsOptionsDelegate>,
  r: Request,
): unknown {
  let out: unknown;
  delegate(r, (_err, options) => { out = options; });
  return out;
}

describe('resolveDeviceNullOriginFlag', () => {
  it('is enabled only by the exact string "enabled"', () => {
    expect(resolveDeviceNullOriginFlag({ DEVICE_NULL_ORIGIN_CORS: 'enabled' })).toEqual({ enabled: true });
  });

  it('absent or empty is disabled with nothing to warn about', () => {
    expect(resolveDeviceNullOriginFlag({})).toEqual({ enabled: false });
    expect(resolveDeviceNullOriginFlag({ DEVICE_NULL_ORIGIN_CORS: '' })).toEqual({ enabled: false });
  });

  it.each(['true', '1', 'Enabled', 'ENABLED', ' enabled', 'enabled ', 'on'])(
    '%j is disabled and reported as unrecognised',
    (value) => {
      expect(resolveDeviceNullOriginFlag({ DEVICE_NULL_ORIGIN_CORS: value })).toEqual({
        enabled: false,
        unrecognisedValue: value,
      });
    },
  );
});

describe('isDeviceNullOriginRoute', () => {
  it.each([
    ['POST', '/api/v1/devices/pairing/request'],
    ['GET', '/api/v1/devices/pairing/status/AbC123'],
    ['GET', '/api/v1/devices/auth/check'],
    ['GET', '/api/v1/devices/me/content'],
    ['GET', '/api/v1/devices/me/content?x=1'],
    ['GET', '/api/v1/device-content/0d4c3a3e-7b0a-4b9e-8f7e-1a2b3c4d5e6f/file'],
  ])('allows %s %s', (method, url) => {
    expect(isDeviceNullOriginRoute(req(method, url))).toBe(true);
  });

  it.each([
    ['POST', '/api/v1/devices/pairing/complete'],
    ['GET', '/api/v1/devices/pairing/active'],
    ['GET', '/api/v1/displays'],
    ['GET', '/api/v1/displays/abc/pair'],
    ['GET', '/api/v1/devices/auth/check/x'],
    ['GET', '/api/v1/devices/auth/checkx'],
    ['GET', '/prefix/api/v1/devices/auth/check'],
    ['GET', '/api/devices/auth/check'],
    ['GET', '/api/v1/devices/pairing/status/ab_c'],
    ['GET', '/api/v1/devices/pairing/status/'],
    ['GET', '/api/v1/devices/pairing/request'],
    ['POST', '/api/v1/devices/auth/check'],
    ['DELETE', '/api/v1/devices/auth/check'],
    ['GET', '/api/v1/device-content/abc/file/x'],
    ['GET', '/api/v1/displays?next=/api/v1/devices/auth/check'],
  ])('denies %s %s', (method, url) => {
    expect(isDeviceNullOriginRoute(req(method, url))).toBe(false);
  });

  it('a preflight is judged by Access-Control-Request-Method, not OPTIONS', () => {
    const url = '/api/v1/devices/auth/check';
    expect(isDeviceNullOriginRoute(req('OPTIONS', url, { 'access-control-request-method': 'GET' }))).toBe(true);
    expect(isDeviceNullOriginRoute(req('OPTIONS', url, { 'access-control-request-method': 'DELETE' }))).toBe(false);
    expect(isDeviceNullOriginRoute(req('OPTIONS', url))).toBe(false);
  });
});

describe('buildCorsOptionsDelegate', () => {
  // The literal object main.ts passed to enableCors before this module.
  const legacy = (isRestrictedEnv: boolean, corsOrigins: string[]) => ({
    origin: isRestrictedEnv ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  });

  it.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])('restricted=%s flag=%s: non-null origins get the legacy options unchanged', (restricted, flag) => {
    const origins = ['https://vizora.cloud'];
    const d = buildCorsOptionsDelegate({ corsOrigins: origins, isRestrictedEnv: restricted, deviceNullOriginEnabled: flag });
    for (const origin of [undefined, 'https://vizora.cloud', 'NULL', 'file://', ' null']) {
      const headers: Record<string, string> = origin === undefined ? {} : { origin };
      expect(decide(d, req('GET', '/api/v1/devices/auth/check', headers))).toEqual(legacy(restricted, origins));
    }
  });

  it('Origin null on an allowlisted route with the flag on gets the uncredentialed device policy', () => {
    const d = buildCorsOptionsDelegate({ corsOrigins: [], isRestrictedEnv: true, deviceNullOriginEnabled: true });
    expect(decide(d, req('GET', '/api/v1/devices/auth/check', { origin: 'null' }))).toEqual({
      origin: 'null',
      credentials: false,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    });
  });

  it('Origin null anywhere else, or with the flag off, gets origin:false', () => {
    const on = buildCorsOptionsDelegate({ corsOrigins: [], isRestrictedEnv: true, deviceNullOriginEnabled: true });
    const off = buildCorsOptionsDelegate({ corsOrigins: [], isRestrictedEnv: false, deviceNullOriginEnabled: false });
    expect(decide(on, req('GET', '/api/v1/displays', { origin: 'null' }))).toEqual({ origin: false });
    expect(decide(off, req('GET', '/api/v1/devices/auth/check', { origin: 'null' }))).toEqual({ origin: false });
  });
});
