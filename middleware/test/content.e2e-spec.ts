import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app/app.module';
import { DatabaseService } from '../src/modules/database/database.service';
import { SanitizeInterceptor } from '../src/modules/common/interceptors/sanitize.interceptor';

describe('Content (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let authToken: string;
  let userId: string;
  let organizationId: string;
  let contentId: string;
  let secondUserToken: string;
  let secondOrgId: string;
  let secondUserId: string;

  const timestamp = Date.now();
  const testUser = {
    email: `content-test-${timestamp}@example.com`,
    password: 'SecureP@ssw0rd!',
    firstName: 'Content',
    lastName: 'Tester',
    organizationName: 'Content Test Org',
    organizationSlug: `content-test-${timestamp}`,
  };

  const testContent = {
    name: 'Test Image',
    description: 'A test image content',
    type: 'image',
    url: 'https://example.com/test-image.jpg',
    thumbnail: 'https://example.com/thumb.jpg',
    duration: 5,
    fileSize: 102400,
    mimeType: 'image/jpeg',
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
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

    // Register test user
    const registerRes = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser);
    
    authToken = registerRes.body.data.token;
    userId = registerRes.body.data.user.id;
    organizationId = registerRes.body.data.user.organizationId;

    // Create second user for multi-tenant testing
    const timestamp2 = Date.now() + 1;
    const secondUser = {
      email: `content-test2-${timestamp2}@example.com`,
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
    if (contentId) {
      await db.content.delete({ where: { id: contentId } }).catch(() => {});
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

  describe('/api/content (POST)', () => {
    it('should create new content', () => {
      return request(app.getHttpServer())
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send(testContent)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe(testContent.name);
          expect(res.body.type).toBe(testContent.type);
          expect(res.body.url).toBe(testContent.url);
          expect(res.body.organizationId).toBe(organizationId);
          
          contentId = res.body.id;
        });
    });

    it('should reject content creation without auth', () => {
      return request(app.getHttpServer())
        .post('/api/content')
        .send({
          ...testContent,
          name: 'Unauthorized Content',
        })
        .expect(401);
    });

    it('should reject content with invalid type', () => {
      return request(app.getHttpServer())
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...testContent,
          type: 'invalid-type',
        })
        .expect(400);
    });

    it('should reject content without required fields', () => {
      return request(app.getHttpServer())
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Incomplete Content',
          // Missing type and url
        })
        .expect(400);
    });

    it('should sanitize XSS in content name', () => {
      return request(app.getHttpServer())
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...testContent,
          name: '<script>alert("xss")</script>Malicious Content',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.name).not.toContain('<script>');
          // Cleanup
          db.content.delete({ where: { id: res.body.id } }).catch(() => {});
        });
    });

    it('should create video content with duration', () => {
      return request(app.getHttpServer())
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Video',
          type: 'video',
          url: 'https://example.com/video.mp4',
          duration: 120,
          mimeType: 'video/mp4',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.type).toBe('video');
          expect(res.body.duration).toBe(120);
          // Cleanup
          db.content.delete({ where: { id: res.body.id } }).catch(() => {});
        });
    });

    it('should create URL content', () => {
      return request(app.getHttpServer())
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Website',
          type: 'url',
          url: 'https://example.com',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.type).toBe('url');
          // Cleanup
          db.content.delete({ where: { id: res.body.id } }).catch(() => {});
        });
    });
  });

  describe('/api/content (GET)', () => {
    it('should list content for authenticated user', () => {
      return request(app.getHttpServer())
        .get('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(1);
          
          // Verify our test content is in the list
          const found = res.body.data.find((c: any) => c.id === contentId);
          expect(found).toBeDefined();
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/api/content?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.meta.page).toBe(1);
          expect(res.body.meta.limit).toBe(5);
          expect(res.body.meta).toHaveProperty('total');
        });
    });

    it('should reject listing without auth', () => {
      return request(app.getHttpServer())
        .get('/api/content')
        .expect(401);
    });

    it('should enforce multi-tenant isolation', () => {
      return request(app.getHttpServer())
        .get('/api/content')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(200)
        .expect((res) => {
          // Second user should not see first user's content
          const found = res.body.data.find((c: any) => c.id === contentId);
          expect(found).toBeUndefined();
        });
    });
  });

  describe('/api/content/:id (GET)', () => {
    it('should get single content by ID', () => {
      return request(app.getHttpServer())
        .get(`/api/content/${contentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(contentId);
          expect(res.body.name).toBe(testContent.name);
          expect(res.body.organizationId).toBe(organizationId);
        });
    });

    it('should return 404 for non-existent content', () => {
      return request(app.getHttpServer())
        .get('/api/content/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should enforce multi-tenant isolation', () => {
      return request(app.getHttpServer())
        .get(`/api/content/${contentId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(404);
    });

    it('should reject without auth', () => {
      return request(app.getHttpServer())
        .get(`/api/content/${contentId}`)
        .expect(401);
    });
  });

  describe('/api/content/:id (PATCH)', () => {
    it('should update content', () => {
      return request(app.getHttpServer())
        .patch(`/api/content/${contentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Content Name',
          description: 'Updated description',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Updated Content Name');
          expect(res.body.description).toBe('Updated description');
        });
    });

    it('should reject update with invalid type', () => {
      return request(app.getHttpServer())
        .patch(`/api/content/${contentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'invalid-type',
        })
        .expect(400);
    });

    it('should enforce multi-tenant isolation', () => {
      return request(app.getHttpServer())
        .patch(`/api/content/${contentId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          name: 'Hacked Name',
        })
        .expect(404);
    });

    it('should reject without auth', () => {
      return request(app.getHttpServer())
        .patch(`/api/content/${contentId}`)
        .send({
          name: 'Unauthorized Update',
        })
        .expect(401);
    });
  });

  describe('/api/content/:id (DELETE)', () => {
    let contentToDelete: string;

    beforeAll(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Content to Delete',
          type: 'image',
          url: 'https://example.com/delete-me.jpg',
        });

      contentToDelete = createRes.body.id;
    });

    it('should delete content', () => {
      return request(app.getHttpServer())
        .delete(`/api/content/${contentToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should return 404 when deleting already deleted content', () => {
      return request(app.getHttpServer())
        .delete(`/api/content/${contentToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should enforce multi-tenant isolation', () => {
      return request(app.getHttpServer())
        .delete(`/api/content/${contentId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(404);
    });

    it('should reject without auth', () => {
      return request(app.getHttpServer())
        .delete(`/api/content/${contentId}`)
        .expect(401);
    });
  });

  describe('Content Type Validation', () => {
    it('should accept valid image type', () => {
      return request(app.getHttpServer())
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Valid Image',
          type: 'image',
          url: 'https://example.com/image.png',
        })
        .expect(201)
        .expect((res) => {
          db.content.delete({ where: { id: res.body.id } }).catch(() => {});
        });
    });

    it('should accept valid video type', () => {
      return request(app.getHttpServer())
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Valid Video',
          type: 'video',
          url: 'https://example.com/video.mp4',
        })
        .expect(201)
        .expect((res) => {
          db.content.delete({ where: { id: res.body.id } }).catch(() => {});
        });
    });

    it('should accept valid url type', () => {
      return request(app.getHttpServer())
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Valid URL',
          type: 'url',
          url: 'https://example.com',
        })
        .expect(201)
        .expect((res) => {
          db.content.delete({ where: { id: res.body.id } }).catch(() => {});
        });
    });

    it('should accept valid html type', () => {
      return request(app.getHttpServer())
        .post('/api/content')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Valid HTML',
          type: 'html',
          url: 'https://example.com/widget.html',
        })
        .expect(201)
        .expect((res) => {
          db.content.delete({ where: { id: res.body.id } }).catch(() => {});
        });
    });
  });
});
