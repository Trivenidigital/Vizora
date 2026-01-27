# VIZORA - IMPLEMENTATION GUIDE
## Phase-by-Phase Development Roadmap

**Version:** 2.0  
**Last Updated:** January 26, 2026  
**Document:** 3 of 5  
**Status:** Ready for Implementation

---

## IMPLEMENTATION TIMELINE

**Total Duration:** 9 weeks (MVP)

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Setup | Monorepo, Docker, DB schemas |
| 2-3 | Backend Core | Auth, Users, Orgs, Devices |
| 3-4 | Realtime | Socket.IO, Device comms |
| 4-5 | Content/Playlists | Upload, Storage, Playlists |
| 5 | Scheduling | CRON, Job queue |
| 6-7 | Frontend | Next.js dashboard |
| 7-8 | Device Client | Electron TV app |
| 8 | Analytics | ClickHouse, Grafana |
| 9 | Testing & Deploy | CI/CD, Production |

---

## PHASE 0: SETUP (Week 1)

### Objective
Set up development environment and project structure.

### Tasks

**Day 1-2: Monorepo Setup**
```bash
# Initialize Nx workspace
npx create-nx-workspace@latest vizora --pm pnpm

# Create apps
pnpm nx g @nx/nest:app middleware
pnpm nx g @nx/nest:app realtime
pnpm nx g @nx/next:app web
pnpm nx g @nx/js:app display

# Create libraries
pnpm nx g @nx/js:lib shared-types
pnpm nx g @nx/js:lib database
pnpm nx g @nx/js:lib auth
pnpm nx g @nx/js:lib config
```

**Day 3: Docker Setup**

Create `docker/docker-compose.yml`:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: vizora_user
      POSTGRES_PASSWORD: vizora_pass
      POSTGRES_DB: vizora
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - minio_data:/data

  clickhouse:
    image: clickhouse/clickhouse-server:24
    ports:
      - "8123:8123"
      - "9002:9000"
    volumes:
      - clickhouse_data:/var/lib/clickhouse

volumes:
  postgres_data:
  mongodb_data:
  redis_data:
  minio_data:
  clickhouse_data:
```

**Day 4-5: Database Schemas**

Create `apps/middleware/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_URL")
}

model User {
  id             String       @id @default(uuid())
  email          String       @unique
  passwordHash   String?
  clerkUserId    String?      @unique
  firstName      String
  lastName       String
  role           String       // admin, manager, viewer
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  isActive       Boolean      @default(true)
  lastLoginAt    DateTime?
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([email])
  @@index([organizationId])
}

model Organization {
  id                   String   @id @default(uuid())
  name                 String
  slug                 String   @unique
  subscriptionTier     String   @default("free") // free, basic, pro, enterprise
  screenQuota          Int      @default(5)
  stripeCustomerId     String?  @unique
  stripeSubscriptionId String?
  billingEmail         String?
  trialEndsAt          DateTime?
  subscriptionStatus   String   @default("trial") // trial, active, past_due, canceled
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  users   User[]
  devices Device[]

  @@index([slug])
}

model Device {
  id                    String    @id @default(uuid())
  organizationId        String
  organization          Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  deviceIdentifier      String    @unique
  nickname              String?
  pairingCode           String?
  pairingCodeExpiresAt  DateTime?
  jwtToken              String?   @db.Text
  socketId              String?
  lastHeartbeat         DateTime?
  status                String    @default("offline") // online, offline, pairing, error
  metadata              Json      @default("{}")
  location              String?
  timezone              String    @default("UTC")
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  pairedAt              DateTime?
  unpairedAt            DateTime?

  @@index([organizationId])
  @@index([status])
  @@index([pairingCode])
}

model AuditLog {
  id             String    @id @default(uuid())
  organizationId String?
  userId         String?
  action         String
  entityType     String?
  entityId       String?
  details        Json      @default("{}")
  ipAddress      String?
  userAgent      String?   @db.Text
  createdAt      DateTime  @default(now())

  @@index([organizationId])
  @@index([userId])
  @@index([createdAt])
}
```

Run migrations:
```bash
cd apps/middleware
pnpm prisma migrate dev --name init
pnpm prisma generate
```

**Day 6-7: Environment Setup**

Create `.env.example`:
```bash
# Node
NODE_ENV=development

# PostgreSQL
POSTGRES_URL=postgresql://vizora_user:vizora_pass@localhost:5432/vizora

# MongoDB
MONGODB_URL=mongodb://localhost:27017/vizora

# Redis
REDIS_URL=redis://localhost:6379

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=vizora-assets
MINIO_USE_SSL=false

# ClickHouse
CLICKHOUSE_URL=http://localhost:8123
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_EXPIRES_IN=7d
DEVICE_JWT_SECRET=your-device-jwt-secret-min-32-chars

