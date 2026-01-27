import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app/app.module';
import { DatabaseService } from '../src/modules/database/database.service';
import { SanitizeInterceptor } from '../src/modules/common/interceptors/sanitize.interceptor';

describe('Displays (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let authToken: string;
  let userId: string;
  let organizationId: string;
  let displayId: string;
  let secondUserToken: string;
  let secondOrgId: string;
  let secondUserId: string;

  const timestamp = Date.now();
  const testUser = {
    email: `displays-test-${timestamp}@example.com`,
    password: 'SecureP@ssw0rd!',
    firstName: 'Display',
    lastName: 'Tester',
    organizationName: 'Display Test Org',
    organizationSlug: `display-test-${timestamp}`,
  };

  const testDisplay = {
    deviceId: `device-${timestamp}`,
    name: 'Test Display',
    orientation: 'landscape',
    resolution: '1920x1080',
    location: 'Office A',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply same configuration as main.ts
    app.use(helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }));
    
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }));
    
    app.useGlobalInterceptors(new SanitizeInterceptor());
    
    await app.init();
    db = moduleFixture.get<DatabaseService>(DatabaseService);

    // Register test user and get auth token
    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser);
    
    authToken = registerRes.body.data.token;
    userId = registerRes.body.data.user.id;
    organizationId = registerRes.body.data.user.organizationId;

    // Create second user for multi-tenant testing
    const timestamp2 = Date.now() + 1;
    const secondUser = {
      email: `displays-test2-${timestamp2}@example.com`,
      password: 'SecureP@ssw0rd!',
      firstName: 'Second',
      lastName: 'User',
      organizationName: 'Second Org',
      organizationSlug: `second-org-${timestamp2}`,
    };

    const secondRegisterRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(secondUser);
    
    secondUserToken = secondRegisterRes.body.data.token;
    secondUserId = secondRegisterRes.body.data.user.id;
    secondOrgId = secondRegisterRes.body.data.user.organizationId;
  });

  afterAll(async () => {
    // Cleanup
    if (displayId) {
      await db.display.delete({ where: { id: displayId } }).catch(() => {});
    }
    if (userId) {
      await db.user.delete({ where: { id: userId } }).catch(() => {});
    }
    if (organizationId) {
      await db.organization.delete({ where: { id: organizationId } }).catch(() => {});
    }
    if (secondUserId) {
      await db.user.delete({ where: { id: secondUserId } }).catch(() => {});
    }
    if (secondOrgId) {
      await db.organization.delete({ where: { id: secondOrgId } }).catch(() => {});
    }
    
    await db.$disconnect();
    await app.close();
  }, 60000);

  describe('/api/displays (POST)', () => {
    it('should create a new display', () => {
      return request(app.getHttpServer())
        .post('/api/displays')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testDisplay)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.deviceIdentifier).toBe(testDisplay.deviceId);
          expect(res.body.nickname).toBe(testDisplay.name);
          expect(res.body.orientation).toBe(testDisplay.orientation);
          expect(res.body.organizationId).toBe(organizationId);
          
          displayId = res.body.id;
        });
    });

    it('should reject display creation with duplicate device ID', () => {
      return request(app.getHttpServer())
        .post('/api/displays')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testDisplay)
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toMatch(/already exists/i);
        });
    });

    it('should reject display creation without auth token', () => {
      return request(app.getHttpServer())
        .post('/api/displays')
        .send({
          ...testDisplay,
          deviceId: `device-unauth-${Date.now()}`,
        })
        .expect(401);
    });

    it('should reject display creation with invalid data', () => {
      return request(app.getHttpServer())
        .post('/api/displays')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing required deviceId
          name: 'Invalid Display',
        })
        .expect(400);
    });

    it('should sanitize XSS in display name', () => {
      const xssDeviceId = `device-xss-${Date.now()}`;
      return request(app.getHttpServer())
        .post('/api/displays')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          deviceId: xssDeviceId,
          name: '<script>alert("xss")</script>Malicious Display',
          orientation: 'landscape',
          resolution: '1920x1080',
          location: 'Test Location',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.nickname).not.toContain('<script>');
          // Cleanup
          db.display.delete({ where: { id: res.body.id } }).catch(() => {});
        });
    });
  });

  describe('/api/displays (GET)', () => {
    it('should list displays for authenticated user', () => {
      return request(app.getHttpServer())
        .get('/api/displays')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(1);
          
          // Verify our test display is in the list
          const found = res.body.data.find((d: any) => d.id === displayId);
          expect(found).toBeDefined();
          expect(found.organizationId).toBe(organizationId);
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/api/displays?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.meta.page).toBe(1);
          expect(res.body.meta.limit).toBe(5);
          expect(res.body.meta).toHaveProperty('total');
          expect(res.body.meta).toHaveProperty('totalPages');
        });
    });

    it('should reject listing without auth token', () => {
      return request(app.getHttpServer())
        .get('/api/displays')
        .expect(401);
    });

    it('should enforce multi-tenant isolation (cannot see other org displays)', () => {
      return request(app.getHttpServer())
        .get('/api/displays')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(200)
        .expect((res) => {
          // Second user should not see first user's display
          const found = res.body.data.find((d: any) => d.id === displayId);
          expect(found).toBeUndefined();
        });
    });
  });

  describe('/api/displays/:id (GET)', () => {
    it('should get a single display by ID', () => {
      return request(app.getHttpServer())
        .get(`/api/displays/${displayId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(displayId);
          expect(res.body.deviceIdentifier).toBe(testDisplay.deviceId);
          expect(res.body.organizationId).toBe(organizationId);
        });
    });

    it('should return 404 for non-existent display', () => {
      return request(app.getHttpServer())
        .get('/api/displays/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should enforce multi-tenant isolation (cannot access other org display)', () => {
      return request(app.getHttpServer())
        .get(`/api/displays/${displayId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(404); // Should return 404, not the display
    });

    it('should reject access without auth token', () => {
      return request(app.getHttpServer())
        .get(`/api/displays/${displayId}`)
        .expect(401);
    });
  });

  describe('/api/displays/:id (PATCH)', () => {
    it('should update a display', () => {
      return request(app.getHttpServer())
        .patch(`/api/displays/${displayId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Display Name',
          orientation: 'portrait',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.nickname).toBe('Updated Display Name');
          expect(res.body.orientation).toBe('portrait');
        });
    });

    it('should allow updating device ID if not conflicting', () => {
      const newDeviceId = `device-updated-${Date.now()}`;
      return request(app.getHttpServer())
        .patch(`/api/displays/${displayId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          deviceId: newDeviceId,
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.deviceIdentifier).toBe(newDeviceId);
        });
    });

    it('should reject update with conflicting device ID', async () => {
      // Create another display
      const anotherDisplay = {
        deviceId: `device-conflict-${Date.now()}`,
        name: 'Another Display',
        orientation: 'landscape',
        resolution: '1920x1080',
        location: 'Test Location',
      };

      const createRes = await request(app.getHttpServer())
        .post('/api/displays')
        .set('Authorization', `Bearer ${authToken}`)
        .send(anotherDisplay);

      const anotherDisplayId = createRes.body.id;

      // Try to update first display with second display's device ID
      await request(app.getHttpServer())
        .patch(`/api/displays/${displayId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          deviceId: anotherDisplay.deviceId,
        })
        .expect(409);

      // Cleanup
      await db.display.delete({ where: { id: anotherDisplayId } }).catch(() => {});
    });

    it('should enforce multi-tenant isolation (cannot update other org display)', () => {
      return request(app.getHttpServer())
        .patch(`/api/displays/${displayId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          name: 'Hacked Name',
        })
        .expect(404);
    });

    it('should reject update without auth token', () => {
      return request(app.getHttpServer())
        .patch(`/api/displays/${displayId}`)
        .send({
          name: 'Unauthorized Update',
        })
        .expect(401);
    });
  });

  describe('/api/displays/:id (DELETE)', () => {
    let displayToDelete: string;

    beforeAll(async () => {
      // Create a display specifically for deletion test
      const deleteDisplay = {
        deviceId: `device-delete-${Date.now()}`,
        name: 'Display to Delete',
        orientation: 'landscape',
        resolution: '1920x1080',
        location: 'Test Location',
      };

      const createRes = await request(app.getHttpServer())
        .post('/api/displays')
        .set('Authorization', `Bearer ${authToken}`)
        .send(deleteDisplay);

      displayToDelete = createRes.body.id;
    });

    it('should delete a display', () => {
      return request(app.getHttpServer())
        .delete(`/api/displays/${displayToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          });
    });

    it('should return 404 when deleting already deleted display', () => {
      return request(app.getHttpServer())
        .delete(`/api/displays/${displayToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should enforce multi-tenant isolation (cannot delete other org display)', () => {
      return request(app.getHttpServer())
        .delete(`/api/displays/${displayId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(404);
    });

    it('should reject deletion without auth token', () => {
      return request(app.getHttpServer())
        .delete(`/api/displays/${displayId}`)
        .expect(401);
    });
  });

  describe('Security & Validation', () => {
    it('should reject invalid UUID format', () => {
      return request(app.getHttpServer())
        .get('/api/displays/invalid-uuid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404); // NestJS returns 404 for invalid UUID in route params
    });

    it('should reject excessively long display names', () => {
      return request(app.getHttpServer())
        .post('/api/displays')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          deviceId: `device-long-${Date.now()}`,
          name: 'A'.repeat(300), // Exceed any reasonable limit
          orientation: 'landscape',
          resolution: '1920x1080',
          location: 'Test Location',
        })
        .expect(400);
    });

    it('should reject invalid orientation values', () => {
      return request(app.getHttpServer())
        .post('/api/displays')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          deviceId: `device-invalid-${Date.now()}`,
          name: 'Test Display',
          orientation: 'diagonal', // Invalid
          resolution: '1920x1080',
          location: 'Test Location',
        })
        .expect(400);
    });
  });
});



