# Backup and Restoration Guide

This document describes backup procedures for all Vizora data stores.

## Infrastructure Overview

| Service | Data Store | Container | Volume |
|---|---|---|---|
| PostgreSQL 16 | Primary database (users, orgs, displays, content, playlists, schedules) | `vizora-postgres` | `postgres_data` |
| MongoDB 7 | Analytics and logs | `vizora-mongodb` | `mongodb_data` |
| MinIO | Content files (images, videos, documents) | `vizora-minio` | `minio_data` |
| ClickHouse 24 | Device metrics and heartbeat time-series | `vizora-clickhouse` | `clickhouse_data` |
| Redis 7 | Session cache, device status, rate limiting | `vizora-redis` | `redis_data` |

## PostgreSQL Backup

PostgreSQL is the primary data store. Use the provided backup script for automated backups.

### Using the Backup Script

```bash
# Run the backup script
./scripts/backup-db.sh
```

The script (`scripts/backup-db.sh`) automatically:
- Creates compressed, timestamped backups using `pg_dump`
- Manages three retention tiers: daily, weekly (Sundays), monthly (1st)
- Prunes old backups based on configurable retention periods

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | (required) | PostgreSQL connection string |
| `BACKUP_DIR` | `/var/backups/vizora` | Directory for backup storage |
| `BACKUP_RETENTION_DAYS` | `7` | Days to keep daily backups |

**Backup directory structure:**
```
/var/backups/vizora/
  daily/      # 7 days of daily backups
  weekly/     # 4 weeks of Sunday backups
  monthly/    # 3 months of first-of-month backups
```

### Manual PostgreSQL Backup

```bash
# Full database dump (compressed)
pg_dump -h localhost -U postgres -d vizora --no-owner --no-privileges --clean --if-exists | gzip -9 > vizora_$(date +%Y%m%d_%H%M%S).sql.gz

# Schema only (for documentation/review)
pg_dump -h localhost -U postgres -d vizora --schema-only > vizora_schema.sql

# Specific tables only
pg_dump -h localhost -U postgres -d vizora -t '"User"' -t '"Organization"' -t '"Display"' | gzip > vizora_core_tables.sql.gz
```

### PostgreSQL Restoration

```bash
# Restore from compressed backup
gunzip -c vizora_backup_20260209_030000.sql.gz | psql -h localhost -U postgres -d vizora

# Restore to a new database (recommended for verification)
createdb -h localhost -U postgres vizora_restored
gunzip -c vizora_backup_20260209_030000.sql.gz | psql -h localhost -U postgres -d vizora_restored

# Verify restoration
psql -h localhost -U postgres -d vizora_restored -c "SELECT count(*) FROM \"User\";"
psql -h localhost -U postgres -d vizora_restored -c "SELECT count(*) FROM \"Display\";"
psql -h localhost -U postgres -d vizora_restored -c "SELECT count(*) FROM \"Content\";"
```

## MongoDB Backup

MongoDB stores analytics data and extended logs.

### Backup

```bash
# Full database dump (compressed)
mongodump \
  --uri="mongodb://mongoadmin:${MONGO_PASSWORD}@localhost:27017" \
  --authenticationDatabase=admin \
  --db=vizora \
  --gzip \
  --out="/var/backups/vizora/mongodb/$(date +%Y%m%d_%H%M%S)"

# Single collection
mongodump \
  --uri="mongodb://mongoadmin:${MONGO_PASSWORD}@localhost:27017" \
  --authenticationDatabase=admin \
  --db=vizora \
  --collection=analytics \
  --gzip \
  --out="/var/backups/vizora/mongodb/analytics_$(date +%Y%m%d)"
```

### Restoration

```bash
# Restore full database
mongorestore \
  --uri="mongodb://mongoadmin:${MONGO_PASSWORD}@localhost:27017" \
  --authenticationDatabase=admin \
  --gzip \
  --drop \
  /var/backups/vizora/mongodb/20260209_030000/vizora

# Restore single collection
mongorestore \
  --uri="mongodb://mongoadmin:${MONGO_PASSWORD}@localhost:27017" \
  --authenticationDatabase=admin \
  --gzip \
  --drop \
  --nsInclude="vizora.analytics" \
  /var/backups/vizora/mongodb/analytics_20260209/
```