# Clerk (if using)
CLERK_SECRET_KEY=
CLERK_PUBLISHABLE_KEY=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# API
API_PORT=3000
REALTIME_PORT=3001
```

**Deliverables:**
- ✅ Working Nx monorepo
- ✅ All databases running in Docker
- ✅ Prisma schema and migrations
- ✅ Environment configuration

---

## PHASE 1: CORE BACKEND (Weeks 2-3)

### Objective
Build authentication, user management, and device pairing.

### Week 2: Authentication & Users

**Day 1-2: NestJS Setup**

Create `apps/middleware/src/main.ts`:
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3002'],
    credentials: true,
  });
  
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  
  app.setGlobalPrefix('api');
  
  await app.listen(process.env.API_PORT || 3000);
  console.log(`🚀 API running on http://localhost:${process.env.API_PORT || 3000}`);
}
bootstrap();
```

**Day 3-4: Auth Module**

Create `apps/middleware/src/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, PrismaService],
  exports: [AuthService],
})
export class AuthModule {}
```

Create `apps/middleware/src/auth/auth.service.ts`:
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if email exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Check if org slug exists
    const slug = dto.organizationSlug || this.generateSlug(dto.organizationName);
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug },
    });
    
    if (existingOrg) {
      throw new ConflictException('Organization slug already taken');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create organization
    const organization = await this.prisma.organization.create({
      data: {
        name: dto.organizationName,
        slug,
        subscriptionTier: 'free',
        screenQuota: 5,
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: 'admin',
        organizationId: organization.id,
      },
    });

    // Generate token
    const token = this.generateToken(user, organization);

    return {
      user: this.sanitizeUser(user),
      organization,
      token,
      expiresIn: 604800, // 7 days in seconds
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { organization: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Account is inactive');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = this.generateToken(user, user.organization);

    return {
      user: this.sanitizeUser(user),
      token,
      expiresIn: 604800,
    };
  }

  private generateToken(user: any, organization: any) {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      organizationId: organization.id,
      role: user.role,
    });
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
```

**Day 5-7: Device Pairing**

Create `apps/middleware/src/devices/devices.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';
import * as QRCode from 'qrcode';

@Injectable()
export class DevicesService {
  private redis: Redis;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async generatePairingCode(organizationId: string, dto?: CreatePairingDto) {
    // Check quota
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: { devices: { where: { unpairedAt: null } } },
    });

    if (org.devices.length >= org.screenQuota) {
      throw new ForbiddenException({
        code: 'DEVICE_003',
        message: 'Screen quota exceeded',
        details: {
          currentDevices: org.devices.length,
          quota: org.screenQuota,
          subscriptionTier: org.subscriptionTier,
        },
      });
    }

    // Generate 6-character code
    const code = this.generateCode();

    // Create device record
    const device = await this.prisma.device.create({
      data: {
        organizationId,
        deviceIdentifier: dto?.deviceIdentifier || `device-${Date.now()}`,
        nickname: dto?.nickname,
        pairingCode: code,
        pairingCodeExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
        status: 'pairing',
      },
    });

    // Store in Redis
    await this.redis.setex(
      `pairing:code:${code}`,
      300, // 5 minutes TTL
      JSON.stringify({
        deviceId: device.id,
        organizationId,
        createdAt: new Date().toISOString(),
      })
    );

    // Generate QR code
    const qrCode = await QRCode.toDataURL(code);

    return {
      code,
      deviceId: device.id,
      expiresAt: device.pairingCodeExpiresAt,
      qrCode,
    };
  }

  async confirmPairing(code: string, organizationId: string, nickname?: string) {
    // Get from Redis
    const data = await this.redis.get(`pairing:code:${code}`);
    
    if (!data) {
      throw new NotFoundException({
        code: 'DEVICE_001',
        message: 'Invalid or expired pairing code',
      });
    }

    const { deviceId, organizationId: storedOrgId } = JSON.parse(data);

    // Verify organization
    if (storedOrgId !== organizationId) {
      throw new ForbiddenException({
        code: 'AUTHZ_003',
        message: 'Organization mismatch',
      });
    }

    // Update device
    const device = await this.prisma.device.update({
      where: { id: deviceId },
      data: {
        nickname: nickname || device.nickname,
        pairingCode: null,
        pairingCodeExpiresAt: null,
        status: 'online',
        pairedAt: new Date(),
        jwtToken: null, // Will be set below
      },
    });

    // Generate device JWT
    const deviceToken = this.jwtService.sign(
      {
        sub: device.id,
        deviceIdentifier: device.deviceIdentifier,
        organizationId: device.organizationId,
        type: 'device',
      },
      {
        secret: process.env.DEVICE_JWT_SECRET,
        expiresIn: '365d', // 1 year
      }
    );

    // Update with token
    await this.prisma.device.update({
      where: { id: deviceId },
      data: { jwtToken: deviceToken },
    });

    // Delete Redis key
    await this.redis.del(`pairing:code:${code}`);

    return {
      device,
      deviceToken,
      socketUrl: process.env.REALTIME_URL || 'ws://localhost:3001',
      config: {
        heartbeatInterval: 15000,
        cacheSize: 524288000, // 500MB
        autoUpdate: true,
      },
    };
  }

  private generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar chars
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}
```

