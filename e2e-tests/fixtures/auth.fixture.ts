import { test as base, APIResponse, Page } from '@playwright/test';

/**
 * Unwrap the global ResponseEnvelopeInterceptor. Every REST endpoint these specs
 * call returns `{ success, data, meta }`, so reading `body.<field>` directly
 * yields undefined and turns the assertions that follow into no-ops.
 */
export async function readData<T = any>(res: APIResponse): Promise<T> {
  const body = await res.json();
  return body && typeof body === 'object' && 'data' in body ? (body as any).data : body;
}

/**
 * POST to the API with both credentials the middleware requires.
 *
 * The bearer token alone is not enough: CsrfMiddleware enforces a double-submit
 * pair (`vizora_csrf_token` cookie + `X-CSRF-Token` header). Sending only the
 * bearer returns 403 "Invalid CSRF token", which used to push every API-seeded
 * spec down its "if the API fails, just check the page loads" fallback branch.
 */
export async function apiPost(
  page: Page,
  token: string,
  url: string,
  data: Record<string, unknown>,
): Promise<APIResponse> {
  const cookies = await page.context().cookies();
  const csrf = cookies.find((c) => c.name === 'vizora_csrf_token')?.value ?? '';

  return page.request.post(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'X-CSRF-Token': csrf,
    },
    data,
  });
}

export type AuthenticatedPage = {
  authenticatedPage: Page;
  token: string;
  userId: string;
  organizationId: string;
};

export const test = base.extend<AuthenticatedPage>({
  authenticatedPage: async ({ page }, use) => {
    // Register and login
    const timestamp = Date.now();
    const email = `test-${timestamp}@vizora.test`;
    const password = 'Test123!@#';

    // Register via API - the backend sets vizora_auth_token as httpOnly cookie
    const registerRes = await page.request.post('http://localhost:3000/api/v1/auth/register', {
      data: {
        email,
        password,
        firstName: 'Test',
        lastName: 'User',
        organizationName: `Test Org ${timestamp}`,
      },
    });

    // Extract Set-Cookie header to get the token
    const setCookieHeader = registerRes.headers()['set-cookie'];
    let token = '';

    if (setCookieHeader) {
      // Parse the vizora_auth_token from Set-Cookie header
      // Format: "vizora_auth_token=<token>; Path=/; HttpOnly; ..."
      const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
      for (const cookie of cookies) {
        const match = cookie.match(/vizora_auth_token=([^;]+)/);
        if (match) {
          token = match[1];
          break;
        }
      }
    }

    if (!token) {
      throw new Error('Failed to extract auth token from registration response');
    }

    // Set the auth cookie in the browser context
    await page.context().addCookies([
      {
        name: 'vizora_auth_token',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    // Navigate to a page to establish context
    await page.goto('/');

    // Also set in localStorage for client-side JS (optional, for compatibility).
    // The cookie-consent bar is dismissed up front: it slides up 1s after load and
    // sits above the page, intercepting pointer events on modal confirm buttons.
    await page.evaluate((authToken) => {
      localStorage.setItem('authToken', authToken);
      localStorage.setItem('vizora_cookie_consent', 'all');
    }, token);

    await use(page);
  },
  token: async ({ authenticatedPage }, use) => {
    // Get token from cookie instead of localStorage
    const cookies = await authenticatedPage.context().cookies();
    const authCookie = cookies.find(c => c.name === 'vizora_auth_token');
    const token = authCookie?.value || '';
    await use(token);
  },
  userId: async ({ token }, use) => {
    if (!token) {
      await use('');
      return;
    }
    // Decode JWT to get user ID (simple base64 decode)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      await use(payload.sub);
    } catch {
      await use('');
    }
  },
  organizationId: async ({ token }, use) => {
    if (!token) {
      await use('');
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      await use(payload.organizationId);
    } catch {
      await use('');
    }
  },
});

export { expect } from '@playwright/test';
