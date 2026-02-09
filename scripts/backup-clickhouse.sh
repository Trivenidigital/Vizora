#!/usr/bin/env bash
#
# Vizora ClickHouse Backup Script
# Creates a compressed SQL dump of ClickHouse analytics data.
#
# Usage:
#   ./scripts/backup-clickhouse.sh
#
# Environment variables:
#   CLICKHOUSE_HOST    - ClickHouse host (default: localhost)
#   CLICKHOUSE_PORT    - ClickHouse native port (default: 9000)
#   CLICKHOUSE_DB      - Database name (default: vizora_analytics)
#   BACKUP_DIR         - Base backup directory (default: /var/backups/vizora)

set -euo pipefail

CLICKHOUSE_HOST="${CLICKHOUSE_HOST:-localhost}"
CLICKHOUSE_PORT="${CLICKHOUSE_PORT:-9000}"
CLICKHOUSE_DB="${CLICKHOUSE_DB:-vizora_analytics}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/vizora}/clickhouse"
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
BACKUP_FILE="$BACKUP_DIR/vizora_clickhouse_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "[INFO] Starting ClickHouse backup for database '$CLICKHOUSE_DB'..."

# Get list of tables and dump each one
TABLES=$(clickhouse-client \
  --host="$CLICKHOUSE_HOST" \
  --port="$CLICKHOUSE_PORT" \
  --query="SHOW TABLES FROM $CLICKHOUSE_DB" 2>/dev/null)

{
  for TABLE in $TABLES; do
    echo "-- Table: $TABLE"
    clickhouse-client \
      --host="$CLICKHOUSE_HOST" \
      --port="$CLICKHOUSE_PORT" \
      --query="SHOW CREATE TABLE ${CLICKHOUSE_DB}.${TABLE}" 2>/dev/null
    echo ";"
    clickhouse-client \
      --host="$CLICKHOUSE_HOST" \
      --port="$CLICKHOUSE_PORT" \
      --query="SELECT * FROM ${CLICKHOUSE_DB}.${TABLE} FORMAT SQLInsert" 2>/dev/null || true
  done
} | gzip -9 > "$BACKUP_FILE"

# Generate checksum
sha256sum "$BACKUP_FILE" > "${BACKUP_FILE}.sha256"

BACKUP_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "[INFO] ClickHouse backup complete: $BACKUP_FILE ($BACKUP_SIZE)"

# Prune backups older than 4 weeks
DELETED=$(find "$BACKUP_DIR" -name "vizora_clickhouse_*.sql.gz" -type f -mtime +28 -print -delete 2>/dev/null | wc -l)
find "$BACKUP_DIR" -name "vizora_clickhouse_*.sql.gz.sha256" -type f -mtime +28 -delete 2>/dev/null || true
if [[ "$DELETED" -gt 0 ]]; then
  echo "[INFO] Pruned $DELETED old ClickHouse backup(s)."
fi
