import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app/app.module';
import { DatabaseService } from '../src/modules/database/database.service';
import { SanitizeInterceptor } from '../src/modules/common/interceptors/sanitize.interceptor';

describe('Playlists (e2e)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let authToken: string;
  let userId: string;
  let organizationId: string;
  let playlistId: string;
  let contentId1: string;
  let contentId2: string;
  let secondUserToken: string;
  let secondOrgId: string;
  let secondUserId: string;

  const timestamp = Date.now();
  const testUser = {
    email: `playlist-test-${timestamp}@example.com`,
    password: 'SecureP@ssw0rd!',
    firstName: 'Playlist',
    lastName: 'Tester',
    organizationName: 'Playlist Test Org',
    organizationSlug: `playlist-test-${timestamp}`,
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

    // Create test content items
    const content1Res = await request(app.getHttpServer())
      .post('/api/content')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Content 1',
        type: 'image',
        url: 'https://example.com/image1.jpg',
      });
    contentId1 = content1Res.body.id;

    const content2Res = await request(app.getHttpServer())
      .post('/api/content')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Test Content 2',
        type: 'video',
        url: 'https://example.com/video1.mp4',
        duration: 30,
      });
    contentId2 = content2Res.body.id;

    // Create second user for multi-tenant testing
    const timestamp2 = Date.now() + 1;
    const secondUser = {
      email: `playlist-test2-${timestamp2}@example.com`,
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
    if (playlistId) {
      await db.playlist.delete({ where: { id: playlistId } }).catch(() => {});
    }
    if (contentId1) {
      await db.content.delete({ where: { id: contentId1 } }).catch(() => {});
    }
    if (contentId2) {
      await db.content.delete({ where: { id: contentId2 } }).catch(() => {});
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

  describe('/api/playlists (POST)', () => {
    it('should create empty playlist', () => {
      return request(app.getHttpServer())
        .post('/api/playlists')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Playlist',
          description: 'A test playlist',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Test Playlist');
          expect(res.body.organizationId).toBe(organizationId);
          
          playlistId = res.body.id;
        });
    });

    it('should create playlist with items', () => {
      return request(app.getHttpServer())
        .post('/api/playlists')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Playlist with Items',
          description: 'Has content',
          items: [
            { contentId: contentId1, order: 1, duration: 10 },
            { contentId: contentId2, order: 2, duration: 30 },
          ],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.name).toBe('Playlist with Items');
          // Cleanup
          db.playlist.delete({ where: { id: res.body.id } }).catch(() => {});
        });
    });

    it('should reject playlist without name', () => {
      return request(app.getHttpServer())
        .post('/api/playlists')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'No name',
        })
        .expect(400);
    });

    it('should reject without auth', () => {
      return request(app.getHttpServer())
        .post('/api/playlists')
        .send({
          name: 'Unauthorized Playlist',
        })
        .expect(401);
    });

    it('should sanitize XSS in playlist name', () => {
      return request(app.getHttpServer())
        .post('/api/playlists')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '<script>alert("xss")</script>Malicious Playlist',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.name).not.toContain('<script>');
          // Cleanup
          db.playlist.delete({ where: { id: res.body.id } }).catch(() => {});
        });
    });
  });

  describe('/api/playlists (GET)', () => {
    it('should list playlists', () => {
      return request(app.getHttpServer())
        .get('/api/playlists')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('meta');
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThanOrEqual(1);
          
          const found = res.body.data.find((p: any) => p.id === playlistId);
          expect(found).toBeDefined();
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/api/playlists?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.meta.page).toBe(1);
          expect(res.body.meta.limit).toBe(5);
        });
    });

    it('should reject without auth', () => {
      return request(app.getHttpServer())
        .get('/api/playlists')
        .expect(401);
    });

    it('should enforce multi-tenant isolation', () => {
      return request(app.getHttpServer())
        .get('/api/playlists')
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(200)
        .expect((res) => {
          const found = res.body.data.find((p: any) => p.id === playlistId);
          expect(found).toBeUndefined();
        });
    });
  });

  describe('/api/playlists/:id (GET)', () => {
    it('should get single playlist', () => {
      return request(app.getHttpServer())
        .get(`/api/playlists/${playlistId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(playlistId);
          expect(res.body.name).toBe('Test Playlist');
        });
    });

    it('should return 404 for non-existent playlist', () => {
      return request(app.getHttpServer())
        .get('/api/playlists/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should enforce multi-tenant isolation', () => {
      return request(app.getHttpServer())
        .get(`/api/playlists/${playlistId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(404);
    });

    it('should reject without auth', () => {
      return request(app.getHttpServer())
        .get(`/api/playlists/${playlistId}`)
        .expect(401);
    });
  });

  describe('/api/playlists/:id (PATCH)', () => {
    it('should update playlist', () => {
      return request(app.getHttpServer())
        .patch(`/api/playlists/${playlistId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Updated Playlist Name',
          description: 'Updated description',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Updated Playlist Name');
          expect(res.body.description).toBe('Updated description');
        });
    });

    it('should enforce multi-tenant isolation', () => {
      return request(app.getHttpServer())
        .patch(`/api/playlists/${playlistId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          name: 'Hacked Name',
        })
        .expect(404);
    });

    it('should reject without auth', () => {
      return request(app.getHttpServer())
        .patch(`/api/playlists/${playlistId}`)
        .send({
          name: 'Unauthorized Update',
        })
        .expect(401);
    });
  });

  describe('/api/playlists/:id/items (POST)', () => {
    it('should add item to playlist', () => {
      return request(app.getHttpServer())
        .post(`/api/playlists/${playlistId}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: contentId1,
          order: 1,
          duration: 10,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.contentId).toBe(contentId1);
        });
    });

    it('should reject without auth', () => {
      return request(app.getHttpServer())
        .post(`/api/playlists/${playlistId}/items`)
        .send({
          contentId: contentId2,
        })
        .expect(401);
    });
  });

  describe('/api/playlists/:id/items (DELETE)', () => {
    let itemToDelete: string;

    beforeAll(async () => {
      const addRes = await request(app.getHttpServer())
        .post(`/api/playlists/${playlistId}/items`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          contentId: contentId2,
          order: 2,
          duration: 30,
        });
      
      itemToDelete = addRes.body.id;
    });

    it('should remove item from playlist', () => {
      return request(app.getHttpServer())
        .delete(`/api/playlists/${playlistId}/items/${itemToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should reject without auth', () => {
      return request(app.getHttpServer())
        .delete(`/api/playlists/${playlistId}/items/some-id`)
        .expect(401);
    });
  });

  describe('/api/playlists/:id (DELETE)', () => {
    let playlistToDelete: string;

    beforeAll(async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/playlists')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Playlist to Delete',
        });

      playlistToDelete = createRes.body.id;
    });

    it('should delete playlist', () => {
      return request(app.getHttpServer())
        .delete(`/api/playlists/${playlistToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });

    it('should return 404 when deleting already deleted playlist', () => {
      return request(app.getHttpServer())
        .delete(`/api/playlists/${playlistToDelete}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });

    it('should enforce multi-tenant isolation', () => {
      return request(app.getHttpServer())
        .delete(`/api/playlists/${playlistId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(404);
    });

    it('should reject without auth', () => {
      return request(app.getHttpServer())
        .delete(`/api/playlists/${playlistId}`)
        .expect(401);
    });
  });

  describe('Default Playlist', () => {
    it('should create default playlist', () => {
      return request(app.getHttpServer())
        .post('/api/playlists')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Default Playlist',
          isDefault: true,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.isDefault).toBe(true);
          // Cleanup
          db.playlist.delete({ where: { id: res.body.id } }).catch(() => {});
        });
    });
  });
});
