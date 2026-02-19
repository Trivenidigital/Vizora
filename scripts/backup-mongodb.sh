#!/usr/bin/env bash
#
# Vizora MongoDB Backup Script
# Creates a compressed, date-stamped mongodump archive.
#
# Usage:
#   ./scripts/backup-mongodb.sh
#
# Environment variables:
#   MONGODB_URL          - MongoDB connection string (required)
#   BACKUP_DIR           - Base backup directory (default: /var/backups/vizora)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load .env if MONGODB_URL is not set
if [[ -z "${MONGODB_URL:-}" && -f "$PROJECT_ROOT/.env" ]]; then
  set -a; source "$PROJECT_ROOT/.env"; set +a
fi

if [[ -z "${MONGODB_URL:-}" ]]; then
  echo "[ERROR] MONGODB_URL is not set." >&2
  exit 1
fi

BACKUP_DIR="${BACKUP_DIR:-/var/backups/vizora}/mongodb"
TIMESTAMP="$(date '+%Y%m%d_%H%M%S')"
ARCHIVE="$BACKUP_DIR/vizora_mongo_${TIMESTAMP}"

mkdir -p "$BACKUP_DIR"

echo "[INFO] Starting MongoDB backup..."
mongodump --uri="$MONGODB_URL" --out="$ARCHIVE" --quiet

# Compress the dump directory
tar -czf "${ARCHIVE}.tar.gz" -C "$BACKUP_DIR" "vizora_mongo_${TIMESTAMP}"
rm -rf "$ARCHIVE"

# Generate checksum
sha256sum "${ARCHIVE}.tar.gz" > "${ARCHIVE}.tar.gz.sha256"

BACKUP_SIZE="$(du -h "${ARCHIVE}.tar.gz" | cut -f1)"
echo "[INFO] MongoDB backup complete: ${ARCHIVE}.tar.gz ($BACKUP_SIZE)"

# Prune backups older than 7 days
DELETED=$(find "$BACKUP_DIR" -name "vizora_mongo_*.tar.gz" -type f -mtime +7 -print -delete 2>/dev/null | wc -l)
find "$BACKUP_DIR" -name "vizora_mongo_*.tar.gz.sha256" -type f -mtime +7 -delete 2>/dev/null || true
if [[ "$DELETED" -gt 0 ]]; then
  echo "[INFO] Pruned $DELETED old MongoDB backup(s)."
fi
