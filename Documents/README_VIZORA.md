# Vizora - Cloud-Based Digital Signage Platform

A modern, hardware-free digital signage solution that runs natively on smart TVs and browsers.

## ✨ Features

- **Zero Hardware Cost** - No Fire Sticks, Raspberry Pi, or additional hardware required
- **5-Minute Setup** - QR code pairing for instant device onboarding
- **Real-Time Updates** - Instant content publishing via WebSocket
- **Comprehensive Content** - Images, videos, PDFs, webpages, dashboards, and live data feeds
- **Smart Scheduling** - CRON-based automated content scheduling
- **Analytics** - Real-time device monitoring and content performance metrics

## 🚀 Tech Stack

- **Backend**: NestJS 11, Node.js 22
- **Frontend**: Next.js 14, React 19, Tailwind CSS
- **Display Client**: Electron 28
- **Databases**: PostgreSQL 16, MongoDB 7, Redis 7, ClickHouse 24
- **Storage**: MinIO (S3-compatible)
- **Real-Time**: Socket.IO 4.7

## 📦 Quick Start

### Prerequisites

- Node.js 22.x
- pnpm 9.x
- Docker & Docker Compose

### Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/vizora.git
cd vizora

# Install dependencies
pnpm install

# Start databases
cd docker
docker-compose up -d

# Run migrations
cd ../packages/database
pnpm prisma migrate dev

# Start development servers
cd ../..
pnpm dev
```

This will start:
- Middleware API: http://localhost:3000
- Realtime Gateway: http://localhost:3001
- Web Dashboard: http://localhost:3002

## 🏗️ Project Structure

```
vizora/
├── middleware/          # NestJS API Gateway
├── realtime/           # Socket.IO WebSocket server
├── web/                # Next.js Admin Dashboard
├── display/            # Electron TV Client
├── packages/
│   ├── database/       # Prisma schema & migrations
│   └── shared/         # Shared types & utilities
├── docker/             # Docker configuration
└── docs/               # Documentation
```

## 🔥 Implementation Status

### ✅ Phase 1-3: Foundation (95-100%)
- [x] PRD and Architecture
- [x] Database schemas (PostgreSQL, MongoDB)
- [x] Middleware API (Auth, Users, Devices, Content)
- [x] Shared packages

### ✅ Phase 4: Realtime WebSocket Server (100%)
- [x] Device Gateway with Socket.IO
- [x] Redis service for caching and pub/sub
- [x] Heartbeat service
- [x] Playlist service

### ✅ Phase 5: Display Client (100%)
- [x] Electron main process
- [x] Device pairing flow
- [x] Socket.IO client integration
- [x] Content playback engine
- [x] Renderer UI

### ✅ Phase 6: Web Dashboard (100%)
- [x] Next.js 14 with App Router
- [x] Authentication pages (login, register)
- [x] Dashboard layout with navigation
- [x] Devices management page
- [x] Content management page
- [x] Playlists page
- [x] Schedules page
- [x] Analytics page
- [x] Settings page

### ✅ Phase 7: Testing & Docker (100%)
- [x] Docker Compose configuration
- [x] Dockerfiles for all services
- [x] ClickHouse initialization
- [x] CI/CD workflows (GitHub Actions)
- [x] Complete documentation

## 🐳 Deployment

### Using Docker Compose

```bash
cd docker
docker-compose up -d
```

See `docker/README.md` for detailed deployment instructions.

## 📖 Documentation

- [Core PRD](./01_VIZORA_CORE_PRD.md)
- [API Specifications](./02_VIZORA_API_SPECS.md)
- [Implementation Guide](./03_VIZORA_IMPLEMENTATION_GUIDE.md)
- [Frontend Specs](./04_VIZORA_FRONTEND_SPECS.md)
- [DevOps Guide](./05_VIZORA_DEVOPS.md)

## 🎯 Roadmap

### Phase 1 (MVP) - Q1 2026 ✅ COMPLETE
- [x] Core platform features
- [x] Device pairing
- [x] Content management
- [x] Playlist system
- [x] Basic scheduling
- [x] All 7 phases implemented

### Phase 2 (AI Integration) - Q2 2026
- [ ] AI content generation
- [ ] Predictive scheduling
- [ ] Autonomous optimization

### Phase 3 (Enterprise) - Q3 2026
- [ ] SSO integration
- [ ] Advanced RBAC
- [ ] White-label support
- [ ] API marketplace

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

Proprietary - All Rights Reserved

## 💬 Support

- Documentation: `/docs`
- Issues: https://github.com/your-org/vizora/issues

## 👏 Credits

Built with ❤️ by the Vizora Team

**Co-Authored-By:** Claude Sonnet 4.5 <noreply@anthropic.com>

---

**🎉 ALL 7 PHASES COMPLETE - MVP READY FOR DEPLOYMENT!**
