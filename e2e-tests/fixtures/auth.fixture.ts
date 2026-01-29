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

    // Register
    const registerRes = await page.request.post('http://localhost:3000/api/auth/register', {
      data: {
        email,
        password,
        firstName: 'Test',
        lastName: 'User',
        organizationName: `Test Org ${timestamp}`,
      },
    });

    const responseData = await registerRes.json();
    
    // Extract token and user from nested structure
    const token = responseData.data.token;
    const user = responseData.data.user;

    // Set auth cookie and localStorage (use authToken for Next.js middleware)
    await page.context().addCookies([
      {
        name: 'authToken',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    await page.goto('/');
    await page.evaluate((authToken) => {
      localStorage.setItem('authToken', authToken);
    }, token);

    await use(page);
  },
  token: async ({ authenticatedPage }, use) => {
    const token = await authenticatedPage.evaluate(() => localStorage.getItem('authToken') || '');
    await use(token);
  },
  userId: async ({ token }, use) => {
    // Decode JWT to get user ID (simple base64 decode)
    const payload = JSON.parse(atob(token.split('.')[1]));
    await use(payload.sub);
  },
  organizationId: async ({ token }, use) => {
    const payload = JSON.parse(atob(token.split('.')[1]));
    await use(payload.organizationId);
  },
});

export { expect } from '@playwright/test';
