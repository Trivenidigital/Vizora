import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3000';

describe('Middleware API - Comprehensive Tests', () => {
  let authToken: string;
  let organizationId: string;
  let userId: string;

  // Test data
  const testUser = {
    email: `test-${Date.now()}@vizora.test`,
    password: 'TestPassword123!',
    organizationName: 'Test Organization',
  };

  describe('Health & Status', () => {
    it('should return API health status', async () => {
      const res = await axios.get(`${API_URL}/api/health`);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('status');
    });

    it('should return API root message', async () => {
      const res = await axios.get(`${API_URL}/api`);
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('message');
    });
  });

  describe('Authentication', () => {
    it('should register a new user', async () => {
      const res = await axios.post(`${API_URL}/api/auth/register`, testUser);
      
      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('token');
      expect(res.data).toHaveProperty('user');
      expect(res.data.user.email).toBe(testUser.email);
      
      authToken = res.data.token;
      userId = res.data.user.id;
      organizationId = res.data.user.organizationId;
    });

    it('should not register duplicate email', async () => {
      try {
        await axios.post(`${API_URL}/api/auth/register`, testUser);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(400);
      }
    });

    it('should login with correct credentials', async () => {
      const res = await axios.post(`${API_URL}/api/auth/login`, {
        email: testUser.email,
        password: testUser.password,
      });
      
      expect(res.status).toBe(200);
      expect(res.data).toHaveProperty('token');
      expect(res.data).toHaveProperty('user');
    });

    it('should not login with wrong password', async () => {
      try {
        await axios.post(`${API_URL}/api/auth/login`, {
          email: testUser.email,
          password: 'WrongPassword123!',
        });
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should get current user info with token', async () => {
      const res = await axios.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(res.status).toBe(200);
      expect(res.data.email).toBe(testUser.email);
    });

    it('should reject invalid token', async () => {
      try {
        await axios.get(`${API_URL}/api/auth/me`, {
          headers: { Authorization: 'Bearer invalid_token' },
        });
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });
  });

  describe('Organizations', () => {
    it('should get current organization', async () => {
      const res = await axios.get(`${API_URL}/api/organizations/current`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(res.status).toBe(200);
      expect(res.data.name).toBe(testUser.organizationName);
    });

    it('should update organization', async () => {
      const res = await axios.patch(
        `${API_URL}/api/organizations/${organizationId}`,
        { name: 'Updated Organization' },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      expect(res.status).toBe(200);
      expect(res.data.name).toBe('Updated Organization');
    });
  });

  describe('Displays', () => {
    let displayId: string;

    it('should create a display', async () => {
      const res = await axios.post(
        `${API_URL}/api/displays`,
        {
          nickname: 'Test Display',
          location: 'Test Location',
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      expect(res.status).toBe(201);
      expect(res.data.nickname).toBe('Test Display');
      displayId = res.data.id;
    });

    it('should list displays', async () => {
      const res = await axios.get(`${API_URL}/api/displays`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);
    });

    it('should get display by id', async () => {
      const res = await axios.get(`${API_URL}/api/displays/${displayId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(res.status).toBe(200);
      expect(res.data.id).toBe(displayId);
    });

    it('should update display', async () => {
      const res = await axios.patch(
        `${API_URL}/api/displays/${displayId}`,
        { nickname: 'Updated Display' },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      expect(res.status).toBe(200);
      expect(res.data.nickname).toBe('Updated Display');
    });

    it('should delete display', async () => {
      const res = await axios.delete(`${API_URL}/api/displays/${displayId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(res.status).toBe(200);
    });
  });

  describe('Content', () => {
    let contentId: string;

    it('should create content', async () => {
      const res = await axios.post(
        `${API_URL}/api/content`,
        {
          name: 'Test Content',
          type: 'image',
          url: 'https://example.com/test.jpg',
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      expect(res.status).toBe(201);
      expect(res.data.name).toBe('Test Content');
      contentId = res.data.id;
    });

    it('should list content', async () => {
      const res = await axios.get(`${API_URL}/api/content`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should get content by id', async () => {
      const res = await axios.get(`${API_URL}/api/content/${contentId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(res.status).toBe(200);
      expect(res.data.id).toBe(contentId);
    });

    it('should update content', async () => {
      const res = await axios.patch(
        `${API_URL}/api/content/${contentId}`,
        { name: 'Updated Content' },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      expect(res.status).toBe(200);
      expect(res.data.name).toBe('Updated Content');
    });

    it('should delete content', async () => {
      const res = await axios.delete(`${API_URL}/api/content/${contentId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(res.status).toBe(200);
    });
  });

  describe('Playlists', () => {
    let playlistId: string;
    let contentId: string;

    beforeAll(async () => {
      // Create content for playlist tests
      const res = await axios.post(
        `${API_URL}/api/content`,
        {
          name: 'Playlist Test Content',
          type: 'image',
          url: 'https://example.com/playlist-test.jpg',
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      contentId = res.data.id;
    });

    it('should create playlist', async () => {
      const res = await axios.post(
        `${API_URL}/api/playlists`,
        { name: 'Test Playlist' },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      expect(res.status).toBe(201);
      expect(res.data.name).toBe('Test Playlist');
      playlistId = res.data.id;
    });

    it('should add item to playlist', async () => {
      const res = await axios.post(
        `${API_URL}/api/playlists/${playlistId}/items`,
        {
          contentId,
          duration: 10,
          order: 0,
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      expect(res.status).toBe(201);
    });

    it('should list playlists', async () => {
      const res = await axios.get(`${API_URL}/api/playlists`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });

    it('should delete playlist', async () => {
      const res = await axios.delete(`${API_URL}/api/playlists/${playlistId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(res.status).toBe(200);
    });
  });

  describe('Device Pairing', () => {
    it('should request pairing code', async () => {
      const res = await axios.post(
        `${API_URL}/api/devices/pairing/request`,
        {},
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      
      expect(res.status).toBe(201);
      expect(res.data).toHaveProperty('code');
      expect(res.data.code).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should get active pairing codes', async () => {
      const res = await axios.get(`${API_URL}/api/devices/pairing/active`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      try {
        await axios.get(`${API_URL}/api/unknown-route`);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(404);
      }
    });

    it('should return 401 for protected routes without auth', async () => {
      try {
        await axios.get(`${API_URL}/api/displays`);
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBe(401);
      }
    });

    it('should validate request body', async () => {
      try {
        await axios.post(
          `${API_URL}/api/content`,
          { invalid: 'data' },
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.response.status).toBeGreaterThanOrEqual(400);
      }
    });
  });
});
