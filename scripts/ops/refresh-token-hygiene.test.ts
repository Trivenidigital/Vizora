/**
 * Refresh-token hygiene for the ops agents.
 *
 * Regression cover for the leak measured on prod 2026-08-02: every cron firing
 * called `POST /auth/login`, which mints a 30-day rotating refresh-token row
 * and returns it as an httpOnly cookie. `fetch` has no cookie jar, so the
 * cookie was dropped and the row was orphaned at birth — ~16/hour, ~384/day,
 * 8,405 rows accumulated, `replacedByTokenHash = 0` across all of them.
 *
 * The fix keeps the cookie only long enough to hand it back to
 * `POST /auth/logout`, which is the ONLY thing that revokes the row
 * (auth.controller.ts revokes via `extractRefreshToken(req)`, not via the
 * bearer token). These tests pin that contract.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  login,
  logout,
  releaseSessions,
  sessionReleaseFailures,
  __resetSessionReleaseFailures,
  __openSessionCount,
} from './lib/api-client.js';

const BASE = 'http://ops-test.invalid';
const REFRESH_COOKIE = 'vizora_refresh_token=rt-abc123';
const CSRF_COOKIE = 'vizora_csrf_token=csrf-xyz789';

interface Captured {
  url: string;
  method?: string;
  headers: Record<string, string>;
}

/** Install a fetch stub; returns the captured requests and a restore fn. */
function stubFetch(
  loginCookies: string[],
  opts: { logoutStatus?: number; logoutThrows?: boolean } = {},
) {
  const calls: Captured[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: string, init: RequestInit = {}) => {
    calls.push({
      url: String(url),
      method: init.method,
      headers: { ...((init.headers as Record<string, string>) ?? {}) },
    });
    if (String(url).endsWith('/auth/login')) {
      return {
        ok: true,
        status: 201,
        headers: {
          getSetCookie: () => loginCookies,
          get: (h: string) => (h.toLowerCase() === 'set-cookie' ? loginCookies[0] ?? null : null),
        },
        json: async () => ({ data: { accessToken: 'access-token-1' } }),
        text: async () => '',
      } as unknown as Response;
    }
    if (opts.logoutThrows) throw new Error('network down');
    const status = opts.logoutStatus ?? 200;
    // `ok` must follow the status — hardcoding it true is what made a 401
    // look like a success, which is the exact bug these tests guard.
    return { ok: status >= 200 && status < 300, status, text: async () => '' } as unknown as Response;
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = real; } };
}

test('login captures the refresh cookie so the session can be released', async () => {
  const { calls, restore } = stubFetch([`${REFRESH_COOKIE}; Path=/; HttpOnly; SameSite=Lax`, `${CSRF_COOKIE}; Path=/`]);
  try {
    const token = await login(BASE, 'ops@example.test', 'pw');
    assert.equal(token, 'access-token-1');
    assert.equal(__openSessionCount(), 1, 'session should be tracked as open');
    assert.equal(calls[0].url, `${BASE}/api/v1/auth/login`);
  } finally {
    restore();
  }
});

test('logout presents the refresh cookie back — the only thing that revokes the row', async () => {
  const { calls, restore } = stubFetch([`${REFRESH_COOKIE}; Path=/; HttpOnly`, `${CSRF_COOKIE}; Path=/`]);
  try {
    const token = await login(BASE, 'ops@example.test', 'pw');
    await logout(BASE, token);

    const out = calls.find(c => c.url.endsWith('/auth/logout'));
    assert.ok(out, 'logout must be called');
    assert.equal(out.method, 'POST');
    assert.equal(out.headers.Authorization, 'Bearer access-token-1');
    assert.ok(
      out.headers.Cookie.includes(REFRESH_COOKIE),
      'without the refresh cookie the server revokes nothing and the leak persists',
    );
    assert.equal(
      out.headers['X-CSRF-Token'],
      'csrf-xyz789',
      'cookies without the CSRF header are rejected 401 and nothing is revoked',
    );
  } finally {
    restore();
  }
});

test('cookie attributes are stripped — only name=value is sent back', async () => {
  const { calls, restore } = stubFetch([
    `${REFRESH_COOKIE}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`,
    'vizora_token=at-xyz; Path=/; HttpOnly',
  ]);
  try {
    const token = await login(BASE, 'ops@example.test', 'pw');
    await logout(BASE, token);
    const out = calls.find(c => c.url.endsWith('/auth/logout'));
    assert.ok(out?.headers.Cookie.includes(REFRESH_COOKIE));
    assert.ok(out?.headers.Cookie.includes('vizora_token=at-xyz'));
    assert.ok(!out?.headers.Cookie.includes('HttpOnly'));
    assert.ok(!out?.headers.Cookie.includes('Max-Age'));
  } finally {
    restore();
  }
});