## MinIO Backup

MinIO stores uploaded content files (images, videos, documents, screenshots).

### Backup Using mc (MinIO Client)

```bash
# Install MinIO client if not present
# https://min.io/docs/minio/linux/reference/minio-mc.html

# Configure MinIO alias
mc alias set vizora http://localhost:9000 ${MINIO_ROOT_USER:-minioadmin} ${MINIO_ROOT_PASSWORD:-minioadmin}

# Mirror (sync) all buckets to a backup location
mc mirror vizora/ /var/backups/vizora/minio/$(date +%Y%m%d)/

# Mirror a specific bucket
mc mirror vizora/vizora-content /var/backups/vizora/minio/content_$(date +%Y%m%d)/

# List all buckets and their sizes
mc du vizora/
```

### Backup Using Docker Volume

```bash
# Stop MinIO temporarily for consistent backup
docker-compose -f docker/docker-compose.yml stop minio

# Backup the Docker volume
docker run --rm \
  -v vizora_minio_data:/data \
  -v /var/backups/vizora/minio:/backup \
  alpine tar czf /backup/minio_data_$(date +%Y%m%d).tar.gz -C /data .

# Restart MinIO
docker-compose -f docker/docker-compose.yml start minio
```

### MinIO Restoration

```bash
# Using mc (online restore)
mc mirror /var/backups/vizora/minio/20260209/ vizora/

# Using Docker volume (offline restore)
docker-compose -f docker/docker-compose.yml stop minio
docker run --rm \
  -v vizora_minio_data:/data \
  -v /var/backups/vizora/minio:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/minio_data_20260209.tar.gz -C /data"
docker-compose -f docker/docker-compose.yml start minio
```

## ClickHouse Backup

ClickHouse stores device metrics and heartbeat time-series data.

### Backup

```bash
# Using clickhouse-client to export tables
clickhouse-client --host localhost --port 9000 \
  --query "SELECT * FROM vizora.device_heartbeats FORMAT Native" \
  | gzip > /var/backups/vizora/clickhouse/heartbeats_$(date +%Y%m%d).native.gz

clickhouse-client --host localhost --port 9000 \
  --query "SELECT * FROM vizora.content_impressions FORMAT Native" \
  | gzip > /var/backups/vizora/clickhouse/impressions_$(date +%Y%m%d).native.gz

# Using Docker volume snapshot
docker-compose -f docker/docker-compose.yml stop clickhouse
docker run --rm \
  -v vizora_clickhouse_data:/data \
  -v /var/backups/vizora/clickhouse:/backup \
  alpine tar czf /backup/clickhouse_data_$(date +%Y%m%d).tar.gz -C /data .
docker-compose -f docker/docker-compose.yml start clickhouse
```

### ClickHouse Restoration

```bash
# Using Native format import
gunzip -c /var/backups/vizora/clickhouse/heartbeats_20260209.native.gz \
  | clickhouse-client --host localhost --port 9000 \
    --query "INSERT INTO vizora.device_heartbeats FORMAT Native"

# Using Docker volume restore
docker-compose -f docker/docker-compose.yml stop clickhouse
docker run --rm \
  -v vizora_clickhouse_data:/data \
  -v /var/backups/vizora/clickhouse:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/clickhouse_data_20260209.tar.gz -C /data"
docker-compose -f docker/docker-compose.yml start clickhouse
```

## Redis

Redis stores ephemeral data (device status cache, session data, rate limiting counters). It is **not critical to back up** since all persistent state is in PostgreSQL. However, if you want to preserve session state:

```bash
# Trigger a Redis snapshot
redis-cli -a ${REDIS_PASSWORD} BGSAVE

# Copy the RDB file
docker cp vizora-redis:/data/dump.rdb /var/backups/vizora/redis/dump_$(date +%Y%m%d).rdb

# Restore: copy the RDB file back and restart Redis
docker cp /var/backups/vizora/redis/dump_20260209.rdb vizora-redis:/data/dump.rdb
docker-compose -f docker/docker-compose.yml restart redis
```

## Recommended Backup Schedule