**Deliverables:**
- ✅ User registration and login
- ✅ JWT authentication
- ✅ Device pairing code generation
- ✅ Device pairing confirmation
- ✅ Unit tests for auth and devices

---

## PHASE 2: REALTIME GATEWAY (Weeks 3-4)

### Objective
Build Socket.IO gateway for real-time device communication.

Create `apps/realtime/src/gateways/device.gateway.ts`:
```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import Redis from 'ioredis';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN?.split(','),
    credentials: true,
  },
})
export class DeviceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private redis: Redis;

  constructor(private jwtService: JwtService) {
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      
      if (!token) {
        client.disconnect();
        return;
      }

      // Verify device JWT
      const payload = this.jwtService.verify(token, {
        secret: process.env.DEVICE_JWT_SECRET,
      });

      if (payload.type !== 'device') {
        client.disconnect();
        return;
      }

      const deviceId = payload.sub;

      // Store client info
      client.data.deviceId = deviceId;
      client.data.organizationId = payload.organizationId;

      // Join device room
      client.join(`device:${deviceId}`);
      client.join(`org:${payload.organizationId}`);

      // Update device status in Redis
      await this.redis.setex(
        `device:status:${deviceId}`,
        60,
        JSON.stringify({
          status: 'online',
          lastHeartbeat: Date.now(),
          socketId: client.id,
        })
      );

      console.log(`✅ Device connected: ${deviceId}`);

      // Notify admins
      this.server.to(`org:${payload.organizationId}`).emit('device:status', {
        deviceId,
        status: 'online',
      });
    } catch (error) {
      console.error('Connection error:', error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const deviceId = client.data.deviceId;
    
    if (deviceId) {
      // Update status
      await this.redis.setex(
        `device:status:${deviceId}`,
        60,
        JSON.stringify({
          status: 'offline',
          lastHeartbeat: Date.now(),
          socketId: null,
        })
      );

      console.log(`❌ Device disconnected: ${deviceId}`);

      // Notify admins
      this.server.to(`org:${client.data.organizationId}`).emit('device:status', {
        deviceId,
        status: 'offline',
      });
    }
  }

  @SubscribeMessage('heartbeat')
  async handleHeartbeat(client: Socket, data: any) {
    const deviceId = client.data.deviceId;

    // Update in Redis
    await this.redis.setex(
      `device:status:${deviceId}`,
      60,
      JSON.stringify({
        status: 'online',
        lastHeartbeat: Date.now(),
        socketId: client.id,
        metrics: data.metrics,
        currentContent: data.currentContent,
      })
    );

    // Return commands if any
    return {
      nextHeartbeatIn: 15000,
      commands: [],
    };
  }

  // Method to send playlist update from API
  async sendPlaylistUpdate(deviceId: string, playlist: any) {
    this.server.to(`device:${deviceId}`).emit('playlist:update', {
      playlist,
      timestamp: new Date().toISOString(),
    });
  }
}
```

**Deliverables:**
- ✅ Socket.IO gateway
- ✅ Device authentication
- ✅ Heartbeat handling
- ✅ Room management
- ✅ Presence tracking

---

## PHASE 3: CONTENT & PLAYLISTS (Weeks 4-5)

### Objective
Build content upload, storage, and playlist management.

