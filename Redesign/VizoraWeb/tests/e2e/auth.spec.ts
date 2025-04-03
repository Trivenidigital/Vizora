import { test, expect } from '@playwright/test';

// Test the authentication flow
test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('redirects unauthenticated user to login page', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/dashboard');
    
    // Should redirect to login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('displays login form with all elements', async ({ page }) => {
    await page.goto('/login');
    
    // Check all form elements are present
    await expect(page.getByRole('heading', { name: 'Sign in to Vizora' })).toBeVisible();
    await expect(page.getByLabel(/email address/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: 'Remember me' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Forgot your password?' })).toBeVisible();
  });

  test('shows validation error for empty form submission', async ({ page }) => {
    await page.goto('/login');
    
    // Submit empty form
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Check error toast appears
    await expect(page.getByText('Please enter both email and password')).toBeVisible();
    
    // Should remain on login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('shows loading state during login', async ({ page }) => {
    await page.goto('/login');
    
    // Fill form
    await page.getByLabel(/email address/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    
    // Submit form
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Check loading state
    await expect(page.getByText('Signing in...')).toBeVisible();
  });

  test('logs in successfully and navigates to dashboard', async ({ page }) => {
    await page.goto('/login');
    
    // Fill form
    await page.getByLabel(/email address/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    
    // Submit form
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Wait for success toast and redirect
    await expect(page.getByText('Logged in successfully')).toBeVisible();
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Check dashboard content is visible
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('maintains login state when navigating', async ({ page }) => {
    // Log in first
    await page.goto('/login');
    await page.getByLabel(/email address/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    
    // Wait for redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Navigate to displays page
    await page.getByRole('link', { name: 'Displays' }).click();
    
    // Should navigate without redirecting to login
    await expect(page).toHaveURL(/.*displays/);
    await expect(page.getByText('My Displays')).toBeVisible();
    
    // Navigate to content page
    await page.getByRole('link', { name: 'Content' }).click();
    
    // Should navigate without redirecting to login
    await expect(page).toHaveURL(/.*content/);
    
    // Navigate back to dashboard
    await page.getByRole('link', { name: 'Dashboard' }).click();
    
    // Should navigate without redirecting to login
    await expect(page).toHaveURL(/.*dashboard/);
  });
});

// Test the navigation sidebar
test.describe('Navigation Components', () => {
  test.beforeEach(async ({ page }) => {
    // Simulate logged in state
    await page.addInitScript(() => {
      localStorage.setItem('isAuthenticated', 'true');
    });
  });
  
  test('sidebar shows all navigation items', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Check all navigation items are present
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Displays' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Content' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Schedules' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Analytics' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
  });
  
  test('highlights the active navigation item', async ({ page }) => {
    // Check dashboard is active when on dashboard page
    await page.goto('/dashboard');
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    await expect(dashboardLink).toHaveClass(/bg-purple-50/);
    
    // Check displays is active when on displays page
    await page.goto('/displays');
    const displaysLink = page.getByRole('link', { name: 'Displays' });
    await expect(displaysLink).toHaveClass(/bg-purple-50/);
    
    // Check content is active when on content page
    await page.goto('/content');
    const contentLink = page.getByRole('link', { name: 'Content' });
    await expect(contentLink).toHaveClass(/bg-purple-50/);
  });
  
  test('mobile menu toggle works', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/dashboard');
    
    // Mobile menu button should be visible
    const menuButton = page.getByRole('button', { name: 'Open main menu' });
    await expect(menuButton).toBeVisible();
    
    // Navigation links should not be visible initially on mobile
    await expect(page.getByRole('link', { name: 'Dashboard' })).not.toBeVisible();
    
    // Click the menu button to open the menu
    await menuButton.click();
    
    // Navigation links should be visible after opening the menu
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Displays' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Content' })).toBeVisible();
    
    // Close button should be visible
    const closeButton = page.getByRole('button', { name: 'Close main menu' });
    await expect(closeButton).toBeVisible();
    
    // Click the close button to close the menu
    await closeButton.click();
    
    // Navigation links should not be visible after closing
    await expect(page.getByRole('link', { name: 'Dashboard' })).not.toBeVisible();
  });
}); 