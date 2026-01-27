# Vizora Docker Setup

This directory contains Docker configuration for running Vizora in production.

## Quick Start

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose down -v
```

## Services

- **postgres** (5432): PostgreSQL database for users, organizations, devices
- **mongodb** (27017): MongoDB for content, playlists, schedules
- **redis** (6379): Redis for caching, sessions, job queue
- **minio** (9000, 9001): S3-compatible object storage
- **clickhouse** (8123, 9002): Analytics database
- **middleware** (3000): NestJS API server
- **realtime** (3001): Socket.IO WebSocket gateway
- **web** (3002): Next.js dashboard

## Environment Variables

Copy `.env.example` to `.env` and update with your values:

```bash
cp ../.env.example .env
```

**Important:** Change all secrets and passwords in production!

## Database Setup

After starting services, run migrations:

```bash
# Run Prisma migrations
docker exec vizora-middleware pnpm prisma migrate deploy

# Seed data (optional)
docker exec vizora-middleware pnpm run seed
```

## Health Checks

Check service health:

```bash
# Middleware API
curl http://localhost:3000/api/health

# Realtime Gateway
curl http://localhost:3001/api/health

# Web Dashboard
curl http://localhost:3002
```

## Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f middleware
docker-compose logs -f realtime
docker-compose logs -f web
```

## Scaling

Scale specific services:

```bash
# Scale middleware to 3 instances
docker-compose up -d --scale middleware=3

# Scale realtime to 2 instances
docker-compose up -d --scale realtime=2
```

## Production Deployment

For production:

1. Use strong passwords and secrets
2. Enable SSL/TLS
3. Set up proper firewall rules
4. Configure backup schedules
5. Set up monitoring and alerting
6. Use container orchestration (Kubernetes recommended)

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
