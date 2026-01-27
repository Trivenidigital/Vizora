# VIZORA - CORE PRODUCT REQUIREMENTS DOCUMENT
## Vision, Architecture, Tech Stack & Database Design

**Version:** 2.0  
**Last Updated:** January 26, 2026  
**Document:** 1 of 5  
**Status:** Ready for Implementation

---

## TABLE OF CONTENTS

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Strategy](#2-product-vision--strategy)
3. [Tech Stack & Dependencies](#3-tech-stack--dependencies)
4. [System Architecture](#4-system-architecture)
5. [Database Design](#5-database-design)
6. [Project Structure](#6-project-structure)
7. [Development Environment](#7-development-environment)

---

## 1. EXECUTIVE SUMMARY

### 1.1 What is Vizora?

Vizora is a **cloud-based digital signage platform** that revolutionizes how businesses manage content on displays. Unlike traditional solutions requiring external hardware (Fire Sticks, Raspberry Pi), Vizora runs natively on smart TVs and browsers.

### 1.2 Key Differentiators

| Feature | Traditional Solutions | Vizora |
|---------|----------------------|---------|
| Hardware Required | Yes (Fire Stick, Pi, etc.) | No - runs natively |
| Setup Time | 30-60 minutes | 5 minutes (QR pairing) |
| Content Updates | Manual or scheduled | AI-assisted + instant |
| Pricing Model | Per device hardware cost + software | Software only, scalable |
| Intelligence | Manual scheduling | AI-powered optimization |

### 1.3 Target Market

**Primary Personas:**
- **Retail Chains**: Dynamic promotions, seasonal campaigns
- **Restaurants & Cafés**: Menu boards, daily specials
- **Corporate Offices**: Internal communications, event displays
- **Educational Campuses**: Announcements, schedules, wayfinding
- **Franchise Networks**: Centralized content distribution

**Market Size:**
- Global digital signage market: $23B (2024)
- Growing at 7.5% CAGR
- Target: SMB to mid-market (5-500 screens)

### 1.4 Core Value Propositions

1. **Zero Hardware Cost** - Eliminate $50-150/device hardware expenses
2. **5-Minute Setup** - QR code pairing vs. 30+ minute installations
3. **Instant Updates** - Real-time content publishing
4. **AI-Powered** - Autonomous content optimization (Phase 2+)
5. **Comprehensive Content** - Images, videos, PDFs, webpages, dashboards, spreadsheets, live data feeds

---

## 2. PRODUCT VISION & STRATEGY

### 2.1 Mission Statement

> Democratize digital signage by making it accessible, intelligent, and effortless for businesses of all sizes.

### 2.2 Strategic Objectives

**Year 1 (MVP - 2026):**
- ✅ Launch core platform (device pairing, content, playlists, scheduling)
- ✅ Onboard 500 organizations
- ✅ Achieve 5,000 active screens
- ✅ 99.5% uptime SLA

**Year 2 (AI Integration - 2027):**
- ✅ AI content generation
- ✅ Predictive scheduling
- ✅ Autonomous optimization
- ✅ 5,000 organizations, 50,000 screens

**Year 3 (Enterprise - 2028):**
- ✅ Enterprise features (SSO, advanced RBAC, audit)
- ✅ White-label offering
- ✅ API marketplace
- ✅ 20,000 organizations, 200,000 screens

### 2.3 Product Principles

1. **Simplicity First** - If a feature requires a manual, it's too complex
2. **Hardware-Free** - Never require external devices
3. **Real-Time Everything** - Updates should propagate in <1 second
4. **AI-Augmented** - Automate the mundane, elevate the creative
5. **Privacy-Respecting** - Minimal data collection, maximum user control

### 2.4 Success Metrics (North Star)

**Primary Metric:** Active Screens (devices displaying content)

**Supporting Metrics:**
- Time to first content (goal: <10 minutes from signup)
- Content impressions per device per day
- Average uptime (goal: >99%)
- Customer retention rate (goal: >90% annual)
- NPS score (goal: >50)

---

## 3. TECH STACK & DEPENDENCIES

### 3.1 Core Technologies

#### Runtime & Language
```yaml
Node.js: 22.x LTS
TypeScript: 5.3+
Package Manager: pnpm 9.x
Monorepo Tool: Nx 18.x
```

**Rationale:**
- Node.js 22: Latest LTS with native test runner, improved performance
- TypeScript: Type safety, better DX, easier refactoring
- pnpm: Faster installs, disk efficiency, strict dependency resolution
- Nx: Best-in-class monorepo tooling, caching, task orchestration

#### Backend Framework
```yaml
Primary: NestJS 10.x
Alternative: Express 4.19+ (if simpler architecture preferred)
```

**Rationale:**
- NestJS: Enterprise-grade, TypeScript-first, modular architecture
- Built-in dependency injection, decorators, guards
- Excellent testing support
- Large ecosystem and community

**Decision Point:** Use NestJS for structure and scalability. If team prefers simpler approach, Express is acceptable but requires more boilerplate.

#### Frontend Framework
```yaml
Framework: Next.js 14.x (App Router)
UI Library: React 18.x
Styling: Tailwind CSS 3.4+
Components: shadcn/ui (Radix UI primitives)
Icons: lucide-react
Animations: Framer Motion 11+
Forms: React Hook Form 7.x + Zod 3.x
State: React Query 5.x (server state) + Zustand (client state)
```

**Rationale:**
- Next.js: SSR/SSG capabilities, excellent DX, built-in optimization
- shadcn/ui: Copy-paste components, full customization, no npm bloat
- Tailwind: Rapid prototyping, consistent design, smaller CSS bundles
- React Query: Declarative data fetching, caching, synchronization

### 3.2 Databases

#### PostgreSQL 16.x - Relational Data
```yaml
Purpose: Users, organizations, devices, audit logs
ORM: Prisma 5.x
Connection Pooling: PgBouncer
```

**Tables:**
- `users` - User accounts and authentication
- `organizations` - Multi-tenant isolation
- `devices` - Paired display devices
- `locations` - Physical locations (optional)
- `audit_logs` - Compliance and debugging

**Why PostgreSQL:**
- ACID compliance for critical business data
- Excellent JSON support for flexible schemas
- Proven scalability and reliability
- Strong tooling ecosystem

#### MongoDB 7.x - Document Store
```yaml
Purpose: Content, playlists, schedules
ODM: Mongoose 8.x
```

**Collections:**
- `contents` - Media assets and metadata
- `playlists` - Ordered content sequences
- `schedules` - CRON-based scheduling rules
- `instant_publishes` - Temporary overrides

**Why MongoDB:**
- Flexible schema for varied content types
- Excellent for nested data (playlist items)
- Fast reads for content delivery
- TTL indexes for automatic cleanup

#### Redis 7.x - Cache & Queue
```yaml
Purpose: Sessions, pairing codes, caching, job queue
Client: ioredis 5.x
```

**Use Cases:**
- Pairing codes (5-minute TTL)
- Active sessions
- Device status cache
- Rate limiting counters
- BullMQ job queue backend

**Why Redis:**
- Blazing fast in-memory operations
- Native TTL support
- Pub/sub for real-time features
- Reliable job queue backend

#### ClickHouse 24.x - Analytics
```yaml
Purpose: Time-series analytics, metrics, logs
Client: @clickhouse/client
```

**Tables:**
- `heartbeats` - Device health metrics
- `impressions` - Content display events
- `playback_errors` - Error tracking
- `api_logs` - Request/response logs

**Why ClickHouse:**
- Columnar storage for analytical queries
- Exceptional compression ratios
- Real-time data ingestion
- Built for time-series data

### 3.3 Infrastructure Services

#### Object Storage
```yaml
Development: MinIO (latest)
Production: AWS S3 / Cloudflare R2
SDK: @aws-sdk/client-s3 (S3-compatible)
```

**Usage:**
- Media file storage
- Thumbnail storage
- Export file storage

#### Real-Time Communication
```yaml
Framework: Socket.IO 4.7+
Adapter: @socket.io/redis-adapter (for scaling)
```

**Capabilities:**
- Device-server bidirectional communication
- Admin real-time monitoring
- Instant playlist updates
- Presence tracking

#### Job Queue
```yaml
Library: BullMQ 5.x
Backend: Redis
```

**Queues:**
- `content-processing` - Thumbnail generation, video processing
- `schedule-execution` - CRON job processing
- `analytics-ingestion` - Batch insert to ClickHouse
- `email-notifications` - Async email sending

#### Authentication
```yaml
Primary: Clerk (recommended for MVP speed)
Alternative: Custom JWT with bcrypt
Library: @clerk/backend, @clerk/nextjs
```

**Decision:**
- **Use Clerk** if you want fast MVP with built-in user management UI
- **Use Custom JWT** if you need full control or lower long-term costs

**Implementation:**
- JWT tokens (HS256)
- Role-based access control (RBAC)
- Separate device JWT for TV clients

#### Payment Processing
```yaml
Provider: Stripe
SDK: stripe (latest)
```

**Features:**
- Subscription management
- Usage-based billing
- Customer portal
- Invoice generation

### 3.4 Development Tools

#### Code Quality
```yaml
Linting: ESLint 8.x + @typescript-eslint
Formatting: Prettier 3.x
Git Hooks: Husky + lint-staged
Commit Linting: commitlint (Conventional Commits)
```

#### Testing
```yaml
Unit Testing: Jest 29.x + @testing-library/react
E2E Testing: Playwright
API Testing: Supertest
Load Testing: k6
```

#### CI/CD
```yaml
Platform: GitHub Actions
Registry: GitHub Container Registry (ghcr.io)
Deployment: Kubernetes (production)
```

#### Monitoring & Observability
```yaml
Metrics: Prometheus
Visualization: Grafana
Logging: Winston + Loki
Error Tracking: Sentry (optional)
APM: (optional - New Relic, Datadog)
```

### 3.5 Key Dependencies

**Backend (middleware):**
```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/jwt": "^10.0.0",
  "@nestjs/passport": "^10.0.0",
  "@nestjs/platform-socket.io": "^10.0.0",
  "@nestjs/websockets": "^10.0.0",
  "@nestjs/throttler": "^5.0.0",
  "@prisma/client": "^5.0.0",
  "prisma": "^5.0.0",
  "mongoose": "^8.0.0",
  "ioredis": "^5.3.0",
  "socket.io": "^4.7.0",
  "bullmq": "^5.0.0",
  "minio": "^7.1.0",
  "stripe": "^14.0.0",
  "@clerk/backend": "^1.0.0",
  "cron-parser": "^4.9.0",
  "bcrypt": "^5.1.0",
  "class-validator": "^0.14.0",
  "class-transformer": "^0.5.0"
}
```

**Frontend (web):**
```json
{
  "next": "^14.0.0",
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "@clerk/nextjs": "^5.0.0",
  "socket.io-client": "^4.7.0",
  "@tanstack/react-query": "^5.0.0",
  "zustand": "^4.4.0",
  "react-hook-form": "^7.0.0",
  "zod": "^3.22.0",
  "framer-motion": "^11.0.0",
  "tailwindcss": "^3.4.0",
  "lucide-react": "^0.300.0",
  "@radix-ui/react-*": "latest"
}
```

**Device Client (display):**
```json
{
  "electron": "^28.0.0",
  "react": "^18.0.0",
  "socket.io-client": "^4.7.0",
  "electron-store": "^8.1.0",
  "electron-updater": "^6.1.0"
}
```

---

## 4. SYSTEM ARCHITECTURE

### 4.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VIZORA ECOSYSTEM                          │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Admin      │     │  TV/Device   │     │   Public     │
│  Dashboard   │     │   Client     │     │   Website    │
│  (Next.js)   │     │  (Electron)  │     │  (Next.js)   │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                     │
       │ HTTPS              │ WebSocket          │ HTTPS
       │                    │                     │
       ▼                    ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     GATEWAY LAYER                            │
│  ┌──────────────────┐           ┌─────────────────────┐   │
│  │  Middleware API  │◄─────────►│  Realtime Gateway   │   │
│  │   (NestJS)       │           │   (Socket.IO)       │   │
│  │  Port: 3000      │           │   Port: 3001        │   │
│  │                  │           │                     │   │
│  │ - Auth           │           │ - Device rooms      │   │
│  │ - CRUD APIs      │           │ - Presence          │   │
│  │ - Business Logic │           │ - Live updates      │   │
│  └────────┬─────────┘           └──────────┬──────────┘   │
└───────────┼────────────────────────────────┼──────────────┘
            │                                │
            ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│                      DATA LAYER                              │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ PostgreSQL   │  │  MongoDB     │  │    Redis     │     │
│  │              │  │              │  │              │     │
│  │ - users      │  │ - contents   │  │ - sessions   │     │
│  │ - orgs       │  │ - playlists  │  │ - cache      │     │
│  │ - devices    │  │ - schedules  │  │ - queue      │     │
│  │ - audit_logs │  │              │  │ - pairing    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐                                           │
│  │ ClickHouse   │                                           │
│  │              │                                           │
│  │ - heartbeats │                                           │
│  │ - impressions│                                           │
│  │ - errors     │                                           │
│  │ - api_logs   │                                           │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────┐
│                  STORAGE & SERVICES                          │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌─────────┐  ┌────────────┐ │
│  │  MinIO   │  │  BullMQ  │  │ Grafana │  │   Stripe   │ │
│  │   S3     │  │   Jobs   │  │Analytics│  │  Billing   │ │
│  └──────────┘  └──────────┘  └─────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Data Flow Patterns

#### Pattern 1: Device Pairing Flow
```
1. TV Client boots
   ↓
2. Request pairing code from Middleware API
   ↓
3. Middleware generates 6-char code (e.g., "A1B2C3")
   ↓
4. Middleware stores in Redis: pairing:code:A1B2C3 (TTL: 5min)
   ↓
5. Middleware returns code + QR image
   ↓
6. TV displays code on screen
   ↓
7. Admin enters code in Web Dashboard
   ↓
8. Dashboard sends confirmation to Middleware
   ↓
9. Middleware validates code, checks quota
   ↓
10. Middleware creates device record in PostgreSQL
   ↓
11. Middleware generates device JWT
   ↓
12. Middleware deletes Redis key
   ↓
13. Middleware returns JWT + Socket.IO URL
   ↓
14. TV stores JWT, connects to Realtime Gateway
   ↓
15. Realtime Gateway verifies JWT, joins device room
   ↓
16. Device is now paired and online
```

#### Pattern 2: Content Upload & Delivery Flow
```
1. Admin uploads file in Dashboard
   ↓
2. Dashboard → POST /api/content/upload (multipart)
   ↓
3. Middleware validates file (type, size)
   ↓
4. Middleware uploads to MinIO (S3)
   ↓
5. Middleware creates MongoDB content record (status: "processing")
   ↓
6. Middleware adds job to BullMQ: generate-thumbnail
   ↓
7. Middleware returns content ID immediately
   ↓
8. Worker processes thumbnail generation
   ↓
9. Worker uploads thumbnail to MinIO
   ↓
10. Worker updates MongoDB (status: "ready")
   ↓
11. Worker emits Socket.IO event: content:ready
   ↓
12. Dashboard receives event, updates UI
```

#### Pattern 3: Playlist Publish & Playback Flow
```
1. Admin creates playlist with content items
   ↓
2. Admin clicks "Instant Publish" → selects devices
   ↓
3. Dashboard → POST /api/playlists/{id}/instant-publish
   ↓
4. Middleware creates InstantPublish record (MongoDB)
   ↓
5. Middleware → Realtime Gateway: publish to devices
   ↓
6. Realtime Gateway emits to device rooms: playlist:update
   ↓
7. TV Clients receive playlist data
   ↓
8. TV Clients prefetch all content (cache locally)
   ↓
9. TV Clients start playback loop
   ↓
10. TV Clients send heartbeat every 15s with playback status
   ↓
11. Middleware logs impressions to ClickHouse
```

### 4.3 Scalability Design

#### Horizontal Scaling
- **Middleware API**: Stateless, scale to N instances behind load balancer
- **Realtime Gateway**: Use Redis adapter for multi-instance Socket.IO
- **Workers**: BullMQ supports multiple worker processes
- **Databases**: Read replicas for PostgreSQL/MongoDB

#### Vertical Scaling Limits
- **PostgreSQL**: Primary handles up to 10k writes/sec
- **MongoDB**: Single replica set handles 50k reads/sec
- **Redis**: Single instance handles 100k ops/sec
- **ClickHouse**: Single node handles 1M rows/sec inserts

#### Performance Targets (MVP)
- API response time: p95 < 500ms
- Socket.IO latency: < 100ms
- Content delivery: < 2s for 10MB file
- Concurrent devices: 10,000+ per Realtime Gateway instance

---

## 5. DATABASE DESIGN

### 5.1 PostgreSQL Schema (Relational Data)

#### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255), -- nullable if using Clerk
  clerk_user_id VARCHAR(255) UNIQUE,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'viewer')),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_clerk ON users(clerk_user_id);
```

**Columns Explained:**
- `clerk_user_id`: If using Clerk, stores Clerk's user ID for sync
- `password_hash`: Only used if NOT using Clerk (bcrypt, cost 12)
- `role`: RBAC - determines permissions
- `is_active`: Soft deactivation without deletion

#### Organizations Table
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free' 
    CHECK (subscription_tier IN ('free', 'basic', 'pro', 'enterprise')),
  screen_quota INT NOT NULL DEFAULT 5,
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_subscription_id VARCHAR(255),
  billing_email VARCHAR(255),
  trial_ends_at TIMESTAMP,
  subscription_status VARCHAR(50) DEFAULT 'trial' 
    CHECK (subscription_status IN ('trial', 'active', 'past_due', 'canceled')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_org_slug ON organizations(slug);
CREATE INDEX idx_org_stripe ON organizations(stripe_customer_id);
```

**Subscription Logic:**
- New orgs start with 7-day trial
- `screen_quota` enforced on device pairing
- Stripe webhooks update subscription_status

#### Devices Table
```sql
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  device_identifier VARCHAR(255) UNIQUE NOT NULL, -- MAC address or UUID
  nickname VARCHAR(255), -- User-friendly name
  pairing_code VARCHAR(6), -- Temporary code during pairing
  pairing_code_expires_at TIMESTAMP,
  jwt_token TEXT, -- Device authentication token
  socket_id VARCHAR(255), -- Current Socket.IO connection ID
  last_heartbeat TIMESTAMP,
  status VARCHAR(50) DEFAULT 'offline' 
    CHECK (status IN ('online', 'offline', 'pairing', 'error')),
  metadata JSONB DEFAULT '{}', -- OS, resolution, model, etc.
  location VARCHAR(255),
  timezone VARCHAR(100) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  paired_at TIMESTAMP,
  unpaired_at TIMESTAMP
);

CREATE INDEX idx_devices_org ON devices(organization_id);
CREATE INDEX idx_devices_pairing ON devices(pairing_code) WHERE pairing_code IS NOT NULL;
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_heartbeat ON devices(last_heartbeat);
```

**Device Lifecycle:**
1. Created with status='pairing', pairing_code set
2. On confirmation: status='online', paired_at set, pairing_code=NULL
3. Heartbeats update last_heartbeat every 15s
4. If no heartbeat for 60s: status='offline' (updated by cron)
5. On unpair: unpaired_at set, status='offline'

#### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL, -- 'device_paired', 'content_uploaded', etc.
  entity_type VARCHAR(50), -- 'device', 'content', 'playlist', etc.
  entity_id UUID,
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_audit_action ON audit_logs(action);
```

**Purpose:**
- Compliance (SOC 2, GDPR data access logs)
- Security investigations
- User activity tracking
- Debugging

### 5.2 MongoDB Schema (Flexible Documents)

#### Contents Collection
```javascript
{
  _id: ObjectId("..."),
  organizationId: "uuid-from-postgres",
  type: "image" | "video" | "pdf" | "ppt" | "webpage" | "dashboard" | "spreadsheet" | "data_feed",
  title: "Summer Sale Banner",
  description: "Promotional banner for summer 2026 sale",
  source: "https://storage.vizora.com/org-xxx/file.jpg", // MinIO URL or external
  fallback: "https://storage.vizora.com/fallback.jpg", // If source fails
  thumbnail: "https://storage.vizora.com/org-xxx/file_thumb.jpg",
  
  metadata: {
    // For uploaded files
    size: 2048576, // bytes
    duration: 15.5, // seconds (videos)
    mimeType: "image/jpeg",
    width: 1920,
    height: 1080,
    frameRate: 30, // videos
    
    // For external content
    embedUrl: "https://grafana.company.com/dashboard",
    iframeSafe: true,
    corsEnabled: true,
    
    // For data feeds
    feedUrl: "https://api.weather.com/...",
    refreshInterval: 300 // seconds
  },
  
  tags: ["sale", "summer", "promotion"], // For filtering
  
  uploadStatus: "pending" | "processing" | "ready" | "failed",
  uploadError: "Error message if failed",
  
  // Access control
  isPublic: true, // If false, only sharedWith can access
  sharedWith: ["user-uuid-1", "user-uuid-2"],
  
  createdBy: "user-uuid",
  createdAt: ISODate("2026-01-26T00:00:00Z"),
  updatedAt: ISODate("2026-01-26T00:00:00Z"),
  deletedAt: null // Soft delete
}

// Indexes
db.contents.createIndex({ organizationId: 1, createdAt: -1 });
db.contents.createIndex({ organizationId: 1, type: 1 });
db.contents.createIndex({ tags: 1 });
db.contents.createIndex({ uploadStatus: 1 });
db.contents.createIndex({ createdBy: 1 });
db.contents.createIndex({ deletedAt: 1 }); // For soft delete queries
```

#### Playlists Collection
```javascript
{
  _id: ObjectId("..."),
  organizationId: "uuid",
  name: "Morning Promotions",
  description: "Content for morning hours (6am-12pm)",
  
  items: [
    {
      contentId: ObjectId("..."), // Reference to contents collection
      duration: 10, // seconds
      transition: "fade" | "slide" | "zoom" | "dissolve" | "none",
      transitionDuration: 500, // milliseconds
      order: 0
    },
    {
      contentId: ObjectId("..."),
      duration: 15,
      transition: "slide",
      transitionDuration: 300,
      order: 1
    }
  ],
  
  totalDuration: 25, // Calculated: sum of all item durations
  loopPlaylist: true, // Start over after last item
  
  thumbnail: "https://...", // First item's thumbnail
  lastModifiedBy: "user-uuid",
  
  createdBy: "user-uuid",
  createdAt: ISODate("..."),
  updatedAt: ISODate("..."),
  deletedAt: null
}

// Indexes
db.playlists.createIndex({ organizationId: 1, createdAt: -1 });
db.playlists.createIndex({ createdBy: 1 });
db.playlists.createIndex({ deletedAt: 1 });
```

**Playlist Logic:**
- Items are ordered by `order` field
- `totalDuration` is recalculated on save
- When fetching for playback, populate content details

#### Schedules Collection
```javascript
{
  _id: ObjectId("..."),
  organizationId: "uuid",
  deviceId: "uuid", // PostgreSQL device ID
  playlistId: ObjectId("..."), // MongoDB playlist
  
  name: "Weekday Morning Schedule",
  description: "Play morning promotions on weekdays",
  
  // CRON scheduling
  cronExpression: "0 9 * * 1-5", // At 9am, Mon-Fri
  timezone: "America/New_York", // IANA timezone
  
  // Date range
  startDate: ISODate("2026-01-27T00:00:00Z"),
  endDate: ISODate("2026-12-31T23:59:59Z"), // null = indefinite
  
  // Priority (for conflict resolution)
  priority: 50, // 0-100, higher = more important
  
  // Status
  isActive: true,
  
  // Execution tracking
  lastExecutedAt: ISODate("..."),
  nextExecutionAt: ISODate("2026-01-27T14:00:00Z"), // Calculated
  executionCount: 15,
  
  // Override options
  allowOverride: true, // Can instant publish override this?
  
  createdBy: "user-uuid",
  createdAt: ISODate("..."),
  updatedAt: ISODate("..."),
  deletedAt: null
}

// Indexes
db.schedules.createIndex({ organizationId: 1, deviceId: 1 });
db.schedules.createIndex({ deviceId: 1, isActive: 1, nextExecutionAt: 1 });
db.schedules.createIndex({ nextExecutionAt: 1 }); // For scheduler scanning
db.schedules.createIndex({ deletedAt: 1 });
```

**Schedule Execution:**
- Cron job runs every minute
- Finds schedules where `nextExecutionAt <= now` and `isActive = true`
- Creates BullMQ job for each
- Updates `nextExecutionAt` after execution

#### Instant Publishes Collection
```javascript
{
  _id: ObjectId("..."),
  organizationId: "uuid",
  deviceId: "uuid",
  playlistId: ObjectId("..."),
  
  // Temporary override
  expiresAt: ISODate("2026-01-26T22:00:00Z"), // Auto-delete after
  overridesSchedule: true,
  
  publishedBy: "user-uuid",
  publishedAt: ISODate("...")
}

// Indexes
db.instantPublishes.createIndex({ deviceId: 1, expiresAt: 1 });
db.instantPublishes.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL
```

**Instant Publish Logic:**
- Takes immediate precedence over schedules
- MongoDB TTL index auto-deletes when expired
- Device checks for instant publish before playing schedule

### 5.3 Redis Data Structures

#### Pairing Codes
```
Key: pairing:code:{CODE}
Type: String (JSON)
Value: {
  "deviceId": "uuid",
  "organizationId": "uuid",
  "createdAt": "2026-01-26T20:00:00Z"
}
TTL: 300 seconds (5 minutes)
```

#### Active Sessions (if not using Clerk)
```
Key: session:{USER_ID}
Type: String (JSON)
Value: {
  "userId": "uuid",
  "email": "user@example.com",
  "organizationId": "uuid",
  "role": "admin",
  "iat": 1234567890
}
TTL: 604800 seconds (7 days)
```

#### Device Status Cache
```
Key: device:status:{DEVICE_ID}
Type: String (JSON)
Value: {
  "status": "online",
  "lastHeartbeat": 1234567890,
  "socketId": "abc123",
  "currentPlaylistId": "xyz789"
}
TTL: 60 seconds (refreshed on heartbeat)
```

#### Rate Limiting
```
Key: ratelimit:{IP}:{ENDPOINT}
Type: String (counter)
Value: "5"
TTL: 60 seconds
```

**Example:**
```
ratelimit:192.168.1.1:/api/auth/login = 3 (TTL: 45s remaining)
```

#### Job Queues (BullMQ)
```
Queue: content-processing
Queue: schedule-execution
Queue: analytics-ingestion
Queue: email-notifications
```

**Queue Configuration:**
```javascript
{
  redis: redisClient,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100, // Keep last 100 completed
    removeOnFail: 500 // Keep last 500 failed
  }
}
```

### 5.4 ClickHouse Schema (Analytics)

#### Heartbeats Table
```sql
CREATE TABLE heartbeats (
  timestamp DateTime64(3),
  device_id String,
  organization_id String,
  status String, -- 'online', 'offline'
  cpu_usage Float32,
  memory_usage Float32,
  storage_used UInt64, -- bytes
  socket_latency_ms UInt32,
  metadata String -- JSON
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (organization_id, device_id, timestamp);
```

**Retention:**
- Keep 90 days of detailed data
- Aggregate to hourly after 30 days

#### Impressions Table
```sql
CREATE TABLE impressions (
  timestamp DateTime64(3),
  device_id String,
  organization_id String,
  content_id String,
  playlist_id String,
  duration_ms UInt32, -- How long displayed
  completed Boolean, -- Played to end?
  metadata String -- JSON
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (organization_id, device_id, timestamp);
```

**Analytics Queries:**
```sql
-- Content performance
SELECT
  content_id,
  count(*) as impressions,
  avg(duration_ms) as avg_duration,
  sum(completed) / count(*) as completion_rate
FROM impressions
WHERE organization_id = 'xxx'
  AND timestamp >= now() - INTERVAL 7 DAY
GROUP BY content_id
ORDER BY impressions DESC;
```

#### Playback Errors Table
```sql
CREATE TABLE playback_errors (
  timestamp DateTime64(3),
  device_id String,
  organization_id String,
  content_id String,
  error_type String, -- 'load_failed', 'timeout', 'cors', etc.
  error_message String,
  metadata String -- JSON with stack trace, etc.
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (organization_id, timestamp);
```

#### API Logs Table
```sql
CREATE TABLE api_logs (
  timestamp DateTime64(3),
  organization_id String,
  user_id String,
  method String, -- GET, POST, etc.
  endpoint String,
  status_code UInt16,
  response_time_ms UInt32,
  ip_address String,
  user_agent String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(timestamp)
ORDER BY (organization_id, timestamp);
```

**Performance Monitoring:**
```sql
-- Slow API endpoints
SELECT
  endpoint,
  quantile(0.95)(response_time_ms) as p95,
  quantile(0.99)(response_time_ms) as p99,
  count(*) as request_count
FROM api_logs
WHERE timestamp >= now() - INTERVAL 1 HOUR
GROUP BY endpoint
HAVING p95 > 500 -- Alert if p95 > 500ms
ORDER BY p95 DESC;
```

---

## 6. PROJECT STRUCTURE

### 6.1 Monorepo Layout

```
vizora/
├── apps/
│   ├── middleware/              # NestJS API Gateway
│   ├── realtime/                # Socket.IO Gateway
│   ├── web/                     # Next.js Admin Dashboard
│   ├── display/                 # Electron TV Client
│   └── public-site/             # Marketing Website
│
├── libs/
│   ├── shared-types/            # TypeScript interfaces
│   ├── database/                # Database clients
│   ├── auth/                    # Auth utilities
│   └── config/                  # Configuration
│
├── packages/
│   ├── ui-components/           # Shared React components
│   └── utils/                   # Common utilities
│
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.middleware
│   ├── Dockerfile.realtime
│   └── Dockerfile.web
│
├── scripts/
│   ├── setup-dev.sh
│   ├── seed-database.ts
│   └── generate-env.sh
│
├── docs/
│   ├── 01_VIZORA_CORE_PRD.md (this file)
│   ├── 02_VIZORA_API_SPECS.md
│   ├── 03_VIZORA_IMPLEMENTATION.md
│   ├── 04_VIZORA_FRONTEND_SPECS.md
│   └── 05_VIZORA_DEVOPS.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy-production.yml
│
├── .env.example
├── nx.json
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

### 6.2 Detailed App Structure

#### apps/middleware/
```
middleware/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   └── strategies/
│   │       └── jwt.strategy.ts
│   ├── users/
│   ├── organizations/
│   ├── devices/
│   ├── content/
│   ├── playlists/
│   ├── schedules/
│   ├── analytics/
│   ├── billing/
│   ├── storage/
│   ├── queue/
│   └── common/
│       ├── decorators/
│       ├── filters/
│       ├── interceptors/
│       └── pipes/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── test/
├── .env
└── package.json
```

#### apps/web/
```
web/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── devices/
│   │   │   ├── assets/
│   │   │   ├── playlists/
│   │   │   ├── schedules/
│   │   │   ├── analytics/
│   │   │   └── settings/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── dashboard/
│   │   ├── device-pairing/
│   │   ├── asset-manager/
│   │   └── playlist-builder/
│   ├── lib/
│   ├── hooks/
│   └── styles/
├── public/
├── .env.local
├── next.config.js
├── tailwind.config.js
└── package.json
```

---

## 7. DEVELOPMENT ENVIRONMENT

### 7.1 Prerequisites

**Required:**
- Node.js 22.x LTS
- pnpm 9.x
- Docker Desktop (for local databases)
- Git

**Optional but Recommended:**
- VS Code with extensions:
  - ESLint
  - Prettier
  - Prisma
  - Tailwind CSS IntelliSense
  - GitLens

### 7.2 Initial Setup

**Step 1: Clone and Install**
```bash
# Clone repository
git clone https://github.com/your-org/vizora.git
cd vizora

# Install pnpm globally
npm install -g pnpm@9

# Install dependencies
pnpm install
```

**Step 2: Start Databases**
```bash
# Start all services via Docker Compose
cd docker
docker-compose up -d

# Verify all containers running
docker-compose ps

# Expected output:
# NAME                  STATUS
# vizora-postgres       Up
# vizora-mongodb        Up
# vizora-redis          Up
# vizora-minio          Up
# vizora-clickhouse     Up
# vizora-grafana        Up
```

**Step 3: Configure Environment**
```bash
# Copy environment template
cp .env.example .env

# Edit .env with your values
# At minimum, set:
# - JWT_SECRET (generate with: openssl rand -base64 32)
# - DEVICE_JWT_SECRET (generate with: openssl rand -base64 32)
# - If using Clerk: CLERK_SECRET_KEY, CLERK_PUBLISHABLE_KEY
```

**Step 4: Initialize Databases**
```bash
# Run Prisma migrations (PostgreSQL)
cd apps/middleware
pnpm prisma migrate dev

# Seed data (optional)
pnpm run seed

# Initialize ClickHouse tables
docker exec -it vizora-clickhouse clickhouse-client < docker/clickhouse/init.sql
```

**Step 5: Start Development Servers**
```bash
# From root directory

# Start all apps concurrently
pnpm dev

# Or start individually:
pnpm nx serve middleware    # Port 3000
pnpm nx serve realtime      # Port 3001
pnpm nx serve web           # Port 3002
```

**Step 6: Verify Setup**
```bash
# Check API health
curl http://localhost:3000/health
# Expected: {"status":"ok"}

# Check Realtime Gateway
curl http://localhost:3001/health
# Expected: {"status":"ok"}

# Open Web Dashboard
open http://localhost:3002
```

### 7.3 Development Workflow

**Daily Workflow:**
```bash
# 1. Pull latest changes
git pull origin main

# 2. Install any new dependencies
pnpm install

# 3. Run database migrations (if any)
cd apps/middleware
pnpm prisma migrate dev

# 4. Start dev servers
pnpm dev

# 5. Run tests before committing
pnpm test

# 6. Lint and format
pnpm lint
pnpm format

# 7. Commit with conventional commits
git commit -m "feat(devices): add device nickname editing"
```

**Useful Commands:**
```bash
# Run specific app
pnpm nx serve middleware

# Run tests for specific app
pnpm nx test middleware

# Build specific app
pnpm nx build middleware

# Lint specific app
pnpm nx lint middleware

# Generate Prisma client after schema changes
cd apps/middleware
pnpm prisma generate

# View Prisma Studio (database GUI)
pnpm prisma studio

# Run all tests with coverage
pnpm test:coverage

# Type check entire monorepo
pnpm type-check
```

### 7.4 Database Management

**PostgreSQL (via Prisma):**
```bash
# Create new migration
pnpm prisma migrate dev --name add_locations_table

# Reset database (WARNING: deletes all data)
pnpm prisma migrate reset

# View database in Prisma Studio
pnpm prisma studio
# Opens at http://localhost:5555
```

**MongoDB:**
```bash
# Connect via MongoDB Compass
mongodb://localhost:27017

# Or via CLI
docker exec -it vizora-mongodb mongosh

# View collections
use vizora
show collections
db.contents.find().pretty()
```

**Redis:**
```bash
# Connect via CLI
docker exec -it vizora-redis redis-cli -a ${REDIS_PASSWORD}

# View keys
KEYS *

# Get pairing code
GET pairing:code:ABC123
```

**ClickHouse:**
```bash
# Connect via CLI
docker exec -it vizora-clickhouse clickhouse-client

# View tables
SHOW TABLES;

# Query heartbeats
SELECT * FROM heartbeats LIMIT 10;
```

### 7.5 Troubleshooting

**Common Issues:**

1. **Port already in use:**
```bash
# Find process using port
lsof -i :3000
# Kill process
kill -9 <PID>
```

2. **Docker containers not starting:**
```bash
# View logs
docker-compose logs postgres

# Restart specific service
docker-compose restart postgres

# Nuclear option: reset everything
docker-compose down -v
docker-compose up -d
```

3. **Prisma client out of sync:**
```bash
cd apps/middleware
pnpm prisma generate
```

4. **Node modules issues:**
```bash
# Clean install
rm -rf node_modules
rm pnpm-lock.yaml
pnpm install
```

---

## APPENDIX A: Glossary

**Terms:**
- **Device**: A display (TV, monitor) running the Vizora client application
- **Content**: Individual media asset (image, video, PDF, etc.)
- **Playlist**: Ordered sequence of content items with durations
- **Schedule**: CRON-based rule for when to play a playlist
- **Instant Publish**: Temporary playlist override (bypasses schedules)
- **Pairing**: Process of connecting a device to an organization
- **Heartbeat**: Periodic status update sent by device (every 15s)
- **Impression**: Single instance of content being displayed

**Acronyms:**
- **RBAC**: Role-Based Access Control
- **JWT**: JSON Web Token
- **CRON**: Command Run ON (scheduling syntax)
- **TTL**: Time To Live
- **CORS**: Cross-Origin Resource Sharing
- **CDN**: Content Delivery Network
- **SLA**: Service Level Agreement
- **GDPR**: General Data Protection Regulation
- **SOC 2**: Service Organization Control 2

---

## APPENDIX B: Decision Log

**Key Technical Decisions:**

| Decision | Options Considered | Chosen | Rationale |
|----------|-------------------|---------|-----------|
| Backend Framework | Express, NestJS, Fastify | **NestJS** | Enterprise-grade, TypeScript-first, modular |
| Frontend Framework | Next.js, Remix, Astro | **Next.js** | Best DX, SSR/SSG, largest ecosystem |
| Auth Provider | Custom JWT, Auth0, Clerk | **Clerk (recommended)** | Fast MVP, built-in UI, good DX |
| Relational DB | PostgreSQL, MySQL | **PostgreSQL** | Better JSON support, ACID, scalability |
| Document DB | MongoDB, DynamoDB, Firestore | **MongoDB** | Flexible schema, proven scale, self-hosted option |
| Cache/Queue | Redis, Memcached | **Redis** | Versatile, TTL support, pub/sub, queue backend |
| Analytics DB | ClickHouse, TimescaleDB, BigQuery | **ClickHouse** | Best columnar store, self-hosted, cost-effective |
| Object Storage | MinIO, S3, R2 | **MinIO (dev), S3/R2 (prod)** | S3-compatible, local dev support |
| Real-Time | Socket.IO, WebSockets, SSE | **Socket.IO** | Easiest to use, auto-reconnect, fallbacks |
| Payment | Stripe, Paddle, LemonSqueezy | **Stripe** | Industry standard, best API, most features |
| Monorepo | Nx, Turborepo, Lerna | **Nx** | Most mature, best caching, task orchestration |

---

## NEXT STEPS

**You should now:**
1. ✅ Understand Vizora's vision and architecture
2. ✅ Know the complete tech stack and rationale
3. ✅ Understand all database schemas
4. ✅ Be ready to set up development environment

**Next Documents:**
- **02_VIZORA_API_SPECS.md** - Complete API endpoint specifications
- **03_VIZORA_IMPLEMENTATION.md** - Phase-by-phase implementation guide
- **04_VIZORA_FRONTEND_SPECS.md** - UI/UX specifications and components
- **05_VIZORA_DEVOPS.md** - Deployment, CI/CD, monitoring

---

**Document End**

*This is a living document. Last updated: January 26, 2026*
