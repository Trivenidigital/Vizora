# Vizora Docker Setup

This directory contains Docker infrastructure for Vizora plus optional
application Dockerfiles. docker-compose.yml starts infrastructure and observability services; application services run under PM2 in the current production topology.

## Quick Start

```bash
# Start infrastructure services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

## Services

Compose-managed infrastructure:

- **postgres** (5432): PostgreSQL database for users, organizations, devices
- **mongodb** (27017): MongoDB for content, playlists, schedules
- **redis** (6379): Redis for caching, sessions, job queue
- **minio** (9000, 9001): S3-compatible object storage
- **clickhouse** (8123, 9002): Analytics database
- **grafana** (3003): Observability dashboard
- **prometheus** (9090), **loki** (3100), **promtail**: Metrics and logs
- **nginx** (80, 443): Production reverse proxy profile

Application ports when started by PM2 or local dev commands:

- **middleware** (3000): NestJS API server
- **web** (3001): Next.js dashboard
- **realtime** (3002): Socket.IO WebSocket gateway

## Environment Variables

Copy `.env.example` to `.env` and update with your values:

```bash
cp ../.env.example .env
```

**Important:** Change all secrets and passwords in production!

## Database Setup

After starting infrastructure, run migrations from the repo root:

```bash
# Run Prisma migrations
pnpm --filter @vizora/database db:migrate

# Seed data (optional)
pnpm seed
```

## Health Checks

Check app service health after PM2 or local dev services are running:

```bash
# Middleware API
curl http://localhost:3000/api/v1/health

# Realtime Gateway
curl http://localhost:3002/api/health

# Web Dashboard
curl http://localhost:3001
```

## Logs

```bash
# All compose-managed infrastructure services
docker-compose logs -f

# App services
pm2 logs vizora-middleware
pm2 logs vizora-realtime
pm2 logs vizora-web
```

## Scaling

Middleware and web can be horizontally scaled only when containerized behind a
load balancer that preserves the documented port assignments. Realtime gateway MUST stay single-instance for Socket.IO room and device connection consistency.

## Production Deployment

For production:

1. Use strong passwords and secrets
2. Enable SSL/TLS
3. Set up proper firewall rules
4. Configure backup schedules
5. Set up monitoring and alerting
6. Start app services with `pm2 start ecosystem.config.js --env production`

## Backup

Backup databases:

```bash
# PostgreSQL
docker exec vizora-postgres pg_dump -U vizora_user vizora > backup.sql

# MongoDB
docker exec vizora-mongodb mongodump --out /backup

# ClickHouse
docker exec vizora-clickhouse clickhouse-client --query "BACKUP TABLE heartbeats TO Disk('backups', 'heartbeats.zip')"
```

## Troubleshooting

### Port conflicts
If ports are already in use, change them in `docker-compose.yml`.

### Permission errors
```bash
sudo chown -R $USER:$USER .
```

### Reset everything
```bash
docker-compose down -v
docker-compose up -d
```