test('logout is idempotent — a second call does not re-send a cookie', async () => {
  const { calls, restore } = stubFetch([`${REFRESH_COOKIE}; Path=/`, `${CSRF_COOKIE}; Path=/`]);
  try {
    const token = await login(BASE, 'ops@example.test', 'pw');
    await logout(BASE, token);
    await logout(BASE, token);
    const outs = calls.filter(c => c.url.endsWith('/auth/logout'));
    assert.equal(outs.length, 2, 'both calls are attempted');
    assert.ok(outs[0].headers.Cookie.includes(REFRESH_COOKIE));
    assert.equal(outs[1].headers.Cookie, undefined, 'session already released');
    assert.equal(__openSessionCount(), 0);
  } finally {
    restore();
  }
});

test('logout never throws — a failed release must not fail an ops run', async () => {
  const { restore } = stubFetch([`${REFRESH_COOKIE}; Path=/`, `${CSRF_COOKIE}; Path=/`], { logoutThrows: true });
  try {
    const token = await login(BASE, 'ops@example.test', 'pw');
    await assert.doesNotReject(() => logout(BASE, token));
    assert.equal(__openSessionCount(), 0, 'session is released locally even if the call failed');
  } finally {
    restore();
  }
});

test('a login that returns no cookie tracks no session and still logs out cleanly', async () => {
  const { calls, restore } = stubFetch([]);
  try {
    const token = await login(BASE, 'ops@example.test', 'pw');
    assert.equal(__openSessionCount(), 0, 'nothing to release when no cookie was issued');
    await assert.doesNotReject(() => logout(BASE, token));
    const out = calls.find(c => c.url.endsWith('/auth/logout'));
    assert.equal(out?.headers.Cookie, undefined);
  } finally {
    restore();
  }
});

test('a failed login opens no session', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({ ok: false, status: 401, text: async () => 'Invalid email or password' }) as unknown as Response) as typeof fetch;
  try {
    await assert.rejects(() => login(BASE, 'ops@example.test', 'bad'), /Login failed \(401\)/);
    assert.equal(__openSessionCount(), 0);
  } finally {
    globalThis.fetch = real;
  }
});

test('releaseSessions awaits the logout, so the row is revoked before exit', async () => {
  const { calls, restore } = stubFetch([`${REFRESH_COOKIE}; Path=/; HttpOnly`, `${CSRF_COOKIE}; Path=/`]);
  try {
    await login(BASE, 'ops@example.test', 'pw');
    assert.equal(__openSessionCount(), 1);

    // The bug this replaces: a fire-and-forget release let the process exit
    // first, so nothing was revoked. releaseSessions must be awaitable and
    // must have completed the request by the time it resolves.
    await releaseSessions();

    const out = calls.find(c => c.url.endsWith('/auth/logout'));
    assert.ok(out, 'logout must have been issued by releaseSessions');
    assert.ok(out.headers.Cookie.includes(REFRESH_COOKIE), 'cookie is what revokes the row');
    assert.equal(out.headers['X-CSRF-Token'], 'csrf-xyz789', 'CSRF header is mandatory');
    assert.equal(__openSessionCount(), 0, 'session released');
  } finally {
    restore();
  }
});

test('releaseSessions is safe with nothing open', async () => {
  const { calls, restore } = stubFetch([]);
  try {
    await assert.doesNotReject(() => releaseSessions());
    assert.equal(calls.length, 0);
  } finally {
    restore();
  }
});

test('a rejected release is COUNTED, not swallowed', async () => {
  __resetSessionReleaseFailures();
  const { restore } = stubFetch([`${REFRESH_COOKIE}; Path=/`, `${CSRF_COOKIE}; Path=/`], { logoutStatus: 401 });
  try {
    const token = await login(BASE, 'ops@example.test', 'pw');
    await logout(BASE, token);
    // A 401 is exactly what the two ineffective fixes hit. It must not look
    // like success ever again.
    assert.equal(
      sessionReleaseFailures(),
      1,
      'a 401 release must increment the failure count',
    );
  } finally {
    restore();
  }
});

test('a thrown release is COUNTED too', async () => {
  __resetSessionReleaseFailures();
  const { restore } = stubFetch([`${REFRESH_COOKIE}; Path=/`, `${CSRF_COOKIE}; Path=/`], { logoutThrows: true });
  try {
    const token = await login(BASE, 'ops@example.test', 'pw');
    await logout(BASE, token);
    assert.equal(sessionReleaseFailures(), 1);
  } finally {
    restore();
  }
});

test('a successful release does not increment the failure count', async () => {
  __resetSessionReleaseFailures();
  const { restore } = stubFetch([`${REFRESH_COOKIE}; Path=/`, `${CSRF_COOKIE}; Path=/`], { logoutStatus: 200 });
  try {
    await login(BASE, 'ops@example.test', 'pw');
    await releaseSessions();
    assert.equal(sessionReleaseFailures(), 0, 'clean release must not count as failure');
  } finally {
    restore();
  }
});
