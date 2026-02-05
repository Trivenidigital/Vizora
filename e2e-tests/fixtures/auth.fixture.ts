import { test as base, Page } from '@playwright/test';

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
    const registerRes = await page.request.post('http://localhost:3000/api/auth/register', {
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

    // Also set in localStorage for client-side JS (optional, for compatibility)
    await page.evaluate((authToken) => {
      localStorage.setItem('authToken', authToken);
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
