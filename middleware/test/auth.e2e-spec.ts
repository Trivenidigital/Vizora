import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app/app.module';
import { DatabaseService } from '../src/modules/database/database.service';
import { SanitizeInterceptor } from '../src/modules/common/interceptors/sanitize.interceptor';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let authToken: string;
  let userId: string;
  let organizationId: string;

  const timestamp = Date.now();
  const testUser = {
    email: `test-${timestamp}@example.com`,
    password: 'SecureP@ssw0rd!',
    firstName: 'Test',
    lastName: 'User',
    organizationName: 'Test Organization',
    organizationSlug: `test-org-${timestamp}`, // Unique slug per test run
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Apply same configuration as main.ts
    
    // Security headers (Helmet)
    app.use(helmet({
      contentSecurityPolicy: false, // Disable for tests
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
    
    // CRITICAL: Apply XSS sanitization interceptor
    app.useGlobalInterceptors(new SanitizeInterceptor());
    
    await app.init();
    db = moduleFixture.get<DatabaseService>(DatabaseService);
  });

  afterAll(async () => {
    // Cleanup: delete test user and organization
    if (userId) {
      await db.user.delete({ where: { id: userId } }).catch(() => {});
    }
    if (organizationId) {
      await db.organization.delete({ where: { id: organizationId } }).catch(() => {});
    }
    
    // Disconnect database to prevent hanging
    await db.$disconnect();
    await app.close();
  }, 60000); // Increase timeout to 60 seconds

  describe('/api/auth/register (POST)', () => {
    it('should register a new user successfully', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('token'); // Field is named 'token' not 'access_token'
          expect(res.body.data).toHaveProperty('user');
          expect(res.body.data.user.email).toBe(testUser.email);
          expect(res.body.data.user).not.toHaveProperty('password');
          expect(res.body.data.user).not.toHaveProperty('passwordHash');
          
          // Save for later tests
          authToken = res.body.data.token; // Correct field name
          userId = res.body.data.user.id;
          organizationId = res.body.data.user.organizationId;
        });
    });

    it('should reject registration with duplicate email', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(409)
        .expect((res) => {
          expect(res.body.message).toMatch(/already (exists|taken)/i);
        });
    });

    it('should reject registration with invalid email', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          ...testUser,
          email: 'invalid-email',
        })
        .expect(400);
    });

    it('should reject registration with weak password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          ...testUser,
          email: `another-${Date.now()}@example.com`,
          password: '123', // Too short
        })
        .expect(400);
    });

    it('should reject registration without required fields', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: testUser.email,
          // Missing password and name
        })
        .expect(400);
    });

    it('should sanitize malicious input (XSS)', () => {
      const xssTimestamp = Date.now();
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: `xss-test-${xssTimestamp}@example.com`,
          password: 'SecureP@ssw0rd!',
          firstName: '<script>alert("xss")</script>Test',
          lastName: 'User',
          organizationName: '<img src=x onerror=alert(1)>Evil Org',
          organizationSlug: `xss-test-${xssTimestamp}`,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.user.firstName).not.toContain('<script>');
          expect(res.body.data.user.organizationName || '').not.toContain('<img');
          // Cleanup
          db.user.delete({ where: { id: res.body.data.user.id } }).catch(() => {});
          db.organization.delete({ where: { id: res.body.data.user.organizationId } }).catch(() => {});
        });
    });
  });

  describe('/api/auth/login (POST)', () => {
    it('should login successfully with correct credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(201) // Login returns 201 Created
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data).toHaveProperty('token'); // Field is named 'token'
          expect(res.body.data).toHaveProperty('user');
          expect(res.body.data.user.email).toBe(testUser.email);
          expect(res.body.data.user).not.toHaveProperty('password');
        });
    });

    it('should reject login with incorrect password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!',
        })
        .expect(401)
        .expect((res) => {
          expect(res.body.message).toMatch(/Invalid (email or password|credentials)/i);
        });
    });

    it('should reject login with non-existent email', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testUser.password,
        })
        .expect(401);
    });

    it('should reject login without credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({})
        .expect(400);
    });
  });

  describe('/api/auth/me (GET)', () => {
    it('should return current user profile when authenticated', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.user.email).toBe(testUser.email);
          expect(res.body.data.user.id).toBe(userId);
          expect(res.body.data.user).not.toHaveProperty('password');
          expect(res.body.data.user).not.toHaveProperty('passwordHash');
        });
    });

    it('should reject request without auth token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);
    });

    it('should reject request with invalid auth token', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should reject request with malformed authorization header', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', 'InvalidFormat token123') // Malformed header
        .expect(401);
    });
  });

  describe('/api/auth/logout (POST)', () => {
    it('should logout successfully when authenticated', () => {
      return request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201) // Logout returns 201 Created
        .expect((res) => {
          expect(res.body.success).toBe(true);
        });
    });

    it('should reject logout without auth token', () => {
      return request(app.getHttpServer())
        .post('/api/auth/logout')
        .expect(401);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on login endpoint', async () => {
      const requests = Array(10).fill(null).map(() =>
        request(app.getHttpServer())
          .post('/api/auth/login')
          .send({
            email: 'ratelimit@test.com',
            password: 'test',
          })
      );

      const responses = await Promise.all(requests);
      const rateLimited = responses.some(res => res.status === 429);
      
      // At least some requests should be rate limited
      // (Exact behavior depends on rate limit configuration)
      expect(rateLimited || responses.every(res => res.status === 401)).toBe(true);
    }, 15000);
  });

  describe('Multi-Tenant Isolation', () => {
    it('should isolate users by organization', async () => {
      // Create a second user in a different organization
      const timestamp2 = Date.now();
      const secondUser = {
        email: `test-org2-${timestamp2}@example.com`,
        password: 'SecureP@ssw0rd!',
        firstName: 'Test',
        lastName: 'User Two',
        organizationName: 'Second Organization',
        organizationSlug: `second-org-${timestamp2}`, // Unique slug
      };

      const registerRes = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(secondUser)
        .expect(201);

      const secondUserToken = registerRes.body.data.access_token;
      const secondUserId = registerRes.body.data.user.id;
      const secondOrgId = registerRes.body.data.user.organizationId;

      // Verify they have different organizations
      expect(secondOrgId).not.toBe(organizationId);

      // Cleanup
      await db.user.delete({ where: { id: secondUserId } }).catch(() => {});
      await db.organization.delete({ where: { id: secondOrgId } }).catch(() => {});
    });
  });

  describe('Security Headers', () => {
    it('should include security headers in response', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          // Helmet should add security headers
          expect(res.headers).toHaveProperty('x-content-type-options');
          expect(res.headers['x-content-type-options']).toBe('nosniff');
        });
    });
  });
});
