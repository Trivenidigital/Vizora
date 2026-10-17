import type { NextFunction, Request, Response } from 'express';
import {
  deviceNullOriginCors,
  isDeviceNullOriginRequest,
} from './device-null-origin';

/**
 * The security property under test is narrowness, so most of this file is negative
 * cases. A version of this middleware that simply answered every null-origin request
 * would satisfy the happy paths and hand a `file://` page the operator API.
 */
describe('device null-origin CORS', () => {
  const P = {
    pairingRequest: '/api/v1/devices/pairing/request',
    pairingStatus: '/api/v1/devices/pairing/status/A1B2C3',
    authCheck: '/api/v1/devices/auth/check',
    meContent: '/api/v1/devices/me/content',
    contentFile: '/api/v1/device-content/abc-123/file',
    // Same controller prefix as the two device pairing endpoints, but operator-only
    // and cookie-authenticated. The reason this is an exact-path allowlist.
    pairingComplete: '/api/v1/devices/pairing/complete',
    pairingActive: '/api/v1/devices/pairing/active',
  };

  describe('the allowlist predicate', () => {
    it.each([
      ['POST', P.pairingRequest],
      ['GET', P.pairingStatus],
      ['GET', P.authCheck],
      ['GET', P.meContent],
      ['GET', P.contentFile],
    ])('admits %s %s — an endpoint the TV client actually calls', (m, p) => {
      expect(isDeviceNullOriginRequest(m, p)).toBe(true);
    });

    it.each([
      ['POST', P.pairingComplete, 'operator pairing completion (RolesGuard + session)'],
      ['GET', P.pairingActive, 'operator pairing list'],
      ['GET', '/api/v1/displays', 'dashboard displays'],
      ['POST', '/api/v1/auth/login', 'user login'],
      ['GET', '/api/v1/auth/me', 'session identity'],
      ['GET', '/api/v1/admin/security/api-keys', 'admin surface'],
      ['POST', '/api/v1/content/upload', 'content upload'],
      ['GET', '/api/v1/organizations', 'tenant surface'],
    ])('refuses %s %s (%s)', (m, p) => {
      expect(isDeviceNullOriginRequest(m, p)).toBe(false);
    });

    it('is method-scoped — a device path with the wrong verb is refused', () => {
      expect(isDeviceNullOriginRequest('DELETE', P.authCheck)).toBe(false);
      expect(isDeviceNullOriginRequest('POST', P.authCheck)).toBe(false);
      expect(isDeviceNullOriginRequest('GET', P.pairingRequest)).toBe(false);
    });

    it('anchors both ends — no prefix or suffix smuggling', () => {
      expect(isDeviceNullOriginRequest('GET', `${P.authCheck}/../../admin`)).toBe(false);
      expect(isDeviceNullOriginRequest('GET', `/evil${P.authCheck}`)).toBe(false);
      expect(isDeviceNullOriginRequest('GET', `${P.authCheck}extra`)).toBe(false);
      expect(isDeviceNullOriginRequest('POST', `${P.pairingRequest}/../complete`)).toBe(false);
    });

    it('does not let a preflight launder a forbidden method', () => {
      // OPTIONS is the literal method; the one that matters is the requested one.
      expect(isDeviceNullOriginRequest('OPTIONS', P.authCheck, 'GET')).toBe(true);
      expect(isDeviceNullOriginRequest('OPTIONS', P.authCheck, 'DELETE')).toBe(false);
      expect(isDeviceNullOriginRequest('OPTIONS', P.pairingComplete, 'POST')).toBe(false);
      // A preflight with no requested method claims nothing and gets nothing.
      expect(isDeviceNullOriginRequest('OPTIONS', P.authCheck)).toBe(false);
    });
  });

  describe('the middleware', () => {
    const run = (
      req: Partial<Request> & { headers: Record<string, string | undefined> },
    ) => {
      const headers: Record<string, string> = {};
      const varied: string[] = [];
      let status: number | undefined;
      let ended = false;
      const next = jest.fn() as unknown as NextFunction;
      const res = {
        setHeader: (k: string, v: string) => {
          headers[k] = v;
        },
        vary: (v: string) => {
          varied.push(v);
        },
        status: (c: number) => {
          status = c;
          return res;
        },
        end: () => {
          ended = true;
        },
      } as unknown as Response;

      deviceNullOriginCors()(req as Request, res, next);
      return { headers, varied, status, ended, next };
    };

    it('answers a device preflight with allow-origin: null and ends it', () => {
      const r = run({
        method: 'OPTIONS',
        path: P.authCheck,
        headers: { origin: 'null', 'access-control-request-method': 'GET' },
      });

      expect(r.headers['Access-Control-Allow-Origin']).toBe('null');
      expect(r.headers['Access-Control-Allow-Methods']).toBe('GET,POST,OPTIONS');
      expect(r.headers['Access-Control-Allow-Headers']).toBe('Authorization,Content-Type');
      expect(r.status).toBe(204);
      expect(r.ended).toBe(true);
      expect(r.next).not.toHaveBeenCalled();
    });

    it('marks the actual request and lets it continue to the handler', () => {
      const r = run({
        method: 'GET',
        path: P.meContent,
        headers: { origin: 'null' },
      });

      expect(r.headers['Access-Control-Allow-Origin']).toBe('null');
      expect(r.next).toHaveBeenCalled();
      expect(r.ended).toBe(false);
    });

    it('NEVER sets allow-credentials — the property that makes null origin safe', () => {
      for (const req of [
        { method: 'OPTIONS', path: P.authCheck, headers: { origin: 'null', 'access-control-request-method': 'GET' } },
        { method: 'GET', path: P.authCheck, headers: { origin: 'null' } },
        { method: 'POST', path: P.pairingRequest, headers: { origin: 'null' } },
        { method: 'GET', path: P.contentFile, headers: { origin: 'null' } },
      ]) {
        const r = run(req as never);
        expect(r.headers['Access-Control-Allow-Credentials']).toBeUndefined();
      }
    });

    it('appends Vary: Origin rather than assigning it', () => {
      const r = run({ method: 'GET', path: P.authCheck, headers: { origin: 'null' } });
      expect(r.varied).toContain('Origin');
      // If it had been set via setHeader it would clobber an existing Vary.
      expect(r.headers['Vary']).toBeUndefined();
    });

    it('does not touch a null-origin request to an operator endpoint', () => {
      const r = run({
        method: 'POST',
        path: P.pairingComplete,
        headers: { origin: 'null' },
      });

      expect(r.headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(r.next).toHaveBeenCalled(); // falls through to the normal policy, which rejects
    });

    it('does not touch a null-origin PREFLIGHT to an operator endpoint', () => {
      const r = run({
        method: 'OPTIONS',
        path: P.pairingComplete,
        headers: { origin: 'null', 'access-control-request-method': 'POST' },
      });

      expect(r.headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(r.status).toBeUndefined();
      expect(r.next).toHaveBeenCalled();
    });

    it('leaves ordinary browser origins entirely to the existing policy', () => {
      for (const origin of [
        'https://vizora.cloud',
        'https://evil.example',
        'http://localhost:3001',
        undefined,
      ]) {
        const r = run({
          method: 'GET',
          path: P.authCheck,
          headers: { origin } as Record<string, string | undefined>,
        });
        expect(r.headers['Access-Control-Allow-Origin']).toBeUndefined();
        expect(r.next).toHaveBeenCalled();
      }
    });

    it('does not match the literal string "null" arriving as a real origin value', () => {
      // A page served from https://null cannot exist, but a header of "NULL" or with
      // whitespace should not be treated as the opaque origin.
      for (const origin of ['NULL', ' null', 'null ', '"null"']) {
        const r = run({ method: 'GET', path: P.authCheck, headers: { origin } });
        expect(r.headers['Access-Control-Allow-Origin']).toBeUndefined();
      }
    });
  });
});
