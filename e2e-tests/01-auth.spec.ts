import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText(/log in|login|sign in/i);
  });

  test('should register new user and redirect to dashboard', async ({ page }) => {
    const timestamp = Date.now();
    const email = `test-${timestamp}@vizora.test`;
    const password = 'Test123!@#';
    const orgName = `Test Org ${timestamp}`;

    await page.goto('/register');

    // Wait for form to be visible
    await expect(page.locator('h1')).toContainText(/create (your )?account/i);

    // Wait for form inputs to be ready (React controlled components need this)
    const firstNameInput = page.locator('#firstName');
    await firstNameInput.waitFor({ state: 'visible' });

    // Fill registration form - use id selectors for reliability with controlled inputs
    // Click first to ensure focus, then fill
    await firstNameInput.click();
    await firstNameInput.fill('Test');

    await page.locator('#lastName').click();
    await page.locator('#lastName').fill('User');

    await page.locator('#organization').click();
    await page.locator('#organization').fill(orgName);

    await page.locator('#email').click();
    await page.locator('#email').fill(email);

    await page.locator('#password').click();
    await page.locator('#password').fill(password);

    // Submit stays disabled until confirmPassword matches AND terms are accepted.
    await page.locator('#confirmPassword').click();
    await page.locator('#confirmPassword').fill(password);

    await page.locator('#agreeTerms').check();

    // Small delay to ensure form state is updated
    await page.waitForTimeout(300);

    await expect(page.locator('button[type="submit"]')).toBeEnabled();

    // Submit and wait for navigation (or error)
    await page.click('button[type="submit"]');

    /*
     * 30s under a 60s test budget. 15s was tight enough that the navigation
     * landed just after the deadline: the catch block then reported
     * "Registration timeout. Still at: http://localhost:3001/dashboard" —
     * naming the destination it had just reached, which reads as a product
     * failure and is not one. A sub-timeout must also stay below the enclosing
     * test timeout or it can never fire; both are set here deliberately.
     */
    test.setTimeout(60_000);
    try {
      await page.waitForURL(/dashboard/, { timeout: 30000 });
    } catch {
      /*
       * `.first()` matters: this selector is a multi-match, so isVisible()
       * threw a strict-mode error that `.catch(() => false)` turned into "no
       * error shown" — the branch that exists to surface the product's own
       * message could never run.
       */
      const errorElement = page.locator('.bg-red-50, [role="alert"]').first();
      const hasError = await errorElement.isVisible({ timeout: 2000 }).catch(() => false);
      if (hasError) {
        const error = await errorElement.textContent().catch(() => 'Unknown error');
        throw new Error(`Registration failed with error: ${error}`);
      }
      throw new Error(
        `Registration did not reach the dashboard within 30s. URL at failure: ${page.url()}`,
      );
    }

    // Verify dashboard loaded
    await expect(
      page.getByRole('heading', { name: /dashboard overview/i }),
    ).toBeVisible({ timeout: 5000 });
  });

  test('should login existing user', async ({ page }) => {
    // First register via API
    const timestamp = Date.now();
    const email = `test-${timestamp}@vizora.test`;
    const password = 'Test123!@#';

    const response = await page.request.post('http://localhost:3000/api/v1/auth/register', {
      data: {
        email,
        password,
        firstName: 'Test',
        lastName: 'User',
        organizationName: `Test Org ${timestamp}`,
      },
    });

    // Ensure registration was successful
    expect(response.ok()).toBeTruthy();

    // Now login
    await page.goto('/login');

    // Wait for login form to be visible - accept either "login" or "sign in"
    await expect(page.locator('h1')).toContainText(/log in|login|sign in/i);

    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');

    /*
     * Re-fill until the value sticks. This is the only test that flaked in CI,
     * and it took three attempts to get right — each wrong one is recorded
     * because the wrong readings are the instructive part.
     *
     * 1. The symptom was `waitForURL(/dashboard/)` timing out, so the first fix
     *    raised that timeout to 45s. It could never fire: Playwright's per-test
     *    timeout is 30s, so the test died at 30s pointing at a line asking for
     *    45000ms. A sub-timeout above the enclosing test timeout is not a
     *    timeout.
     * 2. No screenshot existed to check, because the artifact upload ran
     *    `if: failure()` and a flake that passes on retry makes the job
     *    SUCCEED. Switching that to `always()` is what produced the evidence:
     *    the page was still on /login with BOTH fields empty and "Please enter
     *    a valid email address" under the email. The login never submitted.
     * 3. So the fill was being discarded — this is a controlled React form, and
     *    a `fill` that lands before hydration is thrown away when the client
     *    re-renders. The second fix asserted `toHaveValue` after filling, on
     *    the theory that it only needed waiting out. It did not: the assertion
     *    held an empty string for its full 5s. React owns the input by then and
     *    the lost keystrokes never come back.
     *
     * So the fill has to be REPEATED, not awaited. `toPass` retries the whole
     * block, re-filling until the value survives a re-render.
     */
    const fillUntilSet = async (locator: typeof emailInput, value: string) => {
      await expect(async () => {
        await locator.fill(value);
        await expect(locator).toHaveValue(value, { timeout: 1000 });
      }).toPass({ timeout: 20000 });
    };

    await fillUntilSet(emailInput, email);
    await fillUntilSet(passwordInput, password);

    await page.click('button[type="submit"]');

    await page.waitForURL(/dashboard/, { timeout: 30000 });
  });

  test('should show validation errors for invalid input', async ({ page }) => {
    await page.goto('/login');
    
    // Wait for form to be ready
    await expect(page.locator('h1')).toContainText(/log in|login/i);
    
    // Fill invalid email (triggers Zod validation)
    await page.fill('input[type="email"]', 'invalid');
    await page.fill('input[type="password"]', 'short');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Wait for validation errors to appear (they render immediately after submit)
    await page.waitForSelector('[role="alert"]', { state: 'visible', timeout: 3000 });
    
    // Verify error message is present
    const alerts = await page.locator('[role="alert"]').count();
    expect(alerts).toBeGreaterThan(0);
  });

  test('should logout user', async ({ page }) => {
    // Login first via API
    const timestamp = Date.now();
    const email = `test-${timestamp}@vizora.test`;
    const password = 'Test123!@#';

    const res = await page.request.post('http://localhost:3000/api/v1/auth/register', {
      data: {
        email,
        password,
        firstName: 'Test',
        lastName: 'User',
        organizationName: `Test Org ${timestamp}`,
      },
    });

    // Extract token from Set-Cookie header (backend sets httpOnly cookie)
    const setCookieHeader = res.headers()['set-cookie'];
    let token = '';
    if (setCookieHeader) {
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

    // Set vizora_auth_token cookie (for Next.js middleware)
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

    // Navigate to a page first to be able to set localStorage
    await page.goto('/');

    // Set localStorage (use authToken key to match what web app expects)
    await page.evaluate((authToken) => {
      localStorage.setItem('authToken', authToken);
    }, token);

    // Now go to dashboard
    await page.goto('/dashboard');

    // Wait for dashboard to load (not login page)
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
    await expect(
      page.getByRole('heading', { name: /dashboard overview/i }),
    ).toBeVisible({ timeout: 5000 });

    // Open user menu - look for button containing email or avatar
    const userMenuButton = page.locator('button').filter({ hasText: email.split('@')[0] }).or(
      page.locator('button').filter({ has: page.locator('[aria-label*="avatar"]') })
    );
    await userMenuButton.first().click();

    // Wait for dropdown to appear and click logout
    await page.waitForSelector('button:has-text("Logout")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Logout")');

    // Should redirect to login
    await expect(page).toHaveURL('/login', { timeout: 5000 });
  });
});
