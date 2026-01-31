# Vizora - Digital Signage Management Platform

Vizora is a modern digital signage management system that allows businesses to manage and distribute content to display screens across multiple locations.

## Architecture Overview

Vizora follows a microservices architecture with the following components:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Vizora Platform                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐  │
│  │    Web      │     │  Middleware │     │   Realtime Gateway  │  │
│  │  (Next.js)  │────▶│   (NestJS)  │◀───▶│      (NestJS)       │  │
│  │  Port 3001  │     │  Port 3000  │     │     Port 3002       │  │
│  └─────────────┘     └──────┬──────┘     └──────────┬──────────┘  │
│                             │                       │              │
│                      ┌──────┴──────┐         ┌──────┴──────┐      │
│                      │  PostgreSQL │         │    Redis    │      │
│                      │  (Prisma)   │         │             │      │
│                      └─────────────┘         └─────────────┘      │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                    Display Clients (Electron)                 │ │
│  │           Connect via WebSocket to Realtime Gateway           │ │
│  └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
vizora/
├── middleware/          # Backend API (NestJS)
├── realtime/           # WebSocket gateway for device communication
├── web/                # Admin dashboard (Next.js)
├── display/            # Electron app for display devices
├── packages/
│   └── database/       # Shared Prisma database schema
├── docker-compose.yml  # Local development infrastructure
└── nx.json             # Nx monorepo configuration
```

## Prerequisites

- Node.js 20+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 15+ (or use Docker)
- Redis 7+ (or use Docker)

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Infrastructure

```bash
docker-compose up -d
```

This starts PostgreSQL and Redis containers.

### 3. Setup Database

```bash
# Generate Prisma client
pnpm --filter @vizora/database db:generate

# Run migrations
pnpm --filter @vizora/database db:migrate
```

### 4. Configure Environment

Copy the example environment files:

```bash
cp middleware/.env.example middleware/.env
cp realtime/.env.example realtime/.env
cp web/.env.example web/.env
```

Configure the following required variables:

```bash
# middleware/.env
DATABASE_URL=postgresql://vizora:vizora@localhost:5432/vizora
JWT_SECRET=your-secure-secret-min-32-chars
DEVICE_JWT_SECRET=your-device-secret-min-32-chars
REDIS_URL=redis://localhost:6379

# realtime/.env
REDIS_URL=redis://localhost:6379
DEVICE_JWT_SECRET=your-device-secret-min-32-chars

# web/.env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_SOCKET_URL=http://localhost:3002
```

### 5. Start Development Servers

```bash
# Start all services
pnpm dev

# Or start individually:
pnpm --filter @vizora/middleware serve
pnpm --filter @vizora/realtime serve
pnpm --filter @vizora/web dev
```

## Running Tests

```bash
# Unit tests
pnpm --filter @vizora/middleware test

# E2E tests (requires test database)
pnpm --filter @vizora/middleware test:e2e

# All tests with coverage
pnpm --filter @vizora/middleware test:all
```

## Security Features

Vizora implements comprehensive security measures:

- **Authentication**: JWT tokens stored in httpOnly cookies
- **CSRF Protection**: Double-submit cookie pattern
- **XSS Prevention**: Input sanitization on all user input
- **SSRF Protection**: URL validation blocking private IPs and cloud metadata endpoints
- **Rate Limiting**: Request throttling via @nestjs/throttler
- **File Validation**: Magic number verification to prevent MIME type spoofing
- **Token Security**: Device tokens hashed before database storage

## API Documentation

API documentation is available at `http://localhost:3000/api/docs` when running in development mode.

## Key Components

### Middleware (Backend API)

- User authentication and authorization
- Organization management
- Display device management
- Content and playlist management
- Scheduling system
- File upload handling

### Realtime Gateway

- WebSocket connections for display devices
- Real-time content updates
- Device heartbeat monitoring
- Command distribution

### Web Dashboard

- Organization administration
- Display management and monitoring
- Content library
- Playlist creation and scheduling
- Real-time device status

### Display Client

- Electron-based display application
- Device pairing flow
- Content playback
- Offline content caching
- Heartbeat reporting

## Environment Variables

### Middleware

| Variable | Description | Required |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Yes |
| JWT_SECRET | Secret for user JWT tokens (min 32 chars) | Yes |
| DEVICE_JWT_SECRET | Secret for device JWT tokens (min 32 chars) | Yes |
| REDIS_URL | Redis connection URL | Yes |
| BCRYPT_ROUNDS | Password hashing rounds (default: 14) | No |
| CORS_ORIGIN | Allowed CORS origins | No |

### Realtime

| Variable | Description | Required |
|----------|-------------|----------|
| REDIS_URL | Redis connection URL | Yes |
| DEVICE_JWT_SECRET | Secret for device JWT tokens | Yes |
| CORS_ORIGIN | Allowed CORS origins | No |

### Web

| Variable | Description | Required |
|----------|-------------|----------|
| NEXT_PUBLIC_API_URL | Backend API URL | Yes |
| NEXT_PUBLIC_SOCKET_URL | Realtime gateway URL | Yes |

## Contributing

1. Create a feature branch from `main`
2. Make your changes
3. Write/update tests
4. Run the test suite
5. Submit a pull request

## License

Proprietary - All rights reserved