Create `apps/middleware/src/content/content.service.ts`:
```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Content } from './schemas/content.schema';
import * as Minio from 'minio';
import * as sharp from 'sharp';

@Injectable()
export class ContentService {
  private minioClient: Minio.Client;

  constructor(
    @InjectModel(Content.name) private contentModel: Model<Content>,
  ) {
    this.minioClient = new Minio.Client({
      endPoint: process.env.MINIO_ENDPOINT,
      port: parseInt(process.env.MINIO_PORT),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
    });
  }

  async uploadContent(
    organizationId: string,
    userId: string,
    file: Express.Multer.File,
    dto: UploadContentDto,
  ) {
    // Validate file
    if (file.size > 100 * 1024 * 1024) { // 100MB
      throw new PayloadTooLargeException({
        code: 'CONTENT_002',
        message: 'File size exceeds maximum (100MB)',
      });
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/webm',
      'application/pdf',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException({
        code: 'CONTENT_003',
        message: 'File type not supported',
      });
    }

    // Generate unique filename
    const ext = file.originalname.split('.').pop();
    const filename = `${organizationId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;

    // Upload to MinIO
    await this.minioClient.putObject(
      process.env.MINIO_BUCKET,
      filename,
      file.buffer,
      file.size,
      {
        'Content-Type': file.mimetype,
      }
    );

    // Create content record
    const content = await this.contentModel.create({
      organizationId,
      type: dto.type,
      title: dto.title,
      description: dto.description,
      source: `https://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${process.env.MINIO_BUCKET}/${filename}`,
      tags: dto.tags || [],
      uploadStatus: 'processing',
      metadata: {
        size: file.size,
        mimeType: file.mimetype,
      },
      createdBy: userId,
    });

    // Queue thumbnail generation
    await this.queueThumbnailGeneration(content._id.toString(), filename, file.mimetype);

    return content;
  }

  private async queueThumbnailGeneration(contentId: string, filename: string, mimeType: string) {
    // Add to BullMQ queue (implementation depends on queue setup)
    // For now, generate inline
    if (mimeType.startsWith('image/')) {
      await this.generateImageThumbnail(contentId, filename);
    }
  }

  private async generateImageThumbnail(contentId: string, filename: string) {
    try {
      // Download original
      const stream = await this.minioClient.getObject(process.env.MINIO_BUCKET, filename);
      const chunks = [];
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      const buffer = Buffer.concat(chunks);

      // Generate thumbnail
      const thumbnail = await sharp(buffer)
        .resize(400, 400, { fit: 'inside' })
        .toBuffer();

      // Upload thumbnail
      const thumbFilename = filename.replace(/(\.[^.]+)$/, '_thumb$1');
      await this.minioClient.putObject(
        process.env.MINIO_BUCKET,
        thumbFilename,
        thumbnail,
        thumbnail.length,
        { 'Content-Type': 'image/jpeg' }
      );

      // Update content
      await this.contentModel.findByIdAndUpdate(contentId, {
        thumbnail: `https://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/${process.env.MINIO_BUCKET}/${thumbFilename}`,
        uploadStatus: 'ready',
      });
    } catch (error) {
      await this.contentModel.findByIdAndUpdate(contentId, {
        uploadStatus: 'failed',
        uploadError: error.message,
      });
    }
  }
}
```

**Deliverables:**
- ✅ File upload to MinIO
- ✅ Content CRUD operations
- ✅ Thumbnail generation
- ✅ Playlist CRUD operations
- ✅ MongoDB schemas

---

## PHASE 4: SCHEDULING (Week 5)

### Objective
Implement CRON-based scheduling with BullMQ.

Create `apps/middleware/src/schedules/schedule.processor.ts`:
```typescript
import { Processor, Process } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Schedule } from './schemas/schedule.schema';
import { DeviceGateway } from '../../realtime/gateways/device.gateway';

@Processor('schedule-execution')
export class ScheduleProcessor {
  constructor(
    @InjectModel(Schedule.name) private scheduleModel: Model<Schedule>,
    private deviceGateway: DeviceGateway,
  ) {}

  @Process('execute')
  async executeSchedule(job: Job) {
    const { scheduleId, deviceId, playlistId } = job.data;

    // Get playlist details
    const playlist = await this.playlistModel.findById(playlistId)
      .populate('items.content');

    // Send to device
    await this.deviceGateway.sendPlaylistUpdate(deviceId, playlist);

    // Update schedule
    await this.scheduleModel.findByIdAndUpdate(scheduleId, {
      lastExecutedAt: new Date(),
      $inc: { executionCount: 1 },
    });
  }
}
```

**Deliverables:**
- ✅ CRON schedule parsing
- ✅ BullMQ job queue
- ✅ Schedule execution
- ✅ Instant publish override
- ✅ Priority handling

---

## PHASE 5-9: QUICK REFERENCE

### Phase 5: Frontend (Weeks 6-7)
- Next.js 14 App Router setup
- shadcn/ui components
- Authentication pages
- Dashboard layout
- Device management UI
- Asset manager
- Playlist builder
- Schedule creator

### Phase 6: Device Client (Weeks 7-8)
- Electron app setup
- Pairing screen
- Socket.IO client
- Content playback engine
- Caching system
- Heartbeat service

### Phase 7: Analytics (Week 8)
- ClickHouse ingestion
- Grafana dashboards
- Analytics API endpoints
- Export functionality

### Phase 8: Testing (Week 9)
- Unit tests (80% coverage)
- Integration tests
- E2E tests with Playwright
- Load testing with k6

### Phase 9: Deployment (Week 9)
- Docker images
- Kubernetes manifests
- CI/CD pipeline
- Production deployment

---

**Document End**
