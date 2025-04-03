import { test, expect, helpers, mockApiResponses, mockSocketEvents } from './setup';

test.describe('Authentication', () => {
  test('should login successfully', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestP@ss1');
    await page.click('button[type="submit"]');

    // Verify successful login
    await page.waitForURL('/dashboard');
    await expect(page.locator('text=Welcome')).toBeVisible();
  });

  test('should handle invalid credentials', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill login form with invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'InvalidP@ss1');
    await page.click('button[type="submit"]');

    // Verify error message
    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });

  test('should handle password reset', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Click forgot password link
    await page.click('text=Forgot Password?');
    await page.waitForURL('/forgot-password');

    // Fill reset form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.click('button:has-text("Reset Password")');

    // Verify reset email sent
    await expect(page.locator('text=Password reset email sent')).toBeVisible();
  });

  test('should handle session timeout', async ({ page }) => {
    // Login
    await helpers.login(page, 'test@example.com', 'TestP@ss1');

    // Wait for session timeout (30 minutes)
    await page.waitForTimeout(30 * 60 * 1000);

    // Verify redirect to login
    await page.waitForURL('/login');
    await expect(page.locator('text=Session expired')).toBeVisible();
  });

  test('should handle remember me', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill login form with remember me
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestP@ss1');
    await page.check('input[name="rememberMe"]');
    await page.click('button[type="submit"]');

    // Verify successful login
    await page.waitForURL('/dashboard');

    // Close and reopen browser
    await page.close();
    const newPage = await page.context().newPage();
    await newPage.goto('/dashboard');

    // Verify still logged in
    await expect(newPage.locator('text=Welcome')).toBeVisible();
  });

  test('should handle logout', async ({ page }) => {
    // Login
    await helpers.login(page, 'test@example.com', 'TestP@ss1');

    // Click logout button
    await page.click('button:has-text("Logout")');

    // Verify redirect to login
    await page.waitForURL('/login');
    await expect(page.locator('text=Logged out successfully')).toBeVisible();
  });

  test('should handle concurrent sessions', async ({ page }) => {
    // Login in first browser
    await helpers.login(page, 'test@example.com', 'TestP@ss1');

    // Open second browser
    const newPage = await page.context().newPage();
    await newPage.goto('/login');

    // Login in second browser
    await newPage.fill('input[name="email"]', 'test@example.com');
    await newPage.fill('input[name="password"]', 'TestP@ss1');
    await newPage.click('button[type="submit"]');

    // Verify first browser is logged out
    await page.waitForURL('/login');
    await expect(page.locator('text=Session terminated')).toBeVisible();
  });

  test('should handle password change', async ({ page }) => {
    // Login
    await helpers.login(page, 'test@example.com', 'TestP@ss1');

    // Navigate to profile settings
    await page.click('a[href="/profile"]');
    await page.waitForURL('/profile');

    // Change password
    await page.fill('input[name="currentPassword"]', 'TestP@ss1');
    await page.fill('input[name="newPassword"]', 'NewP@ss1');
    await page.fill('input[name="confirmPassword"]', 'NewP@ss1');
    await page.click('button:has-text("Change Password")');

    // Verify password change
    await expect(page.locator('text=Password changed successfully')).toBeVisible();

    // Logout
    await page.click('button:has-text("Logout")');

    // Try logging in with new password
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'NewP@ss1');
    await page.click('button[type="submit"]');

    // Verify successful login with new password
    await page.waitForURL('/dashboard');
    await expect(page.locator('text=Welcome')).toBeVisible();
  });
}); 