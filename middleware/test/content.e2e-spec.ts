// Mock isomorphic-dompurify before importing modules
jest.mock('isomorphic-dompurify', () => ({
  __esModule: true,
  default: {
    sanitize: jest.fn((html: string) => html.replace(/<script[^>]*>.*?<\/script>/gi, '')),
  },
}));

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

  // ============================================================================
  // CONTENT TEMPLATES
  // ============================================================================

  describe('Content Templates', () => {
    let templateId: string;

    const testTemplate = {
      name: 'Menu Board Template',
      description: 'Restaurant menu display template',
      templateHtml: '<h1>{{title}}</h1><ul>{{#each items}}<li>{{name}} - ${{price}}</li>{{/each}}</ul>',
      dataSource: {
        type: 'manual',
        manualData: {
          title: 'Today\'s Menu',
          items: [
            { name: 'Burger', price: '9.99' },
            { name: 'Fries', price: '3.99' },
          ],
        },
      },
      refreshConfig: {
        enabled: false,
        intervalMinutes: 15,
      },
      sampleData: {
        title: 'Sample Menu',
        items: [{ name: 'Sample Item', price: '0.00' }],
      },
      duration: 30,
    };

    afterAll(async () => {
      if (templateId) {
        await db.content.delete({ where: { id: templateId } }).catch(() => {});
      }
    });

    describe('/api/content/templates (POST)', () => {
      it('should create a new template', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testTemplate)
          .expect(201)
          .expect((res) => {
            expect(res.body).toHaveProperty('id');
            expect(res.body.name).toBe(testTemplate.name);
            expect(res.body.type).toBe('template');
            expect(res.body.organizationId).toBe(organizationId);
            expect(res.body.metadata).toHaveProperty('templateHtml');
            expect(res.body.metadata).toHaveProperty('renderedHtml');

            templateId = res.body.id;
          });
      });

      it('should reject template creation without auth', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates')
          .send(testTemplate)
          .expect(401);
      });

      it('should reject template with script tags', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...testTemplate,
            name: 'Malicious Template',
            templateHtml: '<script>alert("xss")</script><h1>{{title}}</h1>',
          })
          .expect(400)
          .expect((res) => {
            expect(res.body.message).toContain('validation failed');
          });
      });

      it('should reject template with iframe tags', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...testTemplate,
            name: 'Iframe Template',
            templateHtml: '<iframe src="https://evil.com"></iframe>',
          })
          .expect(400);
      });

      it('should reject template with onclick handlers', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...testTemplate,
            name: 'Event Handler Template',
            templateHtml: '<button onclick="alert(1)">Click</button>',
          })
          .expect(400);
      });

      it('should reject template with javascript: URLs', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...testTemplate,
            name: 'JS URL Template',
            templateHtml: '<a href="javascript:alert(1)">Click</a>',
          })
          .expect(400);
      });

      it('should reject template without required fields', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Incomplete Template',
            // Missing templateHtml, dataSource, refreshConfig
          })
          .expect(400);
      });

      it('should create template with REST API data source', async () => {
        const res = await request(app.getHttpServer())
          .post('/api/content/templates')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            ...testTemplate,
            name: 'API Template',
            dataSource: {
              type: 'rest_api',
              url: 'https://api.example.com/menu',
              method: 'GET',
              headers: { 'X-API-Key': 'test-key' },
              jsonPath: '$.data',
            },
          })
          .expect(201);

        expect(res.body.metadata.dataSource.type).toBe('rest_api');
        expect(res.body.metadata.dataSource.url).toBe('https://api.example.com/menu');

        await db.content.delete({ where: { id: res.body.id } }).catch(() => {});
      });
    });

    describe('/api/content/templates/:id (PATCH)', () => {
      it('should update template', () => {
        return request(app.getHttpServer())
          .patch(`/api/content/templates/${templateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Updated Menu Board',
            templateHtml: '<h2>{{title}}</h2>',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.name).toBe('Updated Menu Board');
          });
      });

      it('should update refresh config', () => {
        return request(app.getHttpServer())
          .patch(`/api/content/templates/${templateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            refreshConfig: {
              enabled: true,
              intervalMinutes: 30,
            },
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.metadata.refreshConfig.enabled).toBe(true);
            expect(res.body.metadata.refreshConfig.intervalMinutes).toBe(30);
          });
      });

      it('should reject update with invalid template HTML', () => {
        return request(app.getHttpServer())
          .patch(`/api/content/templates/${templateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateHtml: '<form action="https://evil.com"><input></form>',
          })
          .expect(400);
      });

      it('should enforce multi-tenant isolation', () => {
        return request(app.getHttpServer())
          .patch(`/api/content/templates/${templateId}`)
          .set('Authorization', `Bearer ${secondUserToken}`)
          .send({
            name: 'Hacked Template',
          })
          .expect(404);
      });

      it('should reject update without auth', () => {
        return request(app.getHttpServer())
          .patch(`/api/content/templates/${templateId}`)
          .send({
            name: 'Unauthorized Update',
          })
          .expect(401);
      });
    });

    describe('/api/content/templates/preview (POST)', () => {
      it('should preview template with sample data', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates/preview')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateHtml: '<h1>{{title}}</h1>',
            sampleData: { title: 'Preview Test' },
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.html).toBe('<h1>Preview Test</h1>');
          });
      });

      it('should preview template with each loop', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates/preview')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateHtml: '{{#each items}}<span>{{this}}</span>{{/each}}',
            sampleData: { items: ['A', 'B', 'C'] },
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.html).toContain('<span>A</span>');
            expect(res.body.html).toContain('<span>B</span>');
            expect(res.body.html).toContain('<span>C</span>');
          });
      });

      it('should auto-escape HTML in preview', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates/preview')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateHtml: '<div>{{content}}</div>',
            sampleData: { content: '<script>alert(1)</script>' },
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.html).not.toContain('<script>');
            expect(res.body.html).toContain('&lt;script&gt;');
          });
      });

      it('should reject preview with forbidden tags', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates/preview')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateHtml: '<script>alert(1)</script>',
            sampleData: {},
          })
          .expect(400);
      });
    });

    describe('/api/content/templates/validate (POST)', () => {
      it('should validate clean template', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateHtml: '<h1>{{title}}</h1><p>{{description}}</p>',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.valid).toBe(true);
            expect(res.body.errors).toHaveLength(0);
          });
      });

      it('should detect script tags in validation', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateHtml: '<script>alert("xss")</script>',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.valid).toBe(false);
            expect(res.body.errors).toContain('Forbidden tag found: <script>');
          });
      });

      it('should detect event handlers in validation', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateHtml: '<img src="x" onerror="alert(1)">',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.valid).toBe(false);
            expect(res.body.errors).toContain('Forbidden attribute found: onerror');
          });
      });

      it('should warn about unescaped expressions', () => {
        return request(app.getHttpServer())
          .post('/api/content/templates/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            templateHtml: '<div>{{{unsafeContent}}}</div>',
          })
          .expect(200)
          .expect((res) => {
            expect(res.body.valid).toBe(false);
            expect(res.body.errors.some((e: string) => e.includes('Unescaped'))).toBe(true);
          });
      });
    });

    describe('/api/content/templates/:id/rendered (GET)', () => {
      it('should get rendered HTML for template', () => {
        return request(app.getHttpServer())
          .get(`/api/content/templates/${templateId}/rendered`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('html');
            expect(res.body).toHaveProperty('renderedAt');
          });
      });

      it('should enforce multi-tenant isolation', () => {
        return request(app.getHttpServer())
          .get(`/api/content/templates/${templateId}/rendered`)
          .set('Authorization', `Bearer ${secondUserToken}`)
          .expect(404);
      });

      it('should reject without auth', () => {
        return request(app.getHttpServer())
          .get(`/api/content/templates/${templateId}/rendered`)
          .expect(401);
      });

      it('should return 404 for non-existent template', () => {
        return request(app.getHttpServer())
          .get('/api/content/templates/00000000-0000-0000-0000-000000000000/rendered')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });

    describe('/api/content/templates/:id/refresh (POST)', () => {
      it('should manually refresh template', () => {
        return request(app.getHttpServer())
          .post(`/api/content/templates/${templateId}/refresh`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body).toHaveProperty('metadata');
            expect(res.body.metadata.refreshConfig.lastRefresh).toBeDefined();
          });
      });

      it('should enforce multi-tenant isolation', () => {
        return request(app.getHttpServer())
          .post(`/api/content/templates/${templateId}/refresh`)
          .set('Authorization', `Bearer ${secondUserToken}`)
          .expect(404);
      });

      it('should reject without auth', () => {
        return request(app.getHttpServer())
          .post(`/api/content/templates/${templateId}/refresh`)
          .expect(401);
      });
    });

    describe('Template in content list', () => {
      it('should include templates in content list', () => {
        return request(app.getHttpServer())
          .get('/api/content')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            const template = res.body.data.find((c: any) => c.id === templateId);
            expect(template).toBeDefined();
            expect(template.type).toBe('template');
          });
      });

      it('should filter by template type', () => {
        return request(app.getHttpServer())
          .get('/api/content?type=template')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            const allTemplates = res.body.data.every((c: any) => c.type === 'template');
            expect(allTemplates).toBe(true);
          });
      });

      it('should get single template by ID', () => {
        return request(app.getHttpServer())
          .get(`/api/content/${templateId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200)
          .expect((res) => {
            expect(res.body.id).toBe(templateId);
            expect(res.body.type).toBe('template');
            expect(res.body.metadata).toHaveProperty('templateHtml');
          });
      });
    });
  });
});