| Data Store | Frequency | Retention | Priority |
|---|---|---|---|
| PostgreSQL | Daily (automated via `backup-db.sh`) | 7 daily, 4 weekly, 3 monthly | Critical |
| MinIO | Weekly (full mirror) | 4 weekly snapshots | High |
| MongoDB | Weekly | 4 weekly snapshots | Medium |
| ClickHouse | Weekly | 4 weekly snapshots | Medium |
| Redis | Not required (ephemeral) | N/A | Low |

### Cron Configuration

```bash
# Add to crontab (crontab -e):

# PostgreSQL: daily at 3:00 AM
0 3 * * * /path/to/vizora/scripts/backup-db.sh >> /var/log/vizora-backup.log 2>&1

# MinIO: weekly on Sunday at 4:00 AM
0 4 * * 0 mc mirror vizora/ /var/backups/vizora/minio/$(date +\%Y\%m\%d)/ >> /var/log/vizora-minio-backup.log 2>&1

# MongoDB: weekly on Sunday at 4:30 AM
30 4 * * 0 mongodump --uri="mongodb://mongoadmin:${MONGO_PASSWORD}@localhost:27017" --authenticationDatabase=admin --db=vizora --gzip --out="/var/backups/vizora/mongodb/$(date +\%Y\%m\%d)" >> /var/log/vizora-mongo-backup.log 2>&1

# ClickHouse: weekly on Sunday at 5:00 AM
0 5 * * 0 docker-compose -f /path/to/vizora/docker/docker-compose.yml stop clickhouse && docker run --rm -v vizora_clickhouse_data:/data -v /var/backups/vizora/clickhouse:/backup alpine tar czf /backup/clickhouse_data_$(date +\%Y\%m\%d).tar.gz -C /data . && docker-compose -f /path/to/vizora/docker/docker-compose.yml start clickhouse >> /var/log/vizora-clickhouse-backup.log 2>&1
```

## Backup Verification

Regularly verify that backups can be restored. Run this monthly:

### PostgreSQL Verification

```bash
# Create a temporary database and restore
createdb -h localhost -U postgres vizora_verify
gunzip -c /var/backups/vizora/daily/vizora_backup_latest.sql.gz | psql -h localhost -U postgres -d vizora_verify

# Verify row counts match production
psql -h localhost -U postgres -d vizora_verify -c "
  SELECT 'User' as table_name, count(*) FROM \"User\"
  UNION ALL SELECT 'Organization', count(*) FROM \"Organization\"
  UNION ALL SELECT 'Display', count(*) FROM \"Display\"
  UNION ALL SELECT 'Content', count(*) FROM \"Content\"
  UNION ALL SELECT 'Playlist', count(*) FROM \"Playlist\"
  UNION ALL SELECT 'Schedule', count(*) FROM \"Schedule\";
"

# Clean up
dropdb -h localhost -U postgres vizora_verify
```

### MinIO Verification

```bash
# Compare object counts between production and backup
mc ls --summarize vizora/vizora-content/ | tail -1
ls -la /var/backups/vizora/minio/latest/vizora-content/ | wc -l
```

## Disaster Recovery

### Full System Restore

In the event of a total failure, restore in this order:

1. **Infrastructure:** Start Docker containers (`docker-compose up -d`)
2. **PostgreSQL:** Restore from the latest backup (this is the source of truth)
3. **Run Prisma migrations:** `pnpm --filter @vizora/database db:migrate` (ensures schema is current)
4. **MinIO:** Restore content files from the latest mirror
5. **ClickHouse:** Restore metrics data (non-critical; can be skipped if urgency requires it)
6. **Start application services:** `pm2 start ecosystem.config.js --env production`
7. **Verify:** Check dashboard loads, devices reconnect, content is accessible

### Partial Data Loss

If only one service is affected:
- **PostgreSQL lost:** Restore from backup, restart middleware and realtime
- **MinIO lost:** Restore files; content metadata in PostgreSQL points to MinIO keys
- **ClickHouse lost:** Analytics history is lost but system remains functional; restart clickhouse container
- **Redis lost:** Restart Redis; all sessions are invalidated (users re-login, devices reconnect automatically)
