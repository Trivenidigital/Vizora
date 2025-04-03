import { test as base } from '@playwright/test';
import { AuthContext } from '../types';

// Extend the base test with custom fixtures
export const test = base.extend<{
  authContext: AuthContext;
}>({
  authContext: async ({ page }, use) => {
    // Mock authentication state
    await page.addInitScript(() => {
      window.localStorage.setItem('auth_token', 'mock_token');
      window.localStorage.setItem('user', JSON.stringify({
        id: 'test-user-id',
        email: 'test@example.com',
        role: 'admin'
      }));
    });
    await use({ token: 'mock_token', user: { id: 'test-user-id', email: 'test@example.com', role: 'admin' } });
  },
});

export { expect } from '@playwright/test';

// Mock API responses
export const mockApiResponses = {
  displays: {
    list: [
      {
        id: 'test-display-1',
        name: 'Test Display',
        location: 'Test Location',
        status: 'online'
      }
    ],
    get: {
      id: 'test-display-1',
      name: 'Test Display',
      location: 'Test Location',
      status: 'online',
      lastSeen: new Date().toISOString()
    }
  },
  users: {
    list: [
      {
        id: 'test-user-1',
        email: 'test@example.com',
        role: 'admin',
        status: 'active'
      }
    ],
    get: {
      id: 'test-user-1',
      email: 'test@example.com',
      role: 'admin',
      status: 'active',
      createdAt: new Date().toISOString()
    }
  }
};

// Mock socket events
export const mockSocketEvents = {
  'display:status': {
    displayId: 'test-display-1',
    status: 'online',
    lastSeen: new Date().toISOString()
  },
  'display:content': {
    displayId: 'test-display-1',
    content: {
      id: 'test-content-1',
      type: 'image',
      url: 'https://example.com/test-image.jpg',
      duration: 10
    }
  }
};

// Helper functions for common test operations
export const helpers = {
  async login(page: any, email: string, password: string) {
    await page.goto('/login');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  },

  async createDisplay(page: any, name: string, location: string) {
    await page.click('button:has-text("Add Display")');
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="location"]', location);
    await page.click('button:has-text("Save")');
  },

  async uploadContent(page: any, filePath: string) {
    await page.setInputFiles('input[type="file"]', filePath);
    await page.click('button:has-text("Upload")');
  }
}; 