# Architecture Details

## System Diagram

```
                        Internet
                           |
                      [Nginx] (production only, profiles: ["production"])
                      /    |    \
                     /     |     \
              :3001  :3000  :3002
               Web   API   Realtime
              (Next) (Nest) (Nest+WS)
                |      |       |
                |      +-------+-----> PostgreSQL :5432 (Prisma)
                |      |       |-----> Redis :6379 (ioredis)
                |      |       |
                |      +-----> MongoDB :27017 (Mongoose, analytics)
                |      +-----> MinIO :9000 (S3 file storage)
                |      +-----> ClickHouse :8123 (analytics warehouse)
                |
                +----> API via fetch (cookie auth, /api/v1/*)
                +----> WebSocket via socket.io-client (:3002)

         [Monitoring Stack]
         Prometheus :9090 <-- scrapes /internal/metrics
         Grafana :3003 <-- dashboards
         Loki <-- log aggregation
         Promtail <-- log shipper

         [Display Clients]
         Electron (desktop) --ws--> :3002
         Android TV (Capacitor) --ws--> :3002
```

## Service Communication

### Web Dashboard to Middleware API
- HTTP REST via `apiClient` in `web/src/lib/api.ts`
- Cookie-based auth (httpOnly JWT cookie set by middleware)
- All endpoints prefixed `/api/v1/`
- Next.js config proxies `/api/*` to middleware in development

### Web Dashboard to Realtime Gateway
- Socket.IO client via `useSocket` hook
- Connects to `NEXT_PUBLIC_SOCKET_URL` (port 3002)
- Joins org room for live device status updates
- Events: `device:status`, `content:push`, `display:update`

### Middleware to Realtime
- Internal API calls using `INTERNAL_API_SECRET` for auth
- Used for triggering content pushes, device commands

### Display Client to Realtime Gateway
- Socket.IO connection with device JWT in handshake
- Joins `device:{deviceId}` and `org:{organizationId}` rooms
- Receives: content updates, playlist changes, commands
- Sends: heartbeat, status updates, impression data

## Data Flow: Content Upload

1. User uploads file via web dashboard (react-dropzone)
2. Web sends multipart POST to `POST /api/v1/content`
3. Middleware validates file (magic number verification, MIME check)
4. File stored in MinIO bucket `vizora-assets`
5. Sharp generates thumbnail
6. Content record created in PostgreSQL
7. Storage usage updated on Organization
8. If content assigned to active playlist on a device, middleware triggers realtime push

## Data Flow: Device Pairing

1. Admin clicks "Pair Device" in dashboard
2. Middleware generates 6-digit pairing code, stores in Redis (5min TTL)
3. QR code displayed in dashboard (qrcode.react)
4. Display client scans QR or enters code manually
5. Client sends code to `POST /api/v1/displays/pair`
6. Middleware validates code from Redis, creates Display record
7. Device receives device JWT for future authentication
8. Device connects to realtime gateway with device JWT
9. Gateway authenticates, joins device to appropriate rooms

## Data Flow: Template Rendering

1. Templates stored as Handlebars HTML in database (templateHtml field)
2. Each template has sampleData (JSON) for preview
3. Server-side: Handlebars.compile(templateHtml)(sampleData) for preview endpoint
4. Client-side: Same Handlebars compilation in browser for live preview
5. Display clients receive compiled HTML for rendering

## Database Schema (28 Models)

Core models: Organization, User, Display, Content, Playlist, PlaylistItem, Schedule
Supporting: DisplayGroup, DisplayGroupMember, Tag, ContentTag, DisplayTag
Content: ContentFolder, ContentImpression
Auth: PasswordResetToken, ApiKey
Billing: BillingTransaction, Plan, Promotion, PlanPromotion, PromotionRedemption
Admin: AuditLog, AdminAuditLog, SystemConfig, SystemAnnouncement, IpBlocklist
Support: SupportRequest, SupportMessage
Analytics: ContentImpression (also in MongoDB for time-series)

Key relationships:
- Organization has many: Users, Displays, Content, Playlists, Schedules
- Playlist has many: PlaylistItems (ordered, each references Content)
- Schedule references: Playlist + Display or DisplayGroup
- Display belongs to: Organization, optionally DisplayGroup
- Content belongs to: Organization, optionally ContentFolder

## Security Architecture

- Global Helmet headers
- CSRF middleware + guard (cookie-based tokens)
- Rate limiting: 3 tiers (short: 10/min, medium: 60/min, long: 1000/hour), 100x relaxed in dev/test
- SanitizeInterceptor on all responses (strips XSS)
- Input validation via class-validator DTOs
- File upload: magic number verification prevents MIME spoofing
- bcryptjs password hashing (configurable rounds via BCRYPT_ROUNDS)
- Dual JWT: user tokens (JWT_SECRET) vs device tokens (DEVICE_JWT_SECRET)
- API keys: scoped, hashed storage

## CI/CD Pipelines

`.github/workflows/ci.yml` -- main pipeline:
- Triggers: push to main/master/develop, PRs
- Jobs: lint, test (middleware + realtime), build (all 3 via Nx), E2E (Playwright), security audit
- Docker services: postgres, redis, mongodb
- Coverage uploaded to Codecov

`.github/workflows/docker-build.yml` -- container builds on `v*` tags:
- Matrix: middleware, realtime, web
- Registry: GitHub Container Registry (ghcr.io)
- Tags: semver + git SHA

`.github/workflows/security-audit.yml` -- Node security audit

## PM2 Production Configuration

```
ecosystem.config.js:
  middleware     x2 cluster  (memory limit, exponential backoff)
  realtime       x1 fork     (WebSocket state consistency)
  web            x1 fork     (Next.js)
  health-guardian  cron 5min
  content-lifecycle cron 15min
  fleet-manager    cron 10min
  schedule-doctor  cron 15min
  ops-reporter     cron 30min
  db-maintainer    cron daily 3am
```
